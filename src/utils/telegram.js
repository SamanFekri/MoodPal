// Bot API client for code that runs outside the Telegraf update loop (e.g. the mini app API).
const { Telegram } = require('telegraf');

const { harden } = require('./telegram_resilience');

let client = null;
// retries short network failures and reports to src/health.js (see telegram_resilience.js)
const getTelegram = () => (client ||= harden(new Telegram(process.env.BOT_TOKEN)));
// tests inject a fake
const setTelegram = (t) => { client = t; };

module.exports = { getTelegram, setTelegram };
