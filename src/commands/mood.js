const Mood = require('../models/mood');
const { MOOD_INLINE_KEYBOARD, msgs, common } = require('../constants');
const { MOOD_MAP } = require('../constants/mood.constant');
const { keyboard } = require('telegraf/markup');

async function setMoodCommand(ctx) {
  try {
    ctx.reply(msgs.chooseMoodMsg(), {
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
    ctx.answerCbQuery('Mood saved successfully!');
    ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].name)
      .then(() => {
        ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].emoji)
          .then(async () => {
            // wait for a minute
            await new Promise(resolve => setTimeout(resolve, 2000));
            // send a message to the user to add a note
            ctx.telegram.sendMessage(ctx.user.id, msgs.addNoteMsg(), {reply_markup: {keyboard: common.makeKeyboardMenu(ctx)}})
          })
      });
  } catch (error) {
    console.error('Error saving mood:', error);
  }
}

module.exports = {
  setMoodCommand,
  saveMood
}