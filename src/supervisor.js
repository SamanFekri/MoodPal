// Start the Telegram bot and keep it started.
//
// bot.launch() checks the token with Telegram once, then long-polls until stopped. If Telegram
// can't be reached at that moment it fails, and the bot used to stay silent until someone
// restarted it. Here it is retried (5s, 10s, 20s ... up to 1 min) for as long as it takes, and
// polling is started again if it ever stops on its own.
const health = require('./health');

const defaultSleep = (ms) => new Promise(r => setTimeout(r, ms));

function superviseBot(bot, { onStarted = () => {}, sleep = defaultSleep, log = console } = {}) {
  let stopping = false;
  const isAuthOrConflict = (err) => [401, 409].includes(err?.code) || [401, 409].includes(err?.response?.error_code);

  const done = (async () => {
    let delay = 5000;
    while (!stopping) {
      health.state.launch_attempts += 1;
      try {
        await bot.launch(() => {
          // polling has started: Telegram is reachable
          health.setPolling(true);
          health.state.last_launch_error = null;
          delay = 5000;
          log.log('Bot started successfully!');
          onStarted();
        });
        health.setPolling(false);
        if (stopping) return;
        log.warn('Polling stopped by itself, starting it again');
        await sleep(2000);
      } catch (err) {
        health.setPolling(false);
        if (stopping) return;
        health.state.last_launch_error = health.describe(err);
        // 409: another instance polls with this token; 401: the token is wrong. Both need a person.
        const wait = isAuthOrConflict(err) ? 60000 : delay;
        log.error(`Bot is not running (${health.state.last_launch_error}). Trying again in ${wait / 1000}s`);
        await sleep(wait);
        delay = Math.min(delay * 2, 60000);
      }
    }
  })();

  return {
    done,
    stop(signal) {
      stopping = true;
      try { bot.stop(signal); } catch {}
    },
  };
}

module.exports = { superviseBot };
