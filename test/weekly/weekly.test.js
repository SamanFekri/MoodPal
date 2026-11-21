const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const weekly = require('../../src/weekly/service');

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

describe('weekly review', () => {
  const cron = process.env.WEEKLY_CRON_JOB_TIME;
  before(() => { process.env.WEEKLY_CRON_JOB_TIME = '0 7 * * 1'; });
  after(() => { process.env.WEEKLY_CRON_JOB_TIME = cron; });

  test('defaults come from WEEKLY_CRON_JOB_TIME; anything unusual falls back to Monday 07:00', () => {
    assert.deepEqual(weekly.defaultsFromCron('0 7 * * 1'), { day: 1, time: '07:00' });
    assert.deepEqual(weekly.defaultsFromCron('30 18 * * 5'), { day: 5, time: '18:30' });
    assert.deepEqual(weekly.defaultsFromCron('"0 9 * * 0"'), { day: 0, time: '09:00' });
    assert.deepEqual(weekly.defaultsFromCron('*/5 * * * *'), { day: 1, time: '07:00' });
    assert.deepEqual(weekly.defaultsFromCron(''), { day: 1, time: '07:00' });
  });

  test('the next review is their day and time in their own timezone', () => {
    // Friday 2026-11-20 12:00 UTC; Monday 07:00 in Tehran (UTC+3:30) is 03:30 UTC on the 23rd
    const now = new Date('2026-11-20T12:00:00Z');
    assert.equal(weekly.nextWeekly(1, '07:00', 'Asia/Tehran', now).toISOString(), '2026-11-23T03:30:00.000Z');
    assert.equal(weekly.nextWeekly(5, '18:00', 'Europe/Berlin', now).toISOString(), '2026-11-20T17:00:00.000Z', 'later today');
    assert.equal(weekly.nextWeekly(5, '09:00', 'Europe/Berlin', now).toISOString(), '2026-11-27T08:00:00.000Z', 'today already passed: next week');
  });

  test('once a week: moving the day never brings the next one within 6 days of the last', () => {
    const now = new Date('2026-11-23T08:00:00Z');   // Monday, review just sent
    const user = { timezone: 'Europe/Berlin', weekly_review: { day: 3, time: '09:00', last_sent_at: now } };
    // they move it to Wednesday: not this Wednesday (2 days later) but the next one
    assert.equal(weekly.nextFor(user, now).toISOString(), '2026-12-02T08:00:00.000Z');
    // switched off: nothing scheduled
    assert.equal(weekly.nextFor({ ...user, weekly_review: { ...user.weekly_review, enabled: false } }, now), null);
  });

  describe('worker and settings', () => {
    let sara, ali, server, base;
    const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

    before(async () => { weekly._setGap(0); await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
    after(async () => { server.close(); weekly._setSender(null); await db.disconnect(); });
    beforeEach(async () => {
      await db.clear();
      weekly.state.paused_until = null;
      sara = await User.create({ id: 8001, first_name: 'Sara', timezone: 'Europe/Berlin' });
      ali = await User.create({ id: 8002, first_name: 'Ali', timezone: 'Asia/Tehran' });
    });

    test('the worker schedules everyone, sends each due review once, and books the next one a week later', async () => {
      const sent = [];
      weekly._setSender(async (u) => { sent.push(u.id); return true; });
      const fri = new Date('2026-11-20T12:00:00Z');
      await weekly.tick(fri);
      assert.deepEqual(sent, [], 'first pass only schedules');
      assert.equal((await User.findById(sara._id)).weekly_review.next_at.toISOString(), '2026-11-23T06:00:00.000Z', 'Monday 07:00 Berlin');
      assert.equal((await User.findById(ali._id)).weekly_review.next_at.toISOString(), '2026-11-23T03:30:00.000Z', 'Monday 07:00 Tehran');

      await weekly.tick(new Date('2026-11-23T04:00:00Z'));
      assert.deepEqual(sent, [8002], 'Tehran first');
      await weekly.tick(new Date('2026-11-23T06:01:00Z'));
      await weekly.tick(new Date('2026-11-23T06:02:00Z'));
      assert.deepEqual(sent, [8002, 8001], 'each once');
      const s = await User.findById(sara._id);
      assert.equal(s.weekly_review.next_at.toISOString(), '2026-11-30T06:00:00.000Z', 'the next Monday');
    });

    test('the queue: oldest first, one at a time; a 429 pauses everything and puts that person back in line', async () => {
      await User.updateOne({ _id: sara._id }, { 'weekly_review.next_at': new Date('2026-11-23T06:00:00Z') });
      await User.updateOne({ _id: ali._id }, { 'weekly_review.next_at': new Date('2026-11-23T03:30:00Z') });
      const carol = await User.create({ id: 8003, first_name: 'Carol', timezone: 'Europe/Berlin', weekly_review: { next_at: new Date('2026-11-23T05:00:00Z') } });
      const sent = [];
      let limited = true;
      weekly._setSender(async (u) => {
        if (u.id === 8003 && limited) { limited = false; throw Object.assign(new Error('Too Many Requests'), { code: 429, parameters: { retry_after: 30 } }); }
        sent.push(u.id); return true;
      });
      const now = new Date('2026-11-23T07:00:00Z');
      await weekly.tick(now);
      assert.deepEqual(sent, [8002], 'Ali (oldest) went out, then Carol hit the limit and the queue stopped');
      assert.equal(weekly.state.paused_until.toISOString(), '2026-11-23T07:00:30.000Z', 'paused for retry_after');
      const c = await User.findById(carol._id);
      assert.equal(c.weekly_review.last_sent_at, null, 'Carol is not marked as sent');
      assert.ok(c.weekly_review.next_at <= weekly.state.paused_until, 'and goes first when the pause ends');

      await weekly.tick(new Date('2026-11-23T07:00:10Z'));
      assert.deepEqual(sent, [8002], 'nothing while paused');
      weekly.state.paused_until = null;
      await weekly.tick(new Date('2026-11-23T07:01:00Z'));
      assert.deepEqual(sent.sort(), [8001, 8002, 8003], 'everyone once');
    });

    test('a failed review is retried later, at most twice; someone who blocked the bot is not', async () => {
      await User.updateOne({ _id: sara._id }, { 'weekly_review.next_at': new Date('2026-11-23T06:00:00Z') });
      await User.updateOne({ _id: ali._id }, { 'weekly_review.enabled': false });
      let calls = 0;
      weekly._setSender(async () => { calls++; throw new Error('chart failed'); });
      let t = new Date('2026-11-23T07:00:00Z');
      for (let i = 0; i < 4; i++) { await weekly.tick(t); t = new Date(t.getTime() + 16 * 60 * 1000); }
      assert.equal(calls, 3, 'first try + 2 retries, then it waits for next week');
      const s = await User.findById(sara._id);
      assert.ok(s.weekly_review.next_at > new Date('2026-11-29T00:00:00Z'), 'next week');

      calls = 0;
      await User.updateOne({ _id: sara._id }, { 'weekly_review.next_at': t, 'weekly_review.attempts': 0 });
      weekly._setSender(async () => { calls++; throw Object.assign(new Error('Forbidden: bot was blocked by the user'), { code: 403 }); });
      await weekly.tick(new Date(t.getTime() + 1000));
      await weekly.tick(new Date(t.getTime() + 20 * 60 * 1000));
      assert.equal(calls, 1, 'blocked: no retry');
    });

    test('Settings: pick a day and time, switch it off, back to default; the timezone moves it', async () => {
      let r = await api('/api/me/settings', { as: sara });
      assert.equal(r.body.weekly.enabled, true);
      assert.equal(r.body.weekly.day, 1); assert.equal(r.body.weekly.time, '07:00'); assert.equal(r.body.weekly.custom, false);

      r = await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { day: 0, time: '20:30' } });
      assert.equal(r.status, 200);
      assert.equal(r.body.weekly.day, 0); assert.equal(r.body.weekly.time, '20:30'); assert.equal(r.body.weekly.custom, true);
      const next = new Date(r.body.weekly.next_at);
      assert.equal(next.toLocaleString('en-US', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), 'Sun 20:30');

      // a new timezone moves the review with it
      await api('/api/me/settings/timezone', { as: sara, method: 'POST', body: { timezone: 'Asia/Tehran' } });
      const moved = (await User.findById(sara._id)).weekly_review.next_at;
      assert.equal(moved.toLocaleString('en-US', { timeZone: 'Asia/Tehran', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), 'Sun 20:30');

      r = await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { enabled: false } });
      assert.equal(r.body.weekly.enabled, false); assert.equal(r.body.weekly.next_at, null);
      const sent = [];
      weekly._setSender(async (u) => { sent.push(u.id); return true; });
      await weekly.tick(new Date(Date.now() + 30 * 24 * 3600 * 1000));
      assert.ok(!sent.includes(8001), 'switched off: never sent');

      r = await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { enabled: true, day: null, time: null } });
      assert.equal(r.body.weekly.day, 1); assert.equal(r.body.weekly.custom, false);

      // the review's language: the app's by default, or one they pick
      assert.equal(r.body.weekly.language, null);
      assert.deepEqual(r.body.weekly.languages.map(l => l.code), ['en', 'fa', 'ru']);
      r = await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { language: 'fa' } });
      assert.equal(r.body.weekly.language, 'fa');
      assert.equal((await User.findById(sara._id)).weekly_review.language, 'fa');
      r = await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { language: null } });
      assert.equal(r.body.weekly.language, null);
      assert.equal((await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { language: 'de' } })).body.error, 'invalid_language');

      assert.equal((await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { day: 9 } })).body.error, 'invalid_day');
      assert.equal((await api('/api/me/settings/weekly', { as: sara, method: 'POST', body: { time: '25:00' } })).body.error, 'invalid_time');
    });
  });
});
