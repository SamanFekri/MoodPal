const mongoose = require('mongoose');

// A made "Year in Moods" video, kept as its Telegram file_id so the same video can be sent again
// instantly while the person's moods for that year haven't changed.
const yearlyVideoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, required: true },
  file_id: { type: String, required: true },
  moods: { type: Number, required: true },   // how many moods it was made from
  made_at: { type: Date, default: Date.now },
}, { timestamps: true, collection: 'yearly_videos' });

yearlyVideoSchema.index({ user: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('YearlyVideo', yearlyVideoSchema);
