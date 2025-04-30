module.exports = async (ctx) => {
  try {
    ctx.reply(`Welcome, ${ctx.user.first_name}! Your Telegram bot is running.`);
  } catch (error) {
    console.error('Error in start command:', error);
  }
};