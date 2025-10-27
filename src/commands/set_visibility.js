const { msgs, common } = require('../constants');

async function setMoodPrivate(ctx) {
  try {
    // change ctx user in db
    ctx.user.is_mood_private = true;
    await ctx.user.save().then(() => {
      ctx.reply(msgs.moodPrivateMsg(), {
        parse_mode: 'HTML',
        reply_markup: {keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true}
      });
    }
    );
  } catch (error) {
    console.error('Error in set_mood command:', error);
  }
}

async function setMoodPublic(ctx) {
  try {
    // change ctx user in db
    ctx.user.is_mood_private = false;
    await ctx.user.save().then(() => {
      ctx.reply(msgs.moodPublicMsg(ctx.user.id), {
        parse_mode: 'HTML',
        reply_markup: {keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true}
      });
    }
    );
  } catch (error) {
    console.error('Error in set_mood command:', error);
  }
}

module.exports = {
  setMoodPrivate: setMoodPrivate,
  setMoodPublic: setMoodPublic,
}