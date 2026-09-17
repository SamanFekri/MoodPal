const mongoose = require('mongoose');

// Progress and result of one attempt at a test.
const personalityTestSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  test_key: { type: String, required: true },
  status: { type: String, enum: ['in_progress', 'completed', 'cancelled'], default: 'in_progress', index: true },
  // index into the ordered question list of the next question to ask
  current_index: { type: Number, default: 0 },
  answers: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalityTestQuestion' },
    order: Number,
    value: Number,
  }],
  // trait key -> 0..1, filled when completed
  scores: { type: Map, of: Number, default: {} },
  completed_at: Date,
  // telegram message that shows the current question, so it can be edited in place
  message_id: Number,
  chat_id: Number,
}, { timestamps: true, collection: 'personality_test_sessions' });

personalityTestSessionSchema.statics.findActive = function (userId) {
  return this.findOne({ user: userId, status: 'in_progress' }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('PersonalityTestSession', personalityTestSessionSchema);
