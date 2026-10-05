const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const Share = require('../../src/models/share');
const { friendsCommand, friendsCallback } = require('../../src/commands/friends');

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}
const sees = (a, b) => Share.exists({ follower: a._id, followed: b._id, disabled: false }).then(Boolean);

describe('unfollowing', () => {
  let server, base, sam, ada, kai;
  const api = (path, { as, method = 'GET' } = {}) => fetch(base + path, { method, headers: { 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) } })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    sam = await User.create({ id: 1, first_name: 'Sam' });
    ada = await User.create({ id: 2, first_name: 'Ada' });
    kai = await User.create({ id: 3, first_name: 'Kai' });
    for (const u of [sam, ada, kai]) await Mood.create({ user: u._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' } });
    await Share.createShare(sam._id, ada._id);   // Sam sees Ada
    await Share.createShare(ada._id, sam._id);   // Ada sees Sam
    await Share.createShare(kai._id, sam._id);   // Kai sees Sam
  });

  test('the app knows who sees you back, lists your followers, and lets you unfollow or remove', async () => {
    let r = await api('/api/friends', { as: sam });
    assert.deepEqual(r.body.map(f => [f.id, f.follows_me]), [[2, true]], 'Ada sees Sam back');

    r = await api('/api/me/followers', { as: sam });
    assert.deepEqual(r.body.followers.map(f => [f.id, f.i_follow_them]).sort(), [[2, true], [3, false]]);

    assert.equal((await api('/api/me/followers/3', { as: sam, method: 'DELETE' })).status, 200);
    assert.equal(await sees(kai, sam), false, 'Kai no longer sees Sam');

    assert.equal((await api('/api/friends/2', { as: sam, method: 'DELETE' })).status, 200);
    assert.equal(await sees(sam, ada), false, 'Sam unfollowed Ada');
    assert.equal(await sees(ada, sam), true, 'Ada still sees Sam until Sam hides it');
    assert.deepEqual((await api('/api/friends', { as: sam })).body, []);

    assert.equal((await api('/api/friends/999', { as: sam, method: 'DELETE' })).status, 404);
  });

  test('/friends in the bot lists both sides with buttons, and the buttons work', async () => {
    const replies = [];
    let edited = null;
    await friendsCommand({ user: sam, reply: async (text, extra) => replies.push({ text, extra }) });
    const { text, extra } = replies[0];
    assert.match(text, /You see the mood of:<\/b> Ada/);
    assert.match(text, /They see your mood:<\/b> Ada, Kai|They see your mood:<\/b> Kai, Ada/);
    const buttons = extra.reply_markup.inline_keyboard.flat().map(b => b.callback_data);
    assert.ok(buttons.includes(`fr_uf_${ada._id}`) && buttons.includes(`fr_both_${ada._id}`) && buttons.includes(`fr_rm_${kai._id}`));

    const tap = (data) => friendsCallback({ user: sam, callbackQuery: { data }, answerCbQuery: async () => {}, editMessageText: async (t) => { edited = t; } });
    await tap(`fr_both_${ada._id}`);
    assert.equal(await sees(sam, ada), false);
    assert.equal(await sees(ada, sam), false, 'unfollowed each other');
    assert.doesNotMatch(edited, /Ada/, 'the list updates in place');

    await tap(`fr_rm_${kai._id}`);
    assert.equal(await sees(kai, sam), false);
    assert.match(edited, /not sharing moods with anyone yet/);
  });
});
