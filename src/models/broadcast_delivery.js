const mongoose = require('mongoose');

// One recipient of a broadcast: queued → sending → sent | failed | skipped
const deliverySchema = new mongoose.Schema({
  broadcast: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chat_id: { type: Number, required: true },
  // position in the send order chosen for the broadcast (0 goes first)
  seq: { type: Number, default: 0 },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'failed', 'skipped'], default: 'queued' },
  run_at: { type: Date, default: Date.now },
  attempts: { type: Number, default: 0 },
  reason: { type: String, default: null },
  sent_at: { type: Date, default: null },
}, { timestamps: true, collection: 'broadcast_deliveries' });

deliverySchema.index({ broadcast: 1, user: 1 }, { unique: true });
deliverySchema.index({ status: 1, run_at: 1, seq: 1 });
deliverySchema.index({ broadcast: 1, status: 1 });
// finished deliveries are only needed for the progress view
deliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('BroadcastDelivery', deliverySchema);
