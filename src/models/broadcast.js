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
  // a re-send of an earlier broadcast, and whether it went only to people who hadn't got that one
  resent_from: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast', default: null },
  only_missed: { type: Boolean, default: false },
  // where it goes: each person's chat (through the queue) and/or one post in the main channel
  // (MAIN_CHANNEL_ID). Both on by default; older broadcasts read as users only.
  to_users: { type: Boolean, default: true },
  to_channel: { type: Boolean, default: false },
  // the channel post: 'sent' | 'failed' | 'not_configured' (null when the channel wasn't asked for)
  channel_status: { type: String, default: null },
  channel_error: { type: String, default: null },
  channel_message_id: { type: Number, default: null },
  total: { type: Number, default: 0 },
  started_at: { type: Date, default: Date.now },
  finished_at: { type: Date, default: null },
}, { timestamps: true, collection: 'broadcasts' });

module.exports = mongoose.model('Broadcast', broadcastSchema);
