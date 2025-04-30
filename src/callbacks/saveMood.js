const Mood = require('../models/mood');
const { MOOD_MAP } = require('../constants/mood.constant');

module.exports = async (ctx) => {
  console.log('hi')
  try {
    const code = ctx.callbackQuery.data.split('_')[1];
    const userId = ctx.user._id;
    let mood = new Mood({
      user: userId,
      mood: MOOD_MAP[code],
    });
    mood = await mood.save();
    ctx.answerCbQuery('Mood saved successfully!');
  } catch (error) {
    console.error('Error saving mood:', error);
  }
}