// Renders a "Year in Moods" video for Instagram Stories: 1080x1920, 30fps, H.264, no audio (people add
// music in Instagram). Every frame is an SVG drawn by sharp, with the animated mood stickers
// (src/public/moods/*.webp, one page per frame) composited on top, piped as JPEG into ffmpeg.
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { MOOD_HUES } = require('../widget/render');

const W = 1080, H = 1920, FPS = 30;
// everything sits between y≈260 and y≈1600: Instagram covers the top and bottom of a story with its own UI
const MOODS_DIR = path.join(__dirname, '..', 'public', 'moods');
const LOGO = path.join(__dirname, '..', 'public', 'logo.jpeg');
const FONT = 'DejaVu Sans, -apple-system, Helvetica, Arial, sans-serif';
const BG = '#0f1115';

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const prog = (t, start, dur) => clamp((t - start) / dur);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const backOut = (x) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { const a = [...String(s ?? '')]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const hueOf = (code) => MOOD_HUES[code] ?? 210;
const text = (x, y, size, fill, s, { weight = 700, anchor = 'middle', opacity = 1, spacing = 0 } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${Math.round(size)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity.toFixed(3)}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(s)}</text>`;

// sticker frames: the webp's own animation, one page per video frame, cached per size. While a sticker
// is still growing in (still: true) it shows its first frame: every in-between size would otherwise
// decode a fresh page each frame, which is most of the render time.
const pageCount = new Map();
const frameCache = new Map();
async function stickerFrame(code, size, frame, still = false) {
  const file = path.join(MOODS_DIR, `${MOOD_HUES[code] !== undefined ? code : 'neutral'}.webp`);
  if (!pageCount.has(code)) pageCount.set(code, (await sharp(file).metadata()).pages || 1);
  const page = still ? 0 : frame % pageCount.get(code);
  const s = Math.max(8, Math.round(size / 4) * 4);   // sizes in 4px steps keep the cache small while scaling
  const key = `${code}:${s}:${page}`;
  if (!frameCache.has(key)) {
    if (frameCache.size > 6000) frameCache.clear();
    frameCache.set(key, sharp(file, { page }).resize(s, s).png().toBuffer());
  }
  return { input: await frameCache.get(key), size: s };
}
let logoCache = null;
function roundedLogo(size) {
  logoCache ||= sharp(LOGO).resize(size, size).composite([{ input: Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.24}" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
  return logoCache;
}

// ---------- scenes: each returns { svg, stickers: [{ code, size, cx, cy }], logo?, hue } for time t ----------
function sceneIntro(t, s) {
  const hue = s.top ? hueOf(s.top.code) : 210;
  const pop = backOut(prog(t, 0.05, 0.7));
  const a = easeOut(prog(t, 0.45, 0.6)), b = easeOut(prog(t, 0.7, 0.6)), c = easeOut(prog(t, 0.95, 0.6));
  return {
    hue,
    svg: text(W / 2, 330, 40, '#a3a9b4', 'MOODPAL', { weight: 800, spacing: 8, opacity: a })
      + text(W / 2, 1190 + (1 - a) * 30, 76, '#c9ced7', `${clip(s.name, 18)}'s`, { weight: 700, opacity: a })
      + text(W / 2, 1400 + (1 - b) * 40, 250, '#ffffff', String(s.year), { weight: 900, opacity: b, spacing: -6 })
      + text(W / 2, 1525 + (1 - c) * 30, 92, '#ffb454', 'in moods', { weight: 800, opacity: c }),
    stickers: s.top ? [{ code: s.top.code, size: 520 * pop, cx: W / 2, cy: 720, still: prog(t, 0.05, 0.7) < 1 }] : [],
  };
}

function sceneNumbers(t, s) {
  const rows = [[s.total, s.total === 1 ? 'mood logged' : 'moods logged', '#ffb454'], [s.days, s.days === 1 ? 'day you checked in' : 'days you checked in', '#5ac8fa'], [s.streak, s.streak === 1 ? 'day in a row, your best streak' : 'days in a row, your best streak', '#34c759']];
  let svg = text(W / 2, 330, 72, '#ffffff', 'Your year in numbers', { weight: 800, opacity: easeOut(prog(t, 0, 0.4)) });
  rows.forEach(([n, label, color], i) => {
    const p = easeOut(prog(t, 0.3 + i * 0.35, 0.8));
    const y = 640 + i * 360;
    svg += text(W / 2, y + (1 - p) * 40, 230, color, String(Math.round(n * p)), { weight: 900, opacity: p, spacing: -4 })
      + text(W / 2, y + 95, 52, '#c9ced7', label, { weight: 600, opacity: p });
  });
  return { hue: 210, svg, stickers: [] };
}

function sceneTop(t, s) {
  if (!s.top) return sceneNumbers(t, s);
  const pop = backOut(prog(t, 0.15, 0.7));
  const a = easeOut(prog(t, 0, 0.4)), b = easeOut(prog(t, 0.6, 0.5)), pct = easeOut(prog(t, 0.8, 0.9));
  return {
    hue: hueOf(s.top.code),
    svg: text(W / 2, 330, 60, '#c9ced7', 'Your mood of the year', { weight: 700, opacity: a })
      + text(W / 2, 1290 + (1 - b) * 40, 168, '#ffffff', s.top.name, { weight: 900, opacity: b, spacing: -3 })
      + text(W / 2, 1410, 64, '#ffb454', `${Math.round(s.top.pct * pct)}% of your moods`, { weight: 700, opacity: b })
      + text(W / 2, 1490, 46, '#a3a9b4', `${s.top.count} times this year`, { weight: 600, opacity: b }),
    stickers: [{ code: s.top.code, size: 600 * pop, cx: W / 2, cy: 740, still: prog(t, 0.15, 0.7) < 1 }],
  };
}

function sceneMix(t, s) {
  let svg = text(W / 2, 330, 80, '#ffffff', 'Your mood mix', { weight: 800, opacity: easeOut(prog(t, 0, 0.4)) });
  const max = Math.max(1, ...s.groups.map(g => g.pct));
  s.groups.forEach((g, i) => {
    const p = easeOut(prog(t, 0.35 + i * 0.22, 0.7));
    const y = 500 + i * 190;
    const width = 780 * (g.pct / max) * p;
    svg += text(150, y, 52, '#ffffff', g.label, { weight: 700, anchor: 'start', opacity: clamp(p * 2) })
      + text(930, y, 52, '#c9ced7', `${Math.round(g.pct * p)}%`, { weight: 700, anchor: 'end', opacity: clamp(p * 2) })
      + `<rect x="150" y="${y + 30}" width="780" height="44" rx="22" fill="#ffffff" opacity="0.08"/>`
      + (width > 1 ? `<rect x="150" y="${y + 30}" width="${Math.max(44, width).toFixed(1)}" height="44" rx="22" fill="hsl(${g.hue},80%,62%)"/>` : '');
  });
  return { hue: s.groups[0] ? s.groups[0].hue : 210, svg, stickers: [] };
}

function sceneMonths(t, s) {
  let svg = text(W / 2, 330, 72, '#ffffff', 'Month by month', { weight: 800, opacity: easeOut(prog(t, 0, 0.4)) });
  const stickers = [];
  s.months.forEach((m, i) => {
    const p = backOut(prog(t, 0.3 + i * 0.13, 0.5));
    const col = i % 3, row = Math.floor(i / 3);
    const cx = 220 + col * 320, cy = 540 + row * 300;
    const o = clamp(prog(t, 0.3 + i * 0.13, 0.25));
    svg += `<rect x="${cx - 130}" y="${cy - 130}" width="260" height="260" rx="50" fill="${m.code ? `hsl(${hueOf(m.code)},55%,50%)` : '#ffffff'}" opacity="${(m.code ? 0.18 : 0.05) * o}"/>`
      + text(cx, cy + 102, 42, m.code ? '#ffffff' : '#6b717c', m.short, { weight: 800, opacity: o });
    if (m.code) stickers.push({ code: m.code, size: 150 * p, cx, cy: cy - 22, still: prog(t, 0.3 + i * 0.13, 0.5) < 1 });
    else svg += text(cx, cy, 70, '#4a505c', '·', { weight: 900, opacity: o });
  });
  return { hue: 250, svg, stickers };
}

function sceneHighs(t, s) {
  let svg = text(W / 2, 330, 80, '#ffffff', 'Highs and lows', { weight: 800, opacity: easeOut(prog(t, 0, 0.4)) });
  const stickers = [];
  const cards = [s.best && ['Your best month', s.best, `${s.best.pct}% good moods`, '#34c759'], s.toughest && ['Your toughest month', s.toughest, `${s.toughest.pct}% hard moods`, '#5ac8fa']].filter(Boolean);
  cards.forEach(([label, m, sub, color], i) => {
    const p = easeOut(prog(t, 0.3 + i * 0.45, 0.6));
    const y = 470 + i * 540, x = 90 + (1 - p) * (i ? 300 : -300);
    svg += `<g opacity="${p.toFixed(3)}"><rect x="${x}" y="${y}" width="900" height="490" rx="64" fill="#1b1e25"/>`
      + text(x + 70, y + 110, 46, color, label, { weight: 800, anchor: 'start' })
      + text(x + 70, y + 250, 120, '#ffffff', m.label, { weight: 900, anchor: 'start', spacing: -3 })
      + text(x + 70, y + 340, 50, '#c9ced7', sub, { weight: 600, anchor: 'start' }) + '</g>';
    if (m.code) stickers.push({ code: m.code, size: 200 * p, cx: x + 770, cy: y + 360, still: p < 1 });
  });
  if (s.toughest) svg += text(W / 2, 1575, 40, '#a3a9b4', 'Every year has both. You kept showing up.', { weight: 600, opacity: easeOut(prog(t, 1.4, 0.6)) });
  return { hue: 150, svg, stickers };
}

function sceneOutro(t, s, bot) {
  const pop = backOut(prog(t, 0.05, 0.6));
  const a = easeOut(prog(t, 0.4, 0.5)), b = easeOut(prog(t, 0.75, 0.5));
  return {
    hue: 38,
    svg: text(W / 2, 1120 + (1 - a) * 30, 150, '#ffffff', 'MoodPal', { weight: 900, opacity: a, spacing: -4 })
      + text(W / 2, 1240, 60, '#ffb454', `Get your ${s.year} in moods`, { weight: 800, opacity: b })
      + text(W / 2, 1335, 54, '#c9ced7', bot ? `t.me/${bot}` : 'on Telegram', { weight: 700, opacity: b }),
    stickers: [],
    logo: { size: 300 * pop, cx: W / 2, cy: 780 },
  };
}

// the timeline: [scene, seconds]; highs and lows only when there's a month to show
function timeline(s) {
  const t = [[sceneIntro, 2.8], [sceneNumbers, 3.2], [sceneTop, 3.0], [sceneMix, 3.4], [sceneMonths, 3.8]];
  if (s.best || s.toughest) t.push([sceneHighs, 3.2]);
  t.push([sceneOutro, 3.0]);
  return t;
}
const FADE = 0.25;

async function renderFrame(s, scene, t, dur, frame, bot) {
  const d = scene(t, s, bot);
  // each scene fades in from the background and out to it
  const fade = Math.min(clamp(t / FADE), clamp((dur - t) / FADE));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="g" cx="540" cy="760" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="hsl(${d.hue},80%,55%)" stop-opacity="0.34"/><stop offset="1" stop-color="hsl(${d.hue},80%,55%)" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="${BG}"/><rect width="100%" height="100%" fill="url(#g)"/>${d.svg}</svg>`;
  const layers = [];
  for (const st of d.stickers) {
    if (st.size < 8) continue;
    const { input, size } = await stickerFrame(st.code, st.size, frame, st.still);
    layers.push({ input, left: Math.round(st.cx - size / 2), top: Math.round(st.cy - size / 2) });
  }
  if (d.logo && d.logo.size >= 8) {
    const size = Math.round(d.logo.size / 4) * 4;
    layers.push({ input: await sharp(await roundedLogo(300)).resize(size, size).toBuffer(), left: Math.round(d.logo.cx - size / 2), top: Math.round(d.logo.cy - size / 2) });
  }
  if (fade < 1) layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="${BG}" opacity="${(1 - fade).toFixed(3)}"/></svg>`) });
  return sharp(Buffer.from(svg)).composite(layers).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Renders the video to `outPath`.
 * @param {object} stats from yearStats()
 * @param {{ bot?: string, onProgress?: (fraction:number)=>void }} opts
 * @returns {Promise<{ path: string, duration: number, width: number, height: number }>}
 */
async function renderYearVideo(stats, outPath, { bot = '', onProgress } = {}) {
  const scenes = timeline(stats);
  const total = scenes.reduce((a, [, d]) => a + Math.round(d * FPS), 0);
  const proc = spawn(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '20', '-r', String(FPS), '-movflags', '+faststart', outPath]);
  let stderr = '';
  proc.stderr.on('data', (c) => { stderr += c; });
  const done = new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))));
  });
  const write = (buf) => new Promise((resolve, reject) => { proc.stdin.write(buf, (err) => (err ? reject(err) : resolve())); });

  let frame = 0, lastReport = -1;
  try {
    for (const [scene, dur] of scenes) {
      const frames = Math.round(dur * FPS);
      for (let i = 0; i < frames; i++, frame++) {
        await write(await renderFrame(stats, scene, i / FPS, dur, frame, bot));
        const pct = Math.floor((frame / total) * 20);
        if (onProgress && pct !== lastReport) { lastReport = pct; onProgress(frame / total); }
      }
    }
  } finally {
    proc.stdin.end();
  }
  await done;
  return { path: outPath, duration: Math.round(total / FPS), width: W, height: H };
}

module.exports = { renderYearVideo, W, H, FPS, _renderFrame: renderFrame, _timeline: timeline };
