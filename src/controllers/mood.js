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

module.exports = { requestMoodPicker };
