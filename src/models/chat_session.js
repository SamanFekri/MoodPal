const mongoose = require('mongoose');

// One "Talk" conversation between a user and the bot. Only one can be active per user;
// it ends explicitly (/end_talk) or after CHAT_IDLE_MINUTES without a message.
const chatSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active', index: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    risk: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
    at: { type: Date, default: Date.now },
  }],
  // how the chat was started: menu button, /talk, or a "talk about it" note
  opened_from: { type: String, enum: ['menu', 'command', 'note'], default: 'menu' },
  highest_risk: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
  last_message_at: { type: Date, default: Date.now },
  ended_at: Date,
  ended_reason: { type: String, enum: ['user', 'idle', 'no_key', 'error'] },
}, { timestamps: true, collection: 'chat_sessions' });

chatSessionSchema.index({ user: 1, status: 1, last_message_at: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
