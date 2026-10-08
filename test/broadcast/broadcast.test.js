const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.BOT_USERNAME = process.env.BOT_USERNAME || 'MoodPalBot';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const AppConfig = require('../../src/models/app_config');
const Broadcast = require('../../src/models/broadcast');
const BroadcastDelivery = require('../../src/models/broadcast_delivery');
const broadcast = require('../../src/broadcast/service');
const reminders = require('../../src/reminders/service');
const { setTelegram } = require('../../src/utils/telegram');

// records every send; `fail(chatId)` may return a Telegram-shaped error
function fakeTelegram(fail = () => null) {
  const calls = [];
  const send = (method) => async (chatId, payload, extra) => {
    const err = fail(chatId, method);
    if (err) throw err;
    calls.push({ method, chatId, payload, extra });
    if (method === 'sendPhoto') return { photo: [{ file_id: 'small' }, { file_id: 'PHOTO_ID' }] };
    if (method === 'sendVideo') return { video: { file_id: 'VIDEO_ID' } };
    if (method === 'sendDocument') return { document: { file_id: 'DOC_ID' } };
    return { message_id: calls.length };
  };
  return { calls, sendMessage: send('sendMessage'), sendPhoto: send('sendPhoto'), sendVideo: send('sendVideo'), sendAnimation: send('sendAnimation'), sendAudio: send('sendAudio'), sendDocument: send('sendDocument') };
}
const tgError = (code, description, parameters) => Object.assign(new Error(description), { code, description, parameters, response: { error_code: code, description, parameters } });

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

describe('admin broadcasts', () => {
  let server, base, admin;
  const api = (path, { as, method = 'GET', body, raw, type } = {}) => fetch(base + path, {
    method,
    headers: { 'Content-Type': type || 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
    body: raw || (body ? JSON.stringify(body) : undefined),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  before(async () => { await db.connect(); await BroadcastDelivery.init(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    reminders.state.paused_until = null;
    admin = await User.create({ id: 9, first_name: 'Root', is_admin: true, last_active_at: new Date('2026-09-01') });
  });

  // people with distinct activity/sign-up times so the order is checkable
  async function people() {
    const mk = (id, name, active, created, extra = {}) => User.create({ id, first_name: name, last_active_at: new Date(active), createdAt: new Date(created), ...extra });
    await mk(1, 'Ana', '2026-09-29', '2026-01-01');
    await mk(2, 'Ben', '2026-09-10', '2026-06-01');
    await mk(3, 'Cy', '2026-09-20', '2026-03-01');
    await mk(4, 'Bot', '2026-09-30', '2026-01-01', { is_bot: true });
    await mk(5, 'Banned', '2026-09-30', '2026-01-01', { is_blocked: true });
    await mk(6, 'Gone', '2026-09-30', '2026-01-01', { reminder: { bot_blocked: true } });
  }

  test('only admins can broadcast; a test goes only to the admin', async () => {
    await people();
    const ana = await User.findOne({ id: 1 });
    assert.equal((await api('/api/admin/broadcasts', { as: ana })).status, 403);
    assert.equal((await api('/api/admin/broadcasts', { as: ana, method: 'POST', body: { text: 'hi all' } })).status, 403);

    const tg = fakeTelegram(); setTelegram(tg);
    const r = await api('/api/admin/broadcasts/test', { as: admin, method: 'POST', body: { text: 'Big update!', button: { text: 'Open', url: 'https://example.com' } } });
    assert.equal(r.status, 200);
    assert.deepEqual(tg.calls.map(c => c.chatId), [9], 'only the admin');
    assert.equal(tg.calls[0].payload, 'Big update!');
    assert.deepEqual(tg.calls[0].extra.reply_markup.inline_keyboard[0][0], { text: 'Open', url: 'https://example.com' });
    assert.equal(await Broadcast.countDocuments(), 0, 'a test is not a broadcast');
  });

  test('bad input is refused before anything is sent', async () => {
    const bad = async (body) => (await api('/api/admin/broadcasts', { as: admin, method: 'POST', body })).body.error;
    assert.equal(await bad({ text: '   ' }), 'empty_message');
    assert.equal(await bad({ kind: 'photo' }), 'missing_media');
    assert.equal(await bad({ kind: 'photo', file_id: 'X', text: 'x'.repeat(1025) }), 'caption_too_long');
    assert.equal(await bad({ text: 'hi', button: { text: 'Go', url: 'javascript:alert(1)' } }), 'invalid_button');
  });

  test('everyone reachable gets it, most recently active first by default, at the capped speed', async () => {
    await people();
    const tg = fakeTelegram(); setTelegram(tg);
    await AppConfig.get(); await AppConfig.updateOne({ key: 'main' }, { broadcast_rate_per_second: 2 });
    const r = await api('/api/admin/broadcasts', { as: admin, method: 'POST', body: { text: 'Hello everyone' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 4, 'Ana, Ben, Cy and the admin; not the bot, the banned or the unreachable');

    assert.deepEqual(await broadcast.drain(new Date()), ['sent', 'sent'], 'two per run');
    assert.deepEqual(await broadcast.drain(new Date()), ['sent', 'sent']);
    // the admin just used the mini app, so they are the most recent; then Ana (Sep 29), Cy (Sep 20), Ben (Sep 10)
    assert.deepEqual(tg.calls.map(c => c.chatId), [9, 1, 3, 2], 'most recently active first');
    assert.equal((await Broadcast.findById(r.body.id)).status, 'done');
    const v = (await api('/api/admin/broadcasts', { as: admin })).body.broadcasts[0];
    assert.equal(v.sent, 4); assert.equal(v.total, 4); assert.equal(v.status, 'done'); assert.equal(v.order, 'recent_active');
  });

  test('other orders: newest users first, oldest users first, least active first', async () => {
    await people();
    const order = async (o) => {
      const tg = fakeTelegram(); setTelegram(tg);
      await broadcast.create(admin._id, { text: 'x', order: o });
      await broadcast.drain(new Date(), { limit: 10 });
      return tg.calls.map(c => c.chatId);
    };
    // admin: active Sep 1, joined now · Ana: active Sep 29, joined Jan · Ben: Sep 10, Jun · Cy: Sep 20, Mar
    assert.deepEqual(await order('newest'), [9, 2, 3, 1]);
    assert.deepEqual(await order('oldest'), [1, 3, 2, 9]);
    assert.deepEqual(await order('least_active'), [9, 2, 3, 1]);
    assert.deepEqual(await order('something-else'), [1, 3, 2, 9], 'unknown order falls back to most recently active');
  });

  test('photos, videos and files are uploaded once and sent by file id', async () => {
    await people();
    const tg = fakeTelegram(); setTelegram(tg);
    const up = await api('/api/admin/broadcasts/media?name=launch.jpg', { as: admin, method: 'POST', raw: Buffer.from('fake-jpeg-bytes'), type: 'image/jpeg' });
    assert.equal(up.status, 200);
    assert.deepEqual({ kind: up.body.kind, file_id: up.body.file_id }, { kind: 'photo', file_id: 'PHOTO_ID' });
    assert.equal(tg.calls[0].chatId, 9, 'uploaded into the admin chat (their preview)');
    assert.ok(Buffer.isBuffer(tg.calls[0].payload.source));

    assert.equal(broadcast.kindFor('video/mp4'), 'video');
    assert.equal(broadcast.kindFor('image/gif'), 'animation');
    assert.equal(broadcast.kindFor('audio/mpeg'), 'audio');
    assert.equal(broadcast.kindFor('application/pdf', 'menu.pdf'), 'document');

    await api('/api/admin/broadcasts', { as: admin, method: 'POST', body: { kind: 'photo', file_id: 'PHOTO_ID', text: 'New look!' } });
    tg.calls.length = 0;
    await broadcast.drain(new Date(), { limit: 10 });
    assert.equal(tg.calls.length, 4);
    assert.ok(tg.calls.every(c => c.method === 'sendPhoto' && c.payload === 'PHOTO_ID' && c.extra.caption === 'New look!'));
  });

  test('an earlier broadcast can be sent again, to everyone or only to people who missed it', async () => {
    await people();
    // Ben can't be reached the first time; the photo goes out by its file id
    let tg = fakeTelegram((chatId) => (chatId === 2 ? tgError(500, 'Internal Server Error') : null)); setTelegram(tg);
    const first = await broadcast.create(admin._id, { kind: 'photo', file_id: 'PHOTO_ID', file_name: 'guide.png', text: 'Add your friends', button: { text: 'Open', url: 'https://t.me/MoodPalBot?startapp' } });
    for (let i = 0; i < 10; i++) await broadcast.drain(new Date(Date.now() + i * 3600000), { limit: 10 });
    const sentFirst = await BroadcastDelivery.find({ broadcast: first._id, status: 'sent' }).distinct('chat_id');
    assert.ok(!sentFirst.includes(2), 'Ben did not get it');

    assert.equal((await api(`/api/admin/broadcasts/${first._id}/resend`, { as: { id: 1, first_name: 'Ana' }, method: 'POST', body: {} })).status, 403);
    assert.equal((await api('/api/admin/broadcasts/0123456789abcdef01234567/resend', { as: admin, method: 'POST', body: {} })).status, 404);

    // a new person joins; "only who missed it" reaches Ben and the newcomer, nobody else
    await User.create({ id: 7, first_name: 'Dee', last_active_at: new Date('2026-09-25') });
    tg = fakeTelegram(); setTelegram(tg);
    const missed = await api(`/api/admin/broadcasts/${first._id}/resend`, { as: admin, method: 'POST', body: { audience: 'missed' } });
    assert.equal(missed.status, 200);
    assert.equal(missed.body.total, 2);
    await broadcast.drain(new Date(), { limit: 10 });
    assert.deepEqual(tg.calls.map(c => c.chatId).sort(), [2, 7]);
    assert.equal(tg.calls[0].method, 'sendPhoto');
    assert.equal(tg.calls[0].payload, 'PHOTO_ID', 'same media, no re-upload');
    assert.equal(tg.calls[0].extra.caption, 'Add your friends');
    const copy = await Broadcast.findById(missed.body.id).lean();
    assert.equal(String(copy.resent_from), String(first._id));
    assert.equal(copy.only_missed, true);
    assert.equal(copy.button.url, 'https://t.me/MoodPalBot?startapp');

    // while that one is still sending, it can't be resent; once done, "everyone" goes to all reachable people
    const sending = await broadcast.create(admin._id, { text: 'Busy' });
    const refused = await api(`/api/admin/broadcasts/${sending._id}/resend`, { as: admin, method: 'POST', body: {} });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error, 'still_sending');
    const everyone = await api(`/api/admin/broadcasts/${first._id}/resend`, { as: admin, method: 'POST', body: { audience: 'everyone', order: 'newest' } });
    assert.equal(everyone.body.total, 5, 'Ana, Ben, Cy, Dee and the admin');
    const v = everyone.body.broadcasts.find(b => String(b.id) === String(everyone.body.id));
    assert.equal(v.order, 'newest');
    assert.equal(v.file_id, 'PHOTO_ID');
    assert.equal(String(v.resent_from), String(first._id));
  });

  test('blocked bot marks the person unreachable; Telegram 429 pauses every queue; cancel stops the rest', async () => {
    await people();
    setTelegram(fakeTelegram((chatId) => (chatId === 1 ? tgError(403, 'Forbidden: bot was blocked by the user') : chatId === 3 ? tgError(429, 'Too Many Requests: retry after 9', { retry_after: 9 }) : null)));
    const b = await broadcast.create(admin._id, { text: 'Hi' });
    assert.deepEqual(await broadcast.drain(new Date(), { limit: 10 }), ['failed', 'rate_limited']);
    assert.equal((await User.findOne({ id: 1 }).lean()).reminder.bot_blocked, true, 'skipped by future broadcasts and reminders');
    assert.ok(reminders.state.paused_until > new Date(), 'the pause is shared with reminders');
    assert.deepEqual(await broadcast.drain(new Date()), [], 'paused');
    assert.deepEqual(await reminders.drain(new Date()), [], 'reminders wait too');

    const r = await api(`/api/admin/broadcasts/${b._id}/cancel`, { as: admin, method: 'POST' });
    assert.equal(r.status, 200);
    const v = r.body.broadcasts[0];
    assert.equal(v.status, 'cancelled');
    assert.equal(v.failed, 1);
    assert.equal(v.skipped, 3);
    assert.equal(v.waiting, 0);
    assert.equal((await api(`/api/admin/broadcasts/${b._id}/cancel`, { as: admin, method: 'POST' })).status, 404, 'already stopped');
  });
});
