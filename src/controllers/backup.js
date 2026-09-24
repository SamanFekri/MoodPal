// Admin-only backup, restore and health endpoints for the mini app.
const AppConfig = require('../models/app_config');
const { GotYouBroClient } = require('../backup/gotyoubro');
const backupService = require('../backup/service');
const scheduler = require('../backup/scheduler');

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const view = async () => {
  const config = await AppConfig.get();
  const token = await AppConfig.getToken();
  return {
    connected: Boolean(token),
    token_hint: token ? `${token.slice(0, 7)}…${token.slice(-4)}` : null,
    base_url: config.gyb_base_url,
    backup: {
      enabled: Boolean(config.backup_enabled),
      time: config.backup_time,
      timezone: config.backup_timezone,
      last_at: config.last_backup_at,
      last_status: config.last_backup_status,
      last_message: config.last_backup_message,
      last_parts: config.last_backup_parts,
      last_bytes: config.last_backup_bytes,
      max_part_bytes: backupService.MAX_PART_BYTES,
      excluded_collections: [...backupService.EXCLUDED_COLLECTIONS],
    },
    health: {
      enabled: Boolean(config.health_enabled),
      interval_minutes: config.health_interval_minutes,
      last_at: config.last_heartbeat_at,
      last_status: config.last_heartbeat_status,
      last_message: config.last_heartbeat_message,
    },
  };
};

// GET /api/admin/backup
const getSettings = async (req, res) => res.json(await view());

// POST /api/admin/backup/settings { token?, base_url?, backup_enabled?, backup_time?, backup_timezone?, health_enabled?, health_interval_minutes? }
const saveSettings = async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.base_url !== undefined) {
    const url = String(body.base_url || '').trim();
    if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return res.status(400).json({ error: 'invalid_base_url' });
    update.gyb_base_url = url || undefined;
  }
  if (body.backup_enabled !== undefined) update.backup_enabled = Boolean(body.backup_enabled);
  if (body.backup_time !== undefined) {
    const time = String(body.backup_time).trim();
    if (!TIME_RE.test(time)) return res.status(400).json({ error: 'invalid_time' });
    update.backup_time = time.length === 4 ? `0${time}` : time;
  }
  if (body.backup_timezone !== undefined) {
    const tz = String(body.backup_timezone).trim() || 'UTC';
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
    } catch {
      return res.status(400).json({ error: 'invalid_timezone' });
    }
    update.backup_timezone = tz;
  }
  if (body.health_enabled !== undefined) update.health_enabled = Boolean(body.health_enabled);
  if (body.health_interval_minutes !== undefined) {
    const minutes = parseInt(body.health_interval_minutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return res.status(400).json({ error: 'invalid_interval' });
    update.health_interval_minutes = minutes;
  }

  await AppConfig.get();
  if (Object.keys(update).length) await AppConfig.updateOne({ key: 'main' }, update);

  if (body.token !== undefined) {
    const token = String(body.token || '').trim();
    if (token && token.length < 8) return res.status(400).json({ error: 'invalid_token' });
    await AppConfig.setToken(token || null);
  }

  await scheduler.reschedule({ log: () => {} }).catch(err => console.error('Reschedule failed:', err.message));
  res.json(await view());
};

// POST /api/admin/backup/test — validate the token against GET /api/v1/service
const testConnection = async (req, res) => {
  const config = await AppConfig.get();
  const token = await AppConfig.getToken();
  if (!token) return res.status(400).json({ error: 'no_token' });
  try {
    const service = await module.exports.makeClient({ token, baseUrl: config.gyb_base_url }).describeService();
    res.json({ ok: true, service });
  } catch (error) {
    res.status(502).json({ error: 'unreachable', code: error.code || null, message: error.message });
  }
};

// POST /api/admin/backup/run — build and upload a backup right now
const runNow = async (req, res) => {
  try {
    const result = await backupService.runBackup({ trigger: 'manual' });
    res.json(result);
  } catch (error) {
    console.error('Backup failed:', error.message);
    res.status(502).json({ error: 'backup_failed', message: error.message });
  }
};

// POST /api/admin/backup/heartbeat — send one heartbeat now
const heartbeatNow = async (req, res) => {
  try {
    res.json(await backupService.sendHeartbeat());
  } catch (error) {
    res.status(502).json({ error: 'heartbeat_failed', code: error.code || null, message: error.message });
  }
};

// POST /api/admin/backup/restore?mode=merge|replace&dry_run=1  (body: one zip part, application/zip)
// Several parts are uploaded one request at a time; each call reports what it restored.
const restore = async (req, res) => {
  const mode = req.query.mode === 'replace' ? 'replace' : 'merge';
  const dryRun = req.query.dry_run === '1' || req.query.dry_run === 'true';
  if (!req.body || !req.body.length) return res.status(400).json({ error: 'empty_body' });
  try {
    const summary = await backupService.restoreFromZips([req.body], { mode, dryRun });
    res.json(summary);
  } catch (error) {
    res.status(400).json({ error: 'restore_failed', message: error.message });
  }
};

module.exports = {
  getSettings, saveSettings, testConnection, runNow, heartbeatNow, restore,
  // separate so tests can swap the outbound client
  makeClient: (opts) => new GotYouBroClient(opts),
};
