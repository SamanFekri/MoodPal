const mongoose = require('mongoose');

// One thing MoodPal remembers about a user, picked up from their Talk conversations
// ("has a big exam on Friday", "sister is called Sara"). At most MAX per user (see
// src/memory/service.js); the least important and stalest are dropped first.
const userMemorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, maxlength: 200 },
  category: { type: String, enum: ['life', 'people', 'feelings', 'preferences', 'goals', 'health', 'work_study', 'other'], default: 'other' },
  importance: { type: Number, min: 1, max: 5, default: 3 },
  // how often later conversations brought it up again (updates bump it)
  times_seen: { type: Number, default: 1 },
  source_session: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', default: null },
}, { timestamps: true, collection: 'user_memories' });

userMemorySchema.index({ user: 1, importance: -1, updatedAt: -1 });

module.exports = mongoose.model('UserMemory', userMemorySchema);
