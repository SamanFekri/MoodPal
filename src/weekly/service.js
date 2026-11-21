// Weekly review: each person gets the week's mood chart and the AI's read of their week (with a few
// suggestions) on their own day and time, in their own timezone, at most once a week.
//
//   user.weekly_review = { enabled, day (0 Sun … 6 Sat, null = default), time ("HH:MM", null = default),
//                          next_at (UTC), last_sent_at }
//
// The default day and time come from WEEKLY_CRON_JOB_TIME in .env ("0 7 * * 1" = Monday 07:00), read in
// each person's timezone. A worker checks every minute for reviews that are due. "Once a week" holds even
// when someone moves their day: the next one is never sooner than 6 days after the last one.
const User = require('../models/user');
const time = require('../reminders/time');
const i18n = require('../i18n');

const TICK_MS = 60 * 1000;
const MIN_GAP_MS = 6 * 24 * 60 * 60 * 1000;
const FALLBACK = { day: 1, time: '07:00' };
// The queue: due reviews go out one at a time, oldest first, with a gap between people so a busy
// Monday morning never floods Telegram. A run stops after RUN_BUDGET_MS and the next tick goes on.
let GAP_MS = Number(process.env.WEEKLY_REVIEW_GAP_MS) || 1500;
const RUN_BUDGET_MS = 50 * 1000;
const RETRY_MS = 15 * 60 * 1000;   // a failed review is tried again later, at most MAX_ATTEMPTS times
const MAX_ATTEMPTS = 2;

const state = { running: false, busy: false, paused_until: null, last_tick_at: null, last_error: null, sent: 0 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const retryAfterMs = (e) => (Number(e?.parameters?.retry_after ?? e?.response?.parameters?.retry_after) || 5) * 1000;
const isRateLimit = (e) => (e?.code ?? e?.response?.error_code) === 429;
const isUnreachable = (e) => (e?.code ?? e?.response?.error_code) === 403;   // blocked the bot / deactivated
let timer = null;

class WeeklyInputError extends Error { constructor(code) { super(code); this.code = code; } }

// "0 7 * * 1" -> { day: 1, time: "07:00" }; anything fancier falls back to Monday 07:00
function defaultsFromCron(expression = process.env.WEEKLY_CRON_JOB_TIME) {
  const f = String(expression || '').trim().replace(/^"|"$/g, '').split(/\s+/);
  if (f.length < 5 || !/^\d+$/.test(f[0]) || !/^\d+$/.test(f[1]) || !/^[0-7]$/.test(f[4])) return { ...FALLBACK };
  const minute = Number(f[0]), hour = Number(f[1]);
  if (minute > 59 || hour > 23) return { ...FALLBACK };
  return { day: Number(f[4]) % 7, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

// what applies to this person: their own choice, else the defaults
function effectiveFor(user) {
  const d = defaultsFromCron();
  const w = user?.weekly_review || {};
  const day = Number.isInteger(w.day) && w.day >= 0 && w.day <= 6 ? w.day : d.day;
  const t = time.normalizeTime(w.time) || d.time;
  const tz = time.isValidTimezone(user?.timezone) ? user.timezone : time.envDefaultTimezone();
  return { enabled: w.enabled !== false, day, time: t, timezone: tz, custom: (Number.isInteger(w.day) && w.day !== d.day) || Boolean(w.time && w.time !== d.time), defaults: d };
}

// the first `day` at `hh:mm` in tz strictly after `after`
function nextWeekly(day, hhmm, tz, after = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(after)) parts[p.type] = p.value;
  for (let add = 0; add <= 8; add++) {
    const d = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + add));
    if (d.getUTCDay() !== day) continue;
    const at = time.zonedToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, tz);
    if (at > after) return at;
  }
  return null;
}

// the next review for this person, at least 6 days after the last one
function nextFor(user, now = new Date()) {
  const e = effectiveFor(user);
  if (!e.enabled) return null;
  const last = user?.weekly_review?.last_sent_at ? new Date(user.weekly_review.last_sent_at).getTime() : 0;
  const after = new Date(Math.max(now.getTime(), last + MIN_GAP_MS));
  return nextWeekly(e.day, e.time, e.timezone, after);
}

function viewFor(user) {
  const e = effectiveFor(user);
  return {
    enabled: e.enabled, day: e.day, time: e.time, timezone: e.timezone, custom: e.custom,
    default_day: e.defaults.day, default_time: e.defaults.time,
    next_at: e.enabled ? (user?.weekly_review?.next_at || nextFor(user)) : null,
    last_sent_at: user?.weekly_review?.last_sent_at || null,
    // null = the same language as the app
    language: i18n.isSupported(user?.weekly_review?.language) ? user.weekly_review.language : null,
    languages: i18n.LANGS.map(code => ({ code, name: i18n.forLang(code).nativeName, flag: i18n.forLang(code).flag })),
  };
}

// { enabled?, day? (0-6 | null = default), time? ("HH:MM" | null = default), language? ('en' | 'fa' | 'ru' | null = the app's) }
async function updateForUser(userId, body = {}) {
  const set = {};
  if (body.enabled !== undefined) set['weekly_review.enabled'] = Boolean(body.enabled);
  if (body.day !== undefined) {
    if (body.day === null) set['weekly_review.day'] = null;
    else if (!Number.isInteger(body.day) || body.day < 0 || body.day > 6) throw new WeeklyInputError('invalid_day');
    else set['weekly_review.day'] = body.day;
  }
  if (body.time !== undefined) {
    if (body.time === null) set['weekly_review.time'] = null;
    else if (!time.normalizeTime(body.time)) throw new WeeklyInputError('invalid_time');
    else set['weekly_review.time'] = time.normalizeTime(body.time);
  }
  if (body.language !== undefined) {
    if (body.language === null || body.language === '') set['weekly_review.language'] = null;
    else if (!i18n.isSupported(body.language)) throw new WeeklyInputError('invalid_language');
    else set['weekly_review.language'] = body.language;
  }
  let user = await User.findByIdAndUpdate(userId, { $set: set }, { new: true }).lean();
  user = await User.findByIdAndUpdate(userId, { $set: { 'weekly_review.next_at': nextFor(user) } }, { new: true }).lean();
  return viewFor(user);
}

// their timezone changed: the next review moves with it
async function reschedule(userId) {
  const user = await User.findById(userId).lean();
  if (user) await User.updateOne({ _id: userId }, { $set: { 'weekly_review.next_at': nextFor(user) } });
}

// ---------- the worker ----------

const realSend = async (user) => require('../commands/report').sendWeeklyReviewTo(require('../utils/telegram').getTelegram(), user);
let send = realSend;
const _setSender = (fn) => { send = fn || realSend; };   // tests swap it

async function tick(now = new Date()) {
  state.last_tick_at = now;
  if (state.busy) return;                                            // the last run is still sending
  if (state.paused_until && state.paused_until > now) return;        // Telegram asked us to slow down
  state.busy = true;
  const runStart = Date.now();
  try {
    // people we haven't scheduled yet (new, or their settings changed) get a next_at, nothing is sent
    const fresh = await User.find({ is_blocked: { $ne: true }, 'weekly_review.enabled': { $ne: false }, 'weekly_review.next_at': null }).limit(500).lean();
    for (const u of fresh) await User.updateOne({ _id: u._id, 'weekly_review.next_at': null }, { $set: { 'weekly_review.next_at': nextFor(u, now) } });

    while (Date.now() - runStart < RUN_BUDGET_MS) {
      const u = await User.findOne({ is_blocked: { $ne: true }, 'weekly_review.enabled': { $ne: false }, 'weekly_review.next_at': { $lte: now } }).sort({ 'weekly_review.next_at': 1 }).lean();
      if (!u) break;
      const prev = u.weekly_review;
      // claim it: only one worker (or restart) sends this week's review
      const claimed = await User.findOneAndUpdate(
        { _id: u._id, 'weekly_review.next_at': prev.next_at },
        { $set: { 'weekly_review.last_sent_at': now, 'weekly_review.next_at': nextFor({ ...u, weekly_review: { ...prev, last_sent_at: now } }, now) } },
        { new: true },
      ).lean();
      if (!claimed) continue;
      try {
        if (await send(claimed)) state.sent++;
        if (prev.attempts) await User.updateOne({ _id: u._id }, { $set: { 'weekly_review.attempts': 0 } });
      } catch (error) {
        const back = (at, extra = {}) => User.updateOne({ _id: u._id }, { $set: { 'weekly_review.next_at': at, 'weekly_review.last_sent_at': prev.last_sent_at || null, ...extra } });
        if (isRateLimit(error)) {
          // pause the whole queue and put this person back first in line
          state.paused_until = new Date(now.getTime() + retryAfterMs(error));
          await back(state.paused_until);
          console.warn(`Weekly reviews paused by Telegram until ${state.paused_until.toISOString()}`);
          break;
        }
        if (!isUnreachable(error) && (prev.attempts || 0) < MAX_ATTEMPTS) await back(new Date(now.getTime() + RETRY_MS), { 'weekly_review.attempts': (prev.attempts || 0) + 1 });
        else if (prev.attempts) await User.updateOne({ _id: u._id }, { $set: { 'weekly_review.attempts': 0 } });
        console.error(`Weekly review for ${u.id} failed:`, error.description || error.message);
      }
      if (GAP_MS) await sleep(GAP_MS);
    }
    state.last_error = null;
  } catch (error) {
    state.last_error = error.message;
    console.error('Weekly review tick failed:', error.message);
  } finally {
    state.busy = false;
  }
}

const _setGap = (ms) => { GAP_MS = ms; };   // tests

function start({ log = console.log } = {}) {
  stop();
  timer = setInterval(() => tick(), TICK_MS);
  timer.unref?.();
  state.running = true;
  tick();
  const d = defaultsFromCron();
  log(`🗓️ Weekly reviews: each person on their own day; default ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day]} ${d.time} in their timezone`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  state.running = false;
}

module.exports = { _setGap, defaultsFromCron, effectiveFor, nextWeekly, nextFor, viewFor, updateForUser, reschedule, tick, start, stop, state, WeeklyInputError, _setSender, MIN_GAP_MS };
