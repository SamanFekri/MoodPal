// Is the bot actually working? Used to decide whether to send the health heartbeat (so a broken
// bot stops pinging and GotYouBro alerts the admin), and by GET /healthz for Docker.
//
// Working means: polling is running and Telegram answered recently. Long polling gets an answer at
// least every ~50s while Telegram is reachable, so a success in the last RECENT_OK_MS is proof
// enough; only without one do we ask Telegram directly (getMe). Other errors in the app (OpenAI,
// database, a user who blocked the bot) say nothing about this and never count.
const PROBE_TIMEOUT_MS = 15000;
const RECENT_OK_MS = 2 * 60 * 1000;
const STARTUP_GRACE_MS = 2 * 60 * 1000;   // right after a restart, give polling time to start

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
// just after the process starts, wait (up to maxMs) for polling to come up instead of failing
async function waitForPolling(maxMs) {
  const until = Date.now() + maxMs;
  while (!state.polling && Date.now() < until) await new Promise(r => setTimeout(r, 1000));
}

async function check({ fresh = false } = {}) {
  if (!state.enabled) return { healthy: true, reasons: [], monitored: false };
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.result;
  if (!state.polling && Date.now() - state.started_at.getTime() < STARTUP_GRACE_MS) await waitForPolling(60000);

  const reasons = [];
  if (!state.polling) {
    reasons.push(`not receiving messages from Telegram (bot not started${state.last_launch_error ? `: ${state.last_launch_error}` : ''})`);
  } else {
    const recentlyOk = state.last_ok_at && Date.now() - state.last_ok_at.getTime() < RECENT_OK_MS;
    if (!recentlyOk && probe) {
      try {
        await withTimeout(probe(), PROBE_TIMEOUT_MS);
        markOk();
      } catch (err) {
        markError(err);
        reasons.push(`Telegram is not answering (${describe(err)})`);
      }
    }
  }
  const result = { healthy: reasons.length === 0, reasons, monitored: true };
  cached = { at: Date.now(), result };
  return result;
}

const snapshot = () => ({ ...state, unhandled: state.unhandled.length });

module.exports = { redact, describe, state, enable, setPolling, markUpdate, markOk, markError, noteUnhandled, isNetworkError, check, snapshot };
