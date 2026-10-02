const { msgs } = require('../constants');

module.exports = async (ctx) => {
  try {
    await ctx.reply(msgs.notImplementedMsg());
    // send emoji of a worker
    await ctx.telegram.sendMessage(ctx.user.id, '👷‍♂️');
  } catch (error) {
    console.error('Error in not implemented command:', error);
  }
};