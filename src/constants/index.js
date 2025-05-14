const moodConstants = require('./mood.constant');
const msgConstants = require('./msg.constant');
const reportConstants = require('./report.constant');

module.exports = {
  ...moodConstants,
  msgs: msgConstants,
  report: reportConstants
};