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

    test('the weekly radar: from the first to the last week with moods, smoothed, empty weeks hold the shape', async () => {
      const Y = 2026;
      // weeks 1, 2, 3 happy; nothing in week 4; week 5 sad; week 6 one angry mood among happy ones
      await moods(saman, [['happy', at(Y, 0, 1)], ['happy', at(Y, 0, 8)], ['relaxed', at(Y, 0, 15)],
        ['sad', at(Y, 0, 29)], ['sad', at(Y, 0, 30)], ['happy', at(Y, 1, 5)], ['happy', at(Y, 1, 6)], ['angry', at(Y, 1, 7)]]);
      const { radar } = await yearStats(saman._id, Y);
      assert.ok(radar, 'enough weeks for a radar');
      assert.deepEqual(radar.axes, ['Positive', 'Motivated', 'Anxious', 'Low', 'Drained', 'Calm']);
      assert.deepEqual(radar.weeks.map(w => w.week), [1, 2, 3, 4, 5, 6]);
      assert.equal(radar.weeks[0].month, 'January');
      assert.equal(radar.weeks[5].month, 'February');
      for (const w of radar.weeks) assert.ok(Math.abs(w.values.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'each week is a whole');
      assert.equal(radar.weeks[0].values[0], 1, 'week 1: all positive');
      assert.ok(radar.weeks[4].values[3] > 0.5, 'week 5 leans Low');
      assert.ok(radar.weeks[5].values[4] < 0.34, 'one angry mood in week 6 is smoothed, not a jump');
      assert.ok(Math.abs(radar.year.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    });

    test('no radar with fewer than 4 weeks of moods', async () => {
      await moods(saman, [['happy', at(2026, 0, 1)], ['happy', at(2026, 0, 2)], ['sad', at(2026, 0, 9)], ['happy', at(2026, 0, 16)]]);
      assert.equal((await yearStats(saman._id, 2026)).radar, null);
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

  describe('the queue and the cache', () => {
    beforeEach(async () => { await moods(saman, Array.from({ length: 6 }, (_, i) => ['happy', at(new Date().getFullYear(), 0, i + 1)])); });

    test('one video at a time, in order; asking again while waiting does not add a second request', async (t) => {
      await yearly.updateSettings(root._id, { enabled: true });
      const dan = await User.create({ id: 9102, first_name: 'Dan' });
      const y = new Date().getFullYear();
      await moods(dan, Array.from({ length: 6 }, (_, i) => ['sad', at(y, 1, i + 1)]));
      let running = 0, most = 0, open;
      const gate = new Promise(r => { open = r; });
      t.after(() => open());   // even if an assertion fails, the queue must not stay stuck for the next tests
      const order = [];
      yearly._setRenderer(async (stats) => {
        running++; most = Math.max(most, running); renders++;
        order.push(stats.name);
        await gate;
        running--;
        return { path: __filename, width: 1080, height: 1920, duration: 22 };
      });
      const me = await User.findById(saman._id).lean();
      const first = yearly.requestOwn(me);
      for (let i = 0; i < 1000 && (await yearly.adminView()).in_queue < 1; i++) await new Promise(r => setTimeout(r, 5));
      const second = yearly.requestOwn(await User.findById(dan._id).lean());
      for (let i = 0; i < 1000 && (await yearly.adminView()).in_queue < 2; i++) await new Promise(r => setTimeout(r, 5));
      const again = await yearly.requestOwn(me);
      assert.equal(again.status, 'already_queued');
      assert.match(sent.filter(m => m.chatId === saman.id && !m.edit).at(-1).text, /already|being made right now/);
      const view = await yearly.adminView();
      assert.equal(view.in_queue, 2);
      assert.equal(view.queue.now.name, 'Saman', 'the admin sees who is being made');
      assert.deepEqual(view.queue.waiting.map(w => w.name), ['Dan'], 'and who is waiting, in order');
      assert.deepEqual(yearly.statusOf(dan.id), { place: 1, percent: 0 }, 'the mini app shows Dan his place');
      assert.equal(yearly.statusOf(saman.id).place, 0);
      assert.equal(yearly.statusOf(root.id), null);
      assert.match(sent.find(m => m.chatId === dan.id).text, /1 ahead of you/);
      open();
      assert.deepEqual([(await first).status, (await second).status], ['sent', 'sent']);
      assert.equal(renders, 2, 'Saman\'s second tap made nothing');
      assert.equal(most, 1, 'never two at once');
      assert.deepEqual(order, ['Saman', 'Dan']);
      assert.equal(videos(saman).length, 1);
      assert.equal((await yearly.adminView()).in_queue, 0);
    });

    test('a kept video is made new after a day, or as soon as a mood is added', async () => {
      await yearly.updateSettings(root._id, { enabled: true });
      const me = await User.findById(saman._id).lean();
      assert.equal((await yearly.requestOwn(me)).status, 'sent');
      assert.equal((await yearly.requestOwn(me)).status, 'cached');
      await YearlyVideo.updateOne({ user: saman._id }, { made_at: new Date(Date.now() - yearly.REUSE_MS - 1000) });
      assert.equal((await yearly.requestOwn(me)).status, 'sent', 'older than a day');
      assert.equal((await yearly.requestOwn(me)).status, 'cached');
      await moods(saman, [['happy', at(new Date().getFullYear(), 0, 20)]]);
      assert.equal((await yearly.requestOwn(me)).status, 'sent', 'a new mood');
      assert.equal(renders, 3);
    });
  });

  describe('a stuck video', () => {
    beforeEach(async () => { await moods(saman, Array.from({ length: 6 }, (_, i) => ['happy', at(new Date().getFullYear(), 0, i + 1)])); });

    test('the admin sees how long it has been stuck and can restart it; it is made again, first in line', async (t) => {
      await yearly.updateSettings(root._id, { enabled: true });
      let calls = 0, release;
      t.after(() => release?.());
      yearly._setRenderer(async (stats, out, { signal }) => {
        calls++;
        if (calls === 1) {   // the first try hangs until it is stopped
          await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('stopped'))));
        }
        await new Promise(r => { release = r; setTimeout(r, 10); });
        return { path: __filename, width: 1080, height: 1920, duration: 22 };
      });
      const me = await User.findById(saman._id).lean();
      const done = yearly.requestOwn(me);
      for (let i = 0; i < 1000 && calls < 1; i++) await new Promise(r => setTimeout(r, 5));
      let view = await yearly.adminView();
      assert.equal(view.queue.now.name, 'Saman');
      assert.equal(view.queue.now.stuck, false, 'just started');
      assert.equal(view.queue.now.minutes, 0);

      assert.equal((await api('/api/admin/yearly/restart', { as: saman, method: 'POST' })).status, 403);
      const r = await api('/api/admin/yearly/restart', { as: root, method: 'POST' });
      assert.equal(r.status, 200);
      assert.equal((await done).status, 'sent', 'made on the second try');
      assert.equal(calls, 2);
      assert.equal(videos(saman).length, 1);
      assert.ok(!sent.some(m => m.chatId === saman.id && /went wrong/.test(m.text)), 'Saman was not told it failed');
      assert.equal((await api('/api/admin/yearly/restart', { as: root, method: 'POST' })).status, 409, 'nothing running now');
    });
  });

  describe('start fresh', () => {
    test('admins can forget this year\'s videos so the next request is made new; others cannot', async () => {
      await yearly.updateSettings(root._id, { enabled: true });
      await moods(saman, Array.from({ length: 6 }, (_, i) => ['happy', at(new Date().getFullYear(), 0, i + 1)]));
      const me = await User.findById(saman._id).lean();
      assert.equal((await yearly.requestOwn(me)).status, 'sent');
      assert.equal((await yearly.requestOwn(me)).status, 'cached');
      assert.equal((await api('/api/admin/yearly/reset', { as: saman, method: 'POST' })).status, 403);
      const r = await api('/api/admin/yearly/reset', { as: root, method: 'POST' });
      assert.equal(r.body.cleared, 1);
      assert.equal(r.body.made, 0);
      const before = renders;
      assert.equal((await yearly.requestOwn(me)).status, 'sent', 'made again');
      assert.equal(renders, before + 1);
      assert.equal(videos(saman).length, 3, 'nobody was messaged by the reset itself');
    });
  });

  describe('disk space', () => {
    test('the video file is deleted after sending; leftovers are cleared at startup', async () => {
      const fs = require('fs'), os = require('os'), path = require('path');
      const dir = path.join(os.tmpdir(), 'moodpal-yearly');
      let made = null;
      yearly._setRenderer(async (stats, out) => { fs.writeFileSync(out, 'video'); made = out; return { path: out, width: 1080, height: 1920, duration: 22 }; });
      await moods(root, Array.from({ length: 5 }, (_, i) => ['happy', at(new Date().getFullYear(), 0, i + 1)]));
      assert.equal((await yearly.requestOwn(await User.findById(root._id).lean())).status, 'sent');
      await new Promise(r => setTimeout(r, 50));
      assert.ok(made && !fs.existsSync(made), 'gone after sending');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'left-by-a-crash.mp4'), 'x');
      await yearly.start({ log: () => {} });
      assert.ok(!fs.existsSync(dir), 'cleared at startup');
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
      assert.deepEqual((await api('/api/me/yearly', { as: saman })).body, { available: false, year: yearly.state.year, enabled: false, making: null });
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
