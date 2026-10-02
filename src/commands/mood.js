const Mood = require('../models/mood');
const { MOOD_INLINE_KEYBOARD, msgs, common } = require('../constants');
const { MOOD_MAP } = require('../constants/mood.constant');
const { keyboard } = require('telegraf/markup');
const { logTelegramError } = require('../utils/tg_errors');

async function setMoodCommand(ctx) {
  try {
    await ctx.reply(msgs.chooseMoodMsg(), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: MOOD_INLINE_KEYBOARD,
      }
    });
  } catch (error) {
    console.error('Error in set_mood command:', error);
  }
}

async function saveMood(ctx) {
  try {
    const code = ctx.callbackQuery.data.split('_')[1];
    const userId = ctx.user._id;
    let mood = new Mood({
      user: userId,
      mood: MOOD_MAP[code],
    });
    mood = await mood.save();
    await ctx.answerCbQuery('Mood saved successfully!').catch(logTelegramError('answerCbQuery'));
    // name, emoji, then (2s later) the note prompt. In the background so the bot keeps handling
    // other people meanwhile; a failed send is logged, never left unhandled (that stops the bot).
    (async () => {
      await ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].name);
      await ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].emoji);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await ctx.telegram.sendMessage(ctx.user.id, msgs.addNoteMsg(), {reply_markup: {keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true}});
    })().catch(logTelegramError('mood saved messages'));
  } catch (error) {
    console.error('Error saving mood:', error);
  }
}

module.exports = {
  setMoodCommand,
  saveMood
}