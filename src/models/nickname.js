const mongoose = require('mongoose');

// The name `owner` uses for `target` in the mini app and in bot messages owner gets about them.
// Private to the owner: the target is never told.
const nicknameSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 32 },
}, { timestamps: true, collection: 'nicknames' });

nicknameSchema.index({ owner: 1, target: 1 }, { unique: true });

module.exports = mongoose.model('Nickname', nicknameSchema);
