// Blocked users (set by an admin in the mini app) are ignored by the bot: their
// updates stop here, so no handler runs and nothing is stored for them.
const blockMiddleware = async (ctx, next) => {
  if (ctx.user?.is_blocked) {
    console.log(`Ignoring update from blocked user ${ctx.user.id}`);
    return;
  }
  return next();
};

module.exports = blockMiddleware;
