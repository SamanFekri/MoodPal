const mongoose = require('mongoose');

// One piece of evidence about a user (from a test or an LLM inference) and what
// it did to the profile. Rejected LLM suggestions are kept too, for auditing.
const personalityObservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  trait: { type: String, required: true },
  source: { type: String, enum: ['test', 'llm', 'manual'], default: 'llm' },
  // what the source claimed
  observed_value: { type: Number },
  change: { type: Number },
  confidence: { type: Number, min: 0, max: 1 },
  evidence: { type: String, default: '' },
  // what actually happened
  applied: { type: Boolean, default: false },
  rejection_reason: { type: String },
  value_before: { type: Number },
  value_after: { type: Number },
}, { timestamps: true, collection: 'personality_observations' });

module.exports = mongoose.model('PersonalityObservation', personalityObservationSchema);
