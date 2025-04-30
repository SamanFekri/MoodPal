require('dotenv').config();
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const connectDB = require('./db');
const User = require('./models/user');

// Import middlewares
const saveUserMiddleware = require('./middlewares/user.middleware');

// Import commands
const startCommand = require('./commands/start');
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