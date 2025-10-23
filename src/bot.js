require('dotenv').config();
const fs = require('fs');
const { Telegraf } = require('telegraf');
const connectDB = require('./db');
// Import the server 
const { listenServer } = require('./server');
// Import the cron library
const cron = require('node-cron');

// Import constants
const { MOOD_INLINE_KEYBOARD, msgs } = require('./constants');
// Import middlewares
const saveUserMiddleware = require('./middlewares/user.middleware');
const olafMiddleware = require('./middlewares/olaf.middleware');
const joinMiddleware = require('./middlewares/join.middleware');

// Not implemented
const notImplemented = require('./utils/not_implemented');

// Import commands
const startCommand = require('./commands/start');
const { setMoodCommand, saveMood } = require('./commands/mood');
const helpCommand = require('./commands/help');
const setVisibilityCommand = require('./commands/set_visibility');
const { showReportCommand, sendWeeklyReport, getReportCallback, generateYearlyWeeklyReportVideo } = require('./commands/report');
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

bot.command('mood_2025', async ctx => {
  const year = new Date().getFullYear();
  const msg = await ctx.reply(`⏳ Generating reports for video (year ${year})…\n\n🌃 ⬜️⬜️⬜️⬜️⬜️⬜️⬜️⬜️⬜️⬜ \n\n🏷️ Phase: images`);

  const bar = p => {
    const w = 10, filled = Math.round((p / 100) * w);
    return `${'🟩'.repeat(filled)}${'⬜️'.repeat(w - filled)} ${p}%`;
  };

  const edit = async (text) => {
    try { await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, text); } catch {}
  };

  const { videoPath, maxScale } = await generateYearlyWeeklyReportVideo(ctx.user._id, year, {
    outputDir: `./temp/${ctx.user._id}`,
    chart: { width: 1000, height: 1000 },
    slideshow: { stillDuration: 0.6, transitionDuration: 0.6, transition: 'dissolve', fps: 30},
    onProgress: (p) => {
      if (p.phase === 'images') {
        edit(`⏳ Generating reports for video (year ${year})…\n\n🌃 ${bar(p.percent)} \n\n🏷️ Phase: images`);
      } else if (p.phase === 'video') {
        edit(`⏳ Generating video (It could take some minutes)…\n🏷️ Phase: video`);
      } else if (p.phase === 'done') {
        edit(`✅ Rendering complete.\n🚀 Sending video…`);
      }
    }
  });

  if (videoPath) {
    await ctx.replyWithVideo({ source: fs.createReadStream(videoPath) }, {
      caption: `😁 Your mood through the year.`
    });
    edit(`✅ Video sent! 🚀🚀🚀`);
    try {
      const tempPath = `./temp/${ctx.user._id}`;
      if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('Failed to remove temp path:', err);
    }
  } else {
    await ctx.reply('No mood data found for this year.');
  }
});



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
