require('dotenv').config();
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const connectDB = require('./db');
const User = require('./models/user');
const { msgs, MOOD_INLINE_KEYBOARD } = require('./constants');

// Import middlewares
const saveUserMiddleware = require('./middlewares/user.middleware');

// Not implemented
const notImplemented = require('./utils/not_implemented');

// Import commands
const startCommand = require('./commands/start');
const setMoodCommand = require('./commands/set_mood');
const helpCommand = require('./commands/help');

// Import Callbacks
const saveMood = require('./callbacks/saveMood');


// Connect to MongoDB
connectDB();

// Create bot instance
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middlewares
// Middleware to save user data
bot.use(saveUserMiddleware);

// Set up commands
bot.command('start', startCommand);
bot.command('set_mood', setMoodCommand);
bot.command('help', helpCommand);
bot.command('history', notImplemented);

// Callbacks from inline buttons
bot.action(/mood_/, saveMood);

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// Start the bot
bot.launch().then(() => {
  console.log('Bot started successfully!');
  
}).catch(err => {
  console.error('Failed to start bot:', err);
});

bot.telegram.sendMessage(process.env.MAIN_CHANNEL_ID, msgs.chooseMoodMsg(), {
  parse_mode: 'HTML',
  reply_markup: {
    inline_keyboard: MOOD_INLINE_KEYBOARD
  },
}).catch(err => {
  console.error('Failed to send message to channel:', err);
});