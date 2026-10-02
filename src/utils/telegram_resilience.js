// Make a Telegraf `Telegram` client ride out short network trouble.
//
// Every Bot API call reports to src/health.js. Calls that fail before reaching Telegram (connect
// timeout, DNS, connection refused) are retried twice with a short pause; those never arrived, so
// retrying can't send anything twice. getUpdates is left alone: Telegraf's polling retries it itself.
const health = require('../health');

// failures where the request never got to Telegram
const RETRYABLE = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT']);
const DELAYS_MS = [1000, 3000];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function harden(telegram, { delays = DELAYS_MS } = {}) {
  if (!telegram || telegram.__hardened) return telegram;
  const original = telegram.callApi.bind(telegram);
  telegram.callApi = async function (method, ...args) {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await original(method, ...args);
        health.markOk();
        return result;
      } catch (err) {
        if (err?.name !== 'AbortError') health.markError(err);
        const retry = method !== 'getUpdates' && attempt < delays.length && (RETRYABLE.has(err?.code) || RETRYABLE.has(err?.errno));
        if (!retry) throw err;
        await sleep(delays[attempt]);
      }
    }
  };
  telegram.__hardened = true;
  return telegram;
}

module.exports = { harden, RETRYABLE };
