const path = require('path');

const Mood = require('../models/mood');
const User = require('../models/user');

async function getMoodOfUser(userId) {
  // get the user from the database
  const user = await User.getUserById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.httpCode = 404;
    throw error;
  }
  // if user is_mood_private then return user not found
  if (user.is_mood_private) {
    const error = new Error('User not found');
    error.httpCode = 404;
    throw error;
  }
  // Read the last mood of the user from the database
  const lastMood = await Mood.getLastMood(user._id);
  if (!lastMood) {
    const error = new Error('No mood found for this user');
    error.httpCode = 404;
    throw error;
  }
  return lastMood;
}


const animatedMood = async (req, res) => {
  const userId = req.params.userId;
  try {
    const lastMood = await getMoodOfUser(userId);
    // with the mood code pass webp in the public file
    const moodCode = lastMood.mood.code;
    const moodFilePath = path.join(__dirname, '..', 'public', 'moods', `${moodCode}.webp`);
    res.sendFile(moodFilePath);

  } catch (error) {
    console.error('Error fetching mood:', error);
    let httpCode = error.httpCode || 500;
    res.status(httpCode).json({ error: error.message });
  }
}

const tgsMood = async (req, res) => {
  const userId = req.params.userId;
  try {
    const moodCode = lastMood.mood.code;
    const moodFilePath = path.join(__dirname, '..', 'public', 'tgs', `${moodCode}.tgs`);
    res.sendFile(moodFilePath);
  } catch (error) {
    console.error('Error fetching mood:', error);
    let httpCode = error.httpCode || 500;
    res.status(httpCode).json({ error: error.message });
  }
}

const emojiMood = async (req, res) => {
  const userId = req.params.userId;
  try {
    const lastMood = await getMoodOfUser(userId);
    // return the emoji of the mood
    res.send(lastMood.mood.emoji);
  } catch (error) {
    console.error('Error fetching mood:', error);
    let httpCode = error.httpCode || 500;
    res.status(httpCode).json({ error: error.message });
  }
}

module.exports = {
  animatedMood,
  emojiMood,
  tgsMood
}