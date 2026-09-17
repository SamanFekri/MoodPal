const mongoose = require('mongoose');

// Definition of a test (e.g. Big Five). Questions live in personality_test_questions.
const personalityTestSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  intro: { type: String, default: '' },
  // answer scale shown for every question of this test
  scale: {
    min: { type: Number, default: 1 },
    max: { type: Number, default: 5 },
    labels: { type: [String], default: [] },
  },
  // how a finished test is turned into trait values (see src/personality/scoring.js)
  scoring: {
    method: { type: String, default: 'likert_mean' },
    // confidence assigned to traits measured by this test
    confidence: { type: Number, default: 0.7, min: 0, max: 1 },
  },
  // position in the test list
  order: { type: Number, default: 100 },
  enabled: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
}, { timestamps: true, collection: 'personality_tests' });

module.exports = mongoose.model('PersonalityTest', personalityTestSchema);
