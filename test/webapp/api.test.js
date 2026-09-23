const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.BOT_USERNAME = process.env.BOT_USERNAME || 'MoodPalBot';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const Share = require('../../src/models/share');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');
const { setTelegram } = require('../../src/utils/telegram');

// ---- helpers ----
function signInitData(tgUser, { token = process.env.BOT_TOKEN, ageSeconds = 5 } = {}) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - ageSeconds), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(token, 'WebAppData');
  const hash = cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex);
  const p = new URLSearchParams(params); p.set('hash', hash);
  return p.toString();
}

let server, base;
const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
  method,
  headers: { 'Content-Type': 'application/json', ...(as ? { 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

async function takeBigFive(userId, answer = () => 4) {
  const s = await personalityService.startTest(userId, 'big_five');
  for (const q of s.questions) await personalityService.answerQuestion(userId, s.session._id, q.order, answer(q));
}

describe('mini app API', () => {
  let alice, bob, carol, admin;

  before(async () => {
    await db.connect();
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    personalityService.clearCache();
    alice = await User.create({ id: 1, first_name: 'Alice' });
    bob = await User.create({ id: 2, first_name: 'Bob', username: 'bobby' });
    carol = await User.create({ id: 3, first_name: 'Carol' });
    admin = await User.create({ id: 9, first_name: 'Root', is_admin: true });
    await Mood.create({ user: bob._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' }, note: 'sunny', timestamp: new Date(Date.now() - 1000) });
    await Mood.create({ user: alice._id, mood: { code: 'tired', emoji: '😴', name: 'Tired' }, note: 'long day' });
    await Share.createShare(alice._id, bob._id); // alice follows bob
  });

  describe('authentication', () => {
    test('rejects missing, forged and unknown-user initData', async () => {
      assert.equal((await api('/api/friends')).status, 401);
      const forged = await fetch(base + '/api/friends', { headers: { 'X-Telegram-Init-Data': signInitData({ id: 1 }, { token: 'wrong' }) } });
      assert.equal(forged.status, 401);
      assert.equal((await api('/api/friends', { as: { id: 424242, first_name: 'Ghost' } })).status, 401);
    });

    test('the old unauthenticated followings route is gone', async () => {
      assert.equal((await api(`/user/${alice._id}/followings`)).status, 404);
    });
  });

  describe('friends', () => {
    test('lists the people I follow with their mood and whether they share personality', async () => {
      const r = await api('/api/friends', { as: alice });
      assert.equal(r.status, 200);
      assert.equal(r.body.length, 1);
      assert.equal(r.body[0].id, 2);
      assert.equal(r.body[0].mood.code, 'happy');
      assert.equal(r.body[0].personality_shared, false);
      // notes are private: a friend only ever sees the mood, never what was written with it
      assert.equal(r.body[0].note, undefined);
      assert.ok(!JSON.stringify(r.body).includes('sunny'), "bob's note never reaches alice");
      assert.deepEqual(await api('/api/friends', { as: bob }).then(r => r.body), []);
    });
  });

  describe('mood picker bridge', () => {
    test('asks the bot to send the mood picker to the signed-in user', async () => {
      const sent = [];
      setTelegram({ sendMessage: async (chatId, text, extra) => { sent.push({ chatId, text, extra }); return { message_id: 1 }; } });
      const r = await api('/api/me/mood/picker', { as: alice, method: 'POST' });
      assert.equal(r.status, 200);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].chatId, 1);
      assert.match(sent[0].text, /mood/i);
      assert.ok(sent[0].extra.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'mood_happy'));
      assert.equal((await api('/api/me/mood/picker', { method: 'POST' })).status, 401);

      setTelegram({ sendMessage: async () => { throw new Error('blocked'); } });
      assert.equal((await api('/api/me/mood/picker', { as: alice, method: 'POST' })).status, 502);
    });
  });

  describe('my moods', () => {
    test('every user can page through their own history, newest first', async () => {
      for (let i = 0; i < 32; i++) await Mood.create({ user: alice._id, mood: { code: 'neutral', emoji: '😐', name: 'Neutral' }, note: `mine ${i}`, timestamp: new Date(Date.now() - (i + 5) * 60000) });
      const p0 = await api('/api/me/moods', { as: alice });
      assert.equal(p0.status, 200);
      assert.equal(p0.body.moods.length, 30);
      assert.equal(p0.body.moods[0].note, 'long day');
      assert.equal(p0.body.has_more, true);
      const p1 = await api(`/api/me/moods?before=${encodeURIComponent(p0.body.next_before)}`, { as: alice });
      assert.equal(p1.body.moods.length, 3);
      assert.equal(p1.body.has_more, false);
      assert.ok(!JSON.stringify(p0.body).includes('sunny'), "bob's moods never appear");
      assert.equal((await api('/api/me/moods', { as: bob })).body.moods.length, 1);
      assert.equal((await api('/api/me/moods')).status, 401);
    });
  });

  describe('settings', () => {
    test('key: format check, verification, masked hint, removal; model: choices and validation', async () => {
      const settings = require('../../src/controllers/settings');
      const origVerify = settings.verify;
      try {
        let r = await api('/api/me/settings', { as: alice });
        assert.equal(r.status, 200);
        assert.deepEqual({ has_key: r.body.openai.has_key, model: r.body.openai.model }, { has_key: false, model: 'gpt-5.6' });
        assert.ok(r.body.openai.models.some(m => m.id === 'gpt-5.6'));

        assert.equal((await api('/api/me/settings/openai-key', { as: alice, method: 'POST', body: { key: 'hello' } })).status, 400);
        settings.verify = async () => { throw Object.assign(new Error('bad'), { status: 401 }); };
        assert.equal((await api('/api/me/settings/openai-key', { as: alice, method: 'POST', body: { key: 'sk-proj-abcdefghijklmnopqrstuvwxyz1234' } })).status, 401);
        settings.verify = async () => {};
        r = await api('/api/me/settings/openai-key', { as: alice, method: 'POST', body: { key: 'sk-proj-abcdefghijklmnopqrstuvwxyz1234' } });
        assert.equal(r.status, 200);
        assert.equal(r.body.openai.has_key, true);
        assert.equal(r.body.openai.key_hint, 'sk-…1234');
        assert.equal(await User.getOpenAIKey(alice._id), 'sk-proj-abcdefghijklmnopqrstuvwxyz1234');
        assert.ok(!JSON.stringify(r.body).includes('abcdefghij'), 'the full key is never returned');

        r = await api('/api/me/settings/model', { as: alice, method: 'POST', body: { model: 'gpt-5-mini' } });
        assert.equal(r.body.openai.model, 'gpt-5-mini');
        assert.equal((await User.findById(alice._id)).openai_model, 'gpt-5-mini');
        assert.equal((await api('/api/me/settings/model', { as: alice, method: 'POST', body: { model: 'not a model!!' } })).status, 400);
        r = await api('/api/me/settings/model', { as: alice, method: 'POST', body: { model: null } });
        assert.equal(r.body.openai.model, 'gpt-5.6');

        r = await api('/api/me/settings/openai-key', { as: alice, method: 'DELETE' });
        assert.equal(r.body.openai.has_key, false);
        assert.equal(await User.getOpenAIKey(alice._id), null);
        assert.equal((await api('/api/me/settings')).status, 401);
      } finally {
        settings.verify = origVerify;
      }
    });
  });

  describe('my personality', () => {
    test('no profile yet: null profile, full test list', async () => {
      const r = await api('/api/me/personality', { as: alice });
      assert.equal(r.status, 200);
      assert.equal(r.body.profile, null);
      assert.ok(r.body.tests.length >= 6);
      assert.ok(r.body.tests.every(t => t.completed === false));
      assert.deepEqual(r.body.sharing, { enabled: false, public_url: null });
    });

    test('after a test: grouped categories with labels, completed test marked', async () => {
      await takeBigFive(alice._id, q => (q.reverse ? 1 : 5));
      const r = await api('/api/me/personality', { as: alice });
      assert.equal(r.body.profile.categories.length, 1);
      assert.equal(r.body.profile.categories[0].key, 'big_five');
      assert.equal(r.body.profile.categories[0].traits.length, 5);
      assert.equal(r.body.profile.categories[0].traits[0].value, 1);
      assert.equal(r.body.profile.categories[0].traits[0].label, 'very high');
      assert.equal(r.body.profile.measured, 5);
      assert.deepEqual(r.body.profile.tests_taken, ['big_five']);
      assert.ok(r.body.tests.find(t => t.key === 'big_five').completed);
    });
  });

  describe('taking a test in the mini app', () => {
    test('start, answer every question, get the profile back; resume and cancel work', async () => {
      assert.deepEqual((await api('/api/me/personality/session', { as: alice })).body, { session: null });
      assert.equal((await api('/api/me/personality/tests/nope/start', { as: alice, method: 'POST' })).status, 404);

      let r = await api('/api/me/personality/tests/big_five/start', { as: alice, method: 'POST' });
      assert.equal(r.status, 200);
      const s = r.body.session;
      assert.equal(s.total, 20);
      assert.equal(s.current_index, 0);
      assert.equal(s.test.scale.labels.length, 5);
      assert.deepEqual(Object.keys(s.questions[0]), ['order', 'text'], 'no trait or reverse hints leak to the client');

      r = await api(`/api/me/personality/session/${s.id}/answer`, { as: alice, method: 'POST', body: { order: 1, value: 5 } });
      assert.equal(r.body.done, false);
      assert.equal(r.body.session.current_index, 1);
      assert.equal((await api(`/api/me/personality/session/${s.id}/answer`, { as: alice, method: 'POST', body: { order: 2, value: 9 } })).status, 400);
      assert.equal((await api(`/api/me/personality/session/${s.id}/answer`, { as: alice, method: 'POST', body: {} })).status, 400);
      // another user cannot answer alice's session
      assert.equal((await api(`/api/me/personality/session/${s.id}/answer`, { as: bob, method: 'POST', body: { order: 2, value: 3 } })).status, 410);

      // resume shows progress
      r = await api('/api/me/personality/session', { as: alice });
      assert.equal(r.body.session.answered, 1);
      assert.equal(r.body.session.id, s.id);

      let last;
      for (let order = 2; order <= 20; order++) last = await api(`/api/me/personality/session/${s.id}/answer`, { as: alice, method: 'POST', body: { order, value: 5 } });
      assert.equal(last.body.done, true);
      assert.equal(last.body.test.key, 'big_five');
      assert.equal(last.body.scores.extraversion, 0.5);
      assert.equal(last.body.profile.categories[0].key, 'big_five');
      assert.ok(last.body.tests.find(t => t.key === 'big_five').completed);
      assert.deepEqual((await api('/api/me/personality/session', { as: alice })).body, { session: null });
      assert.equal((await api(`/api/me/personality/session/${s.id}/answer`, { as: alice, method: 'POST', body: { order: 1, value: 1 } })).status, 410);

      // cancel
      r = await api('/api/me/personality/tests/communication_style/start', { as: alice, method: 'POST' });
      assert.equal(r.body.session.total, 14);
      assert.deepEqual((await api('/api/me/personality/session/cancel', { as: alice, method: 'POST' })).body, { cancelled: true });
      assert.deepEqual((await api('/api/me/personality/session', { as: alice })).body, { session: null });
      assert.deepEqual((await api('/api/me/personality/session/cancel', { as: alice, method: 'POST' })).body, { cancelled: false });
    });
  });

  describe('sharing', () => {
    test('toggle creates a stable public link; public endpoint follows the toggle', async () => {
      await takeBigFive(bob._id);
      let r = await api('/api/me/personality/sharing', { as: bob, method: 'POST', body: { enabled: true } });
      assert.equal(r.status, 200);
      assert.equal(r.body.enabled, true);
      assert.match(r.body.public_url, /\/p\/[A-Za-z0-9_-]{10,}$/);
      const token = r.body.public_url.split('/p/')[1];

      const pub = await api(`/api/public/personality/${token}`);
      assert.equal(pub.status, 200);
      assert.equal(pub.body.first_name, 'Bob');
      assert.equal(pub.body.profile.categories[0].key, 'big_five');
      assert.equal(pub.body.profile.traits, undefined);
      assert.equal(JSON.stringify(pub.body).includes('openai'), false);

      r = await api('/api/me/personality/sharing', { as: bob, method: 'POST', body: { enabled: false } });
      assert.equal(r.body.enabled, false);
      assert.equal(r.body.public_url, null);
      assert.equal((await api(`/api/public/personality/${token}`)).status, 404);

      // re-enabling keeps the same token so old links keep working
      r = await api('/api/me/personality/sharing', { as: bob, method: 'POST', body: { enabled: true } });
      assert.equal(r.body.public_url.split('/p/')[1], token);
      assert.equal((await api('/api/public/personality/nonexistent')).status, 404);
    });

    test('a friend sees my personality only if I follow-share and they enabled it', async () => {
      await takeBigFive(bob._id);
      // alice follows bob, bob has not enabled sharing
      let r = await api('/api/friends/2/personality', { as: alice });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { shared: false, profile: null });

      await api('/api/me/personality/sharing', { as: bob, method: 'POST', body: { enabled: true } });
      r = await api('/api/friends/2/personality', { as: alice });
      assert.equal(r.body.shared, true);
      assert.equal(r.body.profile.categories[0].traits.length, 5);
      assert.equal((await api('/api/friends', { as: alice })).body[0].personality_shared, true);

      // carol does not follow bob -> forbidden even though bob shares
      assert.equal((await api('/api/friends/2/personality', { as: carol })).status, 403);
      // bob does not follow alice -> forbidden
      assert.equal((await api('/api/friends/1/personality', { as: bob })).status, 403);
      assert.equal((await api('/api/friends/999/personality', { as: alice })).status, 404);
    });
  });

  describe('admin', () => {
    test('non-admins are refused', async () => {
      assert.equal((await api('/api/admin/users', { as: alice })).status, 403);
      assert.equal((await api('/api/admin/users/2/moods', { as: alice })).status, 403);
      assert.equal((await api('/api/admin/users')).status, 401);
    });

    test('admins see every user, most recently active first, with latest mood/note and search', async () => {
      const t = Date.now();
      await User.updateOne({ _id: bob._id }, { last_active_at: new Date(t - 1000) });
      await User.updateOne({ _id: alice._id }, { last_active_at: new Date(t - 2000) });
      await User.updateOne({ _id: carol._id }, { last_active_at: new Date(t - 3000) });
      await User.updateOne({ _id: admin._id }, { last_active_at: new Date(t - 4000) });

      const r = await api('/api/admin/users', { as: admin });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.users.map(u => u.id), [2, 1, 3, 9]);    // by activity, users without moods included
      assert.equal(r.body.users[0].last_mood.mood.code, 'happy');
      assert.equal(r.body.users[0].username, 'bobby');
      assert.equal(r.body.users[1].last_mood.note, 'long day');
      assert.equal(r.body.users[2].last_mood, null);
      assert.equal(r.body.users[2].mood_count, 0);
      assert.equal(r.body.users[0].mood_count, 1);
      assert.equal(r.body.users[0].is_friend, false);
      assert.equal(r.body.total_users, 4);
      assert.equal(r.body.total_moods, 2);
      assert.equal(r.body.has_more, false);
      assert.equal(r.body.page_size, 20);

      const byName = await api('/api/admin/users?q=bob', { as: admin });
      assert.deepEqual(byName.body.users.map(u => u.id), [2]);
      const byUsername = await api('/api/admin/users?q=BOBBY', { as: admin });
      assert.deepEqual(byUsername.body.users.map(u => u.id), [2]);
      const byId = await api('/api/admin/users?q=1', { as: admin });
      assert.deepEqual(byId.body.users.map(u => u.id), [1]);
      assert.deepEqual((await api('/api/admin/users?q=nobody', { as: admin })).body.users, []);
    });

    test('users created before last_active_at existed still sort by recency', async () => {
      await User.collection.updateOne({ id: 3 }, { $unset: { last_active_at: '' } });      // pre-migration user
      await User.updateOne({ _id: bob._id }, { last_active_at: new Date(Date.now() - 10 * 86400000) });
      await User.updateOne({ _id: alice._id }, { last_active_at: new Date(Date.now() - 20 * 86400000) });
      await User.updateOne({ _id: admin._id }, { last_active_at: new Date(Date.now() - 30 * 86400000) });
      const r = await api('/api/admin/users', { as: admin });
      // carol (updated just now, no field) precedes bob and alice; the admin's own request bumps them to the top (async, so not asserted)
      const ids = r.body.users.map(u => u.id).filter(id => id !== 9);
      assert.deepEqual(ids, [3, 2, 1]);
      assert.ok(r.body.users[1].last_active_at, 'fallback activity time is reported');
    });

    test('opening the mini app counts as activity', async () => {
      await User.updateOne({ _id: alice._id }, { last_active_at: new Date(Date.now() - 86400000) });
      await api('/api/friends', { as: alice });
      await new Promise(r => setTimeout(r, 50));
      const fresh = await User.findById(alice._id);
      assert.ok(Date.now() - fresh.last_active_at.getTime() < 5000);
    });

    test('user list is paginated', async () => {
      for (let i = 0; i < 25; i++) await User.create({ id: 1000 + i, first_name: `U${i}`, last_active_at: new Date(Date.now() + i * 1000) });
      const p0 = await api('/api/admin/users', { as: admin });
      assert.equal(p0.body.users.length, 20);
      assert.equal(p0.body.has_more, true);
      assert.equal(p0.body.users[0].id, 1024);                        // most recently active first
      const p1 = await api('/api/admin/users?page=1', { as: admin });
      assert.equal(p1.body.users.length, 9);                          // 25 new + 4 seeded - 20
      assert.equal(p1.body.has_more, false);
      const ids = new Set([...p0.body.users, ...p1.body.users].map(u => u.id));
      assert.equal(ids.size, 29, 'no duplicates across pages');
    });

    test('a user\'s history is cursor paginated, newest first', async () => {
      for (let i = 0; i < 35; i++) await Mood.create({ user: carol._id, mood: { code: 'neutral', emoji: '😐', name: 'Neutral' }, note: `n${i}`, timestamp: new Date(Date.now() - i * 60000) });
      const p0 = await api('/api/admin/users/3/moods', { as: admin });
      assert.equal(p0.body.moods.length, 30);
      assert.equal(p0.body.moods[0].note, 'n0');
      assert.equal(p0.body.has_more, true);
      assert.ok(p0.body.next_before);
      const p1 = await api(`/api/admin/users/3/moods?before=${encodeURIComponent(p0.body.next_before)}`, { as: admin });
      assert.equal(p1.body.moods.length, 5);
      assert.equal(p1.body.moods[0].note, 'n30');
      assert.equal(p1.body.has_more, false);
      assert.equal(p1.body.next_before, null);
      const small = await api('/api/admin/users/3/moods?limit=5', { as: admin });
      assert.equal(small.body.moods.length, 5);
    });

    test('admin can add and remove anyone as a friend (they appear in the admin\'s friends)', async () => {
      let r = await api('/api/admin/users/2/friend', { as: admin, method: 'POST' });
      assert.equal(r.status, 200);
      assert.equal(r.body.is_friend, true);
      assert.deepEqual((await api('/api/friends', { as: admin })).body.map(f => f.id), [2]);
      assert.equal((await api('/api/admin/users', { as: admin })).body.users.find(u => u.id === 2).is_friend, true);

      r = await api('/api/admin/users/2/friend', { as: admin, method: 'DELETE' });
      assert.equal(r.body.is_friend, false);
      assert.deepEqual((await api('/api/friends', { as: admin })).body, []);
      assert.equal((await api('/api/admin/users', { as: admin })).body.users.find(u => u.id === 2).is_friend, false);

      assert.equal((await api('/api/admin/users/9/friend', { as: admin, method: 'POST' })).status, 400);
      assert.equal((await api('/api/admin/users/999/friend', { as: admin, method: 'POST' })).status, 404);
      assert.equal((await api('/api/admin/users/2/friend', { as: alice, method: 'POST' })).status, 403);
    });

    test('admin sees anyone\'s personality regardless of sharing, and can filter users by a trait', async () => {
      await takeBigFive(bob._id, q => (q.reverse ? 1 : 5));     // bob: everything 1.0, sharing off
      await takeBigFive(alice._id, q => (q.reverse ? 5 : 1));   // alice: everything 0.0
      let r = await api('/api/admin/users/2/personality', { as: admin });
      assert.equal(r.status, 200);
      assert.equal(r.body.shared, false);
      assert.equal(r.body.profile.categories[0].traits[0].value, 1);
      assert.equal((await api('/api/admin/users/3/personality', { as: admin })).body.profile, null);
      assert.equal((await api('/api/admin/users/2/personality', { as: alice })).status, 403);

      const traits = await api('/api/admin/traits', { as: admin });
      assert.ok(traits.body.traits.some(t => t.key === 'openness' && t.category === 'big_five'));

      r = await api('/api/admin/users?trait=openness&min=0.6', { as: admin });
      assert.deepEqual(r.body.users.map(u => u.id), [2]);
      assert.equal(r.body.users[0].trait_value, 1);
      assert.equal(r.body.total_users, 1);
      assert.deepEqual(r.body.filter.trait, { trait: 'openness', min: 0.6, max: 1 });
      r = await api('/api/admin/users?trait=openness&max=0.4', { as: admin });
      assert.deepEqual(r.body.users.map(u => u.id), [1]);
      r = await api('/api/admin/users?trait=openness', { as: admin });
      assert.deepEqual(new Set(r.body.users.map(u => u.id)), new Set([1, 2]));    // only users with a profile
      r = await api('/api/admin/users?trait=openness&q=bob', { as: admin });
      assert.deepEqual(r.body.users.map(u => u.id), [2]);
      assert.equal((await api('/api/admin/users?trait=$where', { as: admin })).body.filter.trait, null);
    });

    test('there is no global mood feed, not even for admins', async () => {
      assert.equal((await api('/api/admin/moods', { as: admin })).status, 404);
    });

    test('notes filter keeps only users whose last mood has (or lacks) a note', async () => {
      // alice: "long day", bob: "sunny", carol: a mood with no note, admin: no mood at all
      await Mood.create({ user: carol._id, mood: { code: 'bored', emoji: '🥱', name: 'Bored' }, note: '   ', timestamp: new Date() });
      const withNote = await api('/api/admin/users?notes=with', { as: admin });
      assert.deepEqual(withNote.body.users.map(u => u.id).sort(), [1, 2]);
      assert.ok(withNote.body.users.every(u => u.has_note));
      assert.equal(withNote.body.total_users, 2);
      assert.equal(withNote.body.filter.notes, 'with');

      const without = await api('/api/admin/users?notes=without', { as: admin });
      const ids = without.body.users.map(u => u.id).sort();
      assert.deepEqual(ids, [3, 9], 'whitespace-only note counts as no note, and so does having no mood');
      assert.ok(without.body.users.every(u => !u.has_note));

      // filters compose with search and with the trait filter
      assert.deepEqual((await api('/api/admin/users?notes=with&q=bob', { as: admin })).body.users.map(u => u.id), [2]);
      assert.equal((await api('/api/admin/users?notes=bogus', { as: admin })).body.filter.notes, null);
    });

    test('sort=mood orders by the last mood registered, not by activity', async () => {
      const t = Date.now();
      // activity order is the reverse of mood order, so the two sorts cannot coincide
      await Mood.create({ user: carol._id, mood: { code: 'sad', emoji: '😢', name: 'Sad' }, timestamp: new Date(t - 1000) });
      await User.updateOne({ _id: bob._id },   { last_active_at: new Date(t - 30000) });   // mood: t-1000 (newest)
      await User.updateOne({ _id: carol._id }, { last_active_at: new Date(t - 20000) });
      await User.updateOne({ _id: alice._id }, { last_active_at: new Date(t - 10000) });
      await Mood.updateOne({ user: bob._id },   { timestamp: new Date(t - 100) });
      await Mood.updateOne({ user: alice._id }, { timestamp: new Date(t - 5000) });

      const byMood = await api('/api/admin/users?sort=mood', { as: admin });
      assert.equal(byMood.body.sort, 'mood');
      assert.deepEqual(byMood.body.users.map(u => u.id), [2, 3, 1, 9], 'newest mood first, no-mood user last');

      const byActivity = await api('/api/admin/users', { as: admin });
      assert.equal(byActivity.body.sort, 'activity');
      assert.equal(byActivity.body.users[0].id, 9, "the admin's own request counts as activity");
      assert.notDeepEqual(byActivity.body.users.map(u => u.id), byMood.body.users.map(u => u.id));
    });

    test('admin can block and unblock a user, and a blocked user is refused everywhere', async () => {
      assert.equal((await api('/api/friends', { as: bob })).status, 200);

      let r = await api('/api/admin/users/2/block', { as: admin, method: 'POST' });
      assert.equal(r.status, 200);
      assert.equal(r.body.is_blocked, true);
      assert.equal((await User.findById(bob._id)).is_blocked, true);
      assert.equal((await api('/api/admin/users', { as: admin })).body.users.find(u => u.id === 2).is_blocked, true);

      // blocked: every mini app route refuses them
      assert.equal((await api('/api/friends', { as: bob })).status, 403);
      assert.equal((await api('/api/me/settings', { as: bob })).status, 403);
      assert.equal((await api('/api/me/moods', { as: bob })).status, 403);

      // and the bot ignores them
      const blockMiddleware = require('../../src/middlewares/block.middleware');
      let ran = false;
      await blockMiddleware({ user: await User.findById(bob._id) }, async () => { ran = true; });
      assert.equal(ran, false, 'no handler runs for a blocked user');
      await blockMiddleware({ user: await User.findById(alice._id) }, async () => { ran = true; });
      assert.equal(ran, true, 'unblocked users pass through');

      r = await api('/api/admin/users/2/block', { as: admin, method: 'DELETE' });
      assert.equal(r.body.is_blocked, false);
      assert.equal((await api('/api/friends', { as: bob })).status, 200);

      // guards
      assert.equal((await api('/api/admin/users/9/block', { as: admin, method: 'POST' })).status, 400, 'cannot block yourself');
      const admin2 = await User.create({ id: 10, first_name: 'Root2', is_admin: true });
      assert.equal((await api(`/api/admin/users/${admin2.id}/block`, { as: admin, method: 'POST' })).status, 400, 'cannot block an admin');
      assert.equal((await api('/api/admin/users/999/block', { as: admin, method: 'POST' })).status, 404);
      assert.equal((await api('/api/admin/users/2/block', { as: alice, method: 'POST' })).status, 403, 'non-admins cannot block');
    });

    test('admins can read a user\'s full history including private moods and notes', async () => {
      await User.updateOne({ _id: bob._id }, { is_mood_private: true });
      await Mood.create({ user: bob._id, mood: { code: 'sad', emoji: '😢', name: 'Sad' }, note: 'secret note' });
      const r = await api('/api/admin/users/2/moods', { as: admin });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.fullname, 'Bob');
      assert.deepEqual(r.body.moods.map(m => m.mood.code), ['sad', 'happy']);
      assert.equal(r.body.moods[0].note, 'secret note');
      assert.equal((await api('/api/admin/users/999/moods', { as: admin })).status, 404);
    });
  });
});
