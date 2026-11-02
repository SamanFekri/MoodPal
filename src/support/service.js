// Emotional support network.
//
// - Emergency (support) friends: up to MAX_CONTACTS people a user picks. Each gets an invitation in the
//   bot and only receives automatic alerts after accepting. Either side can end it at any time.
// - Automatic alerts (on by default, user.support.auto; only to support friends who accepted, so with none
//   nobody is told): after a hard mood, triggers decide whether to alert —
//   right away, after N hard moods within H hours, or after D hard days in a row (in the user's
//   timezone). An optional delay holds the alert, and it's dropped if a better mood comes in meanwhile.
//   One alert per friend per cooldown, never two waiting at once.
// - Manual sharing: after a hard mood the user is asked "share how you're feeling with a friend?" (in
//   the bot, or in the mini app when the mood was picked there) and picks a friend or skips.
// - Friends get a warm message with "Message <name>" and "Send a hug". Anyone can turn off receiving.
//
// The support_alerts rows are the queue: a worker sends the ones whose delay is over, so alerts go out
// whether or not the mini app is open. Notes are never included.
const User = require('../models/user');
const Mood = require('../models/mood');
const Share = require('../models/share');
const SupportContact = require('../models/support_contact');
const SupportAlert = require('../models/support_alert');
const { msgs } = require('../constants');
const { MOODS, MOOD_MAP } = require('../constants/mood.constant');
const { getTelegram } = require('../utils/telegram');
const time = require('../reminders/time');

const HARD_DEFAULT = ['sad', 'disappointed', 'overwhelmed', 'anxious', 'overthinking', 'nervous', 'angry'];
const OPTIONS = {
  repeat_count: [2, 3, 4, 5],
  repeat_hours: [6, 12, 24, 48],
  days: [2, 3, 4, 5],
  delay_minutes: [0, 15, 30, 60, 120],
  cooldown_hours: [3, 6, 12, 24],
};
const BOOLEANS = ['auto', 'immediate', 'repeat_on', 'days_on', 'manual_prompt', 'receive'];
const MAX_CONTACTS = 3;
const DECLINE_COOLDOWN_MS = 7 * 24 * 3600 * 1000;   // after a "no", wait a week before asking the same person again
const SHARE_WINDOW_MS = 24 * 3600 * 1000;            // a mood can be shared for a day
const HUG_WINDOW_MS = 14 * 24 * 3600 * 1000;
const PROMPT_FRIENDS = 12;
const TICK_MS = 20 * 1000;

// callback_data prefixes (none contains "mood_" or "share_", which other handlers match)
// SHARE_TICK / SHARE_ALL_TICK / SHARE_SEND drive the checklist; SHARE (one friend) and SHARE_ALL are the
// older one-tap buttons, still answered for prompts already sitting in people's chats
const CB = { ACCEPT: 'sc_ok_', DECLINE: 'sc_no_', SHARE: 'ms_', SHARE_ALL: 'ms_all_', SHARE_TICK: 'ms_t_', SHARE_ALL_TICK: 'ms_a_', SHARE_SEND: 'ms_s_', SHARE_DONE: 'ms_done', HUG: 'hug_' };
const TICK_OFF = '⬜ ';
const TICK_ON = '✅ ';
const MAX_SHARE_AT_ONCE = 20;

class SupportError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const firstName = (u) => u?.first_name || u?.username || 'Your friend';
const fullname = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || 'Unnamed';
const errorCode = (e) => e?.response?.error_code ?? e?.code;
const isBlockedError = (e) => errorCode(e) === 403 || (errorCode(e) === 400 && /chat not found|user is deactivated/i.test(e?.description || e?.message || ''));

// ---------- settings ----------

function settingsOf(user) {
  const s = user?.support || {};
  const pick = (key, def) => (OPTIONS[key].includes(s[key]) ? s[key] : def);
  const emotions = Array.isArray(s.emotions) && s.emotions.length ? s.emotions.filter(c => MOOD_MAP[c]) : HARD_DEFAULT;
  return {
    auto: s.auto !== false,
    emotions: emotions.length ? emotions : HARD_DEFAULT,
    immediate: s.immediate !== false,
    repeat_on: s.repeat_on === true,
    repeat_count: pick('repeat_count', 3),
    repeat_hours: pick('repeat_hours', 24),
    days_on: s.days_on === true,
    days: pick('days', 2),
    delay_minutes: pick('delay_minutes', 0),
    cooldown_hours: pick('cooldown_hours', 6),
    manual_prompt: s.manual_prompt !== false,
    receive: s.receive !== false,
  };
}

// validates a partial update; throws SupportError('invalid_value') on anything unexpected
async function updateSettings(userId, body = {}) {
  const set = {};
  for (const key of BOOLEANS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') throw new SupportError('invalid_value');
    set[`support.${key}`] = body[key];
  }
  for (const key of Object.keys(OPTIONS)) {
    if (body[key] === undefined) continue;
    if (!OPTIONS[key].includes(body[key])) throw new SupportError('invalid_value');
    set[`support.${key}`] = body[key];
  }
  if (body.emotions !== undefined) {
    if (!Array.isArray(body.emotions) || !body.emotions.length || body.emotions.some(c => typeof c !== 'string' || !Object.hasOwn(MOOD_MAP, c))) throw new SupportError('invalid_value');
    set['support.emotions'] = [...new Set(body.emotions)];
  }
  if (!Object.keys(set).length) throw new SupportError('invalid_value');
  await User.updateOne({ _id: userId }, set);
  // turning automatic sharing off drops alerts that are still waiting
  if (set['support.auto'] === false) await cancelOpen({ user: userId }, 'auto_off');
}

// ---------- who ----------

// people connected to the user in either direction (they see my mood, or I see theirs)
async function connections(userId) {
  const shares = await Share.find({ disabled: false, $or: [{ follower: userId }, { followed: userId }] }).select('follower followed').lean();
  const ids = [...new Set(shares.map(s => String(String(s.follower) === String(userId) ? s.followed : s.follower)))];
  if (!ids.length) return [];
  return User.find({ _id: { $in: ids }, is_blocked: { $ne: true }, is_bot: { $ne: true } }).lean();
}

const canReceive = (u) => u && !u.is_blocked && !u.is_bot && u.support?.receive !== false;

// who the "share with a friend?" prompt offers: accepted support friends first, then the rest
async function shareTargets(user) {
  const [people, accepted] = await Promise.all([
    connections(user._id),
    SupportContact.find({ user: user._id, status: 'accepted' }).populate('contact').lean(),
  ]);
  const seen = new Set();
  const out = [];
  for (const c of accepted) if (c.contact && canReceive(c.contact) && !seen.has(String(c.contact._id))) { seen.add(String(c.contact._id)); out.push({ user: c.contact, support: true }); }
  people.sort((a, b) => fullname(a).localeCompare(fullname(b)));
  for (const p of people) if (canReceive(p) && !seen.has(String(p._id))) { seen.add(String(p._id)); out.push({ user: p, support: false }); }
  return out;
}

// ---------- triggers ----------

const tzOf = (user) => (time.isValidTimezone(user.timezone) ? user.timezone : time.envDefaultTimezone());
const dayKey = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// hard days in a row, ending today (in the user's timezone). A day is hard when at least half of its
// moods are hard ones; a day without moods breaks the streak.
async function hardDayStreak(user, emotions, now = new Date()) {
  const tz = tzOf(user);
  const moods = await Mood.find({ user: user._id, timestamp: { $gte: new Date(now - 10 * 24 * 3600 * 1000), $lte: now } }).select('mood.code timestamp').lean();
  const days = new Map();
  for (const m of moods) {
    const k = dayKey(m.timestamp, tz);
    const d = days.get(k) || { hard: 0, all: 0 };
    d.all++; if (emotions.includes(m.mood?.code)) d.hard++;
    days.set(k, d);
  }
  let streak = 0;
  for (let i = 0; i < 10; i++) {
    const d = days.get(dayKey(new Date(now - i * 24 * 3600 * 1000), tz));
    if (!d || d.hard * 2 < d.all) break;
    streak++;
  }
  return streak;
}

// the strongest reason that fires for this mood, or null: hard days > repeated > right away
async function evaluate(user, mood, s, now = new Date()) {
  if (s.days_on) {
    const streak = await hardDayStreak(user, s.emotions, now);
    if (streak >= s.days) return { reason: 'days', detail: { days: streak } };
  }
  if (s.repeat_on) {
    const count = await Mood.countDocuments({ user: user._id, 'mood.code': { $in: s.emotions }, timestamp: { $gte: new Date(now - s.repeat_hours * 3600 * 1000), $lte: now } });
    if (count >= s.repeat_count) return { reason: 'repeated', detail: { count, hours: s.repeat_hours } };
  }
  if (s.immediate) return { reason: 'immediate', detail: {} };
  return null;
}

// ---------- after a mood ----------

/**
 * Runs after every saved mood (bot or mini app). Schedules automatic alerts and, for moods picked in
 * the bot, asks there whether to share with a friend. Never throws.
 * @param {'bot'|'app'} source
 */
async function afterMood(userId, moodDoc, { source = 'bot', now = new Date() } = {}) {
  const result = { hard: false, scheduled: 0, prompted: false };
  try {
    const user = await User.findById(userId).lean();
    if (!user || user.is_blocked || !moodDoc) return result;
    const s = settingsOf(user);
    if (!s.emotions.includes(moodDoc.mood?.code)) return result;
    result.hard = true;
    if (s.auto) result.scheduled = await scheduleAuto(user, moodDoc, s, now);
    if (s.manual_prompt && source === 'bot') result.prompted = await promptInBot(user, moodDoc);
  } catch (error) {
    console.error('Support after mood failed:', error.message);
  }
  return result;
}

async function scheduleAuto(user, moodDoc, s, now = new Date()) {
  const trigger = await evaluate(user, moodDoc, s, now);
  if (!trigger) return 0;
  const contacts = await SupportContact.find({ user: user._id, status: 'accepted' }).populate('contact').lean();
  const since = new Date(now - s.cooldown_hours * 3600 * 1000);
  let scheduled = 0;
  for (const c of contacts) {
    if (!canReceive(c.contact)) continue;
    const recent = await SupportAlert.exists({ user: user._id, contact: c.contact._id, kind: 'auto', status: 'sent', sent_at: { $gte: since } });
    if (recent) continue;
    let alert;
    try {
      alert = await SupportAlert.create({
        user: user._id, contact: c.contact._id, kind: 'auto', reason: trigger.reason, detail: trigger.detail,
        mood: moodDoc._id, mood_snapshot: snapshot(moodDoc), mood_at: moodDoc.timestamp || now,
        send_at: new Date(now.getTime() + s.delay_minutes * 60 * 1000),
      });
    } catch (error) {
      if (error.code === 11000) continue;   // one is already waiting for this friend
      throw error;
    }
    scheduled++;
    if (!s.delay_minutes) await processAlert(alert._id, now);
  }
  return scheduled;
}

const snapshot = (moodDoc) => ({ code: moodDoc.mood.code, name: moodDoc.mood.name, emoji: moodDoc.mood.emoji });

// ---------- sending ----------

function alertText(from, alert) {
  const name = esc(firstName(from));
  const mood = alert.mood_snapshot || {};
  if (alert.reason === 'manual') return msgs.supportSharedMsg(name, mood);
  if (alert.reason === 'days') return msgs.supportDaysMsg(name, alert.detail?.days || 2);
  if (alert.reason === 'repeated') return msgs.supportRepeatedMsg(name, alert.detail?.count || 2, alert.detail?.hours || 24);
  return msgs.supportNowMsg(name, mood);
}

function alertKeyboard(from) {
  const row = [];
  if (from.username) row.push({ text: msgs.supportMessageButton(firstName(from)), url: `https://t.me/${from.username}` });
  row.push({ text: msgs.supportHugButton(), callback_data: `${CB.HUG}${from.id}` });
  return { inline_keyboard: [row] };
}

async function deliver(from, to, alert) {
  await getTelegram().sendMessage(to.id, alertText(from, alert), { parse_mode: 'HTML', reply_markup: alertKeyboard(from) });
}

const finish = (id, set) => SupportAlert.updateOne({ _id: id }, { $set: set, $unset: { open: '' } });

// sends one waiting alert if it's due and still makes sense; returns its final status
async function processAlert(alertId, now = new Date()) {
  const alert = await SupportAlert.findOneAndUpdate({ _id: alertId, status: 'pending', send_at: { $lte: now } }, { status: 'sending' }, { new: true });
  if (!alert) return null;
  const cancel = async (reason) => { await finish(alert._id, { status: 'canceled', cancel_reason: reason }); return 'canceled'; };
  const [user, contact] = await Promise.all([User.findById(alert.user).lean(), User.findById(alert.contact).lean()]);
  if (!user || user.is_blocked) return cancel('user_gone');
  if (!contact) return cancel('contact_gone');
  if (!canReceive(contact)) return cancel('receive_off');
  if (alert.kind === 'auto') {
    const s = settingsOf(user);
    if (!s.auto) return cancel('auto_off');
    if (!await SupportContact.exists({ user: user._id, contact: contact._id, status: 'accepted' })) return cancel('not_a_contact');
    // they logged a better mood while the alert was waiting
    const later = await Mood.findOne({ user: user._id, timestamp: { $gt: alert.mood_at } }).sort({ timestamp: -1 }).select('mood.code').lean();
    if (later && !s.emotions.includes(later.mood?.code)) return cancel('feeling_better');
  }
  try {
    await deliver(user, contact, alert);
    await finish(alert._id, { status: 'sent', sent_at: new Date() });
    return 'sent';
  } catch (error) {
    console.error(`Support message to ${contact.id} failed:`, error.message);
    await finish(alert._id, { status: 'failed', error: isBlockedError(error) ? 'unreachable' : String(error.message || error).slice(0, 200) });
    return 'failed';
  }
}

async function cancelOpen(filter, reason) {
  await SupportAlert.updateMany({ ...filter, status: 'pending' }, { $set: { status: 'canceled', cancel_reason: reason }, $unset: { open: '' } });
}

// ---------- manual sharing ----------

// what the mini app shows after a hard mood: the friends to pick from, or null
async function sharePrompt(userId, moodDoc) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  const s = settingsOf(user);
  if (!s.manual_prompt || !s.emotions.includes(moodDoc.mood?.code)) return null;
  const targets = await shareTargets(user);
  if (!targets.length) return null;
  return { mood_id: moodDoc._id, friends: targets.map(t => ({ id: t.user.id, fullname: fullname(t.user), support: t.support })) };
}

// The "tell some friends?" checklist: tapping a name only ticks it (⬜ ↔ ✅); Notify sends to the ticked
// ones. The ticks live in the message's own keyboard, so nothing is stored until Notify.
async function promptInBot(user, moodDoc) {
  const targets = (await shareTargets(user)).slice(0, PROMPT_FRIENDS);
  if (!targets.length) return false;
  const friends = targets.map(t => ({ id: t.user.id, name: `${t.support ? '💛 ' : ''}${firstName(t.user)}`, on: false }));
  await getTelegram().sendMessage(user.id, msgs.supportPromptMsg(), { reply_markup: checklistKeyboard(moodDoc._id, friends) });
  return true;
}

function checklistKeyboard(moodId, friends) {
  const rows = [];
  for (let i = 0; i < friends.length; i += 2) {
    rows.push(friends.slice(i, i + 2).map(f => ({ text: `${f.on ? TICK_ON : TICK_OFF}${f.name}`, callback_data: `${CB.SHARE_TICK}${moodId}_${f.id}` })));
  }
  if (friends.length > 1) rows.push([{ text: msgs.supportSelectAllButton(friends.every(f => f.on)), callback_data: `${CB.SHARE_ALL_TICK}${moodId}` }]);
  rows.push([{ text: msgs.supportNotifyButton(friends.filter(f => f.on).length), callback_data: `${CB.SHARE_SEND}${moodId}` }]);
  rows.push([{ text: msgs.supportSkipButton(), callback_data: CB.SHARE_DONE }]);
  return { inline_keyboard: rows };
}

// reads the friends and their ticks back from a checklist keyboard
function readChecklist(keyboard) {
  const friends = [];
  for (const b of (keyboard?.inline_keyboard || []).flat()) {
    if (!b.callback_data?.startsWith(CB.SHARE_TICK)) continue;
    const id = Number(b.callback_data.split('_').pop());
    const on = b.text.startsWith(TICK_ON);
    friends.push({ id, on, name: b.text.slice((on ? TICK_ON : TICK_OFF).length) });
  }
  return friends;
}

/**
 * Share one of my recent moods with a friend I'm connected to (or a support friend).
 * @returns {Promise<{status:'sent'|'already'|'failed', to:object}>}
 */
async function shareMood(userId, moodId, friendTelegramId, now = new Date()) {
  const user = await User.findById(userId).lean();
  const mood = /^[a-f0-9]{24}$/i.test(String(moodId)) ? await Mood.findOne({ _id: moodId, user: userId }).lean() : null;
  if (!user || !mood) throw new SupportError('mood_not_found');
  if (now - mood.timestamp > SHARE_WINDOW_MS) throw new SupportError('too_old');
  const friend = await User.findOne({ id: Number(friendTelegramId) }).lean();
  if (!friend || String(friend._id) === String(user._id)) throw new SupportError('friend_not_found');
  const linked = (await connections(user._id)).some(p => String(p._id) === String(friend._id))
    || await SupportContact.exists({ user: user._id, contact: friend._id, status: 'accepted' });
  if (!linked) throw new SupportError('not_connected');
  if (!canReceive(friend)) throw new SupportError('receive_off');

  let alert;
  try {
    alert = await SupportAlert.create({
      user: user._id, contact: friend._id, kind: 'manual', reason: 'manual', mood: mood._id,
      mood_snapshot: snapshot(mood), mood_at: mood.timestamp, status: 'sending', send_at: now,
    });
  } catch (error) {
    if (error.code === 11000) return { status: 'already', to: friend };
    throw error;
  }
  try {
    await deliver(user, friend, alert);
    await finish(alert._id, { status: 'sent', sent_at: new Date() });
    return { status: 'sent', to: friend };
  } catch (error) {
    await finish(alert._id, { status: 'failed', error: isBlockedError(error) ? 'unreachable' : String(error.message || error).slice(0, 200) });
    return { status: 'failed', to: friend };
  }
}

/**
 * Share one mood with several friends at once (the mini app's multi-select, the bot's "everyone").
 * telegramIds = 'all' means everyone the prompt offers. Each friend is checked on its own: one that
 * can't get it doesn't stop the rest.
 * @returns {Promise<Array<{id:number, status:string, error?:string}>>}
 */
async function shareMoodMany(userId, moodId, telegramIds, now = new Date()) {
  let ids = telegramIds;
  if (ids === 'all') {
    const user = await User.findById(userId).lean();
    ids = user ? (await shareTargets(user)).map(t => t.user.id) : [];
  }
  if (!Array.isArray(ids) || !ids.length) throw new SupportError('invalid_value');
  ids = [...new Set(ids.map(Number).filter(Number.isFinite))].slice(0, MAX_SHARE_AT_ONCE);
  const results = [];
  for (const id of ids) {
    try {
      const r = await shareMood(userId, moodId, id, now);
      results.push({ id, status: r.status, first_name: r.to.first_name || '' });
    } catch (error) {
      if (!(error instanceof SupportError)) throw error;
      // the mood itself is the problem: the same for everyone, so stop here
      if (error.code === 'mood_not_found' || error.code === 'too_old') throw error;
      results.push({ id, status: 'skipped', error: error.code });
    }
  }
  return results;
}

// ---------- support friends (consent) ----------

async function invite(userId, friendTelegramId, now = new Date()) {
  const user = await User.findById(userId).lean();
  const friend = await User.findOne({ id: Number(friendTelegramId) }).lean();
  if (!user || !friend || friend.is_blocked || friend.is_bot) throw new SupportError('friend_not_found');
  if (String(friend._id) === String(user._id)) throw new SupportError('not_yourself');
  if (!(await connections(user._id)).some(p => String(p._id) === String(friend._id))) throw new SupportError('not_connected');

  const existing = await SupportContact.findOne({ user: user._id, contact: friend._id });
  if (existing?.status === 'accepted') return { contact: existing, delivered: true };
  if (existing?.status === 'pending') return { contact: existing, delivered: true };
  if (existing?.status === 'declined' && now - (existing.answered_at || existing.invited_at) < DECLINE_COOLDOWN_MS) throw new SupportError('declined_recently');
  const count = await SupportContact.countDocuments({ user: user._id, status: { $in: ['pending', 'accepted'] } });
  if (count >= MAX_CONTACTS) throw new SupportError('too_many');

  const contact = existing
    ? await SupportContact.findOneAndUpdate({ _id: existing._id }, { status: 'pending', invited_at: now, answered_at: null }, { new: true })
    : await SupportContact.create({ user: user._id, contact: friend._id, invited_at: now });
  let delivered = true;
  try {
    await getTelegram().sendMessage(friend.id, msgs.supportInviteMsg(esc(firstName(user))), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: msgs.supportAcceptButton(), callback_data: `${CB.ACCEPT}${contact._id}` }, { text: msgs.supportDeclineButton(), callback_data: `${CB.DECLINE}${contact._id}` }]] },
    });
  } catch (error) {
    console.error(`Support invitation to ${friend.id} failed:`, error.message);
    delivered = false;
  }
  return { contact, delivered };
}

// the invited friend answers (from the bot or the mini app)
async function respond(contactUserId, contactId, accept, now = new Date()) {
  const row = await SupportContact.findOne({ _id: contactId, contact: contactUserId });
  if (!row) throw new SupportError('not_found');
  if (row.status !== 'pending') return { row, changed: false };
  row.status = accept ? 'accepted' : 'declined';
  row.answered_at = now;
  await row.save();
  const [owner, helper] = await Promise.all([User.findById(row.user).lean(), User.findById(contactUserId).lean()]);
  if (owner) {
    await getTelegram().sendMessage(owner.id, accept ? msgs.supportAcceptedMsg(esc(firstName(helper))) : msgs.supportDeclinedMsg(esc(firstName(helper))), { parse_mode: 'HTML' })
      .catch(error => console.error('Support answer notice failed:', error.message));
  }
  return { row, changed: true };
}

// the user removes a support friend (quietly), or the friend stops supporting (the user is told)
async function removeContact(userId, friendTelegramId) {
  const friend = await User.findOne({ id: Number(friendTelegramId) }).lean();
  if (!friend) throw new SupportError('not_found');
  const row = await SupportContact.findOneAndDelete({ user: userId, contact: friend._id });
  if (!row) throw new SupportError('not_found');
  await cancelOpen({ user: userId, contact: friend._id }, 'removed');
}

async function stopSupporting(helperId, ownerTelegramId) {
  const owner = await User.findOne({ id: Number(ownerTelegramId) }).lean();
  if (!owner) throw new SupportError('not_found');
  const row = await SupportContact.findOneAndDelete({ user: owner._id, contact: helperId });
  if (!row) throw new SupportError('not_found');
  await cancelOpen({ user: owner._id, contact: helperId }, 'removed');
  if (row.status === 'accepted') {
    const helper = await User.findById(helperId).lean();
    await getTelegram().sendMessage(owner.id, msgs.supportStoppedMsg(esc(firstName(helper))), { parse_mode: 'HTML' })
      .catch(error => console.error('Support stop notice failed:', error.message));
  }
}

// ---------- hugs ----------

// "Send a hug" works for someone who sees that person's mood, or who got a support message from them lately
async function sendHug(fromUser, toTelegramId, now = new Date()) {
  const to = await User.findOne({ id: Number(toTelegramId) }).lean();
  if (!to || String(to._id) === String(fromUser._id)) return false;
  const allowed = await Share.exists({ follower: fromUser._id, followed: to._id, disabled: false })
    || await SupportAlert.exists({ user: to._id, contact: fromUser._id, status: 'sent', sent_at: { $gte: new Date(now - HUG_WINDOW_MS) } });
  if (!allowed) return false;
  await getTelegram().sendMessage(to.id, msgs.supportHugMsg(esc(firstName(fromUser))), { parse_mode: 'HTML' });
  return true;
}

// ---------- mini app view ----------

async function view(userId) {
  const user = await User.findById(userId).lean();
  const s = settingsOf(user);
  const [contacts, supporting, people, recent] = await Promise.all([
    SupportContact.find({ user: userId }).populate('contact').sort({ createdAt: 1 }).lean(),
    SupportContact.find({ contact: userId, status: { $in: ['pending', 'accepted'] } }).populate('user').sort({ createdAt: 1 }).lean(),
    connections(userId),
    SupportAlert.find({ user: userId, status: 'sent' }).sort({ sent_at: -1 }).limit(5).populate('contact', 'id first_name last_name username').lean(),
  ]);
  const taken = new Set(contacts.filter(c => c.contact).map(c => String(c.contact._id)));
  return {
    settings: s,
    options: OPTIONS,
    max_contacts: MAX_CONTACTS,
    emotions: MOODS.map(m => ({ code: m.code, name: m.name, emoji: m.emoji, on: s.emotions.includes(m.code), hard_default: HARD_DEFAULT.includes(m.code) })),
    contacts: contacts.filter(c => c.contact).map(c => ({ id: c.contact.id, fullname: fullname(c.contact), status: c.status, receives: canReceive(c.contact) })),
    candidates: people.filter(p => !taken.has(String(p._id))).map(p => ({ id: p.id, fullname: fullname(p), receives: canReceive(p) })).sort((a, b) => a.fullname.localeCompare(b.fullname)),
    supporting: supporting.filter(c => c.user).map(c => ({ id: c.user.id, fullname: fullname(c.user), status: c.status, invitation_id: c._id })),
    recent: recent.filter(a => a.contact).map(a => ({ to: fullname(a.contact), reason: a.reason, mood: a.mood_snapshot, at: a.sent_at })),
  };
}

// ---------- admin view (one person's support setup) ----------

async function adminView(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new SupportError('not_found');
  const s = settingsOf(user);
  const [contacts, supporting, alerts] = await Promise.all([
    SupportContact.find({ user: userId }).populate('contact', 'id first_name last_name username support').sort({ createdAt: 1 }).lean(),
    SupportContact.find({ contact: userId }).populate('user', 'id first_name last_name username').sort({ createdAt: 1 }).lean(),
    SupportAlert.find({ user: userId }).sort({ createdAt: -1 }).limit(15).populate('contact', 'id first_name last_name username').lean(),
  ]);
  return {
    settings: s,
    hard_moods: MOODS.filter(m => s.emotions.includes(m.code)).map(m => ({ code: m.code, name: m.name, emoji: m.emoji })),
    default_hard: s.emotions.length === HARD_DEFAULT.length && HARD_DEFAULT.every(c => s.emotions.includes(c)),
    contacts: contacts.filter(c => c.contact).map(c => ({ id: c.contact.id, fullname: fullname(c.contact), username: c.contact.username || null, status: c.status, invited_at: c.invited_at, answered_at: c.answered_at, receives: c.contact.support?.receive !== false })),
    supporting: supporting.filter(c => c.user).map(c => ({ id: c.user.id, fullname: fullname(c.user), username: c.user.username || null, status: c.status })),
    alerts: alerts.map(a => ({ to: a.contact ? fullname(a.contact) : 'Someone', to_id: a.contact?.id || null, kind: a.kind, reason: a.reason, detail: a.detail || {}, mood: a.mood_snapshot, status: a.status, cancel_reason: a.cancel_reason, error: a.error, at: a.sent_at || a.createdAt })),
  };
}

// ---------- worker ----------

let timer = null;
async function tick(now = new Date()) {
  const due = await SupportAlert.find({ status: 'pending', send_at: { $lte: now } }).sort({ send_at: 1 }).limit(50).select('_id').lean();
  for (const a of due) await processAlert(a._id, now).catch(error => console.error('Support alert failed:', error.message));
  return due.length;
}
async function start({ log = console.log } = {}) {
  stop();
  // the migration: the unique indexes that stop duplicate alerts must exist before the first send.
  // Existing users need no data change: their support settings fall back to the defaults (automatic off).
  await Promise.all([SupportAlert.createIndexes(), SupportContact.createIndexes()]);
  // alerts caught mid-send by a restart go back in the queue
  await SupportAlert.updateMany({ status: 'sending', kind: 'auto' }, { status: 'pending' });
  timer = setInterval(() => tick().catch(error => console.error('Support tick failed:', error.message)), TICK_MS);
  timer.unref?.();
  log('💛 Support alerts running');
}
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = {
  CB, HARD_DEFAULT, OPTIONS, MAX_CONTACTS, SupportError, checklistKeyboard, readChecklist,
  settingsOf, updateSettings, connections, shareTargets, hardDayStreak, evaluate,
  afterMood, scheduleAuto, processAlert, tick, start, stop,
  sharePrompt, promptInBot, shareMood, shareMoodMany,
  invite, respond, removeContact, stopSupporting, sendHug, view, adminView,
};
