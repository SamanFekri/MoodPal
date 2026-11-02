const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.BOT_USERNAME = process.env.BOT_USERNAME || 'MoodPalBot';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const AppConfig = require('../../src/models/app_config');
const YearlyVideo = require('../../src/models/yearly_video');
const Broadcast = require('../../src/models/broadcast');
const { MOOD_MAP } = require('../../src/constants/mood.constant');
const { common } = require('../../src/constants');
const { yearStats } = require('../../src/yearly/stats');
const yearly = require('../../src/yearly/service');
const { setTelegram } = require('../../src/utils/telegram');

let sent, renders;
const tg = {
  sendMessage: async (chatId, text) => { sent.push({ chatId, text }); return { message_id: sent.length }; },
  editMessageText: async (chatId, id, _i, text) => { sent.push({ chatId, text, edit: true }); },
  sendVideo: async (chatId, video, extra) => { sent.push({ chatId, video, caption: extra.caption, kind: 'video' }); return { video: { file_id: `file-${sent.length}` } }; },
};
const videos = (u) => sent.filter(m => m.kind === 'video' && m.chatId === u.id);
const at = (y, m, d, h = 12) => new Date(Date.UTC(y, m, d, h));
async function moods(user, list) { for (const [code, date] of list) await Mood.create({ user: user._id, mood: MOOD_MAP[code], timestamp: date }); }

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData')).toString(cryptoJs.enc.Hex));
  return p.toString();
}
let server, base;
const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

describe('Year in Moods', () => {
  let saman, root;

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    sent = []; renders = 0;
    setTelegram(tg);
    yearly._setRenderer(async (stats, out) => { renders++; return { path: __filename, width: 1080, height: 1920, duration: 22 }; });
    saman = await User.create({ id: 9101, first_name: 'Saman', timezone: 'Asia/Tehran' });
    root = await User.create({ id: 9199, first_name: 'Root', is_admin: true });
    await AppConfig.deleteMany({});
    await yearly.load();
  });

  describe('the numbers', () => {
    test('totals, days, longest streak, top mood, groups, months and best/toughest month', async () => {
      await moods(saman, [
        ['happy', at(2026, 0, 1)], ['happy', at(2026, 0, 2)], ['relaxed', at(2026, 0, 3)], ['happy', at(2026, 0, 3, 15)],
        ['sad', at(2026, 2, 10)], ['anxious', at(2026, 2, 11)], ['sad', at(2026, 2, 20)],
        ['excited', at(2026, 5, 5)],
        ['happy', at(2025, 11, 31, 10)],   // last year: not counted
      ]);
      const s = await yearStats(saman._id, 2026);
      assert.equal(s.total, 8);
      assert.equal(s.days, 7);
      assert.equal(s.streak, 3, 'Jan 1-3');
      assert.deepEqual([s.top.code, s.top.count, s.top.pct], ['happy', 3, 38]);
      assert.equal(s.groups[0].key, 'positive');
      assert.equal(s.months[0].code, 'happy');
      assert.equal(s.months[2].code, 'sad');
      assert.equal(s.months[11].code, null);
      assert.equal(s.best.label, 'January');
      assert.equal(s.toughest.label, 'March');
      assert.equal(s.enough, true);
    });

    test('days follow the person\'s own timezone', async () => {
      // 21:00 UTC on Dec 31, 2025 is already Jan 1, 2026 in Tehran
      await moods(saman, [['happy', new Date(Date.UTC(2025, 11, 31, 21, 0))]]);
      assert.equal((await yearStats(saman._id, 2026)).total, 1);
      assert.equal((await yearStats(saman._id, 2025)).total, 0);
    });
  });

  describe('who can get it', () => {
    beforeEach(async () => { await moods(saman, Array.from({ length: 6 }, (_, i) => ['happy', at(new Date().getFullYear(), 0, i + 1)])); });

    test('off by default: people are told it is not open, admins can test it', async () => {
      assert.equal(yearly.state.enabled, false);
      const r = await yearly.requestOwn(await User.findById(saman._id).lean());
      assert.equal(r.status, 'not_open');
      assert.match(sent[0].text, /isn't open yet/);
      assert.equal(renders, 0);
      await moods(root, Array.from({ length: 5 }, (_, i) => ['relaxed', at(new Date().getFullYear(), 1, i + 1)]));
      assert.equal((await yearly.requestOwn(await User.findById(root._id).lean())).status, 'sent');
      assert.equal(videos(root).length, 1);
      assert.match(videos(root)[0].caption, /Instagram story/);
      assert.match(videos(root)[0].caption, /t\.me\/MoodPalBot/);
    });

    test('once on, everyone gets it; the same video is reused while their moods are unchanged', async () => {
      await yearly.updateSettings(root._id, { enabled: true });
      const me = await User.findById(saman._id).lean();
      assert.equal((await yearly.requestOwn(me)).status, 'sent');
      assert.equal((await yearly.requestOwn(me)).status, 'cached');
      assert.equal(renders, 1);
      assert.equal(typeof videos(saman)[0].video, 'object', 'first time: the rendered file is uploaded');
      assert.match(videos(saman)[1].video, /^file-\d+$/, 'second time: Telegram\'s stored file_id, no upload');
      assert.equal((await YearlyVideo.findOne({ user: saman._id })).moods, 6);
    });

    test('too few moods: a kind note, no video', async () => {
      await yearly.updateSettings(root._id, { enabled: true });
      const dan = await User.create({ id: 9102, first_name: 'Dan' });
      await moods(dan, [['happy', at(new Date().getFullYear(), 0, 1)]]);
      const r = await yearly.requestOwn(await User.findById(dan._id).lean());
      assert.equal(r.status, 'not_enough');
      assert.match(sent.at(-1).text, /at least 5 moods/);
      assert.equal(renders, 0);
    });

    test('an admin can preview anyone\'s video in their own chat', async () => {
      const r = await api(`/api/admin/users/${saman.id}/yearly`, { as: root, method: 'POST' });
      assert.equal(r.status, 200);
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.equal(videos(root).length, 1);
      assert.match(videos(root)[0].caption, /Saman's \d{4} in moods \(admin preview/);
      assert.equal(videos(saman).length, 0, 'Saman gets nothing');
      assert.equal((await api(`/api/admin/users/${saman.id}/yearly`, { as: saman, method: 'POST' })).status, 403);
    });
  });

  describe('switching it on', () => {
    test('sends everyone the announcement once per year, with a button into the bot', async () => {
      let v = await yearly.updateSettings(root._id, { enabled: true });
      assert.equal(v.just_announced, true);
      const b = await Broadcast.findOne().lean();
      assert.match(b.text, /in moods is ready/);
      assert.deepEqual(b.button, { text: `✨ Get my ${yearly.state.year}`, url: 'https://t.me/MoodPalBot?start=year' });
      await yearly.updateSettings(root._id, { enabled: false });
      v = await yearly.updateSettings(root._id, { enabled: true });
      assert.equal(v.just_announced, false);
      assert.equal(await Broadcast.countDocuments(), 1);
    });

    test('the bot menu shows ✨ <year> to everyone once on, and to admins always', async () => {
      const menu = (u) => common.makeKeyboardMenu({ user: u }).flat();
      assert.ok(!menu({ is_admin: false }).includes(`✨ ${yearly.state.year}`));
      assert.ok(menu({ is_admin: true }).includes(`✨ ${yearly.state.year}`));
      const before = common.menuSignature();
      await yearly.updateSettings(root._id, { enabled: true });
      assert.ok(menu({ is_admin: false }).includes(`✨ ${yearly.state.year}`));
      assert.notEqual(common.menuSignature(), before, 'menus are refreshed when it opens');
    });
  });

  describe('mini app API', () => {
    test('availability, asking for mine, admin view and settings (admins only)', async () => {
      assert.deepEqual((await api('/api/me/yearly', { as: saman })).body, { available: false, year: yearly.state.year, enabled: false });
      assert.equal((await api('/api/me/yearly', { as: saman, method: 'POST' })).status, 403);
      assert.equal((await api('/api/admin/yearly', { as: saman })).status, 403);
      const v = (await api('/api/admin/yearly', { as: root })).body;
      assert.deepEqual([v.enabled, v.made, v.min_moods], [false, 0, 5]);
      assert.equal((await api('/api/admin/yearly/settings', { as: root, method: 'POST', body: { year: 1999 } })).status, 400);
      const on = (await api('/api/admin/yearly/settings', { as: root, method: 'POST', body: { enabled: true } })).body;
      assert.equal(on.enabled, true);
      assert.equal((await api('/api/me/yearly', { as: saman })).body.available, true);
    });
  });
});
