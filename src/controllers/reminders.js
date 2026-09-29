// Admin-only controls for mood reminders: master switch, defaults, queue speed, and queue health.
const AppConfig = require('../models/app_config');
const reminders = require('../reminders/service');
const time = require('../reminders/time');

const view = async () => {
  const s = await reminders.getSettings({ fresh: true });
  return {
    settings: {
      enabled: s.enabled,
      default_times: s.default_times,
      default_times_from_env: s.default_times_from_env,
      env_default_times: time.envDefaultTimes(),
      default_timezone: s.default_timezone,
      max_per_day: s.max_per_day,
      rate_per_second: s.rate_per_second,
      grace_minutes: s.grace_minutes,
      skip_if_logged_minutes: s.skip_if_logged_minutes,
    },
    ...(await reminders.stats()),
  };
};

// GET /api/admin/reminders
const getReminders = async (req, res) => res.json(await view());

const intIn = (v, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

// POST /api/admin/reminders/settings
// { enabled?, default_times?: [..] | null (null = from .env), default_timezone?, max_per_day?, rate_per_second?, grace_minutes?, skip_if_logged_minutes? }
const saveSettings = async (req, res) => {
  const body = req.body || {};
  const update = {};
  let reschedule = false;

  if (body.enabled !== undefined) update.reminders_enabled = Boolean(body.enabled);
  if (body.default_times !== undefined) {
    if (body.default_times === null) update.reminder_default_times = null;
    else {
      const times = Array.isArray(body.default_times) ? body.default_times.map(time.normalizeTime) : [];
      if (!times.length || times.some(t => !t) || times.length > 5) return res.status(400).json({ error: 'invalid_times' });
      update.reminder_default_times = [...new Set(times)].sort();
    }
    reschedule = true;
  }
  if (body.default_timezone !== undefined) {
    if (!time.isValidTimezone(body.default_timezone)) return res.status(400).json({ error: 'invalid_timezone' });
    update.reminder_default_timezone = body.default_timezone;
    reschedule = true;
  }
  const ranges = { max_per_day: [1, 5], rate_per_second: [1, 25], grace_minutes: [5, 720], skip_if_logged_minutes: [0, 720] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (body[key] === undefined) continue;
    const n = intIn(body[key], min, max);
    if (n === null) return res.status(400).json({ error: `invalid_${key}` });
    update[`reminder_${key}`] = n;
    if (key === 'max_per_day') reschedule = true;
  }
  // turning the service back on: everyone's next reminder is worked out from now
  if (body.enabled === true) reschedule = true;

  await AppConfig.get();
  if (Object.keys(update).length) await AppConfig.updateOne({ key: 'main' }, update);
  reminders.invalidate();
  if (reschedule) await reminders.resetSchedules();
  res.json(await view());
};

// POST /api/admin/reminders/test — queue a reminder to yourself (goes through the real queue)
const sendTest = async (req, res) => {
  await reminders.enqueueTest(req.user._id);
  res.json({ ok: true, ...(await view()) });
};

// POST /api/admin/reminders/clear — drop everything still waiting in the queue
const clearQueue = async (req, res) => {
  const cleared = await reminders.clearQueue();
  res.json({ cleared, ...(await view()) });
};

module.exports = { getReminders, saveSettings, sendTest, clearQueue };
