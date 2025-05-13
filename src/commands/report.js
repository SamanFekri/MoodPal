const { msgs } = require('../constants');
const Mood = require('../models/mood');
const User = require('../models/user');
const { generateMoodRadarChart } = require('../utils/radar_diagram');
const crypto = require('crypto');
const fs = require('fs');


async function getSevenDaysReport(userId) {
  // get all the moods for this user in the last 7 days
  const moods = await Mood.find({ user: userId, timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }).sort({ timestamp: -1 }).limit(7);
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

async function sendReport(filePath, user, ctx) {
  await ctx.telegram.sendPhoto(user.id, {
    source: fs.createReadStream(filePath)
  }, {
    caption: msgs.sevenDaysReportMsg(user)
  });
}

async function showReportCommand(ctx) {
  const userId = ctx.user._id;
  const data = await getSevenDaysReport(userId);
  const path = await generateReport(data, userId);
  await sendReport(path, ctx.user, ctx);
  fs.unlinkSync(path); // delete the file from temp folder
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
  sendWeeklyReport
}
