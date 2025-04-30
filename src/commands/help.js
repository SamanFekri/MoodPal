const { msgs } = require('../constants');

module.exports = async (ctx) => {
  try {
    ctx.reply(msgs.helpMsg())
  } catch (error) {
    console.error('Error in help command:', error);
  }
};