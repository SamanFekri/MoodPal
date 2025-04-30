const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String
  },
  first_name: String,
  last_name: String,
  is_bot: {
    type: Boolean,
    default: false
  },
  language_code: String,
  is_premium: Boolean,
  is_blocked: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
