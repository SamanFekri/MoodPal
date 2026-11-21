const mongoose = require('mongoose');

// Requests through the admin's shared AI key, counted per day. One row per person per day (their
// local day), and one row per UTC day with user = null for the whole bot (the daily cap).
// A person's own OpenAI key is never counted.
const aiUsageSchema = new mongoose.Schema({
  day: { type: String, required: true },          // YYYY-MM-DD
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  talk: { type: Number, default: 0 },             // Talk messages (the per-person limit)
  insight: { type: Number, default: 0 },          // weekly AI insights
  background: { type: Number, default: 0 },       // memory and personality learning
  admin: { type: Number, default: 0 },            // admin tools (characteristics, translation)
  total: { type: Number, default: 0 },
}, { timestamps: true, collection: 'ai_usage' });

aiUsageSchema.index({ day: 1, user: 1 }, { unique: true });
aiUsageSchema.index({ user: 1, day: -1 });
// a year of history is plenty for the admin's view
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
