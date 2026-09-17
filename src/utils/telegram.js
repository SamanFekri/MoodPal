// Bot API client for code that runs outside the Telegraf update loop (e.g. the mini app API).
const { Telegram } = require('telegraf');

let client = null;
const getTelegram = () => (client ||= new Telegram(process.env.BOT_TOKEN));
// tests inject a fake
const setTelegram = (t) => { client = t; };

module.exports = { getTelegram, setTelegram };
