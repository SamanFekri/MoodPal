const mongoose = require('mongoose');

// A message an admin sends to everyone. Media is uploaded to Telegram once (into the admin's
// chat) and then sent to each person by file_id. One BroadcastDelivery row per recipient.
const broadcastSchema = new mongoose.Schema({
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['text', 'photo', 'video', 'animation', 'audio', 'document'], default: 'text' },
  text: { type: String, default: '' },                // the message, or the caption for media
  file_id: { type: String, default: null },
  file_name: { type: String, default: null },
  button: { text: { type: String, default: null }, url: { type: String, default: null } },
  // who gets it first (see ORDERS in src/broadcast/service.js)
  order: { type: String, enum: ['recent_active', 'least_active', 'newest', 'oldest'], default: 'recent_active' },
  status: { type: String, enum: ['sending', 'done', 'cancelled'], default: 'sending', index: true },
  total: { type: Number, default: 0 },
  started_at: { type: Date, default: Date.now },
  finished_at: { type: Date, default: null },
}, { timestamps: true, collection: 'broadcasts' });

module.exports = mongoose.model('Broadcast', broadcastSchema);
