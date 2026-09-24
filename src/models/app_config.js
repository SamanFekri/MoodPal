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
