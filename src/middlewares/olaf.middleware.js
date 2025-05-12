require('dotenv').config();
const Cache = require('../utils/cache'); // Assuming you have a Cache utility

// CACHE
const cache = new Cache(1000 * 60 * 60);

const olafCaption = (user) => `
👤 ${user.first_name} ${user.last_name}
🫆 <code>${user.id}</code>
${user.username ? `🆔 @${user.username}` : ''}`

const olafMiddleware = async (ctx, next) => {
  try {
    // from the ctx.user.id get profile picture of the user
    const userId = ctx.user.id;
    const c = cache.get(userId);
    if (c) {
      next();
      return
    }
    else {
      // set user in cache
      cache.set(userId, ctx.user);
    }
    const user = await ctx.telegram.getUserProfilePhotos(userId);
    cache.set(userId, user);

    if (user.total_count === 0) { // if user has no profile picture
      await ctx.telegram.sendMessage(process.env.OLAF_CHANNEL_ID, olafCaption(ctx.user), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '👤 View Profile',
                url: `tg://user?id=${userId}`,
              },
            ],
          ],
        },
      });
    } else { // if user has profile picture
      await ctx.telegram.sendPhoto(process.env.OLAF_CHANNEL_ID, user.photos[0][0].file_id, {
        caption: olafCaption(ctx.user),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '👤 View Profile',
                url: `tg://user?id=${userId}`,
              },
            ],
          ],
        },
      });
    }
  } catch (error) {
    console.error('Error in olafMiddleware:', error);
  }
  next();
};

module.exports = olafMiddleware;``