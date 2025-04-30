const { msgs } = require('../constants');

module.exports = async (ctx) => {
  try {
    ctx.reply(msgs.notImplementedMsg())
      .then(() => {
        // send emoji of a worker
        ctx.telegram.sendMessage(ctx.user.id, '👷‍♂️')
      });
  } catch (error) {
    console.error('Error in not implemented command:', error);
  }
};