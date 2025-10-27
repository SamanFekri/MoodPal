const moodConstants = require('./mood.constant');
const msgConstants = require('./msg.constant');
const reportConstants = require('./report.constant');
const shareConstants = require('./share.constant');
const commonConstant = require('./common.constant')

module.exports = {
  ...moodConstants,
  msgs: msgConstants,
  report: reportConstants,
  share: shareConstants,
  common: commonConstant
};