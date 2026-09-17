// Keeps every user's reply keyboard up to date. Telegram clients cache the last keyboard
// the bot sent, so after a menu change users would keep seeing the old one until some
// handler happened to send a keyboard. This pushes the current layout on their next message.
const { common } = require('../constants');
const User = require('../models/user');
const chatService = require('../chat/service');

const menuMiddleware = async (ctx, next) => {
  try {
    const isStart = /^\/start\b/.test(ctx.message?.text || '');   // /start sends the menu itself
    if (ctx.user && ctx.chat?.type === 'private' && ctx.message && !isStart && ctx.user.menu_signature !== common.MENU_SIGNATURE) {
      const inTalk = Boolean(await chatService.getActive(ctx.user._id));
      const keyboard = inTalk ? common.makeTalkKeyboard() : common.makeKeyboardMenu(ctx);
      await ctx.reply('🆕 Your menu has been updated.', { reply_markup: { keyboard, resize_keyboard: true } });
      await User.updateOne({ _id: ctx.user._id }, { menu_signature: common.MENU_SIGNATURE });
      ctx.user.menu_signature = common.MENU_SIGNATURE;
    }
  } catch (error) {
    console.error('Error in menuMiddleware:', error);
  }
  return next();
};

module.exports = menuMiddleware;
