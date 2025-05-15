const moodConstants = require('./mood.constant');
const msgConstants = require('./msg.constant');
const reportConstants = require('./report.constant');
const shareConstants = require('./share.constant');

module.exports = {
  ...moodConstants,
  msgs: msgConstants,
  report: reportConstants,
  share: shareConstants
};