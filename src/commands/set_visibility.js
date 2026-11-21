const { common } = require('../constants');
const i18n = require('../i18n');

async function setMoodPrivate(ctx) {
  try {
    // change ctx user in db
    ctx.user.is_mood_private = true;
    await ctx.user.save().then(() => {
      return ctx.reply(i18n.forCtx(ctx).moodPrivateMsg(), {
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
      return ctx.reply(i18n.forCtx(ctx).moodPublicMsg(ctx.user.id), {
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