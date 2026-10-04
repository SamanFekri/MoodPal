const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const moodExport = require('../../src/export/moods');
const { exportCommand } = require('../../src/commands/export');
const { common } = require('../../src/constants');
const { setTelegram } = require('../../src/utils/telegram');

function fakeTelegram() {
  const docs = [];
  return { docs, sendDocument: async (chatId, file, extra) => { docs.push({ chatId, file, extra }); return {}; } };
}
function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

describe('export my moods', () => {
  let server, base, sara;
  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    moodExport._resetCooldown();
    sara = await User.create({ id: 7, first_name: 'Sara', timezone: 'Asia/Tehran' });
    await Mood.create({ user: sara._id, mood: { code: 'tired', emoji: '😴', name: 'Tired' }, note: 'long day, "really" long\nand more', timestamp: new Date('2026-10-02T20:45:00Z') });
    await Mood.create({ user: sara._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' }, note: 'امروز خوب بود', timestamp: new Date('2026-10-01T05:10:00Z') });
    await Mood.create({ user: sara._id, mood: { code: 'relaxed', emoji: '😌', name: 'Relaxed' }, timestamp: new Date('2026-10-03T12:00:00Z') });
  });

  test('the CSV has every mood with its note, day and hour in their timezone, oldest first', async () => {
    const f = await moodExport.buildCsv(sara._id);
    assert.equal(f.count, 3);
    assert.equal(f.timezone, 'Asia/Tehran');
    assert.match(f.filename, /^moodpal-moods-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = f.buffer.toString('utf8');
    assert.ok(text.startsWith('﻿'), 'Excel reads it as UTF-8');
    const rows = text.slice(1).split('\r\n');
    assert.equal(rows[0], 'Date,Weekday,Time,Timezone,Mood,Note');
    assert.equal(rows[1], '2026-10-01,Thursday,08:40,Asia/Tehran,Happy,امروز خوب بود', '05:10 UTC is 08:40 in Tehran');
    assert.equal(rows[2], '2026-10-03,Saturday,00:15,Asia/Tehran,Tired,"long day, ""really"" long\nand more"', 'late UTC evening is the next day in Tehran; commas, quotes and line breaks are escaped');
    assert.equal(rows[3], '2026-10-03,Saturday,15:30,Asia/Tehran,Relaxed,', 'no note: empty cell');
  });

  test('the file is sent to their chat; once a minute; nothing to send without moods', async () => {
    const tg = fakeTelegram(); setTelegram(tg);
    const r = await moodExport.sendToChat(sara._id);
    assert.equal(r.count, 3);
    assert.equal(tg.docs.length, 1);
    assert.equal(tg.docs[0].chatId, 7);
    assert.ok(Buffer.isBuffer(tg.docs[0].file.source));
    assert.match(tg.docs[0].file.filename, /\.csv$/);
    assert.match(tg.docs[0].extra.caption, /3 moods with notes, times in Asia\/Tehran/);

    await assert.rejects(moodExport.sendToChat(sara._id), (e) => e.code === 'too_soon' && e.retry_in_s > 0);
    const empty = await User.create({ id: 8, first_name: 'New' });
    await assert.rejects(moodExport.sendToChat(empty._id), (e) => e.code === 'no_moods');
  });

  test('/export and the 📥 Export button in the bot', async () => {
    const tg = fakeTelegram(); setTelegram(tg);
    const replies = [];
    const ctx = (user) => ({ user, reply: async (t) => { replies.push(t); }, sendChatAction: async () => {} });
    await exportCommand(ctx(sara));
    assert.equal(tg.docs.length, 1);
    await exportCommand(ctx(sara));
    assert.match(replies.at(-1), /export again in \d+s/);
    const empty = await User.create({ id: 8, first_name: 'New' });
    await exportCommand(ctx(empty));
    assert.match(replies.at(-1), /haven't logged any moods yet/);

    const keyboard = common.makeKeyboardMenu({ user: { is_admin: false, is_mood_private: false } }).flat();
    assert.ok(keyboard.includes(common.MENU_BUTTONS.EXPORT), 'the keyboard has the Export button');
    assert.ok(common.MENU_SIGNATURE.includes('Export'), 'menu signature changed, so everyone gets the new keyboard');
  });

  test('the mini app button sends it to the chat', async () => {
    const tg = fakeTelegram(); setTelegram(tg);
    const call = () => fetch(`${base}/api/me/export`, { method: 'POST', headers: { 'X-Telegram-Init-Data': signInitData({ id: 7, first_name: 'Sara' }) } }).then(async r => ({ status: r.status, body: await r.json() }));
    let r = await call();
    assert.equal(r.status, 200);
    assert.equal(r.body.count, 3);
    assert.equal(tg.docs[0].chatId, 7);
    r = await call();
    assert.equal(r.status, 429);
    assert.equal(r.body.error, 'too_soon');
  });
});
