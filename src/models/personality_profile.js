const mongoose = require('mongoose');

// Current trait values for one user. Keys of `traits` / `confidence` / `baseline`
// are trait keys from personality_traits.
const personalityProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  traits: { type: Map, of: Number, default: {} },
  confidence: { type: Map, of: Number, default: {} },
  // value a trait is anchored to (from a test, or the trait default); observations
  // may only move a trait (1 - stability) away from this
  baseline: { type: Map, of: Number, default: {} },
  // which tests contributed to this profile
  sources: [{
    test_key: String,
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalityTestSession' },
    taken_at: Date,
  }],
  observation_count: { type: Number, default: 0 },
  version: { type: Number, default: 1 },
}, { timestamps: true, collection: 'personality_profiles' });

personalityProfileSchema.statics.findByUser = function (userId) {
  return this.findOne({ user: userId });
};

// plain-object view used by scoring / context builders
personalityProfileSchema.methods.toPlain = function () {
  return {
    user: this.user,
    traits: Object.fromEntries(this.traits || []),
    confidence: Object.fromEntries(this.confidence || []),
    baseline: Object.fromEntries(this.baseline || []),
    version: this.version,
    observation_count: this.observation_count,
    sources: this.sources,
  };
};

module.exports = mongoose.model('PersonalityProfile', personalityProfileSchema);
