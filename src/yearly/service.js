// "Year in Moods": a short Instagram-story video of someone's year (src/yearly/render.js), sent by the bot.
//
// - Availability: an admin switch. Off = only admins can make one (to test it); on = everyone, from the
//   ✨ <year> menu button, /mood_<year>, t.me/<bot>?start=year and the mini app. Turning it on for a year
//   for the first time sends everyone one "it's ready" message through the broadcast queue.
// - Videos render one at a time (each takes about a minute); asking again while one is being made
//   joins it. A made video is kept as its Telegram file_id and sent again instantly while the person's
//   moods for that year haven't changed (or for REUSE_MS after it was made).
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

const REUSE_MS = 6 * 3600 * 1000;
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

// ---------- queue: one render at a time ----------
let chain = Promise.resolve();
const jobs = new Map();   // `${userId}:${year}` -> promise
function enqueue(key, fn) {
  if (jobs.has(key)) return jobs.get(key);
  const p = chain.then(fn).finally(() => jobs.delete(key));
  chain = p.catch(() => {});
  jobs.set(key, p);
  return p;
}
// injectable for tests (rendering takes about a minute)
let renderer = (stats, out, opts) => require('./render').renderYearVideo(stats, out, opts);
function _setRenderer(fn) { renderer = fn || ((stats, out, opts) => require('./render').renderYearVideo(stats, out, opts)); }

/**
 * Make (or reuse) `subjectId`'s video for `year` and send it to `chatId`.
 * @param {{ subjectId, chatId, year?, preview?: boolean }} opts preview: an admin checking someone else
 * @returns {Promise<{status: 'sent'|'cached'|'not_enough'|'failed', moods?: number}>}
 */
async function deliver({ subjectId, chatId, year = state.year, preview = false }) {
  const tg = getTelegram();
  const subject = await User.findById(subjectId).select('first_name username').lean();
  const stats = await yearStats(subjectId, year);
  if (!stats.enough) {
    await tg.sendMessage(chatId, preview ? `${subject?.first_name || 'They'} only have ${stats.total} moods in ${year}; a video needs ${MIN_MOODS}.` : msgs.yearlyNotEnoughMsg(year, MIN_MOODS, stats.total)).catch(() => {});
    return { status: 'not_enough', moods: stats.total };
  }
  const caption = preview ? msgs.yearlyAdminCaption(subject?.first_name || 'Their', year) : msgs.yearlyCaption(year, bot());

  const cached = await YearlyVideo.findOne({ user: subjectId, year }).lean();
  if (cached && (cached.moods === stats.total || Date.now() - cached.made_at < REUSE_MS)) {
    await tg.sendVideo(chatId, cached.file_id, { caption, parse_mode: 'HTML', supports_streaming: true });
    return { status: 'cached', moods: cached.moods };
  }

  const ahead = jobs.size;
  const progress = await tg.sendMessage(chatId, msgs.yearlyMakingMsg(year, 0, ahead)).catch(() => null);
  const edit = (text) => progress && tg.editMessageText(chatId, progress.message_id, undefined, text).catch(() => {});
  return enqueue(`${subjectId}:${year}`, async () => {
    fs.mkdirSync(TMP, { recursive: true });
    const out = path.join(TMP, `${subjectId}-${year}-${Date.now()}.mp4`);
    try {
      let last = 0;
      const video = await renderer(stats, out, {
        bot: bot(),
        onProgress: (f) => { const pct = Math.floor(f * 100); if (pct - last >= 10) { last = pct; edit(msgs.yearlyMakingMsg(year, pct, 0)); } },
      });
      const sent = await tg.sendVideo(chatId, { source: fs.createReadStream(video.path) }, {
        caption, parse_mode: 'HTML', supports_streaming: true, width: video.width, height: video.height, duration: video.duration,
      });
      const fileId = sent?.video?.file_id || sent?.document?.file_id;
      if (fileId) await YearlyVideo.updateOne({ user: subjectId, year }, { file_id: fileId, moods: stats.total, made_at: new Date() }, { upsert: true });
      edit(msgs.yearlyReadyMsg());
      return { status: 'sent', moods: stats.total };
    } catch (error) {
      console.error('Year in Moods video failed:', error.message);
      edit(msgs.yearlyFailedMsg());
      return { status: 'failed' };
    } finally {
      fs.rm(out, { force: true }, () => {});
    }
  });
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
    in_queue: jobs.size,
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

module.exports = { state, load, start, available, deliver, requestOwn, adminView, updateSettings, resetYear, _setRenderer, REUSE_MS };
