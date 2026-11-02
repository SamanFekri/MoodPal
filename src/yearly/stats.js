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
  for (const m of moods) {
    const code = MOOD_MAP[m.mood?.code] ? m.mood.code : null;
    if (!code) continue;
    const lp = localParts(m.timestamp, tz);
    counts[code] = (counts[code] || 0) + 1;
    days.add(dayNumber(lp));
    const mo = months[lp.m];
    mo.n++; mo.counts[code] = (mo.counts[code] || 0) + 1;
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
    enough: total >= MIN_MOODS,
  };
}

module.exports = { yearStats, GROUPS, MIN_MOODS, MONTHS };
