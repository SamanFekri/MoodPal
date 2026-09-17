const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/secret');

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
  },
  is_mood_private: {
    type: Boolean,
    default: false
  },
  // Admins can see everyone's moods and notes in the mini app. Set by hand in the database:
  //   db.users.updateOne({ id: <telegram id> }, { $set: { is_admin: true } })
  is_admin: {
    type: Boolean,
    default: false
  },
  // Personality sharing: friends who follow this user (and anyone with the public link) can see it
  is_personality_shared: {
    type: Boolean,
    default: false
  },
  personality_share_token: {
    type: String,
    default: null,
    index: true
  },
  // which menu layout this user's Telegram client currently has (see MENU_SIGNATURE)
  menu_signature: {
    type: String,
    default: null
  },
  // last time the user interacted with the bot; drives "most recently active" ordering
  last_active_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  // User's own OpenAI key for AI mood insights. Stored encrypted and never
  // selected by default so it can't leak through populate() or API responses.
  openai_api_key: {
    type: String,
    default: null,
    select: false
  },
}, { timestamps: true });

// One-off: give users created before last_active_at existed a sensible value
userSchema.statics.backfillLastActive = async function() {
  const result = await this.updateMany(
    { last_active_at: { $exists: false } },
    [{ $set: { last_active_at: { $ifNull: ['$updatedAt', { $ifNull: ['$createdAt', '$$NOW'] }] } } }]
  );
  return result.modifiedCount;
};

// Method get user by id
userSchema.statics.getUserById = async function(userId) {
  const user = await this.findOne({ id: userId });
  return user;
}

// Store the user's OpenAI key encrypted (null removes it)
userSchema.statics.setOpenAIKey = async function(userId, apiKey) {
  await this.updateOne({ _id: userId }, { openai_api_key: apiKey ? encrypt(apiKey) : null });
};

// Returns the decrypted key or null if the user has not set one
userSchema.statics.getOpenAIKey = async function(userId) {
  const user = await this.findById(userId).select('+openai_api_key');
  if (!user || !user.openai_api_key) return null;
  try {
    return decrypt(user.openai_api_key);
  } catch (error) {
    console.error('Failed to decrypt OpenAI key for user', userId, error.message);
    return null;
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;
