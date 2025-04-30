const User = require('../models/user');

module.exports = async (ctx) => {
  try {
    // Save user to database
    await User.findOneAndUpdate(
      { id: ctx.from.id },
      {
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        is_bot: ctx.from.is_bot,
        language_code: ctx.from.language_code,
        is_premium: ctx.from.is_premium,
      },
      { upsert: true, new: true }
    );
    
    // Send welcome message
    ctx.reply(`Welcome, ${firstName}! Your Telegram bot is running.`);
  } catch (error) {
    console.error('Error in start command:', error);
    ctx.reply('Sorry, something went wrong with the start command');
  }
};