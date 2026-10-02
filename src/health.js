// Is the bot actually working? Used to decide whether to send the health heartbeat (so a broken
// bot stops pinging and GotYouBro alerts the admin), and by GET /healthz for Docker.
//
// Working means: we are receiving updates from Telegram (polling is running), and Telegram answers
// right now (a quick getMe). Telegram calls made anywhere in the app report success or failure here.
const PROBE_TIMEOUT_MS = 10000;

// Telegram network errors carry the request URL, which contains the bot token: never store or log it
const redact = (text) => String(text ?? '').replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<token>');
const describe = (err) => redact([err?.code, err?.description || err?.message].filter(Boolean).join(' ')).slice(0, 200);
const CACHE_MS = 20000;

const state = {
  enabled: false,              // only the real bot process monitors itself (not tests or scripts)
  started_at: new Date(),
  polling: false,
  polling_since: null,
  launch_attempts: 0,
  last_launch_error: null,
  last_update_at: null,        // last update received from Telegram
  last_ok_at: null,            // last successful Telegram API call
  last_error: null,
  last_error_at: null,
  consecutive_failures: 0,
  unhandled: [],               // timestamps of errors caught by the process-wide safety net
};
let probe = null;              // () => Promise, set by the bot (telegram.getMe)
let cached = null;

const enable = (probeFn) => { state.enabled = true; probe = probeFn; };
const setPolling = (on) => {
  state.polling = on;
  state.polling_since = on ? new Date() : null;
  cached = null;
};
const markUpdate = () => { state.last_update_at = new Date(); };
const markOk = () => { state.last_ok_at = new Date(); state.consecutive_failures = 0; };
const markError = (err) => {
  state.last_error = describe(err) || 'error';
  state.last_error_at = new Date();
  // only network-level failures say anything about the bot's health; a 403 from one user doesn't
  if (isNetworkError(err)) state.consecutive_failures += 1;
};
const noteUnhandled = () => {
  const now = Date.now();
  state.unhandled = state.unhandled.filter(t => now - t < 10 * 60 * 1000);
  state.unhandled.push(now);
};

const NETWORK_CODES = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'ESOCKETTIMEDOUT']);
function isNetworkError(err) {
  return Boolean(err) && (NETWORK_CODES.has(err.code) || NETWORK_CODES.has(err.errno) || err.type === 'system' || err.name === 'FetchError' || err.name === 'AbortError');
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(`timed out after ${ms / 1000}s`), { code: 'ETIMEDOUT' })), ms))]);

/**
 * { healthy, reasons[] }. Not monitoring (tests, one-off scripts) counts as healthy.
 * The Telegram probe is cached for a few seconds so /healthz can be polled freely.
 */
async function check({ fresh = false } = {}) {
  if (!state.enabled) return { healthy: true, reasons: [], monitored: false };
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.result;
  const reasons = [];
  // ask Telegram first: if it answers now, earlier failed calls no longer count
  if (probe) {
    try {
      await withTimeout(probe(), PROBE_TIMEOUT_MS);
      markOk();
    } catch (err) {
      markError(err);
      reasons.push(`Telegram is not answering (${describe(err)})`);
    }
  }
  if (!state.polling) reasons.push(`not receiving messages from Telegram (bot not started${state.last_launch_error ? `: ${state.last_launch_error}` : ''})`);
  if (state.consecutive_failures >= 3 && !reasons.length) reasons.push(`the last ${state.consecutive_failures} Telegram calls failed (${state.last_error})`);
  if (state.unhandled.length >= 5) reasons.push(`${state.unhandled.length} unexpected errors in the last 10 minutes`);
  const result = { healthy: reasons.length === 0, reasons, monitored: true };
  cached = { at: Date.now(), result };
  return result;
}

const snapshot = () => ({ ...state, unhandled: state.unhandled.length });

module.exports = { redact, describe, state, enable, setPolling, markUpdate, markOk, markError, noteUnhandled, isNetworkError, check, snapshot };
