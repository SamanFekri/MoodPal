// Mini app -> bot bridge for moods.
const { MOOD_INLINE_KEYBOARD, msgs, common } = require('../constants');
const { getTelegram } = require('../utils/telegram');
const Mood = require('../models/mood');

// POST /api/me/mood/picker — the bot sends the "choose your mood" message to the chat,
// so the mini app can close and the user lands right on the picker.
const requestMoodPicker = async (req, res) => {
  try {
    await getTelegram().sendMessage(req.user.id, msgs.chooseMoodMsg(), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: MOOD_INLINE_KEYBOARD },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('Mood picker request failed:', error.message);
    res.status(502).json({ ok: false, error: 'telegram_send_failed' });
  }
};

// GET /api/moods — the 18 moods the mini app's picker offers (same list and order as the bot's)
const { MOODS, MOOD_MAP } = require('../constants/mood.constant');
const listMoods = (req, res) => res.json({ moods: MOODS.map(m => ({ ...m, tgs: `/public/tgs/${m.code}.tgs` })) });

// POST /api/me/mood { code, note? } — set the mood from the mini app. It's saved like a mood picked in
// the bot, and the bot posts the same messages to the chat: the mood's name and emoji, then either
// "note saved" (with Talk about it) or the usual prompt to add a note there.
const NOTE_MAX = 2000;
const setMine = async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (!Object.hasOwn(MOOD_MAP, code)) return res.status(400).json({ error: 'invalid_mood' });
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (note.length > NOTE_MAX) return res.status(400).json({ error: 'note_too_long', max: NOTE_MAX });

  const mood = await Mood.create({ user: req.user._id, mood: MOOD_MAP[code], note });
  res.json({
    mood: { mood: mood.mood, note: mood.note || '', timestamp: mood.timestamp, image: `/public/moods/${code}.webp`, tgs: `/public/tgs/${code}.tgs` },
  });
  module.exports.botJob = postToChat(req.user, MOOD_MAP[code], note).catch(error => console.error('Mood (mini app) chat messages failed:', error.message));
};

// what the bot says after a mood is picked, sent in order; a failure never undoes the saved mood
async function postToChat(user, mood, note) {
  const telegram = getTelegram();
  await telegram.sendMessage(user.id, mood.name);
  await telegram.sendMessage(user.id, mood.emoji);
  if (note) {
    const { TALK_ABOUT_NOTE_KEYBOARD } = require('../commands/talk');
    await telegram.sendMessage(user.id, `${msgs.noteSavedMsg()}\n${msgs.talkAboutNoteMsg()}`, { reply_markup: { inline_keyboard: TALK_ABOUT_NOTE_KEYBOARD } });
  } else {
    await new Promise(resolve => setTimeout(resolve, module.exports.NOTE_PROMPT_DELAY_MS));
    await telegram.sendMessage(user.id, msgs.addNoteMsg(), { reply_markup: { keyboard: common.makeKeyboardMenu({ user }), resize_keyboard: true } });
  }
}

// GET /api/me/moods?before=<ISO date>&limit= — the signed-in user's own history, newest first
const myMoods = async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const before = req.query.before ? new Date(req.query.before) : null;
  const filter = { user: req.user._id };
  if (before && !isNaN(before)) filter.timestamp = { $lt: before };
  const moods = await Mood.find(filter).sort({ timestamp: -1 }).limit(limit + 1).select('mood note timestamp').lean();
  const hasMore = moods.length > limit;
  const page = moods.slice(0, limit);
  res.json({
    moods: page.map(m => ({ mood: m.mood, note: m.note || '', timestamp: m.timestamp, tgs: `/public/tgs/${m.mood.code}.tgs` })),
    has_more: hasMore,
    next_before: hasMore ? page[page.length - 1].timestamp : null,
  });
};

// POST /api/me/export — send the whole mood log (moods, notes, day and hour) as a CSV to the user's chat
const moodExport = require('../export/moods');
const exportMine = async (req, res) => {
  try {
    res.json({ ok: true, ...(await moodExport.sendToChat(req.user._id)) });
  } catch (error) {
    if (error instanceof moodExport.ExportError) return res.status(error.code === 'too_soon' ? 429 : 400).json({ error: error.code, retry_in_s: error.retry_in_s });
    console.error('Mood export failed:', error.code || error.message);
    res.status(502).json({ error: 'telegram_send_failed' });
  }
};

module.exports = { requestMoodPicker, listMoods, setMine, myMoods, exportMine, NOTE_PROMPT_DELAY_MS: 2000, botJob: null };
