// "Export my moods": every mood a user logged, with its note, as a CSV that opens in Excel,
// Numbers or Google Sheets. Times are in the user's own timezone. Sent as a file into their
// Telegram chat (works the same from the bot and from the mini app).
const Mood = require('../models/mood');
const User = require('../models/user');
const { getTelegram } = require('../utils/telegram');

const COOLDOWN_MS = 60 * 1000;          // one export a minute per person is plenty
const lastExport = new Map();

const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function timezoneOf(user, fallback) {
  for (const tz of [user?.timezone, fallback, 'UTC']) {
    try { if (tz) { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } } catch {}
  }
  return 'UTC';
}

// { buffer, filename, count, timezone }
async function buildCsv(userId) {
  const user = await User.findById(userId).select('id first_name timezone').lean();
  if (!user) throw new Error('unknown_user');
  const defaultTz = (await require('../reminders/service').getSettings()).default_timezone;
  const tz = timezoneOf(user, defaultTz);
  const parts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map(p => [p.type, p.value]));

  const lines = [['Date', 'Weekday', 'Time', 'Timezone', 'Mood', 'Note'].join(',')];
  let count = 0;
  for await (const m of Mood.find({ user: userId }).sort({ timestamp: 1 }).select('mood note timestamp').lean().cursor()) {
    const p = parts(new Date(m.timestamp));
    lines.push([`${p.year}-${p.month}-${p.day}`, p.weekday, `${p.hour}:${p.minute}`, tz, m.mood?.name || m.mood?.code || '', m.note || ''].map(cell).join(','));
    count++;
  }
  const today = parts(new Date());
  // the BOM makes Excel read the file as UTF-8, so notes in any language show correctly
  const buffer = Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8');
  return { buffer, filename: `moodpal-moods-${today.year}-${today.month}-${today.day}.csv`, count, timezone: tz };
}

class ExportError extends Error { constructor(code, extra = {}) { super(code); this.code = code; Object.assign(this, extra); } }

// Build the file and send it to the user's chat. Throws ExportError('too_soon' | 'no_moods').
async function sendToChat(userId, { now = Date.now() } = {}) {
  const key = String(userId);
  const last = lastExport.get(key);
  if (last && now - last < COOLDOWN_MS) throw new ExportError('too_soon', { retry_in_s: Math.ceil((COOLDOWN_MS - (now - last)) / 1000) });
  const file = await buildCsv(userId);
  if (!file.count) throw new ExportError('no_moods');
  lastExport.set(key, now);
  const user = await User.findById(userId).select('id').lean();
  await getTelegram().sendDocument(user.id, { source: file.buffer, filename: file.filename }, {
    caption: `📥 Your mood log: ${file.count} ${file.count === 1 ? 'mood' : 'moods'} with notes, times in ${file.timezone}. Opens in Excel, Numbers or Google Sheets.`,
  });
  return { count: file.count, filename: file.filename, timezone: file.timezone };
}

const _resetCooldown = () => lastExport.clear();

module.exports = { buildCsv, sendToChat, ExportError, COOLDOWN_MS, _resetCooldown };
