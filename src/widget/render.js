// Draws the home-screen widget images (PNG) with sharp only: an SVG for the cards and text, with the
// first frame of each mood's animated sticker (src/public/moods/<code>.webp) composited on top.
// Three canvases match the iOS/Android widget shapes; people are laid out in a grid that fits them.
const path = require('path');
const sharp = require('sharp');

const MOODS_DIR = path.join(__dirname, '..', 'public', 'moods');
// same hues as the mini app's mood glows
const MOOD_HUES = {
  happy: 45, relaxed: 160, excited: 330, motivated: 25, neutral: 220, confused: 270,
  bored: 200, uncertain: 240, disappointed: 210, anxious: 280, angry: 0, sad: 215,
  overwhelmed: 300, overthinking: 260, tired: 230, nervous: 40, sick: 120, naughty: 340,
};
// widget shapes (small 1:1, medium ~2.13:1, large ~1:1.05) and how many people fit each
const SIZES = {
  small: { w: 600, h: 600, max: 4 },
  medium: { w: 1200, h: 564, max: 6 },
  large: { w: 1200, h: 1256, max: 9 },
};
// [cols, rows] for n people
const GRIDS = {
  small: [null, [1, 1], [1, 2], [2, 2], [2, 2]],
  medium: [null, [1, 1], [2, 1], [3, 1], [4, 1], [3, 2], [3, 2]],
  large: [null, [1, 1], [1, 2], [2, 2], [2, 2], [2, 3], [2, 3], [3, 3], [3, 3], [3, 3]],
};
const FONT = `DejaVu Sans, -apple-system, Helvetica, Arial, sans-serif`;
const BG = '#14171d';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { const a = [...String(s ?? '')]; return a.length > n ? a.slice(0, Math.max(1, n - 1)).join('') + '…' : a.join(''); };
// DejaVu Sans averages ~0.6em per character: shrink a line (to 55% at most) before cutting it short
const charW = (bold) => (bold ? 0.64 : 0.58);
const fitFont = (s, width, base, bold) => Math.max(base * 0.55, Math.min(base, (width * 0.97) / ([...String(s ?? '')].length * charW(bold))));
const fit = (s, width, font, bold = false) => clip(s, Math.floor(width / (font * charW(bold))));

function ago(date, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(date).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(date).toISOString().slice(0, 10);
}

// first frame of a mood sticker at a given size, cached
const stickerCache = new Map();
function sticker(code, size) {
  const key = `${code}:${size}`;
  if (!stickerCache.has(key)) {
    const file = path.join(MOODS_DIR, `${/^[a-z]+$/.test(code) && MOOD_HUES[code] !== undefined ? code : 'neutral'}.webp`);
    stickerCache.set(key, sharp(file, { animated: false }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
  }
  return stickerCache.get(key);
}

const text = (x, y, size, fill, s, { bold = false, anchor = 'start' } = {}) =>
  `<text x="${Math.round(x)}" y="${Math.round(y)}" font-family="${FONT}" font-size="${Math.round(size)}"${bold ? ' font-weight="700"' : ''} fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

/**
 * One person in a cell: sticker plus up to three lines. Wide cells put the text beside the sticker,
 * tall ones under it. A lone person leads with the mood; in a group the name comes first.
 */
async function drawCell(p, i, { x, y, w, h, solo }) {
  const hue = p.mood ? (MOOD_HUES[p.mood.code] ?? 210) : 220;
  const horizontal = w / h >= 1.5;
  const lines = !p.mood
    ? [[p.name, true], [p.empty || 'No mood yet', false]]
    : solo
      ? [[p.mood.name, true], [`${p.name} · ${ago(p.timestamp)}`, false]]
      : [[p.name, true], [p.mood.name, false], [ago(p.timestamp), false]];
  let svg = '', layer = null;
  const defs = `<radialGradient id="g${i}" cx="${x + (horizontal ? h * 0.5 : w / 2)}" cy="${y + (horizontal ? h / 2 : h * 0.38)}" r="${Math.max(w, h) * (solo ? 0.55 : 0.45)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="hsl(${hue},85%,58%)" stop-opacity="${p.mood ? 0.32 : 0.08}"/><stop offset="1" stop-color="hsl(${hue},85%,58%)" stop-opacity="0"/></radialGradient>`;
  if (!solo) svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(Math.min(w, h) * 0.12)}" fill="#1b1e25"/>`;
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${solo ? 0 : Math.round(Math.min(w, h) * 0.12)}" fill="url(#g${i})"/>`;

  let s, sx, sy;
  const sizes = solo ? [0.105, 0.055] : [0.15, 0.115, 0.09];
  if (horizontal) {
    s = Math.round(Math.min(h * 0.7, w * 0.42));
    sx = x + Math.round((h - s) / 2); sy = y + Math.round((h - s) / 2);
    const tx = sx + s + Math.round(h * 0.1), tw = x + w - tx - Math.round(h * 0.08);
    const fonts = lines.map(([str, bold], k) => fitFont(str, tw, Math.max(18, h * (solo ? [0.2, 0.1][k] : [0.18, 0.14, 0.11][k])), bold));
    const total = fonts.reduce((a, f) => a + f * 1.3, 0);
    let ty = y + (h - total) / 2;
    lines.forEach(([str, bold], k) => { ty += fonts[k] * 1.08; svg += text(tx, ty, fonts[k], k === 0 ? '#f2f3f5' : k === 1 ? '#c4c9d2' : '#8b919c', fit(str, tw, fonts[k], bold), { bold }); ty += fonts[k] * 0.22; });
  } else {
    s = Math.round(Math.min(w * (solo ? 0.62 : 0.66), h * (solo ? 0.5 : 0.42)));
    const fonts = lines.map(([str, bold], k) => fitFont(str, w * 0.9, Math.max(18, (solo ? Math.min(w, h * 1.2) : Math.min(w, h)) * sizes[k]), bold));
    // sticker and lines as one block, centered in the cell
    const block = s + h * 0.04 + fonts.reduce((sum, f) => sum + f * 1.15, 0);
    sx = x + Math.round((w - s) / 2); sy = y + Math.round(solo ? h * 0.1 : Math.max(h * 0.06, (h - block) / 2 - h * 0.02));
    let ty = sy + s + h * 0.04;
    lines.forEach(([str, bold], k) => { ty += fonts[k] * 1.15; svg += text(x + w / 2, ty, fonts[k], k === 0 ? '#f2f3f5' : k === 1 ? '#c4c9d2' : '#8b919c', fit(str, w * 0.9, fonts[k], bold), { bold, anchor: 'middle' }); });
  }
  if (p.mood) layer = { input: await sticker(p.mood.code, s), left: sx, top: sy };
  else svg += `<circle cx="${sx + s / 2}" cy="${sy + s / 2}" r="${s * 0.4}" fill="none" stroke="#3a4050" stroke-width="${Math.max(3, s * 0.025)}" stroke-dasharray="${s * 0.06} ${s * 0.05}"/>`;
  return { defs, svg, layer };
}

/**
 * A widget picture.
 * @param {{size?: 'small'|'medium'|'large', people: Array<{name:string, mood?:{code,name}, timestamp?:Date, empty?:string}>}} opts
 */
async function renderWidget({ size = 'small', people }) {
  const S = SIZES[size] || SIZES.small;
  const list = people.slice(0, S.max);
  if (!list.length) list.push({ name: 'MoodPal', empty: 'Pick who to show' });
  const n = list.length;
  const [cols, rows] = GRIDS[size in GRIDS ? size : 'small'][n];
  const solo = n === 1;
  const pad = solo ? 0 : Math.round(Math.min(S.w, S.h) * 0.035), gap = Math.round(Math.min(S.w, S.h) * 0.025);
  const cw = (S.w - pad * 2 - gap * (cols - 1)) / cols, ch = (S.h - pad * 2 - gap * (rows - 1)) / rows;
  let defs = '', body = '';
  const layers = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const cell = await drawCell(list[i], i, { x: Math.round(pad + c * (cw + gap)), y: Math.round(pad + r * (ch + gap)), w: Math.round(cw), h: Math.round(ch), solo });
    defs += cell.defs; body += cell.svg;
    if (cell.layer) layers.push(cell.layer);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}"><defs>${defs}</defs><rect width="100%" height="100%" fill="${BG}"/>${body}</svg>`;
  return sharp(Buffer.from(svg)).composite(layers).png().toBuffer();
}

module.exports = { renderWidget, ago, SIZES, MOOD_HUES };
