const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const Share = require('../../src/models/share');
const SupportContact = require('../../src/models/support_contact');
const SupportAlert = require('../../src/models/support_alert');
const support = require('../../src/support/service');
const supportCommands = require('../../src/commands/support');
const moodController = require('../../src/controllers/mood');
const { MOOD_MAP } = require('../../src/constants/mood.constant');
const { setTelegram } = require('../../src/utils/telegram');

// ---- helpers ----
let sent;
const fakeTelegram = { sendMessage: async (chatId, text, extra) => { if (fakeTelegram.fail?.(chatId)) throw Object.assign(new Error('Forbidden: bot was blocked by the user'), { response: { error_code: 403 } }); sent.push({ chatId, text, extra }); return { message_id: sent.length }; } };
const to = (u) => sent.filter(m => m.chatId === u.id);
const H = 3600 * 1000;

async function mood(user, code, at = new Date()) {
  return Mood.create({ user: user._id, mood: MOOD_MAP[code], timestamp: at });
}
async function logMood(user, code, at = new Date(), source = 'bot') {
  const m = await mood(user, code, at);
  return { mood: m, result: await support.afterMood(user._id, m, { source, now: at }) };
}
const follow = (follower, followed) => Share.create({ follower: follower._id, followed: followed._id, disabled: false });
async function supportFriend(user, friend) {
  const { contact } = await support.invite(user._id, friend.id);
  await support.respond(friend._id, contact._id, true);
  sent.length = 0;
}
const setSupport = (user, patch) => support.updateSettings(user._id, patch);

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

describe('Emotional support network', () => {
  let ada, bob, carol, dan;

  before(async () => {
    await db.connect();
    await SupportAlert.syncIndexes();
    await SupportContact.syncIndexes();
    server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`;
    moodController.NOTE_PROMPT_DELAY_MS = 0;
  });
  after(async () => { server.close(); await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    sent = []; fakeTelegram.fail = null;
    setTelegram(fakeTelegram);
    ada = await User.create({ id: 8001, first_name: 'Ada', username: 'ada' });
    bob = await User.create({ id: 8002, first_name: 'Bob' });
    carol = await User.create({ id: 8003, first_name: 'Carol' });
    dan = await User.create({ id: 8004, first_name: 'Dan' });   // not connected to Ada
    await follow(bob, ada);     // Bob sees Ada's mood
    await follow(ada, carol);   // Ada sees Carol's mood (connected the other way)
  });

  describe('settings', () => {
    test('defaults: automatic sharing, prompt and receiving on (existing users too), the usual hard moods', async () => {
      await User.collection.updateOne({ _id: ada._id }, { $unset: { support: '' } });   // a user from before the feature
      const s = support.settingsOf(await User.findById(ada._id).lean());
      assert.equal(s.auto, true);
      assert.equal(s.manual_prompt, true);
      assert.equal(s.receive, true);
      assert.equal(s.immediate, true);
      assert.deepEqual(s.emotions, support.HARD_DEFAULT);
      assert.ok(!s.emotions.includes('tired') && !s.emotions.includes('happy'));
    });

    test('only known values are accepted', async () => {
      await setSupport(ada, { auto: true, delay_minutes: 30, cooldown_hours: 12, emotions: ['sad', 'tired'], days_on: true, days: 3 });
      const s = support.settingsOf(await User.findById(ada._id).lean());
      assert.deepEqual([s.auto, s.delay_minutes, s.cooldown_hours, s.days], [true, 30, 12, 3]);
      assert.deepEqual(s.emotions, ['sad', 'tired']);
      for (const bad of [{ auto: 'yes' }, { delay_minutes: 7 }, { emotions: [] }, { emotions: ['ecstatic'] }, { emotions: ['__proto__'] }, {}]) {
        await assert.rejects(setSupport(ada, bad), (e) => e.code === 'invalid_value');
      }
    });
  });

  describe('support friends need to agree', () => {
    test('invite → the friend gets a message with yes / not now; nothing automatic until they accept', async () => {
      await setSupport(ada, { auto: true });
      const { contact, delivered } = await support.invite(ada._id, bob.id);
      assert.equal(delivered, true);
      assert.equal(contact.status, 'pending');
      const invite = to(bob)[0];
      assert.match(invite.text, /Ada.*support friend/);
      assert.deepEqual(invite.extra.reply_markup.inline_keyboard[0].map(b => b.callback_data), [`sc_ok_${contact._id}`, `sc_no_${contact._id}`]);

      sent.length = 0;
      await logMood(ada, 'sad');
      assert.equal(to(bob).length, 0, 'pending friends get no alerts');

      await support.respond(bob._id, contact._id, true);
      assert.match(to(ada).at(-1).text, /Bob.*agreed/);
      sent.length = 0;
      await logMood(ada, 'sad');
      assert.equal(to(bob).length, 1);
    });

    test('only people connected either way can be picked, up to 3, never yourself', async () => {
      await assert.rejects(support.invite(ada._id, dan.id), (e) => e.code === 'not_connected');
      await assert.rejects(support.invite(ada._id, ada.id), (e) => e.code === 'not_yourself');
      await assert.rejects(support.invite(ada._id, 999999), (e) => e.code === 'friend_not_found');
      await support.invite(ada._id, carol.id);   // Ada follows Carol: connected the other way
      for (const [i, name] of [[8010, 'Eve'], [8011, 'Fay']]) { const u = await User.create({ id: i, first_name: name }); await follow(u, ada); await support.invite(ada._id, i); }
      const gus = await User.create({ id: 8012, first_name: 'Gus' }); await follow(gus, ada);
      await assert.rejects(support.invite(ada._id, gus.id), (e) => e.code === 'too_many');
    });

    test('a "not now" is respected for a week; the friend can also stop later and Ada is told', async () => {
      const { contact } = await support.invite(ada._id, bob.id);
      await support.respond(bob._id, contact._id, false);
      assert.match(to(ada).at(-1).text, /Bob.*can't be a support friend/);
      await assert.rejects(support.invite(ada._id, bob.id), (e) => e.code === 'declined_recently');
      await support.invite(ada._id, bob.id, new Date(Date.now() + 8 * 24 * H));
      const again = await SupportContact.findOne({ user: ada._id, contact: bob._id });
      assert.equal(again.status, 'pending');
      await support.respond(bob._id, again._id, true);
      await support.stopSupporting(bob._id, ada.id);
      assert.match(to(ada).at(-1).text, /Bob.*no longer/);
      assert.equal(await SupportContact.countDocuments(), 0);
    });

    test('someone else cannot answer an invitation that is not theirs', async () => {
      const { contact } = await support.invite(ada._id, bob.id);
      await assert.rejects(support.respond(carol._id, contact._id, true), (e) => e.code === 'not_found');
      assert.equal((await SupportContact.findById(contact._id)).status, 'pending');
    });
  });

  describe('automatic alerts', () => {
    beforeEach(async () => { await supportFriend(ada, bob); });

    test('on by default: an accepted support friend hears about a hard mood without any setup', async () => {
      await User.collection.updateOne({ _id: ada._id }, { $unset: { support: '' } });
      const { result } = await logMood(ada, 'sad');
      assert.equal(result.scheduled, 1);
      assert.equal(to(bob).length, 1);
      assert.match(to(bob)[0].text, /feeling.*sad/);
    });

    test('with no support friend who said yes, nobody gets anything', async () => {
      await support.removeContact(ada._id, bob.id);
      await support.invite(ada._id, carol.id);   // invited, not answered yet
      sent.length = 0;
      const { result } = await logMood(ada, 'sad');
      assert.equal(result.scheduled, 0);
      assert.equal(to(bob).length + to(carol).length, 0);
      assert.equal(await SupportAlert.countDocuments(), 0);
    });

    test('turned off: nobody gets an automatic message', async () => {
      await setSupport(ada, { auto: false });
      await logMood(ada, 'sad');
      assert.equal(to(bob).length, 0);
    });

    test('right away: the support friend gets a warm message with message and hug buttons', async () => {
      await setSupport(ada, { auto: true });
      await logMood(ada, 'anxious');
      const msg = to(bob)[0];
      assert.match(msg.text, /Ada.*feeling.*anxious/);
      assert.deepEqual(msg.extra.reply_markup.inline_keyboard[0].map(b => b.url || b.callback_data), ['https://t.me/ada', 'hug_8001']);
      assert.equal((await SupportAlert.findOne()).status, 'sent');
    });

    test('only the moods Ada picked count', async () => {
      await setSupport(ada, { auto: true, emotions: ['tired'] });
      await logMood(ada, 'sad');
      assert.equal(to(bob).length, 0);
      await logMood(ada, 'tired');
      assert.equal(to(bob).length, 1);
      sent.length = 0;
      await setSupport(ada, { emotions: support.HARD_DEFAULT });
      await logMood(ada, 'happy');
      assert.equal(to(bob).length, 0, 'good moods never alert');
    });

    test('cooldown: at most one alert per friend per cooldown', async () => {
      await setSupport(ada, { auto: true, cooldown_hours: 6 });
      const t = Date.now();
      await logMood(ada, 'sad', new Date(t));
      await logMood(ada, 'sad', new Date(t + 1 * H));
      await logMood(ada, 'anxious', new Date(t + 5 * H));
      assert.equal(to(bob).length, 1);
      await logMood(ada, 'sad', new Date(t + 7 * H));
      assert.equal(to(bob).length, 2);
    });

    test('delay: waits, and is dropped if a better mood comes in meanwhile', async () => {
      await setSupport(ada, { auto: true, delay_minutes: 30 });
      const t = new Date();
      await logMood(ada, 'sad', t);
      assert.equal(to(bob).length, 0, 'not yet');
      assert.equal(await support.tick(new Date(t.getTime() + 10 * 60 * 1000)), 0);
      await mood(ada, 'happy', new Date(t.getTime() + 15 * 60 * 1000));
      await support.tick(new Date(t.getTime() + 31 * 60 * 1000));
      assert.equal(to(bob).length, 0);
      const a = await SupportAlert.findOne();
      assert.equal(a.status, 'canceled');
      assert.equal(a.cancel_reason, 'feeling_better');
    });

    test('delay: sent once the time is up when still struggling; never two waiting at once', async () => {
      await setSupport(ada, { auto: true, delay_minutes: 15 });
      const t = new Date();
      await logMood(ada, 'sad', t);
      await logMood(ada, 'anxious', new Date(t.getTime() + 60 * 1000));
      assert.equal(await SupportAlert.countDocuments({ status: 'pending' }), 1);
      await support.tick(new Date(t.getTime() + 16 * 60 * 1000));
      assert.equal(to(bob).length, 1);
      assert.equal((await SupportAlert.findOne()).status, 'sent');
    });

    test('repeated: only after N hard moods within the window', async () => {
      await setSupport(ada, { auto: true, immediate: false, repeat_on: true, repeat_count: 3, repeat_hours: 6 });
      const t = Date.now();
      await logMood(ada, 'sad', new Date(t));
      await logMood(ada, 'anxious', new Date(t + H));
      assert.equal(to(bob).length, 0);
      await logMood(ada, 'overwhelmed', new Date(t + 2 * H));
      assert.equal(to(bob).length, 1);
      assert.match(to(bob)[0].text, /3 hard moods in the last 6 hours/);
    });

    test('hard days in a row, in her own timezone; a good day breaks the streak', async () => {
      await User.updateOne({ _id: ada._id }, { timezone: 'Asia/Tehran' });
      await setSupport(ada, { auto: true, immediate: false, days_on: true, days: 3 });
      const now = Date.now();
      await mood(ada, 'sad', new Date(now - 2 * 24 * H));
      await mood(ada, 'happy', new Date(now - 1 * 24 * H));
      await logMood(ada, 'sad', new Date(now));
      assert.equal(to(bob).length, 0, 'yesterday was fine');
      await mood(ada, 'anxious', new Date(now - 1 * 24 * H + 60 * 1000));   // yesterday: 1 good, 1 hard → half counts as hard
      await logMood(ada, 'sad', new Date(now + 60 * 1000));
      assert.equal(to(bob).length, 1);
      assert.match(to(bob)[0].text, /3 hard days in a row/);
    });

    test('a friend who turned off support messages, or blocked the bot, is skipped without errors', async () => {
      await setSupport(ada, { auto: true });
      await setSupport(bob, { receive: false });
      await logMood(ada, 'sad');
      assert.equal(to(bob).length, 0);
      await setSupport(bob, { receive: true });
      fakeTelegram.fail = (id) => id === bob.id;
      const t = Date.now() + 7 * H;
      await logMood(ada, 'sad', new Date(t));
      const failed = await SupportAlert.findOne({ status: 'failed' });
      assert.equal(failed.error, 'unreachable');
    });

    test('turning automatic sharing off drops alerts that are still waiting', async () => {
      await setSupport(ada, { auto: true, delay_minutes: 60 });
      await logMood(ada, 'sad');
      await setSupport(ada, { auto: false });
      assert.equal((await SupportAlert.findOne()).status, 'canceled');
      await support.tick(new Date(Date.now() + 2 * H));
      assert.equal(to(bob).length, 0);
    });
  });

  describe('sharing by choice', () => {
    test('in the bot: a hard mood asks "share with a friend?" listing connected people; easy moods don\'t', async () => {
      await logMood(ada, 'happy');
      assert.equal(to(ada).length, 0);
      const { mood: m } = await logMood(ada, 'sad');
      const prompt = to(ada)[0];
      assert.match(prompt.text, /tell some friends how you're feeling/);
      const buttons = prompt.extra.reply_markup.inline_keyboard.flat();
      assert.deepEqual(buttons.map(b => b.callback_data).sort(), [`ms_t_${m._id}_8002`, `ms_t_${m._id}_8003`, `ms_a_${m._id}`, `ms_s_${m._id}`, 'ms_done'].sort());
      assert.deepEqual(buttons.filter(b => b.callback_data.startsWith('ms_t_')).map(b => b.text).sort(), ['⬜ Bob', '⬜ Carol']);
      assert.equal(buttons.find(b => b.callback_data.startsWith('ms_s_')).text, '💛 Notify 0 friends');
      assert.equal(to(bob).length + to(carol).length, 0, 'nothing is sent by the question itself');
    });

    test('the checklist: ticking sends nothing, Notify sends to the ticked friends only', async () => {
      const { mood: m } = await logMood(ada, 'sad');
      let keyboard = to(ada)[0].extra.reply_markup;
      const edits = [];
      const press = async (cb) => {
        const ctx = { user: await User.findById(ada._id), callbackQuery: { data: cb, message: { reply_markup: keyboard } }, answers: [],
          answerCbQuery: async (t) => { ctx.answers.push(t); }, editMessageReplyMarkup: async (k) => { keyboard = k; }, editMessageText: async (t) => edits.push(t) };
        await supportCommands.shareCallback(ctx);
        return ctx;
      };
      const texts = () => keyboard.inline_keyboard.flat().map(b => b.text);

      const empty = await press(`ms_s_${m._id}`);
      assert.match(empty.answers[0], /Tick at least one/);
      await press(`ms_t_${m._id}_8002`);
      assert.ok(texts().includes('✅ Bob') && texts().includes('⬜ Carol'));
      assert.ok(texts().includes('💛 Notify 1 friend'));
      await press(`ms_t_${m._id}_8002`);   // untick
      assert.ok(texts().includes('⬜ Bob'));
      await press(`ms_a_${m._id}`);         // select all
      assert.ok(texts().includes('✅ Bob') && texts().includes('✅ Carol') && texts().includes('Clear all'));
      await press(`ms_t_${m._id}_8003`);   // untick Carol again
      assert.equal(to(bob).length + to(carol).length, 0, 'still nothing sent');

      await press(`ms_s_${m._id}`);
      assert.equal(to(bob).length, 1);
      assert.match(to(bob)[0].text, /Ada.*wanted you to know.*sad/);
      assert.equal(to(carol).length, 0, 'Carol was unticked');
      assert.match(edits[0], /Notified Bob/);
    });

    test('works without automatic sharing, and can be turned off', async () => {
      await setSupport(ada, { manual_prompt: false });
      await logMood(ada, 'sad');
      assert.equal(to(ada).length, 0);
    });

    test('mini app moods get the prompt in the response, not in the bot', async () => {
      const r = await api('/api/me/mood', { as: ada, method: 'POST', body: { code: 'sad' } });
      await moodController.botJob;
      assert.deepEqual(r.body.share.friends.map(f => f.id).sort(), [8002, 8003]);
      assert.ok(!to(ada).some(m => /share how you're feeling/.test(m.text)));
      const easy = await api('/api/me/mood', { as: ada, method: 'POST', body: { code: 'happy' } });
      assert.equal(easy.body.share, null);
    });

    test('sharing sends a message once per friend; not to strangers, old moods or people who turned it off', async () => {
      const m = await mood(ada, 'sad');
      const r = await support.shareMood(ada._id, m._id, bob.id);
      assert.equal(r.status, 'sent');
      assert.match(to(bob)[0].text, /Ada.*wanted you to know.*sad/);
      assert.equal((await support.shareMood(ada._id, m._id, bob.id)).status, 'already');
      await assert.rejects(support.shareMood(ada._id, m._id, dan.id), (e) => e.code === 'not_connected');
      await assert.rejects(support.shareMood(bob._id, m._id, ada.id), (e) => e.code === 'mood_not_found');
      const old = await mood(ada, 'sad', new Date(Date.now() - 2 * 24 * H));
      await assert.rejects(support.shareMood(ada._id, old._id, carol.id), (e) => e.code === 'too_old');
      await setSupport(carol, { receive: false });
      await assert.rejects(support.shareMood(ada._id, m._id, carol.id), (e) => e.code === 'receive_off');
    });

    test('the bot buttons: share with one, the rest stay; Skip closes it', async () => {
      const m = await mood(ada, 'sad');
      const rows = [[{ text: 'Bob', callback_data: `ms_${m._id}_8002` }, { text: 'Carol', callback_data: `ms_${m._id}_8003` }], [{ text: 'Skip', callback_data: 'ms_done' }]];
      const edits = [];
      const ctx = { user: await User.findById(ada._id), callbackQuery: { data: `ms_${m._id}_8002`, message: { reply_markup: { inline_keyboard: rows } } }, answerCbQuery: async () => {}, editMessageText: async (t, extra) => edits.push({ t, extra }) };
      await supportCommands.shareCallback(ctx);
      assert.equal(to(bob).length, 1);
      assert.match(edits[0].t, /Shared with Bob/);
      assert.deepEqual(edits[0].extra.reply_markup.inline_keyboard.flat().map(b => b.text), ['Carol', 'Skip']);
      ctx.callbackQuery.data = 'ms_done';
      await supportCommands.shareCallback(ctx);
      assert.match(edits[1].t, /Take care/);
    });
  });

  describe('sharing with several friends at once', () => {

    test('the bot\'s "Share with everyone" tells everyone offered, once each', async () => {
      const m = await mood(ada, 'sad');
      const edits = [];
      const ctx = { user: await User.findById(ada._id), callbackQuery: { data: `ms_all_${m._id}` }, answerCbQuery: async () => {}, editMessageText: async (t) => edits.push(t) };
      await supportCommands.shareCallback(ctx);
      assert.equal(to(bob).length, 1);
      assert.equal(to(carol).length, 1);
      assert.match(edits[0], /Shared with (Bob and Carol|Carol and Bob)/);
      await supportCommands.shareCallback(ctx);   // tapped twice: nobody gets it twice
      assert.equal(to(bob).length, 1);
      assert.equal(to(carol).length, 1);
    });

    test('the mini app shares with the friends picked; one who can\'t get it doesn\'t stop the rest', async () => {
      const m = await mood(ada, 'sad');
      await setSupport(carol, { receive: false });
      const r = await api('/api/me/support/share', { as: ada, method: 'POST', body: { mood_id: String(m._id), telegram_ids: [8002, 8003, 8004] } });
      assert.equal(r.status, 200);
      const byId = Object.fromEntries(r.body.results.map(x => [x.id, x.status]));
      assert.deepEqual(byId, { 8002: 'sent', 8003: 'skipped', 8004: 'skipped' });
      assert.equal(to(bob).length, 1);
      assert.equal(to(carol).length + to(dan).length, 0);
      assert.equal((await api('/api/me/support/share', { as: ada, method: 'POST', body: { mood_id: String(m._id), telegram_ids: [] } })).status, 400);
    });
  });

  describe('hugs', () => {
    test('someone who got a support message (or sees the mood) can hug; strangers cannot', async () => {
      const m = await mood(ada, 'sad');
      await support.shareMood(ada._id, m._id, carol.id);   // Carol doesn't see Ada's mood but got a share
      sent.length = 0;
      assert.equal(await support.sendHug(await User.findById(carol._id).lean(), ada.id), true);
      assert.match(to(ada)[0].text, /Carol.*sent you a hug/);
      assert.equal(await support.sendHug(await User.findById(bob._id).lean(), ada.id), true);   // Bob follows Ada
      assert.equal(await support.sendHug(await User.findById(dan._id).lean(), ada.id), false);
    });
  });

  describe('a mood that is not hard', () => {
    test('notifies nobody: no support message, no share question, nothing to friends', async () => {
      await supportFriend(ada, bob);
      sent.length = 0;
      await logMood(ada, 'confused');
      await logMood(ada, 'happy');
      assert.equal(to(bob).length + to(carol).length + to(dan).length, 0);
      assert.equal(to(ada).length, 0, 'no share question in the bot');
      assert.equal(await SupportAlert.countDocuments(), 0);
    });
  });

  describe('mini app API', () => {
    test('view, settings, invite, answer, remove', async () => {
      let r = await api('/api/me/support', { as: ada });
      assert.equal(r.status, 200);
      assert.equal(r.body.settings.auto, true);
      assert.deepEqual(r.body.candidates.map(c => c.id).sort(), [8002, 8003]);
      assert.equal(r.body.emotions.length, 18);

      r = await api('/api/me/support/settings', { as: ada, method: 'POST', body: { auto: true, delay_minutes: 15 } });
      assert.equal(r.body.settings.delay_minutes, 15);
      assert.equal((await api('/api/me/support/settings', { as: ada, method: 'POST', body: { delay_minutes: 999 } })).status, 400);

      r = await api('/api/me/support/contacts', { as: ada, method: 'POST', body: { telegram_id: 8002 } });
      assert.equal(r.body.delivered, true);
      assert.deepEqual(r.body.contacts.map(c => [c.id, c.status]), [[8002, 'pending']]);
      assert.ok(!r.body.candidates.some(c => c.id === 8002));
      assert.equal((await api('/api/me/support/contacts', { as: ada, method: 'POST', body: { telegram_id: 8004 } })).body.error, 'not_connected');

      const bobView = await api('/api/me/support', { as: bob });
      assert.equal(bobView.body.supporting[0].fullname, 'Ada');
      r = await api(`/api/me/support/supporting/${bobView.body.supporting[0].invitation_id}`, { as: bob, method: 'POST', body: { accept: true } });
      assert.equal(r.body.supporting[0].status, 'accepted');

      r = await api('/api/me/support/contacts/8002', { as: ada, method: 'DELETE' });
      assert.deepEqual(r.body.contacts, []);
    });

    test('share from the mini app', async () => {
      const m = await mood(ada, 'sad');
      const r = await api('/api/me/support/share', { as: ada, method: 'POST', body: { mood_id: String(m._id), telegram_id: 8002 } });
      assert.equal(r.body.status, 'sent');
      assert.equal(to(bob).length, 1);
      assert.equal((await api('/api/me/support/share', { as: ada, method: 'POST', body: { mood_id: 'nope', telegram_id: 8002 } })).status, 404);
    });

    test('admin: a person\'s support friends, hard moods, settings and recent messages; admins only', async () => {
      const root = await User.create({ id: 8099, first_name: 'Root', is_admin: true });
      await supportFriend(ada, bob);
      await support.invite(ada._id, carol.id);
      await setSupport(ada, { emotions: ['sad', 'tired'], repeat_on: true });
      await Mood.create({ user: ada._id, mood: MOOD_MAP.sad, note: 'private note' });
      const m = await mood(ada, 'sad');
      await support.shareMood(ada._id, m._id, carol.id);
      const r = await api('/api/admin/users/8001/support', { as: root });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.hard_moods.map(x => x.code), ['sad', 'tired']);
      assert.equal(r.body.default_hard, false);
      assert.deepEqual(r.body.contacts.map(c => [c.fullname, c.status]), [['Bob', 'accepted'], ['Carol', 'pending']]);
      assert.equal(r.body.settings.auto, true);
      assert.equal(r.body.settings.repeat_on, true);
      assert.equal(r.body.alerts[0].kind, 'manual');
      assert.equal(r.body.alerts[0].to, 'Carol');
      assert.ok(!JSON.stringify(r.body).includes('private note'), 'never notes');
      const bobs = await api('/api/admin/users/8002/support', { as: root });
      assert.deepEqual(bobs.body.supporting.map(p => [p.fullname, p.status]), [['Ada', 'accepted']]);
      assert.equal((await api('/api/admin/users/8001/support', { as: bob })).status, 403);
      assert.equal((await api('/api/admin/users/123/support', { as: root })).status, 404);
    });

    test('the bot invitation buttons work too', async () => {
      const { contact } = await support.invite(ada._id, bob.id);
      const edits = [];
      const ctx = { user: await User.findById(bob._id), callbackQuery: { data: `sc_ok_${contact._id}` }, answerCbQuery: async () => {}, editMessageText: async (t) => edits.push(t) };
      await supportCommands.inviteAnswerCallback(ctx);
      assert.match(edits[0], /hear from MoodPal if Ada/);
      assert.equal((await SupportContact.findById(contact._id)).status, 'accepted');
      await supportCommands.inviteAnswerCallback(ctx);
      assert.match(edits[1], /isn't open anymore/);
    });
  });
});
