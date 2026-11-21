require('dotenv').config();
const fs = require('fs');
const { Telegraf } = require('telegraf');
const health = require('./health');
const { harden } = require('./utils/telegram_resilience');

// ---- stay up: one failed call must never take the whole bot down ----
// A promise that rejects with nobody listening (e.g. a send that timed out) used to stop Node.
// Now it is logged and counted (src/health.js), and the bot keeps serving everyone else.
process.on('unhandledRejection', (reason) => {
  health.noteUnhandled(reason);
  console.error('Unhandled rejection (bot keeps running):', health.describe(reason) || health.redact(reason));
});
// A thrown error nobody caught: log it and keep going, unless it keeps happening, in which case
// the process is in a bad state; exit so Docker starts a clean one (restart: unless-stopped).
process.on('uncaughtException', (err) => {
  health.noteUnhandled(err);
  console.error('Uncaught exception (bot keeps running):', health.describe(err), health.redact(err?.stack || ''));
  if (health.state.unhandled.length >= 20) {
    console.error('Too many unexpected errors in 10 minutes, restarting the process');
    process.exit(1);
  }
});
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
const menuMiddleware = require('./middlewares/menu.middleware');
const blockMiddleware = require('./middlewares/block.middleware');

// Not implemented
const notImplemented = require('./utils/not_implemented');

// Import commands
const startCommand = require('./commands/start');
const { setMoodCommand, saveMood, ge } = require('./commands/mood');
const helpCommand = require('./commands/help');
const setVisibilityCommand = require('./commands/set_visibility');
const { showReportCommand, sendWeeklyReport, getReportCallback, yearInMoods } = require('./commands/report');
const { createShareLinkCommand, shareCallback, followBackCallback } = require('./commands/share');
const { setOpenAIKeyCommand, removeOpenAIKeyCommand } = require('./commands/openai_key');
const personalityCommands = require('./commands/personality');
const talkCommands = require('./commands/talk');
const supportCommands = require('./commands/support');
const supportService = require('./support/service');
const { ensurePersonalityCatalog } = require('./personality/migrate');
const backupScheduler = require('./backup/scheduler');
const { backupNowCommand } = require('./commands/backup');
const { exportCommand } = require('./commands/export');
const { friendsCommand, friendsCallback } = require('./commands/friends');
const { remindersCommand, toggleCallback: remindersToggle, timezoneCommand, timezoneCallback, TZ_PREFIX, TZ_RESET } = require('./commands/reminders');
const reminderService = require('./reminders/service');
const broadcastService = require('./broadcast/service');
const { personality: personalityConstants } = require('./constants');
const languageCommands = require('./commands/language');
const i18n = require('./i18n');

// Import actions
const handleTextMessage = require('./actions/on_text');


// Connect to MongoDB, then make sure the personality catalog is seeded
connectDB()
  .then(() => ensurePersonalityCatalog())
  .then(() => require('./models/user').backfillLastActive())
  .then(() => backupScheduler.reschedule())
  .then(() => reminderService.start())
  .then(() => broadcastService.start())
  .then(() => supportService.start())
  .then(() => require('./yearly/service').start())
  .catch(err => console.error('Startup migration failed:', err));

// Start the server
listenServer();

// Create bot instance
const bot = new Telegraf(process.env.BOT_TOKEN);
// retry short network failures on every Bot API call, and report them to the health check
harden(bot.telegram);
health.enable(() => bot.telegram.getMe());

// Middlewares
// every update proves Telegram is reaching us
bot.use((ctx, next) => { health.markUpdate(); return next(); });
// Middleware to save user data
bot.use(saveUserMiddleware);
bot.use(blockMiddleware);
bot.use(menuMiddleware);
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
bot.command('talk', talkCommands.talkCommand);
bot.command('end_talk', talkCommands.endTalkCommand);
bot.command('backup', backupNowCommand);
bot.command('reminders', remindersCommand);
bot.command('export', exportCommand);
bot.command('friends', friendsCommand);
bot.command('timezone', timezoneCommand);
bot.command('language', languageCommands.languageCommand);

// hidden: not listed in the command menu, works for any year e.g. /mood_2026
bot.command(['mood_2025', 'mood_2026', 'mood_2027'], yearInMoods);

// menu buttons, in every language (a keyboard sent before a language change keeps working)
const menu = (key) => i18n.allMenuTexts(key);
bot.hears(menu('SET_MOOD'), setMoodCommand)
bot.hears(menu('REPORT'), showReportCommand)
bot.hears(menu('EXPORT'), exportCommand)
bot.hears(menu('SHARE'), createShareLinkCommand)
// ✨ <year> (Year in Moods), including an old ✨ 2025 button still in someone's keyboard
bot.hears(/^✨ \d{4}$/, yearInMoods)
bot.hears(menu('VISIBILITY_PRIVATE'), setVisibilityCommand.setMoodPrivate)
bot.hears(menu('VISIBILITY_PUBLIC'), setVisibilityCommand.setMoodPublic)
bot.hears(menu('PERSONALITY_TEST'), personalityCommands.personalityTestCommand)
bot.hears(menu('MY_PERSONALITY'), (ctx) => personalityCommands.myPersonalityCommand(ctx))
bot.hears(menu('TALK'), talkCommands.talkCommand)
bot.hears(menu('END_TALK'), talkCommands.endTalkCommand)
bot.hears(menu('BACKUP_NOW'), backupNowCommand)
bot.hears(menu('LANGUAGE'), languageCommands.languageCommand)



// Callbacks from inline buttons
bot.action(/mood_/, saveMood);
bot.action(languageCommands.CALLBACK_RE, languageCommands.languageCallback);
bot.action(/report_/, getReportCallback);
bot.action(/share_/, shareCallback);
bot.action(/^fb_(ask|give)_/, followBackCallback);
bot.action(/^fr_(uf|rm|both)_/, friendsCallback);
bot.action('talk_note', talkCommands.talkAboutNoteCallback);
// support network: invitations, "share how you're feeling?", hugs
bot.action(/^sc_(ok|no)_[a-f0-9]{24}$/, supportCommands.inviteAnswerCallback);
bot.action(/^ms_((t_)?[a-f0-9]{24}_\d+|done|(all|a|s)_[a-f0-9]{24})$/, supportCommands.shareCallback);
bot.action(/^hug_\d+$/, supportCommands.hugCallback);
bot.action([reminderService.CALLBACK_OFF, reminderService.CALLBACK_ON], remindersToggle);
bot.action([new RegExp(`^${TZ_PREFIX}`), TZ_RESET], timezoneCallback);
bot.action(new RegExp(`^${personalityConstants.CALLBACK.TEST_PREFIX}`), personalityCommands.testCallback);
bot.action(new RegExp(`^${personalityConstants.CALLBACK.ANSWER_PREFIX}`), personalityCommands.answerCallback);
bot.action(new RegExp(`^${personalityConstants.CALLBACK.PROFILE_PREFIX}`), personalityCommands.profileCallback);

// Handle if user sends a message add a note to the last mood
bot.on('message', handleTextMessage);

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, health.describe(err), health.redact(err?.stack || ''));
});


// ---- start the bot, and keep it started (retries until Telegram is reachable, see supervisor.js) ----
const supervisor = require('./supervisor').superviseBot(bot, {
  onStarted: () => languageCommands.registerCommands(bot.telegram).catch(err => console.error('setMyCommands failed:', health.describe(err))),
});

// stop cleanly on docker stop / Ctrl+C
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    supervisor.stop(signal);
    setTimeout(() => process.exit(0), 1500).unref();
  });
}

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
  ).catch(err => console.error('Channel mood post failed:', health.describe(err)));
});

// run the cron job every week monday 9:00 AM
cron.schedule(process.env.WEEKLY_CRON_JOB_TIME, () => {
  console.log('======================');
  console.log(`Running cron job at ${new Date().toLocaleString()}`);
  console.log('======================');
  Promise.resolve(sendWeeklyReport(bot)).catch(err => console.error('Weekly report failed:', health.describe(err)));
});

