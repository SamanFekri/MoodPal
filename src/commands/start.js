const { MOOD_EMOJIS } = require('../constants');
module.exports = async (ctx) => {
  try {
    ctx.reply(`Welcome, ${ctx.user.first_name}! Your Telegram bot is running.`);
    // read the mood constants from the constants file and send the emoji of them
    console.log('=====================');
    console.log('MOOD_EMOJIS:');
    console.log(MOOD_EMOJIS);
    console.log('=====================');
  } catch (error) {
    console.error('Error in start command:', error);
  }
};