const { MOOD_INLINE_KEYBOARD, msgs } = require('../constants');


module.exports = async (ctx) => {
  try {
    ctx.reply(msgs.welocmeMsg(ctx.user.first_name),{parse_mode: 'HTML',});
    ctx.reply(msgs.chooseMoodMsg(), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: MOOD_INLINE_KEYBOARD,
      },
    });
  } catch (error) {
    console.error('Error in start command:', error);
  }
};