const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/secret');

// Single document holding operational settings an admin can change from the mini app.
// The GotYouBro token is stored encrypted and never selected by default.
const appConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },

  // ---- GotYouBro (https://gotyoubro.samanfekri.me) ----
  gyb_token: { type: String, default: null, select: false },
  gyb_base_url: { type: String, default: 'https://gotyoubro.samanfekri.me' },

  // ---- scheduled backup ----
  backup_enabled: { type: Boolean, default: false },
  // local time of day to run the backup, "HH:MM" in backup_timezone
  backup_time: { type: String, default: '03:30' },
  backup_timezone: { type: String, default: 'UTC' },
  last_backup_at: { type: Date, default: null },
  last_backup_status: { type: String, enum: ['success', 'partial', 'failed', null], default: null },
  last_backup_message: { type: String, default: null },
  last_backup_parts: { type: Number, default: 0 },
  last_backup_bytes: { type: Number, default: 0 },

  // ---- health heartbeat ----
  health_enabled: { type: Boolean, default: false },
  health_interval_minutes: { type: Number, default: 5, min: 1, max: 1440 },
  last_heartbeat_at: { type: Date, default: null },
  last_heartbeat_status: { type: String, default: null },
  last_heartbeat_message: { type: String, default: null },

  // ---- mood reminders (see src/reminders) ----
  // master switch: off stops scheduling and sending; queued reminders wait (and expire after the grace window)
  reminders_enabled: { type: Boolean, default: true },
  // everyone who hasn't picked their own times gets these; null = derived from CRON_JOB_TIME in .env
  reminder_default_times: { type: [String], default: null },
  // null = REMINDER_TIMEZONE / TZ from the environment, else UTC
  reminder_default_timezone: { type: String, default: null },
  // the most reminders a user may pick per day (everyone starts with the default times, i.e. 2)
  reminder_max_per_day: { type: Number, default: 5, min: 1, max: 5 },
  // queue drain speed; Telegram allows about 30 messages/second per bot, so stay well under
  reminder_rate_per_second: { type: Number, default: 10, min: 1, max: 25 },
  // a reminder that couldn't go out within this many minutes of its time is dropped, not sent late
  reminder_grace_minutes: { type: Number, default: 120, min: 5, max: 720 },
  // don't remind someone who logged a mood this recently (0 = always remind)
  reminder_skip_if_logged_minutes: { type: Number, default: 120, min: 0, max: 720 },
}, { timestamps: true, collection: 'app_config' });

appConfigSchema.statics.get = async function () {
  return (await this.findOne({ key: 'main' })) || (await this.create({ key: 'main' }));
};

appConfigSchema.statics.setToken = async function (token) {
  await this.get();
  await this.updateOne({ key: 'main' }, { gyb_token: token ? encrypt(token) : null });
};

appConfigSchema.statics.getToken = async function () {
  const doc = await this.findOne({ key: 'main' }).select('+gyb_token');
  if (!doc || !doc.gyb_token) return null;
  try {
    return decrypt(doc.gyb_token);
  } catch (error) {
    console.error('Failed to decrypt the GotYouBro token:', error.message);
    return null;
  }
};

module.exports = mongoose.model('AppConfig', appConfigSchema);
