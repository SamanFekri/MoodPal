const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');
const sharp = require('sharp');

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
let server, base;
const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
// a link from the API, fetched the way a widget app would (no Telegram auth)
const image = async (link) => {
  const r = await fetch(base + new URL(link).pathname);
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, type: r.headers.get('content-type'), buf, meta: r.ok ? await sharp(buf).metadata() : null };
};

describe('home-screen widget links', () => {
  let alice, bob, carol;

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    alice = await User.create({ id: 6001, first_name: 'Alice' });
    bob = await User.create({ id: 6002, first_name: 'Bob' });
    carol = await User.create({ id: 6003, first_name: 'Carol' });
    await Mood.create({ user: alice._id, mood: { code: 'motivated', emoji: '🤩', name: 'Motivated' }, note: 'secret note' });
    await Mood.create({ user: bob._id, mood: { code: 'tired', emoji: '😴', name: 'Tired' } });
    await Mood.create({ user: carol._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' } });
    // Bob shares his mood with Alice; Carol doesn't
    await Share.create({ follower: alice._id, followed: bob._id, disabled: false });
  });

  test('off by default; turning it on gives my links and one per friend who shares with me', async () => {
    assert.deepEqual((await api('/api/me/widget', { as: alice })).body, { enabled: false, links: null, friends: [] });
    const r = await api('/api/me/widget', { as: alice, method: 'POST' });
    assert.equal(r.body.enabled, true);
    assert.match(r.body.links.me, /\/w\/[A-Za-z0-9_-]{20,}\/me\.png$/);
    assert.match(r.body.links.friends, /\/friends\.png$/);
    assert.deepEqual(r.body.friends.map(f => [f.id, f.fullname]), [[6002, 'Bob']]);
    assert.match(r.body.friends[0].link, /\/friend\/6002\.png$/);
    // asking again keeps the same links
    assert.equal((await api('/api/me/widget', { as: alice, method: 'POST' })).body.links.me, r.body.links.me);
  });

  test('the links serve PNG images in widget sizes', async () => {
    const { body } = await api('/api/me/widget', { as: alice, method: 'POST' });
    const me = await image(body.links.me);
    assert.equal(me.status, 200);
    assert.equal(me.type, 'image/png');
    assert.deepEqual([me.meta.width, me.meta.height], [600, 600]);
    const friends = await image(body.links.friends);
    assert.deepEqual([friends.meta.width, friends.meta.height], [1200, 564]);
    const bobImg = await image(body.friends[0].link);
    assert.deepEqual([bobImg.meta.width, bobImg.meta.height], [600, 600]);
  });

  test("someone who doesn't share with me gets a placeholder, not their mood", async () => {
    const { body } = await api('/api/me/widget', { as: alice, method: 'POST' });
    const carolLink = body.links.me.replace('/me.png', '/friend/6003.png');
    const bobLink = body.friends[0].link;
    const [carolImg, bobImg] = await Promise.all([image(carolLink), image(bobLink)]);
    assert.equal(carolImg.status, 200);
    assert.notDeepEqual(carolImg.buf, bobImg.buf);
    // and once Bob stops sharing, his picture goes too
    const before = bobImg.buf;
    await Share.updateOne({ follower: alice._id, followed: bob._id }, { disabled: true });
    const after = await image(bobLink);
    assert.notDeepEqual(after.buf, before);
    assert.deepEqual((await api('/api/me/widget', { as: alice })).body.friends, []);
  });

  test('reset gives new links and the old ones stop working; off stops all of them', async () => {
    const first = (await api('/api/me/widget', { as: alice, method: 'POST' })).body;
    const second = (await api('/api/me/widget', { as: alice, method: 'POST', body: { reset: true } })).body;
    assert.notEqual(second.links.me, first.links.me);
    assert.equal((await image(first.links.me)).status, 404);
    assert.equal((await image(second.links.me)).status, 200);
    const off = await api('/api/me/widget', { as: alice, method: 'DELETE' });
    assert.equal(off.body.enabled, false);
    assert.equal((await image(second.links.me)).status, 404);
  });

  test('bad or unknown tokens and blocked owners get nothing', async () => {
    assert.equal((await fetch(`${base}/w/short/me.png`)).status, 404);
    assert.equal((await fetch(`${base}/w/${'x'.repeat(24)}/friends.png`)).status, 404);
    const { body } = await api('/api/me/widget', { as: alice, method: 'POST' });
    await User.updateOne({ _id: alice._id }, { is_blocked: true });
    assert.equal((await image(body.links.me)).status, 404);
  });

  test('the token is never part of the user JSON', async () => {
    await api('/api/me/widget', { as: alice, method: 'POST' });
    const u = await User.findById(alice._id).lean();
    assert.equal(u.widget_token, undefined);
  });
});
