// Draws the home-screen widget images (PNG) with sharp only: an SVG for the card and text, with the
// first frame of each mood's animated sticker (src/public/moods/<code>.webp) composited on top.
const path = require('path');
const sharp = require('sharp');

const MOODS_DIR = path.join(__dirname, '..', 'public', 'moods');
// same hues as the mini app's mood glows
const MOOD_HUES = {
  happy: 45, relaxed: 160, excited: 330, motivated: 25, neutral: 220, confused: 270,
  bored: 200, uncertain: 240, disappointed: 210, anxious: 280, angry: 0, sad: 215,
  overwhelmed: 300, overthinking: 260, tired: 230, nervous: 40, sick: 120, naughty: 340,
};
const FONT = `DejaVu Sans, -apple-system, Helvetica, Arial, sans-serif`;
const BG = '#14171d';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { const a = [...String(s ?? '')]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };

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
async function sticker(code, size) {
  const key = `${code}:${size}`;
  if (!stickerCache.has(key)) {
    const file = path.join(MOODS_DIR, `${/^[a-z]+$/.test(code) ? code : 'neutral'}.webp`);
    stickerCache.set(key, sharp(file, { animated: false }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
  }
  return stickerCache.get(key);
}

const glow = (id, hue, cx, cy, r) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="hsl(${hue},85%,58%)" stop-opacity="0.32"/><stop offset="1" stop-color="hsl(${hue},85%,58%)" stop-opacity="0"/></radialGradient>`;

async function toPng(width, height, svg, layers) {
  return sharp(Buffer.from(svg)).composite(layers).png().toBuffer();
}

/**
 * One person's mood (yours or a friend's), 600x600 (small and large widgets).
 * @param {{name?:string, mood?:{code,name}, timestamp?:Date, empty?:string}} p
 */
async function renderSingle({ name, mood, timestamp, empty }, now = Date.now()) {
  const W = 600, H = 600;
  if (!mood) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="${BG}"/>
      <text x="300" y="285" font-family="${FONT}" font-size="40" font-weight="700" fill="#f2f3f5" text-anchor="middle">${esc(clip(name || 'MoodPal', 22))}</text>
      <text x="300" y="340" font-family="${FONT}" font-size="28" fill="#8b919c" text-anchor="middle">${esc(empty || 'No mood yet')}</text></svg>`;
    return toPng(W, H, svg, []);
  }
  const hue = MOOD_HUES[mood.code] ?? 210;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>${glow('g', hue, 300, 210, 300)}</defs>
    <rect width="100%" height="100%" fill="${BG}"/><rect width="100%" height="100%" fill="url(#g)"/>
    <text x="300" y="470" font-family="${FONT}" font-size="58" font-weight="700" fill="#f2f3f5" text-anchor="middle">${esc(clip(mood.name, 16))}</text>
    <text x="300" y="530" font-family="${FONT}" font-size="30" fill="#9aa0ab" text-anchor="middle">${esc(clip(name || 'You', 20))} · ${esc(ago(timestamp, now))}</text>
  </svg>`;
  return toPng(W, H, svg, [{ input: await sticker(mood.code, 300), left: 150, top: 60 }]);
}

/**
 * Friends' moods, 1200x564 (medium widget), up to 6 people, newest first.
 * @param {{friends: Array<{name, mood:{code,name}, timestamp}>}} p
 */
async function renderFriends({ friends }, now = Date.now()) {
  const W = 1200, H = 564;
  const shown = friends.slice(0, 6);
  const cols = 3, cellW = 380, cellH = 236, x0 = 30, y0 = 76;
  let defs = '', body = '';
  const layers = [];
  for (let i = 0; i < shown.length; i++) {
    const f = shown[i];
    const cx = x0 + (i % cols) * (cellW + 5), cy = y0 + Math.floor(i / cols) * (cellH + 10);
    const hue = MOOD_HUES[f.mood.code] ?? 210;
    defs += glow(`g${i}`, hue, cx + 90, cy + cellH / 2, 150);
    body += `<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="28" fill="#1b1e25"/>
      <rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="28" fill="url(#g${i})"/>
      <text x="${cx + 180}" y="${cy + 92}" font-family="${FONT}" font-size="32" font-weight="700" fill="#f2f3f5">${esc(clip(f.name, 10))}</text>
      <text x="${cx + 180}" y="${cy + 136}" font-family="${FONT}" font-size="26" fill="#c4c9d2">${esc(clip(f.mood.name, 12))}</text>
      <text x="${cx + 180}" y="${cy + 174}" font-family="${FONT}" font-size="22" fill="#8b919c">${esc(ago(f.timestamp, now))}</text>`;
    layers.push({ input: await sticker(f.mood.code, 150), left: cx + 18, top: cy + 43 });
  }
  if (!shown.length) body = `<text x="600" y="300" font-family="${FONT}" font-size="34" fill="#8b919c" text-anchor="middle">No friends share their mood with you yet</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>${defs}</defs><rect width="100%" height="100%" fill="${BG}"/>
    <text x="40" y="52" font-family="${FONT}" font-size="30" font-weight="700" fill="#f2f3f5">Friends' moods</text>
    ${friends.length > shown.length ? `<text x="1160" y="52" font-family="${FONT}" font-size="24" fill="#8b919c" text-anchor="end">+${friends.length - shown.length} more</text>` : ''}
    ${body}
  </svg>`;
  return toPng(W, H, svg, layers);
}

module.exports = { renderSingle, renderFriends, ago, MOOD_HUES };
