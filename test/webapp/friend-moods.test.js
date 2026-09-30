const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const Share = require('../../src/models/share');

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

describe("a friend's mood log", () => {
  let server, base, me, friend, stranger;
  const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    me = await User.create({ id: 1, first_name: 'Me' });
    friend = await User.create({ id: 2, first_name: 'Friend' });
    stranger = await User.create({ id: 3, first_name: 'Stranger' });
    for (let i = 0; i < 35; i++) {
      await Mood.create({ user: me._id, mood: { code: i % 2 ? 'happy' : 'tired', emoji: '🙂', name: i % 2 ? 'Happy' : 'Tired' }, note: `private note ${i}`, timestamp: new Date(Date.now() - i * 3600e3) });
    }
    await Share.createShare(friend._id, me._id);   // friend follows my mood
  });

  test('people who follow me see my mood history, newest first, without my notes by default', async () => {
    let r = await api('/api/friends/1/moods', { as: friend });
    assert.equal(r.status, 200);
    assert.equal(r.body.shared, true);
    assert.equal(r.body.notes_shared, false);
    assert.equal(r.body.moods.length, 30);
    assert.equal(r.body.moods[0].mood.name, 'Tired', 'newest first');
    assert.ok(!JSON.stringify(r.body).includes('private note'), 'notes stay private');
    assert.equal(r.body.has_more, true);

    r = await api(`/api/friends/1/moods?before=${encodeURIComponent(r.body.next_before)}`, { as: friend });
    assert.equal(r.body.moods.length, 5, 'the rest');
    assert.equal(r.body.has_more, false);

    assert.equal((await api('/api/friends/1/moods', { as: stranger })).status, 403, "people who don't follow me can't");
    assert.equal((await api('/api/friends/99/moods', { as: friend })).status, 404);
  });

  test('I decide: notes can be shared, and the whole log can be hidden', async () => {
    let s = await api('/api/me/settings', { as: me });
    assert.deepEqual([s.body.privacy.mood_log_shared, s.body.privacy.mood_notes_shared], [true, false], 'log on, notes off by default');

    await api('/api/me/settings/privacy', { as: me, method: 'POST', body: { mood_notes_shared: true } });
    let r = await api('/api/friends/1/moods', { as: friend });
    assert.equal(r.body.notes_shared, true);
    assert.equal(r.body.moods[0].note, 'private note 0');

    s = await api('/api/me/settings/privacy', { as: me, method: 'POST', body: { mood_log_shared: false } });
    assert.equal(s.body.privacy.mood_log_shared, false);
    r = await api('/api/friends/1/moods', { as: friend });
    assert.deepEqual(r.body, { shared: false, moods: [], has_more: false, next_before: null });

    assert.equal((await api('/api/me/settings/privacy', { as: me, method: 'POST', body: { mood_log_shared: 'yes' } })).status, 400);
    assert.equal((await api('/api/me/settings/privacy', { as: me, method: 'POST', body: {} })).status, 400);
    // the Moodling switch still works through the same endpoint
    s = await api('/api/me/settings/privacy', { as: me, method: 'POST', body: { mbti_shared: false } });
    assert.equal(s.body.privacy.mbti_shared, false);
  });
});
