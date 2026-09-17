const mongoose = require('mongoose');

const personalityTestQuestionSchema = new mongoose.Schema({
  test_key: { type: String, required: true, index: true },
  order: { type: Number, required: true },
  text: { type: String, required: true },
  // trait key from personality_traits this item measures
  trait: { type: String, required: true },
  // reverse-keyed item: high agreement means a LOW trait value
  reverse: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
}, { timestamps: true, collection: 'personality_test_questions' });

personalityTestQuestionSchema.index({ test_key: 1, order: 1 }, { unique: true });

personalityTestQuestionSchema.statics.getForTest = function (testKey) {
  return this.find({ test_key: testKey, enabled: true }).sort({ order: 1 }).lean();
};

module.exports = mongoose.model('PersonalityTestQuestion', personalityTestQuestionSchema);
