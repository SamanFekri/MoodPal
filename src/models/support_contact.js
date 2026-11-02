const mongoose = require('mongoose');

// An emergency (support) friend: `contact` gets automatic alerts about `user` once they accept.
// Removing one deletes the row; declining keeps it, so the person isn't asked again and again.
const supportContactSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  invited_at: { type: Date, default: Date.now },
  answered_at: { type: Date, default: null },
}, { timestamps: true, collection: 'support_contacts' });

supportContactSchema.index({ user: 1, contact: 1 }, { unique: true });
supportContactSchema.index({ contact: 1, status: 1 });

module.exports = mongoose.model('SupportContact', supportContactSchema);
