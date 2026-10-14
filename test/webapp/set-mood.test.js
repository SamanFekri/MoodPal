const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const moodController = require('../../src/controllers/mood');
const { setTelegram } = require('../../src/utils/telegram');

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}
let server, base;
const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
  method,
  headers: { 'Content-Type': 'application/json', ...(as ? { 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

describe('set my mood from the mini app', () => {
  let alice, sent;

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; moodController.NOTE_PROMPT_DELAY_MS = 0; });
  after(async () => { server.close(); await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    sent = [];
    setTelegram({ sendMessage: async (chatId, text, extra) => { sent.push({ chatId, text, extra }); return { message_id: sent.length }; } });
    alice = await User.create({ id: 7001, first_name: 'Alice' });
  });

  test('the picker gets the same 18 moods as the bot, in the same order', async () => {
    const r = await api('/api/moods');
    assert.equal(r.status, 200);
    assert.equal(r.body.moods.length, 18);
    assert.deepEqual(r.body.moods[0], { emoji: '😊', name: 'Happy', code: 'happy', tgs: '/public/tgs/happy.tgs' });
    assert.equal(r.body.moods.at(-1).code, 'naughty');
  });

  test('without a note: saved, then the bot posts name, emoji and the note prompt', async () => {
    const r = await api('/api/me/mood', { as: alice, method: 'POST', body: { code: 'motivated' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.mood.mood.code, 'motivated');
    assert.equal(r.body.mood.tgs, '/public/tgs/motivated.tgs');
    const saved = await Mood.getLastMood(alice._id);
    assert.equal(saved.mood.name, 'Motivated');
    assert.equal(saved.note, '');
    await moodController.botJob;
    assert.deepEqual(sent.map(m => [m.chatId, m.text]).slice(0, 2), [[7001, 'Motivated'], [7001, '🤩']]);
    assert.match(sent[2].text, /add a note/i);
    assert.ok(sent[2].extra.reply_markup.keyboard.flat().length > 0, 'main keyboard comes with the prompt');
  });

  test('with a note: saved with it, and the bot says the note is saved with Talk about it', async () => {
    const r = await api('/api/me/mood', { as: alice, method: 'POST', body: { code: 'tired', note: '  long week  ' } });
    assert.equal(r.body.mood.note, 'long week');
    assert.equal((await Mood.getLastMood(alice._id)).note, 'long week');
    await moodController.botJob;
    assert.deepEqual(sent.map(m => m.text).slice(0, 2), ['Tired', '😴']);
    assert.match(sent[2].text, /note .*saved/i);
    assert.deepEqual(sent[2].extra.reply_markup.inline_keyboard.flat().map(b => b.callback_data), ['talk_note']);
    assert.equal(sent.length, 3);
  });

  test('the mood is kept even when the bot cannot reach the chat', async () => {
    setTelegram({ sendMessage: async () => { throw new Error('bot was blocked by the user'); } });
    const r = await api('/api/me/mood', { as: alice, method: 'POST', body: { code: 'happy' } });
    assert.equal(r.status, 200);
    await moodController.botJob;
    assert.equal((await Mood.getLastMood(alice._id)).mood.code, 'happy');
  });

  test('rejects unknown moods and long notes, and needs Telegram sign-in', async () => {
    assert.equal((await api('/api/me/mood', { as: alice, method: 'POST', body: { code: 'ecstatic' } })).body.error, 'invalid_mood');
    assert.equal((await api('/api/me/mood', { as: alice, method: 'POST', body: { code: '__proto__' } })).body.error, 'invalid_mood');
    assert.equal((await api('/api/me/mood', { as: alice, method: 'POST', body: { code: 'happy', note: 'x'.repeat(2001) } })).body.error, 'note_too_long');
    assert.equal((await api('/api/me/mood', { method: 'POST', body: { code: 'happy' } })).status, 401);
    assert.equal(await Mood.countDocuments(), 0);
    assert.equal(sent.length, 0);
  });
});
