// Admin broadcasts: one message (text, photo, video, GIF, audio or file) to every user.
//
// Sending goes through a queue, like reminders: every second the worker sends at most
// `broadcast_rate_per_second` messages. Reminders run at their own rate next to it, and both
// share one pause: when Telegram answers 429 the whole bot waits retry_after before sending again.
// People who blocked the bot are marked unreachable (the same flag reminders use) and skipped.
const AppConfig = require('../models/app_config');
const User = require('../models/user');
const Broadcast = require('../models/broadcast');
const BroadcastDelivery = require('../models/broadcast_delivery');
const { getTelegram } = require('../utils/telegram');
const reminders = require('../reminders/service');
const i18n = require('../i18n');

// languages a broadcast can have its own version in; English is the base message everyone else gets
const VARIANT_LANGS = i18n.LANGS.filter(l => l !== i18n.DEFAULT_LANG);

const DRAIN_MS = 1000;
const MAX_ATTEMPTS = 3;
const TEXT_LIMIT = 4096;
const CAPTION_LIMIT = 1024;
const KINDS = ['text', 'photo', 'video', 'animation', 'audio', 'document'];
// who gets a broadcast first; default: whoever used the bot most recently
const ORDERS = {
  recent_active: { last_active_at: -1, _id: -1 },
  least_active: { last_active_at: 1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
};

const state = { running: false, last_error: null };
let timer = null;
let draining = false;

class BroadcastInputError extends Error {
  constructor(code, lang = null) { super(code); this.code = code; this.lang = lang; }
}

// ---------- the message ----------

// shared with reminders: a 429 anywhere pauses every outgoing queue
const pausedUntil = () => reminders.state.paused_until;
const pause = (ms) => { reminders.state.paused_until = new Date(Math.max(Date.now() + ms, reminders.state.paused_until?.getTime?.() || 0)); };

function parseButton(button, lang = null) {
  if (!button || !(button.text || button.url)) return null;
  const bt = String(button.text || '').trim().slice(0, 40), bu = String(button.url || '').trim();
  if (!bt || !/^https?:\/\/\S+$/i.test(bu)) throw new BroadcastInputError('invalid_button', lang);
  return { text: bt, url: bu };
}

const checkLength = (msg, lang = null) => {
  if (msg.text.length > (msg.kind === 'text' ? TEXT_LIMIT : CAPTION_LIMIT)) throw new BroadcastInputError(msg.kind === 'text' ? 'text_too_long' : 'caption_too_long', lang);
};

// the English (base) message
function normalize({ text = '', kind = 'text', file_id = null, file_name = null, button = null } = {}) {
  const k = KINDS.includes(kind) ? kind : 'text';
  const t = String(text || '').trim();
  if (k === 'text' && !t) throw new BroadcastInputError('empty_message');
  if (k !== 'text' && !file_id) throw new BroadcastInputError('missing_media');
  const msg = { kind: k, text: t, file_id: k === 'text' ? null : String(file_id), file_name: file_name ? String(file_name).slice(0, 120) : null, button: parseButton(button) };
  checkLength(msg);
  return msg;
}

// One language's own parts; null when it has none. Whatever it leaves out comes from the English message.
function normalizeVariant(v, lang) {
  if (!v || typeof v !== 'object') return null;
  const t = String(v.text || '').trim();
  const hasMedia = Boolean(v.file_id) && KINDS.includes(v.kind) && v.kind !== 'text';
  const button = parseButton(v.button, lang);
  if (!t && !hasMedia && !button) return null;
  return {
    text: t || null,
    kind: hasMedia ? v.kind : null,
    file_id: hasMedia ? String(v.file_id) : null,
    file_name: hasMedia && v.file_name ? String(v.file_name).slice(0, 120) : null,
    button,
  };
}

// What someone gets: their language's own text, media and button, the English ones for anything missing
function messageFor(base, variant) {
  if (!variant) return { kind: base.kind, text: base.text || '', file_id: base.file_id || null, file_name: base.file_name || null, button: base.button?.text ? base.button : null };
  const media = variant.file_id
    ? { kind: variant.kind, file_id: variant.file_id, file_name: variant.file_name || null }
    : { kind: base.kind, file_id: base.file_id || null, file_name: base.file_name || null };
  return { ...media, text: variant.text || base.text || '', button: variant.button?.text ? variant.button : (base.button?.text ? base.button : null) };
}

// the base message plus every language version, each checked as the message that will actually be sent
function normalizeAll(input = {}) {
  const base = normalize(input);
  const variants = {};
  for (const lang of VARIANT_LANGS) {
    const v = normalizeVariant(input.variants?.[lang], lang);
    if (!v) continue;
    checkLength(messageFor(base, v), lang);
    variants[lang] = v;
  }
  return { base, variants: Object.keys(variants).length ? variants : null };
}

// send one broadcast message to one chat (plain text: nothing the admin types can break formatting)
async function sendTo(chatId, msg) {
  const tg = getTelegram();
  const extra = msg.button?.text ? { reply_markup: { inline_keyboard: [[{ text: msg.button.text, url: msg.button.url }]] } } : {};
  const withCaption = msg.text ? { ...extra, caption: msg.text } : extra;
  switch (msg.kind) {
    case 'photo': return tg.sendPhoto(chatId, msg.file_id, withCaption);
    case 'video': return tg.sendVideo(chatId, msg.file_id, withCaption);
    case 'animation': return tg.sendAnimation(chatId, msg.file_id, withCaption);
    case 'audio': return tg.sendAudio(chatId, msg.file_id, withCaption);
    case 'document': return tg.sendDocument(chatId, msg.file_id, withCaption);
    default: return tg.sendMessage(chatId, msg.text, { ...extra, link_preview_options: { is_disabled: false } });
  }
}

// ---------- media: upload once, reuse the file_id for everyone ----------

function kindFor(mime = '', name = '') {
  const m = String(mime).toLowerCase(), n = String(name).toLowerCase();
  if (m === 'image/gif' || n.endsWith('.gif')) return 'animation';
  if (m.startsWith('image/')) return 'photo';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'document';
}

const fileIdOf = (message, kind) => {
  if (!message) return null;
  if (kind === 'photo') return message.photo?.at(-1)?.file_id || null;
  return message[kind]?.file_id || message.document?.file_id || null;
};

// Upload to the admin's own chat (their preview too) and keep Telegram's file_id.
async function uploadMedia(adminChatId, buffer, { mime, name }) {
  if (!buffer?.length) throw new BroadcastInputError('empty_file');
  let kind = kindFor(mime, name);
  if (kind === 'photo' && buffer.length > 10 * 1024 * 1024) kind = 'document';   // Telegram's photo limit
  const tg = getTelegram();
  const input = { source: buffer, filename: name || `upload.${(mime || '').split('/')[1] || 'bin'}` };
  const caption = { caption: 'Uploaded for a broadcast. This is what people will see.' };
  const method = { photo: 'sendPhoto', video: 'sendVideo', animation: 'sendAnimation', audio: 'sendAudio', document: 'sendDocument' }[kind];
  const message = await tg[method](adminChatId, input, caption);
  const fileId = fileIdOf(message, kind);
  if (!fileId) throw new BroadcastInputError('upload_failed');
  return { kind, file_id: fileId, file_name: name || null, size: buffer.length };
}

// ---------- the main channel ----------

const channelId = () => process.env.MAIN_CHANNEL_ID || null;

// one post in the channel, right away (no queue: it's a single message). Never throws.
async function postToChannel(msg) {
  const id = channelId();
  if (!id) return { channel_status: 'not_configured', channel_error: null, channel_message_id: null };
  try {
    const sent = await sendTo(id, msg);
    return { channel_status: 'sent', channel_error: null, channel_message_id: sent?.message_id ?? null };
  } catch (error) {
    console.error('Broadcast to the channel failed:', error.description || error.message);
    return { channel_status: 'failed', channel_error: String(error.description || error.message || 'send failed').slice(0, 200), channel_message_id: null };
  }
}

// ---------- audience ----------

// everyone the bot can still reach
const audienceFilter = () => ({ is_bot: { $ne: true }, is_blocked: { $ne: true }, 'reminder.bot_blocked': { $ne: true } });
const audienceCount = () => User.countDocuments(audienceFilter());

// ---------- create / cancel ----------

// `to_users` / `to_channel`: send it to everyone's chat, post it in the main channel, or both
// (the default). At least one has to be on.
const flag = (v, fallback) => (v === undefined || v === null ? fallback : v === true || v === 'true');

async function create(adminId, input, { resentFrom = null, exclude = null } = {}) {
  const { base: msg, variants } = normalizeAll(input);
  const order = ORDERS[input?.order] ? input.order : 'recent_active';
  const toUsers = flag(input?.to_users, true);
  const toChannel = flag(input?.to_channel, true);
  if (!toUsers && !toChannel) throw new BroadcastInputError('no_destination');
  const broadcast = await Broadcast.create({ created_by: adminId, ...msg, variants, order, resent_from: resentFrom, only_missed: Boolean(exclude), to_users: toUsers, to_channel: toChannel });
  if (toChannel) Object.assign(broadcast, await postToChannel(msg));
  let total = 0;
  const filter = exclude ? { ...audienceFilter(), _id: { $nin: exclude } } : audienceFilter();
  const cursor = User.find(filter).sort(ORDERS[order]).select('_id id language').lean().cursor();
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    await BroadcastDelivery.insertMany(batch, { ordered: false }).catch(err => { if (err.code !== 11000 && !err.writeErrors) throw err; });
    total += batch.length;
    batch = [];
  };
  for await (const u of toUsers ? cursor : []) {
    batch.push({ broadcast: broadcast._id, user: u._id, chat_id: u.id, lang: i18n.normalize(u.language), seq: total + batch.length });
    if (batch.length >= 1000) await flush();
  }
  await flush();
  broadcast.total = total;
  if (!total) { broadcast.status = 'done'; broadcast.finished_at = new Date(); }
  await broadcast.save();
  return broadcast;
}

// Send an earlier broadcast again: same text, media (by its Telegram file_id, no re-upload) and
// button. `audience`: 'everyone' (whoever the bot can reach now) or 'missed' (only people who didn't
// get it: joined since, failed, or skipped). Not while the original is still sending.
async function resend(adminId, id, { audience = 'everyone', order } = {}) {
  const original = await Broadcast.findById(id).lean().catch(() => null);
  if (!original) return null;
  if (original.status === 'sending') throw new BroadcastInputError('still_sending');
  const exclude = audience === 'missed'
    ? await BroadcastDelivery.find({ broadcast: original._id, status: 'sent' }).distinct('user')
    : null;
  // a resend goes to people's chats only: the channel already has the post
  const input = { text: original.text, kind: original.kind, file_id: original.file_id, file_name: original.file_name, button: original.button?.text ? original.button : null, variants: original.variants || null, order: ORDERS[order] ? order : original.order, to_users: true, to_channel: false };
  return create(adminId, input, { resentFrom: original._id, exclude });
}

// "Send test to me": the English message, then each language that has its own version, as people will get it
async function sendTest(chatId, input) {
  const { base, variants } = normalizeAll(input);
  await sendTo(chatId, base);
  for (const lang of Object.keys(variants || {})) await sendTo(chatId, messageFor(base, variants[lang]));
  return { languages: ['en', ...Object.keys(variants || {})] };
}

async function cancel(id) {
  const b = await Broadcast.findOneAndUpdate({ _id: id, status: 'sending' }, { status: 'cancelled', finished_at: new Date() }, { new: true });
  if (!b) return null;
  await BroadcastDelivery.updateMany({ broadcast: id, status: 'queued' }, { status: 'skipped', reason: 'cancelled' });
  return b;
}

// ---------- the worker ----------

async function rate() {
  const config = await AppConfig.get();
  return config.broadcast_rate_per_second || 15;
}

async function finishIfDone(broadcastId) {
  const left = await BroadcastDelivery.countDocuments({ broadcast: broadcastId, status: { $in: ['queued', 'sending'] } });
  if (!left) await Broadcast.updateOne({ _id: broadcastId, status: 'sending' }, { status: 'done', finished_at: new Date() });
}

const errorCode = (e) => e?.response?.error_code ?? e?.code;
const isBlockedError = (e) => errorCode(e) === 403 || (errorCode(e) === 400 && /chat not found|user is deactivated/i.test(e?.description || e?.message || ''));

// Send up to rate_per_second deliveries that are due. Returns what happened to each.
async function drain(now = new Date(), { limit } = {}) {
  if (draining) return [];
  draining = true;
  const results = [];
  try {
    if (pausedUntil() && pausedUntil() > now) return results;
    const max = limit ?? await rate();
    const active = await Broadcast.find({ status: 'sending' }).sort({ started_at: 1 }).lean();
    const byId = new Map(active.map(b => [String(b._id), b]));
    if (!byId.size) return results;
    const touched = new Set();
    for (let i = 0; i < max; i++) {
      const d = await BroadcastDelivery.findOneAndUpdate(
        { broadcast: { $in: [...byId.keys()] }, status: 'queued', run_at: { $lte: now } },
        { $set: { status: 'sending' }, $inc: { attempts: 1 } },
        { sort: { run_at: 1, seq: 1 }, new: true },
      ).lean();
      if (!d) break;
      touched.add(String(d.broadcast));
      const b = byId.get(String(d.broadcast));
      // their language's version, with the English parts for anything it leaves out
      const msg = messageFor(b, b.variants?.[d.lang]);
      try {
        await sendTo(d.chat_id, msg);
        await BroadcastDelivery.updateOne({ _id: d._id }, { status: 'sent', sent_at: new Date(), reason: null });
        results.push('sent');
      } catch (error) {
        const code = errorCode(error);
        if (code === 429) {
          const wait = (Number(error?.parameters?.retry_after ?? error?.response?.parameters?.retry_after) || 5) * 1000;
          pause(wait);
          await BroadcastDelivery.updateOne({ _id: d._id }, { status: 'queued', run_at: pausedUntil(), reason: 'rate_limited', $inc: { attempts: -1 } });
          results.push('rate_limited');
          break;
        }
        if (isBlockedError(error)) {
          await BroadcastDelivery.updateOne({ _id: d._id }, { status: 'failed', reason: 'bot_blocked' });
          await User.updateOne({ _id: d.user }, { 'reminder.bot_blocked': true, 'reminder.next_at': null });
          results.push('failed');
        } else if (d.attempts >= MAX_ATTEMPTS) {
          await BroadcastDelivery.updateOne({ _id: d._id }, { status: 'failed', reason: String(error?.description || error?.message || 'send failed').slice(0, 200) });
          results.push('failed');
        } else {
          await BroadcastDelivery.updateOne({ _id: d._id }, { status: 'queued', run_at: new Date(Date.now() + 20000 * d.attempts), reason: String(error?.description || error?.message || '').slice(0, 200) });
          results.push('retry');
        }
      }
    }
    for (const id of touched) await finishIfDone(id);
  } catch (error) {
    state.last_error = error.message;
    console.error('Broadcast drain failed:', error.message);
  } finally {
    draining = false;
  }
  return results;
}

// ---------- admin view ----------

async function view({ limit = 8 } = {}) {
  const list = await Broadcast.find().sort({ createdAt: -1 }).limit(limit).lean();
  const counts = await BroadcastDelivery.aggregate([
    { $match: { broadcast: { $in: list.map(b => b._id) } } },
    { $group: { _id: { b: '$broadcast', s: '$status' }, n: { $sum: 1 } } },
  ]);
  const by = {};
  for (const c of counts) (by[String(c._id.b)] ||= {})[c._id.s] = c.n;
  // how many people can get it, per language (no language set = English)
  const byLang = await User.aggregate([{ $match: audienceFilter() }, { $group: { _id: '$language', n: { $sum: 1 } } }]);
  const audienceByLang = Object.fromEntries(i18n.LANGS.map(l => [l, 0]));
  for (const row of byLang) audienceByLang[i18n.normalize(row._id)] += row.n;
  return {
    audience: await audienceCount(),
    audience_by_lang: audienceByLang,
    languages: VARIANT_LANGS,
    rate_per_second: await rate(),
    channel_configured: Boolean(channelId()),
    paused_until: pausedUntil() && pausedUntil() > new Date() ? pausedUntil() : null,
    broadcasts: list.map(b => {
      const c = by[String(b._id)] || {};
      return {
        id: b._id, kind: b.kind, text: b.text, file_id: b.file_id, file_name: b.file_name, button: b.button?.text ? b.button : null, order: b.order,
        variants: b.variants || null,
        resent_from: b.resent_from || null, only_missed: Boolean(b.only_missed),
        to_users: b.to_users !== false, to_channel: Boolean(b.to_channel), channel_status: b.channel_status || null, channel_error: b.channel_error || null,
        status: b.status, total: b.total, started_at: b.started_at, finished_at: b.finished_at,
        sent: c.sent || 0, failed: c.failed || 0, skipped: c.skipped || 0, waiting: (c.queued || 0) + (c.sending || 0),
      };
    }),
  };
}

// ---------- lifecycle ----------

async function start({ log = console.log } = {}) {
  stop();
  await BroadcastDelivery.updateMany({ status: 'sending' }, { status: 'queued' });   // caught mid-send by a restart
  // a broadcast with nothing left to send (e.g. restored from a backup without its queue) is finished
  for (const b of await Broadcast.find({ status: 'sending' }).select('_id').lean()) await finishIfDone(b._id);
  timer = setInterval(() => drain(), DRAIN_MS);
  timer.unref?.();
  state.running = true;
  log(`📣 Broadcast queue ready, up to ${await rate()}/s`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  state.running = false;
}

module.exports = {
  KINDS, ORDERS, TEXT_LIMIT, CAPTION_LIMIT, BroadcastInputError,
  VARIANT_LANGS, normalize, normalizeAll, messageFor, kindFor, uploadMedia, sendTest, create, resend, cancel, drain, view, audienceCount, start, stop, state,
};
