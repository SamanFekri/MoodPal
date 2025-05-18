// middleware to check if the user is in the main channel
// if not, ask him to join the main channel
require('dotenv').config();
const Cache = require('../utils/cache');

// CACHE
const cache = new Cache(1000 * 60 * 60);

const joinMsg = `🤩 Please join the MoodPals channel so we can notify you to set your mood.`

const joinButton = {
  text: '👉 Join',
  url: `https://t.me/@${process.env.MAIN_CHANNEL_USERNAME}`
}


const joinMiddleware = async (ctx, next) => {
  // Call next() first to continue the middleware chain
  next();

  try {
    const c = cache.get(ctx.from.id);
    if (c) {
      return;
    }
    else {
      cache.set(ctx.from.id, ctx.from);
    }

    const chatId = process.env.MAIN_CHANNEL_ID;
    const userId = ctx.from.id;
    const user = await ctx.telegram.getChatMember(chatId, userId);
    // if user is in the main channel, continue
    if (user.status === 'member' || user.status === 'creator' || user.status === 'administrator') {
      return;
    }
    // if user is not in the main channel, ask him to join the main channel
    await ctx.reply(joinMsg, {
      reply_markup: {
        inline_keyboard: [[joinButton]]
      }
    });
  } catch (error) {
    // if user is not in the main channel, ask him to join the main channel
    await ctx.reply(joinMsg, {
      reply_markup: {
        inline_keyboard: [[joinButton]]
      }
    });
    console.error(error);
  }
};

module.exports = joinMiddleware;