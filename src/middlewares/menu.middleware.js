// Keeps every user's reply keyboard up to date. Telegram clients cache the last keyboard
// the bot sent, so after a menu change users would keep seeing the old one until some
// handler happened to send a keyboard. This pushes the current layout on their next message.
const { common } = require('../constants');
const User = require('../models/user');
const chatService = require('../chat/service');
const i18n = require('../i18n');

const menuMiddleware = async (ctx, next) => {
  try {
    const isStart = /^\/start\b/.test(ctx.message?.text || '');   // /start sends the menu itself
    if (ctx.user && ctx.chat?.type === 'private' && ctx.message && !isStart && ctx.user.menu_signature !== common.menuSignature(ctx.user.language)) {
      const inTalk = Boolean(await chatService.getActive(ctx.user._id));
      const keyboard = inTalk ? common.makeTalkKeyboard(ctx) : common.makeKeyboardMenu(ctx);
      await ctx.reply(i18n.forCtx(ctx).menuUpdatedMsg(), { reply_markup: { keyboard, resize_keyboard: true } });
      const signature = common.menuSignature(ctx.user.language);
      await User.updateOne({ _id: ctx.user._id }, { menu_signature: signature });
      ctx.user.menu_signature = signature;
    }
  } catch (error) {
    console.error('Error in menuMiddleware:', error);
  }
  return next();
};

module.exports = menuMiddleware;
