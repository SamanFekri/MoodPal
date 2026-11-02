const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const Share = require('../../src/models/share');
const support = require('../../src/support/service');
const { MOOD_MAP } = require('../../src/constants/mood.constant');
const { setTelegram } = require('../../src/utils/telegram');

let sent;
const to = (u) => sent.filter(m => m.chatId === u.id);
function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}
let server, base;
const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const nick = (as, id, name) => api(`/api/friends/${id}/nickname`, { as, method: 'PUT', body: { name } });

describe('nicknames', () => {
  let saman, ada, bob, dan;

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    sent = [];
    setTelegram({ sendMessage: async (chatId, text, extra) => { sent.push({ chatId, text, extra }); return { message_id: sent.length }; } });
    saman = await User.create({ id: 9001, first_name: 'Saman', username: 'saman' });
    ada = await User.create({ id: 9002, first_name: 'Ada', last_name: 'Lovelace' });
    bob = await User.create({ id: 9003, first_name: 'Bob' });
    dan = await User.create({ id: 9004, first_name: 'Dan' });   // not connected to Saman
    for (const [a, b] of [[saman, ada], [ada, saman], [bob, saman]]) await Share.create({ follower: a._id, followed: b._id, disabled: false });
    await Mood.create({ user: ada._id, mood: MOOD_MAP.happy });
  });

  test('set, show in the Friends list with the real name kept, clear', async () => {
    assert.deepEqual((await nick(saman, ada.id, '  Mom  ')).body, { nickname: 'Mom' });
    let friends = (await api('/api/friends', { as: saman })).body;
    assert.deepEqual([friends[0].fullname, friends[0].nickname, friends[0].real_name], ['Mom', 'Mom', 'Ada Lovelace']);
    assert.deepEqual((await nick(saman, ada.id, '')).body, { nickname: null });
    friends = (await api('/api/friends', { as: saman })).body;
    assert.deepEqual([friends[0].fullname, friends[0].nickname], ['Ada Lovelace', null]);
  });

  test('only for people you are connected to (either way), never yourself, at most 32 characters', async () => {
    assert.equal((await nick(saman, bob.id, 'Bobby')).status, 200, 'Bob sees my mood: connected the other way');
    assert.equal((await nick(saman, dan.id, 'Danny')).body.error, 'not_connected');
    assert.equal((await nick(saman, saman.id, 'Me')).status, 404);
    assert.equal((await nick(saman, 123456, 'X')).status, 404);
    assert.equal((await nick(saman, ada.id, 'x'.repeat(33))).body.error, 'too_long');
  });

  test('private: only the person who set it sees it', async () => {
    await nick(saman, ada.id, 'Mom');
    await Share.create({ follower: bob._id, followed: ada._id, disabled: false });
    const bobs = (await api('/api/friends', { as: bob })).body;
    assert.equal(bobs.find(f => f.id === ada.id).fullname, 'Ada Lovelace');
    const admin = await User.create({ id: 9099, first_name: 'Root', is_admin: true });
    const adminView = await api('/api/admin/users/9001/support', { as: admin });
    assert.equal(adminView.status, 200);
    assert.ok(!JSON.stringify(adminView.body).includes('Mom'), 'admins see real names');
  });

  test('used in Settings → who can see my mood, the support lists and the share step', async () => {
    await nick(saman, bob.id, 'Bobby');
    await nick(saman, ada.id, 'Mom');
    const followers = (await api('/api/me/followers', { as: saman })).body.followers;
    assert.equal(followers.find(f => f.id === bob.id).fullname, 'Bobby');
    const view = (await api('/api/me/support', { as: saman })).body;
    assert.deepEqual(view.candidates.map(c => c.fullname).sort(), ['Bobby', 'Mom']);
    const r = await api('/api/me/mood', { as: saman, method: 'POST', body: { code: 'sad' } });
    assert.deepEqual(r.body.share.friends.map(f => f.fullname).sort(), ['Bobby', 'Mom']);
  });

  test('used in the bot: my checklist, and the messages I get about them', async () => {
    await nick(saman, ada.id, 'Mom');
    await nick(ada, saman.id, 'My kid');
    // my checklist after a hard mood
    const m = await Mood.create({ user: saman._id, mood: MOOD_MAP.sad });
    await support.afterMood(saman._id, m, { source: 'bot' });
    const names = to(saman).at(-1).extra.reply_markup.inline_keyboard.flat().map(b => b.text);
    assert.ok(names.includes('⬜ Mom'), names.join(', '));
    // Ada gets my share under her nickname for me, the button too
    await support.shareMood(saman._id, m._id, ada.id);
    const msg = to(ada).at(-1);
    assert.match(msg.text, /<b>My kid<\/b> wanted you to know/);
    assert.equal(msg.extra.reply_markup.inline_keyboard[0][0].text, '💬 Message My kid');
    // Ada hugs back: I see her as Mom
    await support.sendHug(await User.findById(ada._id).lean(), saman.id);
    assert.match(to(saman).at(-1).text, /<b>Mom<\/b> sent you a hug/);
    // an invitation from me reaches Ada as "My kid"
    await support.invite(saman._id, ada.id);
    assert.match(to(ada).at(-1).text, /<b>My kid<\/b> would like you to be a support friend/);
  });

  test('names are escaped in bot messages', async () => {
    await nick(ada, saman.id, '<b>x</b>');
    const m = await Mood.create({ user: saman._id, mood: MOOD_MAP.sad });
    await support.shareMood(saman._id, m._id, ada.id);
    assert.match(to(ada).at(-1).text, /&lt;b&gt;x&lt;\/b&gt;/);
  });
});
