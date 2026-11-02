const mongoose = require('mongoose');

// One support message from `user` to `contact`: an automatic alert (kind 'auto', possibly waiting for
// its delay) or a share the user chose (kind 'manual'). The rows are the queue, the cooldown and the
// duplicate guard at once.
const supportAlertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['auto', 'manual'], required: true },
  // why an automatic alert went out: one hard mood, several close together, or hard days in a row
  reason: { type: String, enum: ['immediate', 'repeated', 'days', 'manual'], required: true },
  detail: { count: Number, hours: Number, days: Number },
  mood: { type: mongoose.Schema.Types.ObjectId, ref: 'Mood', required: true },
  mood_snapshot: { code: String, name: String, emoji: String },
  mood_at: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'sending', 'sent', 'canceled', 'failed'], default: 'pending' },
  // true while pending or sending (removed when done), for the "one waiting alert per friend" guard
  open: { type: Boolean, default: true },
  send_at: { type: Date, default: Date.now },
  sent_at: { type: Date, default: null },
  cancel_reason: { type: String, default: null },
  error: { type: String, default: null },
}, { timestamps: true, collection: 'support_alerts' });

supportAlertSchema.index({ status: 1, send_at: 1 });
supportAlertSchema.index({ user: 1, contact: 1, createdAt: -1 });
// never two automatic alerts waiting for the same friend, never the same mood shared twice with one friend
supportAlertSchema.index({ user: 1, contact: 1, kind: 1 }, { unique: true, partialFilterExpression: { open: true, kind: 'auto' } });
supportAlertSchema.index({ user: 1, contact: 1, mood: 1 }, { unique: true, partialFilterExpression: { kind: 'manual' } });

module.exports = mongoose.model('SupportAlert', supportAlertSchema);
