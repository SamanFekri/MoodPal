// middleware to check if the user is in the main channel
// if not, ask him to join the main channel
require('dotenv').config();

// CACHE
const cache = new Cache(1000 * 60 * 60);

const joinMsg = `Please join the MoodPals channel so we can notify you to set your mood.`

const joinButton = {
  text: 'Join',
  url: `https://t.me/${process.env.MAIN_CHANNEL_ID}`
}


const joinMiddleware = async (ctx, next) => {
  const chatId = process.env.MAIN_CHANNEL_ID;
  const userId = ctx.from.id;
  const user = await ctx.telegram.getChatMember(chatId, userId);
  // if user is in the main channel, continue
  if (user.status === 'member' || user.status === 'creator' || user.status === 'administrator') {
    next();
    return;
  }
  // if user is not in the main channel, ask him to join the main channel
  await ctx.reply(joinMsg, {
    reply_markup: {
      inline_keyboard: [[joinButton]]
    }
  });
  next();
};

module.exports = joinMiddleware;