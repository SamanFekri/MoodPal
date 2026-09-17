const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mood: {
    type: Object,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  },
});

moodSchema.index({ user: 1, timestamp: -1 });

// Add a method to add a note to the mood
moodSchema.methods.addNote = function(note) {
  this.note = note;
  return this.save();
};

// get last mood of a user
moodSchema.statics.getLastMood = async function(userId) {
  const lastMood = await this.findOne({ user: userId }).sort({ timestamp: -1 }).populate('user');
  return lastMood;
};

/**
 * @function getLastWeekMoods
 * @param {string|mongoose.Types.ObjectId} userId - The ID of the user.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of mood objects 
 * for the last 7 days, containing only mood, note, and timestamp.
 */
moodSchema.statics.getLastWeekMoods = async function(userId) {
  // 1. Calculate the date from 7 days ago
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // 2. Find all moods for the user where the timestamp is greater than or equal to 7 days ago.
  // 3. Sort them from newest to oldest (-1).
  // 4. Use .select() to include only the requested fields: 'mood', 'note', and 'timestamp'.
  const lastWeekMoods = await this.find({
    user: userId,
    timestamp: { $gte: oneWeekAgo }
  })
  .sort({ timestamp: -1 })
  .select('mood note timestamp -_id'); // -_id excludes the default _id field

  return lastWeekMoods;
};


module.exports = mongoose.model('Mood', moodSchema);