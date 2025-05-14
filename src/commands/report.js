const { msgs, report } = require('../constants');
const Mood = require('../models/mood');
const User = require('../models/user');
const { generateMoodRadarChart } = require('../utils/radar_diagram');
const crypto = require('crypto');
const fs = require('fs');


async function getReport(userId, days) {
  // get all the moods for this user in the last 7 days
  const moods = await Mood.find({ user: userId, timestamp: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }).sort({ timestamp: -1 }).limit(days);
  // aggregate the moods by the mood.code
  const aggregatedMoods = moods.reduce((acc, mood) => {
    acc[mood.mood.code] = (acc[mood.mood.code] || 0) + 1;
    return acc;
  }, {});
  return aggregatedMoods;
}

async function generateReport(data, userId) {
  // make a hash from userId and now time anf get only 8 characters of it
  const hash = crypto.createHash('sha256').update(`${userId}-${Date.now()}`).digest('hex').slice(0, 8);
  const outputPath = `./temp/${hash}.png`;
  await generateMoodRadarChart(data, outputPath);
  return outputPath
}

async function sendReport(filePath, user, ctx, days) {
  await ctx.telegram.sendPhoto(user.id, {
    source: fs.createReadStream(filePath)
  }, {
    caption: msgs.showReportMsg(user, days)
  });
}

async function showReportCommand(ctx) {
  ctx.reply(msgs.reportMsg(ctx.user), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: report.REPORT_DAYS_INLINE_KEYBOARD
    }
  });
}

async function getReportCallback(ctx) {
  try {
    const days = parseInt(ctx.callbackQuery.data.split('_')[1], 10);
    const userId = ctx.user._id;
    const data = await getReport(userId, days);
    const path = await generateReport(data, userId);
    await sendReport(path, ctx.user, ctx, days);
    fs.unlinkSync(path); // delete the file from temp folder
    ctx.answerCbQuery('📊 Report sent successfully!');
  } catch (error) {
    console.error('Error in getReportCallback:', error);
    ctx.answerCbQuery('Error in getReportCallback:', error);
  }
}

async function sendWeeklyReport(ctx) {
  // get users have mood in the last 7 days
  const distinctUsers = await Mood.find({ timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }).distinct('user')
  // get all users from the distinct users
  const users = await User.find({ _id: { $in: distinctUsers } });
  // send report to each user
  for (const user of users) {
    let userId = user._id;
    const data = await getSevenDaysReport(userId);
    const path = await generateReport(data, userId);
    await sendReport(path, user, ctx);
    fs.unlinkSync(path); // delete the file from temp folder
    // wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}




module.exports = {
  showReportCommand,
  getReportCallback,
  sendWeeklyReport
}
