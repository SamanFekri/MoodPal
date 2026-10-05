// One admin-requested "characteristics" analysis of a person: communication and behavioral
// observations drawn from their moods, notes and personality data, with advice on how to talk to
// them. Every run is kept, so an admin can see how the picture changes after a recalculation.
const mongoose = require('mongoose');

const characteristicSchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  confidence: { type: Number, min: 0, max: 1, required: true },
  evidence: { type: String, default: '' },
  communication_recommendation: { type: String, default: '' },
  how_to_communicate: { type: [String], default: [] },
  example: { type: String, default: '' },
}, { _id: false });

const characteristicAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  model: { type: String, required: true },
  key_source: { type: String, enum: ['server', 'admin'], required: true },
  status: { type: String, enum: ['ok', 'insufficient_evidence'], required: true },
  characteristics: { type: [characteristicSchema], default: [] },
  guide: {
    overall_communication_style: { type: String, default: '' },
    what_works: { type: [String], default: [] },
    what_to_avoid: { type: [String], default: [] },
    best_approach: { type: String, default: '' },
    example_phrases: { type: [String], default: [] },
  },
  // what was sent to OpenAI (counts and date range only, not the data itself)
  data_used: {
    moods: { type: Number, default: 0 },
    notes: { type: Number, default: 0 },
    traits: { type: Number, default: 0 },
    mbti: { type: String, default: null },
    talk_traits: { type: Number, default: 0 },
    memories: { type: Number, default: 0 },
    from: { type: Date, default: null },
    to: { type: Date, default: null },
  },
}, { timestamps: true, collection: 'characteristic_analyses' });

characteristicAnalysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CharacteristicAnalysis', characteristicAnalysisSchema);
