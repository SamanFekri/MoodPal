const mongoose = require('mongoose');

// Master registry of every personality characteristic the system knows about.
// User profiles only reference these by `key`; definitions live here so new
// traits can be added (or tuned) through the database without code changes.
const personalityTraitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  category: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  // all values are on a 0.0 – 1.0 scale
  default_value: { type: Number, default: 0.5, min: 0, max: 1 },
  min_value: { type: Number, default: 0, min: 0, max: 1 },
  max_value: { type: Number, default: 1, min: 0, max: 1 },
  // how far (0–1) a trait may drift from its baseline through observations
  // (1 = fully fluid, 0.9 = may only move ±0.1 from the test baseline)
  stability: { type: Number, default: 0.5, min: 0, max: 1 },
  // fraction of an observation that is blended in per update (scaled by confidence)
  learning_rate: { type: Number, default: 0.1, min: 0, max: 1 },
  enabled: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
}, { timestamps: true, collection: 'personality_traits' });

personalityTraitSchema.statics.getEnabledMap = async function () {
  const traits = await this.find({ enabled: true }).lean();
  return traits.reduce((acc, trait) => { acc[trait.key] = trait; return acc; }, {});
};

module.exports = mongoose.model('PersonalityTrait', personalityTraitSchema);
