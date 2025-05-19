const { MOOD_INLINE_KEYBOARD, msgs, share } = require('../constants');
const User = require('../models/user');
const Share = require('../models/share');

module.exports = async (ctx) => {
  try {
    // if there is a start parameter, it means that the user is coming from a link
    if (ctx.payload) {
      let params = ctx.payload.split('-');
      switch (params[0]) {
        case 'sm':
          const followed = await User.findById(params[1]);
          if (followed.id === ctx.user.id) {
            break;
          }
          // if you already shared your mood, don't ask for it again
          const isShared = await Share.findOne({ follower: ctx.user._id, followed: followed._id, disabled: false });
          if (isShared) {
            await ctx.reply(msgs.hasAlreadySharedMsg(followed), { parse_mode: 'HTML' });
            return;
          }

          await ctx.telegram.sendMessage(
            followed.id,
            msgs.askForShareMoodMsg(ctx.user),
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: share.ALLOW_SHARE_MOOD_INLINE_KEYBOARD(ctx.user),
              },
            }
          );
          ctx.reply(msgs.waitingForShareMsg(followed), { parse_mode: 'HTML' });
          break;
      }
      return;
    }
    ctx.reply(msgs.welocmeMsg(ctx.user.first_name), { parse_mode: 'HTML', });
    ctx.reply(msgs.chooseMoodMsg(), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: MOOD_INLINE_KEYBOARD,
      },
    });
  } catch (error) {
    console.error('Error in start command:', error);
  }
};