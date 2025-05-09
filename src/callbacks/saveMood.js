const Mood = require('../models/mood');
const { MOOD_MAP } = require('../constants/mood.constant');
const { msgs } = require('../constants');

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
    ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].name)
      .then(() => {
        ctx.telegram.sendMessage(ctx.user.id, MOOD_MAP[code].emoji)
        .then(async () => {
          // wait for a minute
          await new Promise(resolve => setTimeout(resolve, 10000));
          // send a message to the user to add a note
            ctx.telegram.sendMessage(ctx.user.id, msgs.addNoteMsg())
        })
      });
  } catch (error) {
    console.error('Error saving mood:', error);
  }
}