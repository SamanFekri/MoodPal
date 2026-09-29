const mongoose = require('mongoose');

// One queued mood reminder. The scheduler inserts a job per (user, slot); the worker sends them
// at a capped rate. Unique (user, slot_at) makes enqueueing idempotent, and old jobs expire.
const reminderJobSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // the reminder time this job is for
  slot_at: { type: Date, required: true },
  // earliest time the worker may pick it up (pushed back on retries and rate limits)
  run_at: { type: Date, required: true },
  kind: { type: String, enum: ['scheduled', 'test'], default: 'scheduled' },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'skipped', 'failed'], default: 'queued' },
  attempts: { type: Number, default: 0 },
  reason: { type: String, default: null },   // why it was skipped or failed
  sent_at: { type: Date, default: null },
}, { timestamps: true, collection: 'reminder_jobs' });

reminderJobSchema.index({ user: 1, slot_at: 1, kind: 1 }, { unique: true });
reminderJobSchema.index({ status: 1, run_at: 1 });
reminderJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 3600 });

module.exports = mongoose.model('ReminderJob', reminderJobSchema);
