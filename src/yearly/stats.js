// The numbers behind a "Year in Moods" video, in the person's own timezone.
const Mood = require('../models/mood');
const User = require('../models/user');
const time = require('../reminders/time');
const { MOOD_MAP } = require('../constants/mood.constant');

// the six mood groups the reports use (src/utils/radar_diagram.js), with a hue for the bars
const GROUPS = [
  { key: 'positive', label: 'Positive', hue: 45, moods: ['happy', 'relaxed', 'excited'] },
  { key: 'motivated', label: 'Motivated', hue: 25, moods: ['motivated', 'naughty', 'confused'] },
  { key: 'calm', label: 'Calm', hue: 160, moods: ['neutral', 'uncertain', 'bored'] },
  { key: 'anxious', label: 'Anxious', hue: 280, moods: ['anxious', 'overthinking', 'nervous'] },
  { key: 'negative', label: 'Low', hue: 215, moods: ['disappointed', 'sad', 'overwhelmed'] },
  { key: 'drained', label: 'Drained', hue: 230, moods: ['tired', 'sick', 'angry'] },
];
const GOOD = ['happy', 'relaxed', 'excited', 'motivated'];
const HARD = ['sad', 'disappointed', 'overwhelmed', 'anxious', 'overthinking', 'nervous', 'angry'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MIN_MOODS = 5;
const MIN_MONTH = 3;   // a month needs this many moods to be called best or toughest
const MIN_RADAR_WEEKS = 4;   // the weekly radar needs this many weeks with moods
// the radar's corners, clockwise from the top (same six groups as the bars)
const RADAR_AXES = ['positive', 'motivated', 'anxious', 'negative', 'drained', 'calm'];
const groupOf = Object.fromEntries(GROUPS.flatMap(g => g.moods.map(code => [code, g.key])));

const tzOf = (user) => (time.isValidTimezone(user?.timezone) ? user.timezone : time.envDefaultTimezone());
function localParts(date, tz) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month - 1, d: +p.day };
}
const dayNumber = ({ y, m, d }) => Math.round(Date.UTC(y, m, d) / 86400000);

/**
 * @returns {Promise<object>} everything the video shows; `enough` is false below MIN_MOODS moods
 */
async function yearStats(userId, year) {
  const user = await User.findById(userId).select('first_name username timezone').lean();
  const tz = tzOf(user);
  const start = time.zonedToUtc(year, 0, 1, 0, 0, tz);
  const end = time.zonedToUtc(year + 1, 0, 1, 0, 0, tz);
  const moods = await Mood.find({ user: userId, timestamp: { $gte: start, $lt: end } }).select('mood.code timestamp').sort({ timestamp: 1 }).lean();

  const counts = {};
  const days = new Set();
  const months = Array.from({ length: 12 }, () => ({ n: 0, counts: {} }));
  const jan1 = dayNumber({ y: year, m: 0, d: 1 });
  const weeks = Array.from({ length: 53 }, () => ({ n: 0, g: {} }));
  for (const m of moods) {
    const code = MOOD_MAP[m.mood?.code] ? m.mood.code : null;
    if (!code) continue;
    const lp = localParts(m.timestamp, tz);
    counts[code] = (counts[code] || 0) + 1;
    days.add(dayNumber(lp));
    const mo = months[lp.m];
    mo.n++; mo.counts[code] = (mo.counts[code] || 0) + 1;
    const wk = weeks[Math.min(52, Math.floor((dayNumber(lp) - jan1) / 7))];
    wk.n++; wk.g[groupOf[code]] = (wk.g[groupOf[code]] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // longest run of days in a row with at least one mood
  const sorted = [...days].sort((a, b) => a - b);
  let streak = 0, run = 0;
  for (let i = 0; i < sorted.length; i++) { run = i && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1; streak = Math.max(streak, run); }

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const share = (n) => (total ? Math.round((n / total) * 100) : 0);
  const groups = GROUPS.map(g => {
    const n = g.moods.reduce((a, c) => a + (counts[c] || 0), 0);
    return { key: g.key, label: g.label, hue: g.hue, count: n, pct: share(n) };
  }).sort((a, b) => b.count - a.count);

  const monthView = months.map((mo, i) => {
    const dominant = Object.entries(mo.counts).sort((a, b) => b[1] - a[1])[0];
    const good = GOOD.reduce((a, c) => a + (mo.counts[c] || 0), 0);
    const hard = HARD.reduce((a, c) => a + (mo.counts[c] || 0), 0);
    return { index: i, label: MONTHS[i], short: MONTHS[i].slice(0, 3), code: dominant ? dominant[0] : null, n: mo.n, good: mo.n ? good / mo.n : 0, hard: mo.n ? hard / mo.n : 0 };
  });
  const eligible = monthView.filter(m => m.n >= MIN_MONTH);
  const best = eligible.filter(m => m.good > 0).sort((a, b) => b.good - a.good || a.index - b.index)[0] || null;
  const toughest = eligible.filter(m => m.hard > 0 && m !== best).sort((a, b) => b.hard - a.hard || a.index - b.index)[0] || null;

  return {
    year,
    name: user?.first_name || user?.username || 'You',
    timezone: tz,
    total,
    days: days.size,
    streak,
    top: top ? { code: top[0], name: MOOD_MAP[top[0]].name, count: top[1], pct: share(top[1]) } : null,
    groups,
    months: monthView.map(({ index, label, short, code, n }) => ({ index, label, short, code, n })),
    best: best ? { label: best.label, code: best.code, pct: Math.round(best.good * 100) } : null,
    toughest: toughest ? { label: toughest.label, code: toughest.code, pct: Math.round(toughest.hard * 100) } : null,
    radar: weeklyRadar(weeks, year, groups),
    enough: total >= MIN_MOODS,
  };
}

/**
 * The radar that morphs week by week: for each week from the first to the last with moods, the share of
 * each group (RADAR_AXES order). Each week is blended with its neighbours (weighted by how many moods
 * they had), so one odd mood doesn't make the shape jump; a week without moods keeps the last shape.
 * @returns {{ axes: string[], year: number[], weeks: Array<{ week: number, month: string, values: number[] }> } | null}
 */
function weeklyRadar(weeks, year, groups) {
  const withData = weeks.map((w, i) => (w.n ? i : -1)).filter(i => i >= 0);
  if (withData.length < MIN_RADAR_WEEKS) return null;
  const first = withData[0], last = withData[withData.length - 1];
  const out = [];
  let prev = null;
  for (let i = first; i <= last; i++) {
    const sum = Object.fromEntries(RADAR_AXES.map(k => [k, 0]));
    let n = 0;
    for (const [j, weight] of [[i - 1, 0.5], [i, 1], [i + 1, 0.5]]) {
      const w = weeks[j];
      if (!w || !w.n) continue;
      for (const k of RADAR_AXES) sum[k] += weight * (w.g[k] || 0);
      n += weight * w.n;
    }
    const values = n ? RADAR_AXES.map(k => sum[k] / n) : prev;
    prev = values;
    const monthIndex = new Date(Date.UTC(year, 0, 1 + i * 7)).getUTCMonth();
    out.push({ week: i + 1, month: MONTHS[Math.min(11, monthIndex)], values });
  }
  const total = groups.reduce((a, g) => a + g.count, 0) || 1;
  const byKey = Object.fromEntries(groups.map(g => [g.key, g.count / total]));
  return {
    axes: RADAR_AXES.map(k => GROUPS.find(g => g.key === k).label),
    year: RADAR_AXES.map(k => byKey[k] || 0),
    weeks: out,
  };
}

module.exports = { yearStats, GROUPS, MIN_MOODS, MONTHS, MIN_RADAR_WEEKS, RADAR_AXES };
