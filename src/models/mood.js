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

// Add a method to add a note to the mood
moodSchema.methods.addNote = function(note) {
  this.note = note;
  return this.save();
};

// Add a method to get last mood of a user
moodSchema.statics.getLastMood = async function(userId) {
  const lastMood = await this.findOne({ user: userId }).sort({ timestamp: -1 });
  return lastMood;
};



module.exports = mongoose.model('Mood', moodSchema);