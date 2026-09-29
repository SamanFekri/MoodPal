// Time-of-day helpers for reminders: "HH:MM" in an IANA timezone -> the next UTC instant.
// Pure functions (no DB), built on Intl so DST changes are handled without a date library.

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const FALLBACK_TIMES = ['09:00', '21:00'];

// "7:5" is rejected, "7:05" -> "07:05"
function normalizeTime(value) {
  const m = TIME_RE.exec(String(value ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

// Default reminder times from the channel cron in .env (CRON_JOB_TIME, e.g. "* 7,21 * * *" ->
// 07:00 and 21:00). A "*" or range in the minute field counts as :00; only plain hour lists are used.
function timesFromCron(expression) {
  const fields = String(expression || '').trim().split(/\s+/);
  if (fields.length < 5) return null;
  const minute = /^\d+$/.test(fields[0]) && Number(fields[0]) < 60 ? Number(fields[0]) : 0;
  if (!/^\d+(,\d+)*$/.test(fields[1])) return null;
  const hours = [...new Set(fields[1].split(',').map(Number))].filter(h => h < 24).sort((a, b) => a - b);
  if (!hours.length) return null;
  return hours.map(h => `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
}

function envDefaultTimes() {
  return timesFromCron(process.env.CRON_JOB_TIME) || FALLBACK_TIMES;
}

function envDefaultTimezone() {
  const tz = process.env.REMINDER_TIMEZONE || process.env.TZ;
  return isValidTimezone(tz) ? tz : 'UTC';
}

// offset of `tz` from UTC at `date`, in ms (e.g. +2h for Europe/Berlin in summer)
function tzOffsetMs(date, tz) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)) parts[p.type] = p.value;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// wall-clock time in tz -> UTC Date (a time skipped by a DST jump lands just after it)
function zonedToUtc(year, month, day, hour, minute, tz) {
  const guess = Date.UTC(year, month, day, hour, minute);
  let utc = guess - tzOffsetMs(new Date(guess), tz);
  utc = guess - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

// calendar date of `date` as seen in tz
function localDate(date, tz) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) parts[p.type] = p.value;
  return { year: +parts.year, month: +parts.month - 1, day: +parts.day };
}

// The first reminder strictly after `after` for the given local times, or null if there are none.
function nextOccurrence(times, tz, after = new Date()) {
  const valid = (times || []).map(normalizeTime).filter(Boolean);
  if (!valid.length) return null;
  const zone = isValidTimezone(tz) ? tz : 'UTC';
  const today = localDate(after, zone);
  let best = null;
  for (let add = 0; add <= 2 && !best; add++) {
    // Date.UTC normalises day overflow (e.g. the 32nd) into the next month
    const d = new Date(Date.UTC(today.year, today.month, today.day + add));
    for (const t of valid) {
      const [h, m] = t.split(':').map(Number);
      const at = zonedToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, zone);
      if (at > after && (!best || at < best)) best = at;
    }
  }
  return best;
}

// ---------- timezone lookup (for the bot's /timezone and the settings view) ----------
let zonesCache = null;
function allTimezones() {
  if (!zonesCache) {
    let zones = [];
    try { zones = Intl.supportedValuesOf('timeZone'); } catch {}
    zonesCache = [...new Set(['UTC', ...zones])];
  }
  return zonesCache;
}

// minutes east of UTC right now, e.g. 210 for Asia/Tehran
const offsetMinutes = (tz, at = new Date()) => Math.round(tzOffsetMs(at, tz) / 60000);

// "UTC+03:30"
function offsetLabel(tz, at = new Date()) {
  const m = offsetMinutes(tz, at);
  const sign = m < 0 ? '-' : '+';
  const abs = Math.abs(m);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

// "21:04" in that zone
const localTime = (tz, at = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);

// "+3:30", "utc-5", "GMT+2", "3" -> minutes, else null
function parseOffset(query) {
  const m = /^(?:utc|gmt)?\s*([+-])?\s*(\d{1,2})(?:[:.h]?(\d{2}))?$/i.exec(String(query || '').trim());
  if (!m || (!m[1] && !/^(utc|gmt)/i.test(String(query).trim()) && String(query).trim().length > 2)) return null;
  const mins = Number(m[2]) * 60 + Number(m[3] || 0);
  if (Number(m[2]) > 14 || Number(m[3] || 0) >= 60) return null;
  return m[1] === '-' ? -mins : mins;
}

// Find zones by city/region name ("tehran", "new york", "Europe/Berl") or by current UTC offset ("+3:30").
function searchTimezones(query, limit = 8, at = new Date()) {
  const q = String(query || '').trim();
  if (!q) return [];
  const zones = allTimezones();
  if (isValidTimezone(q) && zones.includes(q)) return [q];
  if (/^(utc|gmt)$/i.test(q)) return ['UTC'];
  const offset = parseOffset(q);
  if (offset !== null) {
    // skip Etc/GMT±N, and list populated regions before Antarctica and the oceans
    const rank = (z) => ['Europe', 'Asia', 'America', 'Africa', 'Australia', 'Pacific', 'Atlantic', 'Indian'].indexOf(z.split('/')[0]) + 1 || 99;
    return zones.filter(z => !z.startsWith('Etc/') && offsetMinutes(z, at) === offset)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, limit);
  }
  const needle = q.toLowerCase().replace(/\s+/g, '_');
  const scored = [];
  for (const z of zones) {
    const lower = z.toLowerCase();
    const city = lower.split('/').pop();
    let score = -1;
    if (city === needle) score = 0;
    else if (city.startsWith(needle)) score = 1;
    else if (lower.startsWith(needle)) score = 2;
    else if (lower.includes(needle)) score = 3;
    if (score >= 0) scored.push([score, z]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).slice(0, limit).map(([, z]) => z);
}

// what the app and the bot show for a zone
const describeTimezone = (tz, at = new Date()) => ({ timezone: tz, offset: offsetLabel(tz, at), local_time: localTime(tz, at) });

module.exports = { allTimezones, offsetLabel, localTime, parseOffset, searchTimezones, describeTimezone, TIME_RE, FALLBACK_TIMES, normalizeTime, isValidTimezone, timesFromCron, envDefaultTimes, envDefaultTimezone, nextOccurrence, zonedToUtc };
