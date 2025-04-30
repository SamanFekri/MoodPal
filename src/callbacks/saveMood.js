const Mood = require('../models/mood');
const { MOOD_MAP } = require('../constants/mood.constant');

module.exports = async (ctx) => {
  try {
    const code = ctx.callbackQuery.data.split('_')[1];
    const userId = ctx.user._id;
    let mood = new Mood({
      user: userId,
      mood: MOOD_MAP[code],
    });
    mood = await mood.save();
    ctx.answerCbQuery('Mood saved successfully!');
    ctx.telegram.sendMessage(ctx.user.id, 'Your mood is:')
      .then(() => {
        ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].emoji)
          .then(() => {
            ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].name);
          });
      });
  } catch (error) {
    console.error('Error saving mood:', error);
  }
}