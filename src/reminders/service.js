// Mood check-in reminders.
//
// Two loops, both cheap:
//  - tick (every 30s): users whose reminder.next_at has passed get a job in the reminder_jobs
//    queue, and their next_at moves to the following slot. Users with no next_at yet (new users,
//    or after a settings change) get one computed.
//  - drain (every second): sends up to `rate_per_second` queued jobs. A 429 from Telegram pauses
//    the whole queue for retry_after; a user who blocked the bot is marked and never retried.
// So reminders arrive a little after their time when many are due at once, but the bot never
// floods Telegram. A reminder that can't go out within the grace window is dropped, not sent late.
const User = require('../models/user');
const Mood = require('../models/mood');
const AppConfig = require('../models/app_config');
const ReminderJob = require('../models/reminder_job');
const { getTelegram } = require('../utils/telegram');
const { MOOD_INLINE_KEYBOARD } = require('../constants');
const time = require('./time');

const TICK_MS = 30 * 1000;
const DRAIN_MS = 1000;
const MAX_ATTEMPTS = 3;
const BATCH = 500;
const CALLBACK_OFF = 'reminders_off';
const CALLBACK_ON = 'reminders_on';

const state = { running: false, paused_until: null, last_tick_at: null, last_error: null };
let tickTimer = null;
let drainTimer = null;
let ticking = false;
let draining = false;
let cached = null;   // { at, settings }

// ---------- settings ----------
function toSettings(config) {
  return {
    enabled: config.reminders_enabled !== false,
    default_times: config.reminder_default_times?.length ? config.reminder_default_times : time.envDefaultTimes(),
    default_times_from_env: !config.reminder_default_times?.length,
    default_timezone: config.reminder_default_timezone || time.envDefaultTimezone(),
    max_per_day: config.reminder_max_per_day || 5,
    rate_per_second: config.reminder_rate_per_second || 10,
    grace_minutes: config.reminder_grace_minutes ?? 120,
    skip_if_logged_minutes: config.reminder_skip_if_logged_minutes ?? 120,
  };
}

async function getSettings({ fresh = false } = {}) {
  if (!fresh && cached && Date.now() - cached.at < 10 * 1000) return cached.settings;
  const settings = toSettings(await AppConfig.get());
  cached = { at: Date.now(), settings };
  return settings;
}
const invalidate = () => { cached = null; };

// What actually applies to this user: their own times/zone or the defaults, capped to the max.
function effectiveFor(user, s) {
  const r = user.reminder || {};
  const own = Array.isArray(r.times) && r.times.length ? r.times.map(time.normalizeTime).filter(Boolean) : null;
  const times = [...new Set(own || s.default_times)].sort().slice(0, s.max_per_day);
  return {
    enabled: r.enabled !== false,
    custom_times: Boolean(own),
    times,
    timezone: time.isValidTimezone(user.timezone) ? user.timezone : s.default_timezone,
    custom_timezone: time.isValidTimezone(user.timezone),
  };
}

function nextFor(user, s, after) {
  const eff = effectiveFor(user, s);
  if (!eff.enabled || user.reminder?.bot_blocked || user.is_bot) return null;
  return time.nextOccurrence(eff.times, eff.timezone, after);
}

// ---------- scheduling ----------
// Give every user without a next_at one (null when they don't want reminders).
async function initPending(now = new Date(), s) {
  let total = 0;
  for (let round = 0; round < 40; round++) {
    const users = await User.find({ 'reminder.next_at': { $exists: false } }).select('reminder timezone is_bot').limit(BATCH).lean();
    if (!users.length) break;
    await User.bulkWrite(users.map(u => ({ updateOne: { filter: { _id: u._id }, update: { $set: { 'reminder.next_at': nextFor(u, s, now) } } } })));
    total += users.length;
    if (users.length < BATCH) break;
  }
  return total;
}

// Queue a job for every user whose slot has come, and move them on to the next slot.
async function enqueueDue(now = new Date(), s) {
  const counts = { queued: 0, skipped: 0 };
  const graceMs = s.grace_minutes * 60 * 1000;
  const skipMs = s.skip_if_logged_minutes * 60 * 1000;
  for (let round = 0; round < 40; round++) {
    const users = await User.find({ 'reminder.next_at': { $ne: null, $lte: now } })
      .select('reminder timezone is_bot is_blocked').sort({ 'reminder.next_at': 1 }).limit(BATCH).lean();
    if (!users.length) break;

    const recent = new Set();
    if (skipMs > 0) {
      const logged = await Mood.aggregate([
        { $match: { user: { $in: users.map(u => u._id) }, timestamp: { $gte: new Date(now - skipMs) } } },
        { $group: { _id: '$user' } },
      ]);
      for (const m of logged) recent.add(String(m._id));
    }

    const jobs = [];
    const moves = [];
    for (const u of users) {
      const slot = new Date(u.reminder.next_at);
      let reason = null;
      if (u.is_blocked) reason = 'user_blocked';
      else if (now - slot > graceMs) reason = 'late';                  // e.g. the bot was down
      else if (recent.has(String(u._id))) reason = 'recent_mood';
      if (!u.is_blocked) {
        jobs.push({ user: u._id, slot_at: slot, run_at: now, status: reason ? 'skipped' : 'queued', reason });
        counts[reason ? 'skipped' : 'queued'] += 1;
      }
      const after = new Date(Math.max(now.getTime(), slot.getTime()));
      moves.push({ updateOne: { filter: { _id: u._id }, update: { $set: { 'reminder.next_at': nextFor(u, s, after) } } } });
    }
    if (jobs.length) {
      // a duplicate (user, slot) means it was queued already: ignore it
      await ReminderJob.insertMany(jobs, { ordered: false }).catch(err => { if (err.code !== 11000 && !err.writeErrors) throw err; });
    }
    await User.bulkWrite(moves);
    if (users.length < BATCH) break;
  }
  return counts;
}

async function tick(now = new Date()) {
  if (ticking) return null;
  ticking = true;
  try {
    const s = await getSettings();
    await initPending(now, s);
    const counts = s.enabled ? await enqueueDue(now, s) : { queued: 0, skipped: 0 };
    state.last_tick_at = now;
    return counts;
  } catch (error) {
    state.last_error = `tick: ${error.message}`;
    console.error('Reminder tick failed:', error.message);
    return null;
  } finally {
    ticking = false;
  }
}

// ---------- sending ----------
function reminderMessage() {
  return {
    text: `⏰ <b>Mood check-in</b>\nHow are you feeling right now? Pick the mood that fits best:`,
    extra: {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [...MOOD_INLINE_KEYBOARD, [{ text: '🔕 Turn off reminders', callback_data: CALLBACK_OFF }]] },
    },
  };
}

const errorCode = (e) => e?.response?.error_code ?? e?.code;
const isBlockedError = (e) => errorCode(e) === 403 || (errorCode(e) === 400 && /chat not found|user is deactivated/i.test(e?.description || e?.message || ''));

async function sendJob(job, s, now) {
  const user = await User.findById(job.user).select('id is_blocked reminder').lean();
  const scheduled = job.kind === 'scheduled';
  let skip = null;
  if (!user) skip = 'user_gone';
  else if (user.is_blocked) skip = 'user_blocked';
  else if (scheduled && user.reminder?.enabled === false) skip = 'turned_off';
  else if (scheduled && now - job.slot_at > s.grace_minutes * 60 * 1000) skip = 'late';
  if (skip) {
    await ReminderJob.updateOne({ _id: job._id }, { status: 'skipped', reason: skip });
    return 'skipped';
  }

  try {
    const { text, extra } = reminderMessage();
    await getTelegram().sendMessage(user.id, text, extra);
    await ReminderJob.updateOne({ _id: job._id }, { status: 'sent', sent_at: new Date(), reason: null });
    await User.updateOne({ _id: user._id }, { 'reminder.last_sent_at': new Date() });
    return 'sent';
  } catch (error) {
    const code = errorCode(error);
    const detail = String(error?.description || error?.message || 'send failed').slice(0, 200);
    if (code === 429) {
      // Telegram says slow down: hold the whole queue, then retry this one first
      const wait = (Number(error?.parameters?.retry_after ?? error?.response?.parameters?.retry_after) || 5) * 1000;
      state.paused_until = new Date(Date.now() + wait);
      await ReminderJob.updateOne({ _id: job._id }, { status: 'queued', run_at: state.paused_until, reason: 'rate_limited', $inc: { attempts: -1 } });
      return 'rate_limited';
    }
    if (isBlockedError(error)) {
      await ReminderJob.updateOne({ _id: job._id }, { status: 'failed', reason: 'bot_blocked' });
      await User.updateOne({ _id: user._id }, { 'reminder.bot_blocked': true, 'reminder.next_at': null });
      return 'failed';
    }
    if (job.attempts >= MAX_ATTEMPTS) {
      await ReminderJob.updateOne({ _id: job._id }, { status: 'failed', reason: detail });
      return 'failed';
    }
    await ReminderJob.updateOne({ _id: job._id }, { status: 'queued', run_at: new Date(Date.now() + 30 * 1000 * job.attempts), reason: detail });
    return 'retry';
  }
}

// Send up to rate_per_second jobs that are due. Returns what happened to each.
async function drain(now = new Date(), { limit } = {}) {
  if (draining) return [];
  draining = true;
  const results = [];
  try {
    const s = await getSettings();
    if (!s.enabled) return results;
    if (state.paused_until && state.paused_until > now) return results;
    state.paused_until = null;
    const max = limit ?? s.rate_per_second;
    for (let i = 0; i < max; i++) {
      const job = await ReminderJob.findOneAndUpdate(
        { status: 'queued', run_at: { $lte: now } },
        { $set: { status: 'sending' }, $inc: { attempts: 1 } },
        { sort: { run_at: 1, slot_at: 1 }, new: true },
      ).lean();
      if (!job) break;
      const result = await sendJob(job, s, now);
      results.push(result);
      if (result === 'rate_limited') break;
    }
  } catch (error) {
    state.last_error = `drain: ${error.message}`;
    console.error('Reminder drain failed:', error.message);
  } finally {
    draining = false;
  }
  return results;
}

// ---------- user-facing ----------
function viewFor(user, s) {
  const eff = effectiveFor(user, s);
  return {
    enabled: eff.enabled,
    times: eff.times,
    custom_times: eff.custom_times,
    timezone: eff.timezone,
    custom_timezone: eff.custom_timezone,
    default_times: s.default_times.slice(0, s.max_per_day),
    default_timezone: s.default_timezone,
    max_per_day: s.max_per_day,
    next_at: user.reminder?.next_at || null,
    last_sent_at: user.reminder?.last_sent_at || null,
    bot_blocked: Boolean(user.reminder?.bot_blocked),
    service_enabled: s.enabled,
  };
}

class ReminderInputError extends Error {
  constructor(code) { super(code); this.code = code; }
}

// { enabled?, times? (array, or null = back to defaults), timezone? (null = default) }
// timezone is the user's own setting (user.timezone); it's accepted here too so the app can
// fill in the device's zone the first time someone sets up reminders.
async function updateForUser(userId, body = {}) {
  const s = await getSettings();
  const set = {};
  if (body.enabled !== undefined) {
    set['reminder.enabled'] = Boolean(body.enabled);
    if (body.enabled) set['reminder.bot_blocked'] = false;   // they're using the app, so try again
  }
  if (body.times !== undefined) {
    if (body.times === null) set['reminder.times'] = null;
    else {
      if (!Array.isArray(body.times)) throw new ReminderInputError('invalid_times');
      const times = body.times.map(time.normalizeTime);
      if (!times.length || times.some(t => !t)) throw new ReminderInputError('invalid_times');
      const unique = [...new Set(times)].sort();
      if (unique.length > s.max_per_day) throw new ReminderInputError('too_many_times');
      set['reminder.times'] = unique;
    }
  }
  if (body.timezone !== undefined) {
    if (body.timezone === null || body.timezone === '') set.timezone = null;
    else if (!time.isValidTimezone(body.timezone)) throw new ReminderInputError('invalid_timezone');
    else set.timezone = body.timezone;
  }
  let user = await User.findByIdAndUpdate(userId, { $set: set }, { new: true }).lean();
  // recompute right away so the app can show the next reminder time
  user = await User.findByIdAndUpdate(userId, { $set: { 'reminder.next_at': nextFor(user, s, new Date()) } }, { new: true }).lean();
  // a slot that was already queued for today but is no longer wanted is dropped
  if (!viewFor(user, s).enabled) await ReminderJob.updateMany({ user: userId, status: 'queued', kind: 'scheduled' }, { status: 'skipped', reason: 'turned_off' });
  return viewFor(user, s);
}

// Change the user's timezone (null = back to the default) and move their next reminder to match.
async function setTimezone(userId, timezone) {
  if (timezone !== null && timezone !== '' && !time.isValidTimezone(timezone)) throw new ReminderInputError('invalid_timezone');
  const s = await getSettings();
  let user = await User.findByIdAndUpdate(userId, { $set: { timezone: timezone || null } }, { new: true }).lean();
  user = await User.findByIdAndUpdate(userId, { $set: { 'reminder.next_at': nextFor(user, s, new Date()) } }, { new: true }).lean();
  return user;
}

// what Settings and /timezone show
async function timezoneView(user) {
  const s = await getSettings();
  const current = time.isValidTimezone(user.timezone) ? user.timezone : s.default_timezone;
  return { ...time.describeTimezone(current), is_set: time.isValidTimezone(user.timezone), default: s.default_timezone };
}

// someone who blocked the bot wrote to it again: reminders can resume
async function markReachable(userId) {
  const res = await User.updateOne({ _id: userId, 'reminder.bot_blocked': true }, { $set: { 'reminder.bot_blocked': false }, $unset: { 'reminder.next_at': 1 } });
  return res.modifiedCount > 0;
}

// ---------- admin ----------
// after the defaults change, everyone's next_at is recomputed on the next tick
async function resetSchedules() {
  await User.updateMany({}, { $unset: { 'reminder.next_at': 1 } });
}

async function enqueueTest(userId) {
  const now = new Date();
  await ReminderJob.create({ user: userId, slot_at: now, run_at: now, kind: 'test' });
}

async function clearQueue() {
  const res = await ReminderJob.updateMany({ status: 'queued' }, { status: 'skipped', reason: 'cleared_by_admin' });
  return res.modifiedCount;
}

async function stats(now = new Date()) {
  const day = new Date(now - 24 * 3600 * 1000);
  const [byStatus, reasons, recentFailures, users, nextDue] = await Promise.all([
    ReminderJob.aggregate([
      { $match: { $or: [{ status: { $in: ['queued', 'sending'] } }, { updatedAt: { $gte: day } }] } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    ReminderJob.aggregate([
      { $match: { status: 'skipped', updatedAt: { $gte: day } } },
      { $group: { _id: '$reason', n: { $sum: 1 } } },
    ]),
    ReminderJob.find({ status: 'failed', updatedAt: { $gte: day } }).sort({ updatedAt: -1 }).limit(8).populate('user', 'id first_name last_name username').lean(),
    User.aggregate([
      { $match: { is_bot: { $ne: true } } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        off: { $sum: { $cond: [{ $eq: ['$reminder.enabled', false] }, 1, 0] } },
        unreachable: { $sum: { $cond: [{ $eq: ['$reminder.bot_blocked', true] }, 1, 0] } },
        custom: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$reminder.times', []] } }, 0] }, 1, 0] } },
      } },
    ]),
    User.findOne({ 'reminder.next_at': { $ne: null } }).sort({ 'reminder.next_at': 1 }).select('reminder.next_at').lean(),
  ]);
  const count = Object.fromEntries(byStatus.map(r => [r._id, r.n]));
  const u = users[0] || { total: 0, off: 0, unreachable: 0, custom: 0 };
  return {
    queue: { queued: count.queued || 0, sending: count.sending || 0, sent_24h: count.sent || 0, skipped_24h: count.skipped || 0, failed_24h: count.failed || 0 },
    skipped_reasons_24h: Object.fromEntries(reasons.map(r => [r._id || 'unknown', r.n])),
    recent_failures: recentFailures.map(f => ({
      at: f.updatedAt, reason: f.reason, attempts: f.attempts,
      user: f.user ? { id: f.user.id, fullname: [f.user.first_name, f.user.last_name].filter(Boolean).join(' '), username: f.user.username || null } : null,
    })),
    users: { total: u.total, on: u.total - u.off, off: u.off, unreachable: u.unreachable, custom_times: u.custom },
    next_due_at: nextDue?.reminder?.next_at || null,
    worker: { running: state.running, paused_until: state.paused_until, last_tick_at: state.last_tick_at, last_error: state.last_error },
  };
}

// ---------- lifecycle ----------
async function start({ log = console.log } = {}) {
  stop();
  // jobs caught mid-send by a restart go back in the queue
  await ReminderJob.updateMany({ status: 'sending' }, { status: 'queued' });
  tickTimer = setInterval(() => tick(), TICK_MS);
  drainTimer = setInterval(() => drain(), DRAIN_MS);
  for (const t of [tickTimer, drainTimer]) t.unref?.();
  state.running = true;
  tick();
  const s = await getSettings({ fresh: true });
  log(`⏰ Reminders ${s.enabled ? 'on' : 'off'}: default ${s.default_times.slice(0, s.max_per_day).join(', ')} ${s.default_timezone}, up to ${s.rate_per_second}/s`);
}

function stop() {
  if (tickTimer) clearInterval(tickTimer);
  if (drainTimer) clearInterval(drainTimer);
  tickTimer = drainTimer = null;
  state.running = false;
}

module.exports = {
  CALLBACK_OFF, CALLBACK_ON,
  getSettings, invalidate, toSettings, effectiveFor, nextFor, viewFor,
  initPending, enqueueDue, tick, drain, sendJob, reminderMessage,
  updateForUser, setTimezone, timezoneView, markReachable, ReminderInputError,
  resetSchedules, enqueueTest, clearQueue, stats,
  start, stop, state,
};
