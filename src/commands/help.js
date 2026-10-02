const { msgs } = require('../constants');

module.exports = async (ctx) => {
  try {
    await ctx.reply(msgs.helpMsg());
  } catch (error) {
    console.error('Error in help command:', error);
  }
};