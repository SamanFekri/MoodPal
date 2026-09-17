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
      assert.deepEqual(await api('/api/friends', { as: bob }).then(r => r.body), []);
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

    test('admins see everyone\'s latest mood and note, newest first, with search', async () => {
      const r = await api('/api/admin/users', { as: admin });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.users.map(u => u.id), [1, 2]);          // alice's mood is newer
      assert.equal(r.body.users[0].last_mood.note, 'long day');
      assert.equal(r.body.users[1].last_mood.mood.code, 'happy');
      assert.equal(r.body.users[1].username, 'bobby');
      assert.equal(r.body.total_moods, 2);

      const byName = await api('/api/admin/users?q=bob', { as: admin });
      assert.deepEqual(byName.body.users.map(u => u.id), [2]);
      const byUsername = await api('/api/admin/users?q=BOBBY', { as: admin });
      assert.deepEqual(byUsername.body.users.map(u => u.id), [2]);
      const byId = await api('/api/admin/users?q=1', { as: admin });
      assert.deepEqual(byId.body.users.map(u => u.id), [1]);
      assert.deepEqual((await api('/api/admin/users?q=nobody', { as: admin })).body.users, []);
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
