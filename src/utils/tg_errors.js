// Log a failed Telegram call instead of letting it become an unhandled rejection (which would
// stop the whole bot). Usage: ctx.reply(...).catch(logTelegramError('reply'))
const { describe } = require('../health');

const logTelegramError = (what) => (err) => {
  console.error(`Telegram ${what} failed: ${describe(err)}`);
};

module.exports = { logTelegramError };
