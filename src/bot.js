require('dotenv').config();
const fs = require('fs');
const { Telegraf } = require('telegraf');
const connectDB = require('./db');
// Import the server 
const { listenServer } = require('./server');
// Import the cron library
const cron = require('node-cron');

// Import constants
const { MOOD_INLINE_KEYBOARD, msgs, common } = require('./constants');
// Import middlewares
const saveUserMiddleware = require('./middlewares/user.middleware');
const olafMiddleware = require('./middlewares/olaf.middleware');
const joinMiddleware = require('./middlewares/join.middleware');

// Not implemented
const notImplemented = require('./utils/not_implemented');

// Import commands
const startCommand = require('./commands/start');
const { setMoodCommand, saveMood, ge } = require('./commands/mood');
const helpCommand = require('./commands/help');
const setVisibilityCommand = require('./commands/set_visibility');
const { showReportCommand, sendWeeklyReport, getReportCallback, getYearlyMoodVideo } = require('./commands/report');
const { createShareLinkCommand, shareCallback } = require('./commands/share');

// Import actions
const handleTextMessage = require('./actions/on_text');


// Connect to MongoDB
connectDB();
// Start the server
listenServer();

// Create bot instance
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middlewares
// Middleware to save user data
bot.use(saveUserMiddleware);
bot.use(olafMiddleware);
bot.use(joinMiddleware);

// Set up commands
bot.command('start', startCommand);
bot.command('set_mood', setMoodCommand);
bot.command('help', helpCommand);
bot.command('history', notImplemented);
bot.command('set_private', setVisibilityCommand.setMoodPrivate);
bot.command('set_public', setVisibilityCommand.setMoodPublic);
bot.command('report', showReportCommand);
bot.command('share', createShareLinkCommand);

bot.command('mood_2025', getYearlyMoodVideo);

bot.hears(common.MENU_BUTTONS.SET_MOOD, setMoodCommand)
bot.hears(common.MENU_BUTTONS.REPORT, showReportCommand)
bot.hears(common.MENU_BUTTONS.SHARE, createShareLinkCommand)
bot.hears(common.MENU_BUTTONS.YEAR_REPORT, getYearlyMoodVideo)
bot.hears(common.MENU_BUTTONS.VISIBILITY_PRIVATE, setVisibilityCommand.setMoodPrivate)
bot.hears(common.MENU_BUTTONS.VISIBILITY_PUBLIC, setVisibilityCommand.setMoodPublic)



// Callbacks from inline buttons
bot.action(/mood_/, saveMood);
bot.action(/report_/, getReportCallback);
bot.action(/share_/, shareCallback);

// Handle if user sends a message add a note to the last mood
bot.on('message', handleTextMessage);

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

// create a temp folder if it doesn't exist
if (!fs.existsSync('temp')) {
  fs.mkdirSync('temp');
}


// run the cron job every day 9:00 AM and 10:00 PM
cron.schedule(process.env.CRON_JOB_TIME, () => {
  console.log('======================');
  console.log(`Running cron job at ${new Date().toLocaleString()}`);
  console.log('======================');
  bot.telegram.sendMessage(
    process.env.MAIN_CHANNEL_ID,
    msgs.chooseMoodMsg(),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: MOOD_INLINE_KEYBOARD,
      },
    }
  )
});

// run the cron job every week monday 9:00 AM
cron.schedule(process.env.WEEKLY_CRON_JOB_TIME, () => {
  console.log('======================');
  console.log(`Running cron job at ${new Date().toLocaleString()}`);
  console.log('======================');
  sendWeeklyReport(bot);
});
