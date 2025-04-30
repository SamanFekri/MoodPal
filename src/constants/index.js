const moodConstants = require('./mood.constant');
const msgConstants = require('./msg.constant');

module.exports = {
  ...moodConstants,
  msgs: msgConstants
};