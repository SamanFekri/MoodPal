const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.BOT_USERNAME = process.env.BOT_USERNAME || 'MoodPalBot';
process.env.CRON_JOB_TIME = '* 7,21 * * *';
delete process.env.REMINDER_TIMEZONE;
delete process.env.TZ;

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const AppConfig = require('../../src/models/app_config');
const ReminderJob = require('../../src/models/reminder_job');
const reminders = require('../../src/reminders/service');
const time = require('../../src/reminders/time');
const { setTelegram } = require('../../src/utils/telegram');
const { timezoneCommand, timezoneCallback, TZ_PREFIX } = require('../../src/commands/reminders');

// records sends; `fail` decides per call whether to throw a Telegram-shaped error
function fakeTelegram(fail = () => null) {
  const sent = [];
  return {
    sent,
    async sendMessage(chatId, text, extra) {
      const err = fail(chatId, sent.length);
      if (err) throw err;
      sent.push({ chatId, text, extra });
      return { message_id: sent.length };
    },
  };
}
const tgError = (code, description, parameters) => Object.assign(new Error(description), { code, description, parameters, response: { error_code: code, description, parameters } });

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

describe('reminders', () => {
  let server, base;
  const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  before(async () => {
    await db.connect();
    await ReminderJob.init();   // unique index must exist before the dedupe test
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    reminders.invalidate();
    reminders.state.paused_until = null;
  });

  describe('time', () => {
    test('default times come from CRON_JOB_TIME in .env', () => {
      assert.deepEqual(time.timesFromCron('* 7,21 * * *'), ['07:00', '21:00']);
      assert.deepEqual(time.timesFromCron('30 9 * * *'), ['09:30']);
      assert.equal(time.timesFromCron('*/5 * * * *'), null, 'not a daily hour list');
      assert.deepEqual(time.envDefaultTimes(), ['07:00', '21:00']);
    });

    test('next occurrence respects the timezone and rolls over to tomorrow', () => {
      const at = new Date('2026-09-29T10:00:00Z');
      assert.equal(time.nextOccurrence(['07:00', '21:00'], 'UTC', at).toISOString(), '2026-09-29T21:00:00.000Z');
      assert.equal(time.nextOccurrence(['07:00', '21:00'], 'Asia/Tehran', at).toISOString(), '2026-09-29T17:30:00.000Z');
      assert.equal(time.nextOccurrence(['07:00'], 'UTC', at).toISOString(), '2026-09-30T07:00:00.000Z');
      assert.equal(time.nextOccurrence(['23:59'], 'America/Los_Angeles', new Date('2026-12-31T23:00:00Z')).toISOString(), '2027-01-01T07:59:00.000Z');
      assert.equal(time.nextOccurrence([], 'UTC', at), null);
    });
  });

  describe('timezones', () => {
    test('search finds zones by city, partial name, full id or UTC offset', () => {
      const at = new Date('2026-09-29T10:00:00Z');   // summer time in the north
      assert.deepEqual(time.searchTimezones('tehran', 8, at), ['Asia/Tehran']);
      assert.deepEqual(time.searchTimezones('New York', 8, at), ['America/New_York']);
      assert.deepEqual(time.searchTimezones('berl', 8, at), ['Europe/Berlin']);
      assert.deepEqual(time.searchTimezones('Europe/Berlin', 8, at), ['Europe/Berlin']);
      assert.deepEqual(time.searchTimezones('+3:30', 8, at), ['Asia/Tehran']);
      assert.ok(time.searchTimezones('utc+2', 8, at).includes('Europe/Berlin'));
      assert.ok(time.searchTimezones('+2', 8, at)[0].startsWith('Europe/'), 'populated regions come first');
      assert.deepEqual(time.searchTimezones('atlantis', 8, at), []);
      assert.equal(time.describeTimezone('Asia/Tehran', at).offset, 'UTC+03:30');
      assert.equal(time.describeTimezone('Asia/Tehran', at).local_time, '13:30');
    });

    test('users set their own timezone; reminders follow it', async () => {
      const me = await User.create({ id: 1, first_name: 'Me' });
      let r = await api('/api/me/settings', { as: me });
      assert.equal(r.body.timezone.timezone, 'UTC');
      assert.equal(r.body.timezone.is_set, false);

      r = await api('/api/me/settings/timezone', { as: me, method: 'POST', body: { timezone: 'Asia/Tehran' } });
      assert.equal(r.status, 200);
      assert.equal(r.body.timezone.timezone, 'Asia/Tehran');
      assert.equal(r.body.timezone.is_set, true);
      assert.equal(r.body.timezone.offset, 'UTC+03:30');
      assert.equal(r.body.reminders.timezone, 'Asia/Tehran');
      // 07:00 / 21:00 in Tehran are 03:30 / 17:30 UTC
      const next = new Date(r.body.reminders.next_at);
      assert.ok([3 * 60 + 30, 17 * 60 + 30].includes(next.getUTCHours() * 60 + next.getUTCMinutes()), next.toISOString());
      assert.equal((await User.findById(me._id).lean()).timezone, 'Asia/Tehran', 'stored on the user, not only for reminders');

      assert.equal((await api('/api/me/settings/timezone', { as: me, method: 'POST', body: { timezone: 'Mars/Base' } })).status, 400);
      r = await api('/api/me/settings/timezone', { as: me, method: 'POST', body: { timezone: null } });
      assert.equal(r.body.timezone.is_set, false);
      assert.equal(r.body.timezone.timezone, 'UTC');
    });

    test('/timezone in the bot: one match is set right away, several come back as buttons', async () => {
      const me = await User.create({ id: 1, first_name: 'Me' });
      const replies = [];
      const ctx = (text, extra = {}) => ({ user: me, message: { text }, reply: async (t, e) => { replies.push({ t, e }); }, ...extra });

      await timezoneCommand(ctx('/timezone'));
      assert.match(replies.at(-1).t, /Your timezone: <b>UTC<\/b>/);

      await timezoneCommand(ctx('/timezone tehran'));
      assert.match(replies.at(-1).t, /Asia\/Tehran/);
      assert.equal((await User.findById(me._id).lean()).timezone, 'Asia/Tehran');

      await timezoneCommand(ctx('/timezone +2'));
      const buttons = replies.at(-1).e.reply_markup.inline_keyboard.map(row => row[0].callback_data);
      assert.ok(buttons.length > 1 && buttons.every(b => b.startsWith(TZ_PREFIX)));
      assert.ok(buttons.every(b => Buffer.byteLength(b) <= 64), 'fits Telegram callback_data');

      let edited = null;
      await timezoneCallback(ctx('', { callbackQuery: { data: TZ_PREFIX + 'Europe/Berlin' }, answerCbQuery: async () => {}, editMessageText: async (t) => { edited = t; } }));
      assert.equal((await User.findById(me._id).lean()).timezone, 'Europe/Berlin');
      assert.match(edited, /Europe\/Berlin/);

      await timezoneCommand(ctx('/timezone atlantis'));
      assert.match(replies.at(-1).t, /couldn't find/);
    });
  });

  describe('scheduling and the queue', () => {
    test('new users default to two reminders; due ones are queued once and move to the next slot', async () => {
      const u = await User.create({ id: 1, first_name: 'A' });
      const now = new Date('2026-09-29T06:00:00Z');
      await reminders.tick(now);
      let fresh = await User.findById(u._id).lean();
      assert.equal(fresh.reminder.next_at.toISOString(), '2026-09-29T07:00:00.000Z');

      const later = new Date('2026-09-29T07:00:30Z');
      assert.deepEqual(await reminders.tick(later), { queued: 1, skipped: 0 });
      fresh = await User.findById(u._id).lean();
      assert.equal(fresh.reminder.next_at.toISOString(), '2026-09-29T21:00:00.000Z', 'moves to the evening slot');

      // the same slot can never be queued twice
      await User.updateOne({ _id: u._id }, { 'reminder.next_at': new Date('2026-09-29T07:00:00Z') });
      await reminders.tick(later);
      assert.equal(await ReminderJob.countDocuments({ user: u._id }), 1);
    });

    test('skips people who just logged a mood, and slots missed by more than the grace window', async () => {
      const now = new Date('2026-09-29T07:01:00Z');
      const logged = await User.create({ id: 1, first_name: 'Logged', reminder: { next_at: new Date('2026-09-29T07:00:00Z') } });
      const missed = await User.create({ id: 2, first_name: 'Missed', reminder: { next_at: new Date('2026-09-29T02:00:00Z') } });
      const off = await User.create({ id: 3, first_name: 'Off', reminder: { enabled: false } });
      await Mood.create({ user: logged._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' }, timestamp: new Date('2026-09-29T06:30:00Z') });

      assert.deepEqual(await reminders.tick(now), { queued: 0, skipped: 2 });
      const jobs = await ReminderJob.find().lean();
      assert.deepEqual(jobs.map(j => j.reason).sort(), ['late', 'recent_mood']);
      assert.equal((await User.findById(off._id).lean()).reminder.next_at, null, 'reminders off: nothing scheduled');
      assert.ok((await User.findById(missed._id).lean()).reminder.next_at > now);
    });

    test('drains at most rate_per_second per run, with the mood keyboard and an off button', async () => {
      const tg = fakeTelegram();
      setTelegram(tg);
      await AppConfig.get();
      await AppConfig.updateOne({ key: 'main' }, { reminder_rate_per_second: 3 });
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const u = await User.create({ id: 100 + i, first_name: `U${i}` });
        await ReminderJob.create({ user: u._id, slot_at: now, run_at: now });
      }
      assert.deepEqual(await reminders.drain(now), ['sent', 'sent', 'sent']);
      assert.equal(tg.sent.length, 3);
      assert.equal(await ReminderJob.countDocuments({ status: 'queued' }), 4);
      const keyboard = tg.sent[0].extra.reply_markup.inline_keyboard;
      assert.ok(keyboard.some(row => row.some(b => String(b.callback_data).startsWith('mood_'))));
      assert.equal(keyboard.at(-1)[0].callback_data, reminders.CALLBACK_OFF);
      assert.ok((await User.findOne({ id: 100 }).lean()).reminder.last_sent_at);
    });

    test('a 429 pauses the whole queue; a blocked bot marks the user and is never retried', async () => {
      const now = new Date();
      const blocked = await User.create({ id: 1, first_name: 'Blocked' });
      const limited = await User.create({ id: 2, first_name: 'Limited' });
      await ReminderJob.create({ user: blocked._id, slot_at: now, run_at: new Date(now - 2000) });
      await ReminderJob.create({ user: limited._id, slot_at: now, run_at: new Date(now - 1000) });
      setTelegram(fakeTelegram((chatId) => chatId === 1
        ? tgError(403, 'Forbidden: bot was blocked by the user')
        : tgError(429, 'Too Many Requests: retry after 7', { retry_after: 7 })));

      assert.deepEqual(await reminders.drain(now), ['failed', 'rate_limited']);
      const u = await User.findById(blocked._id).lean();
      assert.equal(u.reminder.bot_blocked, true);
      assert.equal(u.reminder.next_at, null);
      const job = await ReminderJob.findOne({ user: limited._id }).lean();
      assert.equal(job.status, 'queued');
      assert.ok(reminders.state.paused_until > now);
      assert.deepEqual(await reminders.drain(now), [], 'paused until retry_after has passed');
    });

    test('a reminder that waited past the grace window is dropped, not sent late', async () => {
      const tg = fakeTelegram();
      setTelegram(tg);
      const u = await User.create({ id: 1, first_name: 'A' });
      const slot = new Date(Date.now() - 3 * 3600 * 1000);
      await ReminderJob.create({ user: u._id, slot_at: slot, run_at: slot });
      assert.deepEqual(await reminders.drain(new Date()), ['skipped']);
      assert.equal(tg.sent.length, 0);
      assert.equal((await ReminderJob.findOne().lean()).reason, 'late');
    });

    test('the master switch stops scheduling and sending', async () => {
      setTelegram(fakeTelegram());
      await AppConfig.get();
      await AppConfig.updateOne({ key: 'main' }, { reminders_enabled: false });
      const now = new Date('2026-09-29T07:01:00Z');
      await User.create({ id: 1, first_name: 'A', reminder: { next_at: new Date('2026-09-29T07:00:00Z') } });
      assert.deepEqual(await reminders.tick(now), { queued: 0, skipped: 0 });
      assert.equal(await ReminderJob.countDocuments(), 0);
    });
  });

  describe('mini app API', () => {
    test('users see their reminders and can change times, timezone, or turn them off', async () => {
      const me = await User.create({ id: 1, first_name: 'Me' });
      let r = await api('/api/me/settings', { as: me });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.reminders.times, ['07:00', '21:00'], 'two reminders by default, from .env');
      assert.equal(r.body.reminders.enabled, true);
      assert.equal(r.body.reminders.max_per_day, 5, 'people can pick up to 5 a day');

      r = await api('/api/me/settings/reminders', { as: me, method: 'POST', body: { times: ['20:30'], timezone: 'Europe/Berlin' } });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.reminders.times, ['20:30']);
      assert.equal(r.body.reminders.timezone, 'Europe/Berlin');
      assert.ok(r.body.reminders.next_at);

      assert.equal((await api('/api/me/settings/reminders', { as: me, method: 'POST', body: { times: ['08:00', '10:00', '12:00', '14:00', '16:00', '20:00'] } })).body.error, 'too_many_times');
      r = await api('/api/me/settings/reminders', { as: me, method: 'POST', body: { times: ['08:00', '11:00', '14:00', '17:00', '20:00'] } });
      assert.equal(r.status, 200);
      assert.equal(r.body.reminders.times.length, 5, 'five a day is allowed');
      assert.equal((await api('/api/me/settings/reminders', { as: me, method: 'POST', body: { times: ['25:00'] } })).body.error, 'invalid_times');
      assert.equal((await api('/api/me/settings/reminders', { as: me, method: 'POST', body: { timezone: 'Mars/Base' } })).body.error, 'invalid_timezone');

      r = await api('/api/me/settings/reminders', { as: me, method: 'POST', body: { enabled: false } });
      assert.equal(r.body.reminders.enabled, false);
      assert.equal(r.body.reminders.next_at, null);

      r = await api('/api/me/settings/reminders', { as: me, method: 'POST', body: { enabled: true, times: null } });
      assert.deepEqual(r.body.reminders.times, ['07:00', '21:00'], 'null goes back to the defaults');
    });

    test('admin controls: non-admins are refused; defaults, limits, test send and clearing the queue', async () => {
      const user = await User.create({ id: 1, first_name: 'User' });
      const admin = await User.create({ id: 9, first_name: 'Root', is_admin: true });
      assert.equal((await api('/api/admin/reminders', { as: user })).status, 403);
      assert.equal((await api('/api/admin/reminders/settings', { as: user, method: 'POST', body: { enabled: false } })).status, 403);

      let r = await api('/api/admin/reminders', { as: admin });
      assert.equal(r.status, 200);
      assert.equal(r.body.settings.enabled, true);
      assert.deepEqual(r.body.settings.default_times, ['07:00', '21:00']);
      assert.equal(r.body.settings.default_times_from_env, true);
      assert.equal(r.body.users.total, 2);

      r = await api('/api/admin/reminders/settings', { as: admin, method: 'POST', body: { max_per_day: 3, default_times: ['08:00', '13:00', '20:00'], rate_per_second: 5 } });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.settings.default_times, ['08:00', '13:00', '20:00']);
      assert.equal(r.body.settings.rate_per_second, 5);
      const mine = await api('/api/me/settings', { as: user });
      assert.deepEqual(mine.body.reminders.times, ['08:00', '13:00', '20:00'], 'users on defaults follow the admin');
      assert.equal((await api('/api/admin/reminders/settings', { as: admin, method: 'POST', body: { rate_per_second: 100 } })).status, 400);
      assert.equal((await api('/api/admin/reminders/settings', { as: admin, method: 'POST', body: { max_per_day: 6 } })).status, 400, 'the cap is 5');

      // the admin lowers the cap: someone who picked more keeps only the earliest ones
      await api('/api/me/settings/reminders', { as: user, method: 'POST', body: { times: ['08:00', '12:00', '20:00'] } });
      await api('/api/admin/reminders/settings', { as: admin, method: 'POST', body: { max_per_day: 2 } });
      assert.deepEqual((await api('/api/me/settings', { as: user })).body.reminders.times, ['08:00', '12:00']);
      await api('/api/me/settings/reminders', { as: user, method: 'POST', body: { times: null } });
      await api('/api/admin/reminders/settings', { as: admin, method: 'POST', body: { max_per_day: 3 } });

      r = await api('/api/admin/reminders/test', { as: admin, method: 'POST' });
      assert.equal(r.body.queue.queued, 1);
      r = await api('/api/admin/reminders/clear', { as: admin, method: 'POST' });
      assert.equal(r.body.cleared, 1);
      assert.equal(r.body.queue.queued, 0);
    });
  });
});
