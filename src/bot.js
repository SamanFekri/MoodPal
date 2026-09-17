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
const { setOpenAIKeyCommand, removeOpenAIKeyCommand } = require('./commands/openai_key');
const personalityCommands = require('./commands/personality');
const { ensurePersonalityCatalog } = require('./personality/migrate');
const { personality: personalityConstants } = require('./constants');

// Import actions
const handleTextMessage = require('./actions/on_text');


// Connect to MongoDB, then make sure the personality catalog is seeded
connectDB()
  .then(() => ensurePersonalityCatalog())
  .then(() => require('./models/user').backfillLastActive())
  .catch(err => console.error('Startup migration failed:', err));

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
bot.command('set_openai_key', setOpenAIKeyCommand);
bot.command('remove_openai_key', removeOpenAIKeyCommand);
bot.command('personality_test', personalityCommands.personalityTestCommand);
bot.command('my_personality', (ctx) => personalityCommands.myPersonalityCommand(ctx));

// hidden: not listed in the command menu, works for any year e.g. /mood_2026
bot.command(['mood_2025', 'mood_2026', 'mood_2027'], getYearlyMoodVideo);

bot.hears(common.MENU_BUTTONS.SET_MOOD, setMoodCommand)
bot.hears(common.MENU_BUTTONS.REPORT, showReportCommand)
bot.hears(common.MENU_BUTTONS.SHARE, createShareLinkCommand)
bot.hears(common.MENU_BUTTONS.LEGACY_YEAR_REPORT, getYearlyMoodVideo)
bot.hears(common.MENU_BUTTONS.VISIBILITY_PRIVATE, setVisibilityCommand.setMoodPrivate)
bot.hears(common.MENU_BUTTONS.VISIBILITY_PUBLIC, setVisibilityCommand.setMoodPublic)
bot.hears(common.MENU_BUTTONS.PERSONALITY_TEST, personalityCommands.personalityTestCommand)
bot.hears(common.MENU_BUTTONS.MY_PERSONALITY, (ctx) => personalityCommands.myPersonalityCommand(ctx))



// Callbacks from inline buttons
bot.action(/mood_/, saveMood);
bot.action(/report_/, getReportCallback);
bot.action(/share_/, shareCallback);
bot.action(new RegExp(`^${personalityConstants.CALLBACK.TEST_PREFIX}`), personalityCommands.testCallback);
bot.action(new RegExp(`^${personalityConstants.CALLBACK.ANSWER_PREFIX}`), personalityCommands.answerCallback);
bot.action(new RegExp(`^${personalityConstants.CALLBACK.PROFILE_PREFIX}`), personalityCommands.profileCallback);

// Handle if user sends a message add a note to the last mood
bot.on('message', handleTextMessage);

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// Commands shown in Telegram's "Menu" button (yearly video stays hidden on purpose)
const BOT_COMMANDS = [
  { command: 'start', description: 'Start the bot' },
  { command: 'set_mood', description: 'Set your current mood' },
  { command: 'report', description: 'Mood report for the last days' },
  { command: 'share', description: 'Share your mood with a friend' },
  { command: 'personality_test', description: 'Take a personality test' },
  { command: 'my_personality', description: 'See your personality profile' },
  { command: 'set_public', description: 'Make your mood public (embed codes)' },
  { command: 'set_private', description: 'Make your mood private' },
  { command: 'set_openai_key', description: 'Add your OpenAI key for AI insights' },
  { command: 'remove_openai_key', description: 'Remove your OpenAI key' },
  { command: 'help', description: 'List all commands' },
];

// Start the bot
bot.launch().then(() => {
  console.log('Bot started successfully!');
  bot.telegram.setMyCommands(BOT_COMMANDS).catch(err => console.error('setMyCommands failed:', err));
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

