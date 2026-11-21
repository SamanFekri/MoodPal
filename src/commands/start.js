const { moodKeyboard, share, common } = require('../constants');
const i18n = require('../i18n');
const User = require('../models/user');
const Share = require('../models/share');

module.exports = async (ctx) => {
  const msgs = i18n.forCtx(ctx);
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

          // the request is read by the other person, so it's in their language
          const theirs = i18n.forUser(followed);
          await ctx.telegram.sendMessage(
            followed.id,
            theirs.askForShareMoodMsg(ctx.user),
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: share.ALLOW_SHARE_MOOD_INLINE_KEYBOARD(ctx.user, theirs),
              },
            }
          );
          await ctx.reply(msgs.waitingForShareMsg(followed), { parse_mode: 'HTML' });
          break;
        // t.me/<bot>?start=year, from the Year in Moods announcement or a shared video
        case 'year':
          await ctx.reply(msgs.welocmeMsg(ctx.user.first_name), { parse_mode: 'HTML', reply_markup: { keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true } });
          await require('./report').yearInMoods(ctx);
          break;
        // t.me/<bot>?start=mbti, from a shared MBTI-style result: welcome, then straight into the test
        case 'mbti':
          await ctx.reply(msgs.welocmeMsg(ctx.user.first_name), { parse_mode: 'HTML', reply_markup: { keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true } });
          await require('./personality').startTestByKey(ctx, 'mbti');
          break;
      }
      return;
    }
    await ctx.reply(msgs.welocmeMsg(ctx.user.first_name),
     { 
      parse_mode: 'HTML', 
      reply_markup: {keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true}
    });
    await ctx.reply(msgs.chooseMoodMsg(), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: moodKeyboard(msgs),
      },
    });
  } catch (error) {
    console.error('Error in start command:', error);
  }
};