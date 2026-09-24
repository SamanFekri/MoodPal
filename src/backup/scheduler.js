// Runs the scheduled backup and the health heartbeat. Re-reads AppConfig whenever an
// admin changes the settings, so a new time or interval takes effect without a restart.
const cron = require('node-cron');
const AppConfig = require('../models/app_config');
const { runBackup, sendHeartbeat } = require('./service');

let backupJob = null;
let heartbeatTimer = null;

// "HH:MM" -> a daily cron expression, or null when the value is not a valid time
function timeToCron(time) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(time || '').trim());
  if (!m) return null;
  return `${Number(m[2])} ${Number(m[1])} * * *`;
}

function stop() {
  if (backupJob) { backupJob.stop(); backupJob = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// Read the current config and (re)arm both schedules.
async function reschedule({ log = console.log } = {}) {
  stop();
  const config = await AppConfig.get();

  if (config.backup_enabled) {
    const expression = timeToCron(config.backup_time);
    if (!expression) {
      log(`⚠️  Backup time "${config.backup_time}" is not HH:MM - backup not scheduled`);
    } else {
      const options = cron.validate(expression) ? { timezone: config.backup_timezone || 'UTC' } : {};
      backupJob = cron.schedule(expression, () => {
        runBackup({ trigger: 'schedule' })
          .then(r => log(`💾 Scheduled backup: ${r.status} (${r.message})`))
          .catch(e => console.error('Scheduled backup failed:', e.message));
      }, options);
      log(`💾 Backup scheduled daily at ${config.backup_time} ${config.backup_timezone || 'UTC'}`);
    }
  }

  if (config.health_enabled) {
    const minutes = Math.min(1440, Math.max(1, config.health_interval_minutes || 5));
    const tick = () => sendHeartbeat().catch(e => console.error('Heartbeat failed:', e.message));
    heartbeatTimer = setInterval(tick, minutes * 60 * 1000);
    if (heartbeatTimer.unref) heartbeatTimer.unref();
    tick();   // send one immediately so the service knows we are up
    log(`❤️  Heartbeat every ${minutes} min`);
  }

  return { backup: Boolean(backupJob), heartbeat: Boolean(heartbeatTimer) };
}

module.exports = { reschedule, stop, timeToCron };
