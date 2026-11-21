const i18n = require('../i18n');

module.exports = async (ctx) => {
  try {
    await ctx.reply(i18n.forCtx(ctx).helpMsg());
  } catch (error) {
    console.error('Error in help command:', error);
  }
};