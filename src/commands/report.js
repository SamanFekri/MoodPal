const { msgs, report } = require('../constants');
const Mood = require('../models/mood');
const User = require('../models/user');
const radar = require('../utils/radar_diagram');
const {
  generateMoodRadarChart,
  renderAggregatedRadar,
  _aggregateMoodsFrequency: aggregateMoodsFrequency
} = radar;

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

function ensureDirSync(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function formatDateRangeLabel(start, end) {
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function startOfISOWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function getReport(userId, days) {
  const moods = await Mood.find({
    user: userId,
    timestamp: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
  }).sort({ timestamp: -1 }).limit(days);

  return moods.reduce((acc, mood) => {
    acc[mood.mood.code] = (acc[mood.mood.code] || 0) + 1;
    return acc;
  }, {});
}

async function generateReport(data, userId, options = {}) {
  const hash = crypto.createHash('sha256').update(`${userId}-${Date.now()}`).digest('hex').slice(0, 8);
  const outputPath = `./temp/${hash}.png`;
  await generateMoodRadarChart(data, outputPath, options);
  return outputPath;
}

async function sendReport(filePath, user, ctx, days) {
  await ctx.telegram.sendPhoto(user.id, { source: fs.createReadStream(filePath) }, {
    caption: msgs.showReportMsg(user, days)
  });
}

async function showReportCommand(ctx) {
  ctx.reply(msgs.reportMsg(ctx.user), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: report.REPORT_DAYS_INLINE_KEYBOARD }
  });
}

async function getReportCallback(ctx) {
  try {
    const days = parseInt(ctx.callbackQuery.data.split('_')[1], 10);
    const userId = ctx.user._id;
    const data = await getReport(userId, days);
    const p = await generateReport(data, userId);
    await sendReport(p, ctx.user, ctx, days);
    fs.unlinkSync(p);
    ctx.answerCbQuery('📊 Report sent successfully!');
  } catch (error) {
    console.error('Error in getReportCallback:', error);
    ctx.answerCbQuery('❌ Failed to generate report. Please try again.');
  }
}

async function sendWeeklyReport(ctx) {
  const distinctUsers = await Mood.find({
    timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  }).distinct('user');

  const users = await User.find({ _id: { $in: distinctUsers } });
  for (const user of users) {
    try {
      const data = await getReport(user._id, 7);
      const p = await generateReport(data, user._id);
      await sendReport(p, user, ctx, 7);
      fs.unlinkSync(p);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error in sendWeeklyReport:', error);
    }
  }
}

function getWeeklyRangesForYearBounded(year) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const now = new Date();
  const endBound = now.getUTCFullYear() === year ? now : dec31;

  let start = startOfISOWeek(jan1);
  const ranges = [];
  while (start <= endBound) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    ranges.push({ start: new Date(start), end });
    start = end;
  }
  return ranges;
}

async function getReportForRange(userId, start, end) {
  const moods = await Mood.find({
    user: userId,
    timestamp: { $gte: start, $lt: end }
  }).sort({ timestamp: -1 });

  return moods.reduce((acc, mood) => {
    acc[mood.mood.code] = (acc[mood.mood.code] || 0) + 1;
    return acc;
  }, {});
}

/* weekly images with fixed scale (aggregated max) and bottom-left date (no sharp) */
async function generateWeeklyImagesForYear(userId, year, options = {}) {
  const uid = String(userId);
  const outputDir = options.outputDir || path.join('./temp', 'yearly', String(year), uid);
  ensureDirSync(outputDir);

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const allWeeks = getWeeklyRangesForYearBounded(year);

  const weeklyData = [];
  let firstDataIndex = -1;

  for (let i = 0; i < allWeeks.length; i++) {
    const { start, end } = allWeeks[i];
    const data = await getReportForRange(userId, start, end);
    if (firstDataIndex === -1 && Object.keys(data).length > 0) firstDataIndex = i;
    weeklyData.push({ start, end, data });
  }

  if (firstDataIndex === -1) return { imagePaths: [], niceMax: 1, weeks: [] };
  const trimmed = weeklyData.slice(firstDataIndex);

  let baseMax = 0;
  const weeksAgg = [];
  for (const w of trimmed) {
    const agg = aggregateMoodsFrequency(w.data || {});
    weeksAgg.push({ ...w, agg });
    const vals = Object.values(agg);
    if (vals.length) baseMax = Math.max(baseMax, Math.max(...vals));
  }
  const fixedMax = Math.max(1, baseMax);

  const imagePaths = [];
  for (let i = 0; i < weeksAgg.length; i++) {
    const { start, end, agg } = weeksAgg[i];
    const label = formatDateRangeLabel(start, new Date(end.getTime() - 1));
    const baseName = `week-${String(i + 1).padStart(2, '0')}-${uid}.png`;
    const outPath = path.join(outputDir, baseName);

    await renderAggregatedRadar(agg, outPath, {
      maxValue: fixedMax,
      width: options.chart?.width,
      height: options.chart?.height,
      cornerText: label,               // bottom-left date
      cornerFontSize: (options.label?.fontSize || 14),
      cornerPad: 10,
      debugNumbers: false
    });

    imagePaths.push(outPath);

    // sleep for a bit to avoid blocking to avoid send too many sync ops max 30 qps on update
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (onProgress) onProgress({
      phase: 'images',
      current: i + 1,
      total: weeksAgg.length,
      percent: Math.round(((i + 1) / weeksAgg.length) * 100)
    });
  }

  return {
    imagePaths,
    niceMax: fixedMax,
    weeks: weeksAgg.map(w => ({ start: w.start, end: w.end })),
    weeksAgg
  };
}

/* morph tween frames — keep previous week date on tween frames; bottom-left position */
function lerp(a, b, t) { return a + (b - a) * t; }

async function generateMorphFrames(weeksAgg, fixedMax, baseDir, {
  steps = 12,
  holdStartFrames = 12,
  holdEndFrames = 12,
  fps = 30,
  chart = {},
  corner = {}
} = {}) {
  ensureDirSync(baseDir);
  const framesDir = path.join(baseDir, 'frames');
  ensureDirSync(framesDir);

  const categories = Object.keys(aggregateMoodsFrequency({}));
  let frameIndex = 0;

  async function saveFrame(aggValues, cornerText = '') {
    const name = `frame-${String(++frameIndex).padStart(5, '0')}.png`;
    const out = path.join(framesDir, name);
    await renderAggregatedRadar(aggValues, out, {
      maxValue: fixedMax,
      width: chart.width,
      height: chart.height,
      cornerText,                              // always draw bottom-left
      cornerFontSize: corner.fontSize || 14,
      cornerPad: corner.pad || 10,
      debugNumbers: !!corner.debugNumbers
    });
  }

  for (let i = 0; i < weeksAgg.length; i++) {
    const { start, end, agg } = weeksAgg[i];
    const prevWeekLabel = formatDateRangeLabel(start, new Date(end.getTime() - 1));

    // Hold current week with its own date
    for (let h = 0; h < holdStartFrames; h++) await saveFrame(agg, prevWeekLabel);

    // Interpolate to next week — KEEP previous week's date during morph
    if (i < weeksAgg.length - 1) {
      const nextAgg = weeksAgg[i + 1].agg;
      const A = categories.map(k => agg[k] || 0);
      const B = categories.map(k => nextAgg[k] || 0);

      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const interp = {};
        categories.forEach((k, idx) => { interp[k] = lerp(A[idx], B[idx], t); });
        await saveFrame(interp, prevWeekLabel);   // <-- keep previous week date
      }
    }
  }

  // Final hold shows last week's own date
  const last = weeksAgg[weeksAgg.length - 1];
  const lastLabel = formatDateRangeLabel(last.start, new Date(last.end.getTime() - 1));
  for (let h = 0; h < holdEndFrames; h++) await saveFrame(last.agg, lastLabel);

  return { framesDir: path.join(baseDir, 'frames'), fps };
}

/* video from frames */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    proc.on('error', reject);
  });
}

async function buildVideoFromFrames(framesDir, outPath, { fps = 30, resolution } = {}) {
  const inputPattern = path.join(framesDir, 'frame-%05d.png');
  const args = [
    '-y', '-hide_banner',
    '-framerate', String(fps),
    '-i', inputPattern,
    ...(resolution ? ['-vf', `scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:(ow-iw)/2:(oh-ih)/2`] : []),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', 'faststart',
    outPath
  ];
  await runFfmpeg(args);
  return outPath;
}

async function generateYearlyWeeklyReportVideo(
  userId,
  year,
  { outputDir, videoName, chart = {}, label = {}, slideshow = { fps: 30, steps: 12, holdStartFrames: 12, holdEndFrames: 12, resolution: null }, onProgress } = {}
) {
  const uid = String(userId);
  const baseDir = outputDir || path.join('./temp', 'yearly', String(year), uid);
  ensureDirSync(baseDir);

  const { weeksAgg, niceMax: fixedMax } = await generateWeeklyImagesForYear(
    userId,
    year,
    { outputDir: baseDir, chart, label, onProgress }
  );
  if (!weeksAgg || weeksAgg.length === 0) return { images: [], videoPath: null, maxScale: 1 };

  if (onProgress) onProgress({ phase: 'video' });
  const { framesDir, fps } = await generateMorphFrames(
    weeksAgg,
    fixedMax,
    baseDir,
    {
      steps: slideshow.steps ?? 12,
      holdStartFrames: slideshow.holdStartFrames ?? 12,
      holdEndFrames: slideshow.holdEndFrames ?? 12,
      fps: slideshow.fps ?? 30,
      chart,
      corner: { fontSize: label.fontSize || 14, pad: 10, debugNumbers: false }
    }
  );

  const videoPath = path.join(baseDir, videoName || `mood-${year}-${uid}.mp4`);
  await buildVideoFromFrames(framesDir, videoPath, { fps, resolution: slideshow.resolution });

  if (onProgress) onProgress({ phase: 'done' });
  return { images: [], videoPath, maxScale: fixedMax };
}

async function getYearlyMoodVideo(ctx) {
  const year = 2025;
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
}


module.exports = {
  showReportCommand,
  getReportCallback,
  sendWeeklyReport,
  generateWeeklyImagesForYear,
  generateYearlyWeeklyReportVideo,
  getYearlyMoodVideo
};
