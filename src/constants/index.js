const moodConstants = require('./mood.constant');
const { welocmeMsg, chooseMoodMsg } = require('./msg.constant');
module.exports = {
  ...moodConstants,
  msgs: {
    welocmeMsg,
    chooseMoodMsg
  }
}