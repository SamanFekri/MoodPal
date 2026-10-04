// Mini app -> bot bridge for moods.
const { MOOD_INLINE_KEYBOARD, msgs, common } = require('../constants');
const { getTelegram } = require('../utils/telegram');

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

// GET /api/me/moods?before=<ISO date>&limit= — the signed-in user's own history, newest first
const Mood = require('../models/mood');
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

module.exports = { requestMoodPicker, myMoods, exportMine };
