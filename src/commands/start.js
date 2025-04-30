const { MOOD_INLINE_KEYBOARD } = require('../constants');
const msg = `
  <b>Welcome to the Mood Pal Bot!</b>
  <i>Please select your mood from the options below:</i>
`;
module.exports = async (ctx) => {
  try {
    // also parse text as html
    ctx.reply(
      msg,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: MOOD_INLINE_KEYBOARD,
        },
      }
    );
  } catch (error) {
    console.error('Error in start command:', error);
  }
};