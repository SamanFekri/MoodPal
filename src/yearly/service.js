// "Year in Moods": a short Instagram-story video of someone's year (src/yearly/render.js), sent by the bot.
//
// - Availability: an admin switch. Off = only admins can make one (to test it); on = everyone, from the
//   ✨ <year> menu button, /mood_<year>, t.me/<bot>?start=year and the mini app. Turning it on for a year
//   for the first time sends everyone one "it's ready" message through the broadcast queue.
// - One queue, one video at a time (each takes about a minute), first come first served. A person has
//   at most one request in the queue: asking again while theirs waits or is being made just tells them
//   their place in line. People waiting see how many are ahead of them, updated as the line moves.
// - A made video is kept as its Telegram file_id and sent again instantly, but only while it is less
//   than REUSE_MS old AND the person hasn't logged any moods for that year since.
// - Admins can make anyone's video and get it in their own chat to check.
const fs = require('fs');
const os = require('os');
const path = require('path');
const AppConfig = require('../models/app_config');
const User = require('../models/user');
const YearlyVideo = require('../models/yearly_video');
const { msgs } = require('../constants');
const { getTelegram } = require('../utils/telegram');
const { yearStats, MIN_MOODS } = require('./stats');

const REUSE_MS = 24 * 3600 * 1000;   // a made video is reused for at most a day
const EDIT_EVERY_MS = 3000;           // how often the progress message in the chat moves
const RENDER_TIMEOUT_MS = 5 * 60 * 1000;   // a render stuck longer than this is given up, so the queue keeps moving
const STUCK_MS = 2 * 60 * 1000;            // no progress for this long: the admin view calls it stuck
const TMP = path.join(os.tmpdir(), 'moodpal-yearly');

const state = { enabled: false, year: new Date().getFullYear(), announcedYear: null };
const bot = () => process.env.BOT_USERNAME || '';

// the bot menu reads this (src/constants/common.constant.js) without a database call
function publish() { globalThis.__moodpalYearly = { enabled: state.enabled, year: state.year }; }

async function load() {
  const cfg = await AppConfig.findOne({ key: 'main' }).select('yearly_enabled yearly_year yearly_announced_year').lean();
  state.enabled = Boolean(cfg?.yearly_enabled);
  state.year = cfg?.yearly_year || new Date().getFullYear();
  state.announcedYear = cfg?.yearly_announced_year ?? null;
  publish();
  return state;
}

const available = (user) => Boolean(user && (state.enabled || user.is_admin));

// ---------- queue: one render at a time, one request per person ----------
const line = [];        // waiting requests, in order: { chatId, subjectId, year, preview, progress, resolve }
let current = null;     // the request being made right now
let working = false;
// injectable for tests (rendering takes about a minute)
let renderer = (stats, out, opts) => require('./render').renderYearVideo(stats, out, opts);
function _setRenderer(fn) { renderer = fn || ((stats, out, opts) => require('./render').renderYearVideo(stats, out, opts)); }

const queued = () => line.length + (current ? 1 : 0);
// -1: not in the queue; 0: being made now; n: n requests ahead of theirs
function placeOf(chatId) {
  if (current?.chatId === chatId) return 0;
  const i = line.findIndex(r => r.chatId === chatId);
  return i < 0 ? -1 : i + (current ? 1 : 0);
}
const isFresh = (cached, total) => Boolean(cached && cached.moods === total && Date.now() - new Date(cached.made_at).getTime() < REUSE_MS);
const progressEdit = (req, text) => req.progress && getTelegram().editMessageText(req.chatId, req.progress.message_id, undefined, text).catch(() => {});

async function work() {
  if (working) return;
  working = true;
  try {
    while (line.length) {
      current = line.shift();
      current.started_at = new Date();
      // everyone still waiting moved up one
      line.forEach((r, i) => progressEdit(r, msgs.yearlyMakingMsg(r.year, 0, i + 1)));
      const req = current;
      const result = await make(req).catch((error) => { console.error('Year in Moods video failed:', error.message); return { status: 'failed' }; });
      current = null;
      // an admin restarted it: made again from the start, first in line
      if (result.status === 'restart') { line.unshift(req); continue; }
      req.resolve(result);
    }
  } finally { current = null; working = false; }
}

// runs when the request reaches the front of the line; the numbers are read now, not when they asked
async function make(req) {
  const tg = getTelegram();
  const { subjectId, chatId, year } = req;
  const stats = await yearStats(subjectId, year);
  // someone else's request (an admin preview, say) may have just made it
  const cached = await YearlyVideo.findOne({ user: subjectId, year }).lean();
  if (isFresh(cached, stats.total)) {
    await tg.sendVideo(chatId, cached.file_id, { caption: req.caption, parse_mode: 'HTML', supports_streaming: true });
    progressEdit(req, msgs.yearlyReadyMsg());
    return { status: 'cached', moods: cached.moods };
  }
  fs.mkdirSync(TMP, { recursive: true });
  const out = path.join(TMP, `${subjectId}-${year}-${Date.now()}.mp4`);
  try {
    req.percent = 0;
    req.progress_at = new Date();
    req.controller = new AbortController();
    const stopped = new Promise((_, reject) => req.controller.signal.addEventListener('abort', () => reject(new Error('stopped')), { once: true }));
    progressEdit(req, msgs.yearlyMakingMsg(year, 0, 0));
    // the chat's progress bar moves every few seconds (Telegram limits how often a message can change)
    let lastPct = 0, lastEdit = Date.now();
    let timer;
    const tooLong = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('render took too long')), RENDER_TIMEOUT_MS); });
    const video = await Promise.race([tooLong, stopped, renderer(stats, out, {
      bot: bot(),
      signal: req.controller.signal,
      onProgress: (f) => {
        const pct = Math.min(99, Math.floor(f * 100));
        if (pct !== req.percent) req.progress_at = new Date();
        req.percent = pct;
        if (pct !== lastPct && Date.now() - lastEdit >= EDIT_EVERY_MS) { lastPct = pct; lastEdit = Date.now(); progressEdit(req, msgs.yearlyMakingMsg(year, pct, 0)); }
      },
    })]).finally(() => clearTimeout(timer));
    const sent = await tg.sendVideo(chatId, { source: fs.createReadStream(video.path) }, {
      caption: req.caption, parse_mode: 'HTML', supports_streaming: true, width: video.width, height: video.height, duration: video.duration,
    });
    const fileId = sent?.video?.file_id || sent?.document?.file_id;
    if (fileId) await YearlyVideo.updateOne({ user: subjectId, year }, { file_id: fileId, moods: stats.total, made_at: new Date() }, { upsert: true });
    progressEdit(req, msgs.yearlyReadyMsg());
    return { status: 'sent', moods: stats.total };
  } catch (error) {
    if (req.restart) {
      req.restart = false;
      req.restarts = (req.restarts || 0) + 1;
      return { status: 'restart' };
    }
    console.error('Year in Moods video failed:', error.message);
    progressEdit(req, msgs.yearlyFailedMsg());
    return { status: 'failed' };
  } finally {
    req.controller?.abort();   // stops a renderer that is still going (after a timeout, say)
    req.controller = null;
    fs.rm(out, { force: true }, () => {});
  }
}

/**
 * Send `subjectId`'s video for `year` to `chatId`: right away if a fresh one is kept, otherwise it joins
 * the queue. A chat with a request already in the queue gets its place in line instead of a second one.
 * @param {{ subjectId, chatId, year?, preview?: boolean }} opts preview: an admin checking someone else
 * @returns {Promise<{status: 'sent'|'cached'|'not_enough'|'already_queued'|'failed', moods?: number, place?: number}>}
 */
async function deliver({ subjectId, chatId, year = state.year, preview = false }) {
  const tg = getTelegram();
  const place = placeOf(chatId);
  if (place >= 0) {
    await tg.sendMessage(chatId, msgs.yearlyInLineMsg(place)).catch(() => {});
    return { status: 'already_queued', place };
  }
  const subject = await User.findById(subjectId).select('first_name username').lean();
  const stats = await yearStats(subjectId, year);
  if (!stats.enough) {
    await tg.sendMessage(chatId, preview ? `${subject?.first_name || 'They'} only have ${stats.total} moods in ${year}; a video needs ${MIN_MOODS}.` : msgs.yearlyNotEnoughMsg(year, MIN_MOODS, stats.total)).catch(() => {});
    return { status: 'not_enough', moods: stats.total };
  }
  const caption = preview ? msgs.yearlyAdminCaption(subject?.first_name || 'Their', year) : msgs.yearlyCaption(year, bot());

  const cached = await YearlyVideo.findOne({ user: subjectId, year }).lean();
  if (isFresh(cached, stats.total)) {
    await tg.sendVideo(chatId, cached.file_id, { caption, parse_mode: 'HTML', supports_streaming: true });
    return { status: 'cached', moods: cached.moods };
  }

  // checked again after the awaits above, so two quick taps still make only one request
  if (placeOf(chatId) >= 0) return { status: 'already_queued', place: placeOf(chatId) };
  return new Promise((resolve) => {
    const req = { chatId, subjectId, year, preview, caption, progress: null, resolve, name: subject?.first_name || subject?.username || 'Someone', asked_at: new Date(), percent: 0 };
    line.push(req);
    tg.sendMessage(chatId, msgs.yearlyMakingMsg(year, 0, queued() - 1)).catch(() => null)
      .then((m) => { req.progress = m; work(); });
  });
}

// where this chat's request is, for the mini app's progress bar: null when it has none
function statusOf(chatId) {
  const place = placeOf(chatId);
  if (place < 0) return null;
  return place === 0 ? { place: 0, percent: current.percent } : { place, percent: 0 };
}

// from the bot or the mini app: the person's own video, if it's open to them
async function requestOwn(user, { year } = {}) {
  if (!available(user)) {
    await getTelegram().sendMessage(user.id, msgs.yearlyNotYetMsg()).catch(() => {});
    return { status: 'not_open' };
  }
  return deliver({ subjectId: user._id, chatId: user.id, year: year || state.year });
}

// ---------- admin ----------
async function adminView() {
  const year = state.year;
  return {
    enabled: state.enabled,
    year,
    current_year: new Date().getFullYear(),
    min_year: 2020,
    max_year: new Date().getFullYear() + 1,
    announced: state.announcedYear === year,
    made: await YearlyVideo.countDocuments({ year }),
    in_queue: queued(),
    // for the admin's live view of the line
    queue: {
      now: current && {
        name: current.name, year: current.year, preview: current.preview, percent: current.percent, started_at: current.started_at,
        minutes: Math.floor((Date.now() - current.started_at) / 60000),
        quiet_minutes: Math.floor((Date.now() - (current.progress_at || current.started_at)) / 60000),
        stuck: Date.now() - (current.progress_at || current.started_at) >= STUCK_MS,
        restarts: current.restarts || 0,
      },
      waiting: line.map(r => ({ name: r.name, year: r.year, preview: r.preview, asked_at: r.asked_at })),
    },
    min_moods: MIN_MOODS,
  };
}

/**
 * @param {{ enabled?: boolean, year?: number }} patch
 * Turning it on for a year for the first time sends everyone the announcement (broadcast queue).
 */
async function updateSettings(adminId, { enabled, year } = {}) {
  const set = {};
  if (enabled !== undefined) { if (typeof enabled !== 'boolean') throw new Error('invalid_value'); set.yearly_enabled = enabled; }
  if (year !== undefined) { if (!Number.isInteger(year) || year < 2020 || year > new Date().getFullYear() + 1) throw new Error('invalid_value'); set.yearly_year = year; }
  if (!Object.keys(set).length) throw new Error('invalid_value');
  await AppConfig.updateOne({ key: 'main' }, set, { upsert: true });
  await load();
  let announced = false;
  if (state.enabled && state.announcedYear !== state.year) {
    const button = bot() ? { text: `✨ Get my ${state.year}`, url: `https://t.me/${bot()}?start=year` } : null;
    await require('../broadcast/service').create(adminId, { kind: 'text', text: msgs.yearlyAnnounceMsg(state.year), button });
    await AppConfig.updateOne({ key: 'main' }, { yearly_announced_year: state.year });
    state.announcedYear = state.year;
    announced = true;
  }
  return { ...await adminView(), just_announced: announced };
}

// An admin's "Restart it" for a video that looks stuck: stops it and makes it again from the start,
// first in line. The person isn't told anything; their progress bar just starts over.
async function restartCurrent() {
  if (!current) throw new Error('nothing_running');
  current.restart = true;
  current.controller?.abort();
  return adminView();
}

// "Start fresh": forget every video made for this year, so the next request makes a new one
// (after a design change, for example). Nothing is sent to anyone.
async function resetYear(year = state.year) {
  const { deletedCount } = await YearlyVideo.deleteMany({ year });
  return { ...await adminView(), cleared: deletedCount };
}

async function start({ log = console.log } = {}) {
  // videos are deleted once sent; this clears any a crash or restart left half-made
  fs.rmSync(TMP, { recursive: true, force: true });
  await load();
  log(`✨ Year in Moods ${state.enabled ? 'open to everyone' : 'admins only'} (${state.year})`);
}

module.exports = { state, load, start, available, deliver, requestOwn, adminView, updateSettings, resetYear, restartCurrent, statusOf, _setRenderer, REUSE_MS };
