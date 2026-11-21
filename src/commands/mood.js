const Mood = require('../models/mood');
const { moodKeyboard, common } = require('../constants');
const i18n = require('../i18n');
const { MOOD_MAP } = require('../constants/mood.constant');
const { keyboard } = require('telegraf/markup');
const { logTelegramError } = require('../utils/tg_errors');
const support = require('../support/service');

async function setMoodCommand(ctx) {
  try {
    const msgs = i18n.forCtx(ctx);
    await ctx.reply(msgs.chooseMoodMsg(), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: moodKeyboard(msgs),
      }
    });
  } catch (error) {
    console.error('Error in set_mood command:', error);
  }
}

async function saveMood(ctx) {
  try {
    const msgs = i18n.forCtx(ctx);
    const code = ctx.callbackQuery.data.split('_')[1];
    const userId = ctx.user._id;
    let mood = new Mood({
      user: userId,
      mood: MOOD_MAP[code],
    });
    mood = await mood.save();
    await ctx.answerCbQuery(msgs.moodSavedToast()).catch(logTelegramError('answerCbQuery'));
    // name, emoji, then (2s later) the note prompt. In the background so the bot keeps handling
    // other people meanwhile; a failed send is logged, never left unhandled (that stops the bot).
    (async () => {
      await ctx.telegram.sendMessage(ctx.user.id, msgs.moods[code] || MOOD_MAP[code].name);
      await ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].emoji);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await ctx.telegram.sendMessage(ctx.user.id, msgs.addNoteMsg(), {reply_markup: {keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true}});
    })().catch(logTelegramError('mood saved messages'))
      // a hard mood: automatic alerts to support friends, and "share how you're feeling?" here in the chat
      .then(() => support.afterMood(userId, mood, { source: 'bot' }));
  } catch (error) {
    console.error('Error saving mood:', error);
  }
}

module.exports = {
  setMoodCommand,
  saveMood
}