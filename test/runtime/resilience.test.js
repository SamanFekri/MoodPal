const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const health = require('../../src/health');
const { harden } = require('../../src/utils/telegram_resilience');
const { superviseBot } = require('../../src/supervisor');
const AppConfig = require('../../src/models/app_config');
const backup = require('../../src/backup/service');
const User = require('../../src/models/user');
const { saveMood } = require('../../src/commands/mood');

const netErr = (code) => Object.assign(new Error(`request to https://api.telegram.org/bot7671047983:AAHsecretTOKEN-123/sendMessage failed, reason: `), { name: 'FetchError', type: 'system', code, errno: code });
const tgErr = (code, description) => Object.assign(new Error(description), { code, description, response: { error_code: code, description } });

function resetHealth() {
  Object.assign(health.state, { enabled: false, polling: false, consecutive_failures: 0, unhandled: [], last_launch_error: null, last_error: null });
  health.enable(null); health.state.enabled = false;
}

describe('staying up when Telegram is unreachable', () => {
  before(async () => { await db.connect(); });
  after(async () => { await db.disconnect(); });
  beforeEach(async () => { await db.clear(); resetHealth(); });
  afterEach(() => resetHealth());

  test('a send that times out before reaching Telegram is retried, other errors are not', async () => {
    const calls = [];
    const fake = { callApi: async (method) => { calls.push(method); if (calls.length <= 2) throw netErr('ETIMEDOUT'); return { ok: true }; } };
    harden(fake, { delays: [1, 1] });
    assert.deepEqual(await fake.callApi('sendMessage', {}), { ok: true });
    assert.equal(calls.length, 3, 'two retries, then it went through');

    let n = 0;
    const reset = harden({ callApi: async () => { n++; throw netErr('ECONNRESET'); } }, { delays: [1, 1] });
    await assert.rejects(reset.callApi('sendMessage', {}));
    assert.equal(n, 1, 'a reset connection may have been delivered, so no retry (no duplicate messages)');

    let m = 0;
    const blocked = harden({ callApi: async () => { m++; throw tgErr(403, 'Forbidden: bot was blocked by the user'); } }, { delays: [1, 1] });
    await assert.rejects(blocked.callApi('sendMessage', {}));
    assert.equal(m, 1);

    let u = 0;
    const polling = harden({ callApi: async () => { u++; throw netErr('ETIMEDOUT'); } }, { delays: [1, 1] });
    await assert.rejects(polling.callApi('getUpdates', {}));
    assert.equal(u, 1, "getUpdates is left to Telegraf's own polling retry");
  });

  test('saving a mood while Telegram times out never becomes an unhandled error (the bot used to stop)', async () => {
    const user = await User.create({ id: 1, first_name: 'Ana' });
    const unhandled = [];
    const onUnhandled = (r) => unhandled.push(r);
    process.on('unhandledRejection', onUnhandled);
    const logged = [];
    const origError = console.error; console.error = (...a) => logged.push(a.join(' '));
    try {
      const ctx = {
        user, callbackQuery: { data: 'mood_happy' },
        answerCbQuery: async () => { throw netErr('ETIMEDOUT'); },
        telegram: { sendMessage: async () => { throw netErr('ETIMEDOUT'); } },
      };
      await saveMood(ctx);
      await new Promise(r => setTimeout(r, 50));
    } finally {
      process.off('unhandledRejection', onUnhandled);
      console.error = origError;
    }
    assert.deepEqual(unhandled, [], 'nothing left unhandled');
    assert.ok(logged.some(l => /mood saved messages failed/.test(l)), 'the failure is logged');
    assert.ok(!logged.some(l => /AAHsecretTOKEN/.test(l)), 'the bot token never reaches the logs');
    assert.equal(await require('../../src/models/mood').countDocuments({ user: user._id }), 1, 'the mood itself was saved');
  });

  test('startup keeps retrying until Telegram is reachable, and restarts polling if it stops', async () => {
    let attempts = 0;
    let release;
    const bot = {
      async launch(onLaunch) {
        attempts += 1;
        if (attempts <= 2) throw netErr('ETIMEDOUT');           // Telegram unreachable at first
        onLaunch();
        if (attempts === 3) return;                              // polling stopped by itself once
        await new Promise(r => { release = r; });                // then runs until stop()
      },
      stop() { release?.(); },
    };
    const waits = [];
    const started = [];
    const sup = superviseBot(bot, { sleep: async (ms) => { waits.push(ms); }, onStarted: () => started.push(attempts), log: { log() {}, warn() {}, error() {} } });
    while (attempts < 4) await new Promise(r => setTimeout(r, 5));
    assert.deepEqual(waits, [5000, 10000, 2000], 'backs off 5s, 10s, then restarts polling after 2s');
    assert.deepEqual(started, [3, 4]);
    assert.equal(health.state.polling, true);
    assert.match(String(health.state.launch_attempts), /^\d+$/);
    sup.stop('SIGTERM');
    await sup.done;
    assert.equal(health.state.polling, false);
  });

  test('health: Telegram not answering or no polling means unhealthy, with the token masked', async () => {
    assert.equal((await health.check({ fresh: true })).healthy, true, 'not monitoring (tests, scripts) counts as healthy');

    health.enable(async () => { throw netErr('ETIMEDOUT'); });
    health.setPolling(true);
    let h = await health.check({ fresh: true });
    assert.equal(h.healthy, false);
    assert.match(h.reasons[0], /Telegram is not answering \(ETIMEDOUT/);
    assert.ok(!JSON.stringify(h).includes('AAHsecretTOKEN'), 'token masked');
    assert.match(h.reasons[0], /bot<token>/);

    health.enable(async () => ({ id: 1 }));
    health.setPolling(false);
    h = await health.check({ fresh: true });
    assert.equal(h.healthy, false);
    assert.match(h.reasons.join(), /not receiving messages/);

    health.setPolling(true);
    assert.equal((await health.check({ fresh: true })).healthy, true);
  });

  test('the heartbeat is only sent when the bot works, so a broken bot triggers the GotYouBro alert', async () => {
    let beats = 0;
    const client = { heartbeat: async () => { beats++; return { healthStatus: 'HEALTHY' }; } };
    health.enable(async () => { throw netErr('ETIMEDOUT'); });
    health.setPolling(true);

    let r = await backup.sendHeartbeat({ client });
    assert.equal(r.skipped, true);
    assert.equal(beats, 0, 'no heartbeat while Telegram is unreachable');
    let cfg = await AppConfig.get();
    assert.equal(cfg.last_heartbeat_status, 'SKIPPED');
    assert.match(cfg.last_heartbeat_message, /bot not working: Telegram is not answering/);
    assert.ok(!cfg.last_heartbeat_message.includes('AAHsecretTOKEN'));

    health.enable(async () => ({ id: 1 }));   // Telegram is back
    r = await backup.sendHeartbeat({ client });
    assert.equal(beats, 1, 'heartbeats resume on their own');
    cfg = await AppConfig.get();
    assert.equal(cfg.last_heartbeat_status, 'HEALTHY');
  });

  test('GET /healthz answers 200 when working and 503 with reasons when not', async () => {
    const { app } = require('../../src/server');
    const server = app.listen(0);
    const url = `http://127.0.0.1:${server.address().port}/healthz`;
    try {
      health.enable(async () => ({ id: 1 }));
      health.setPolling(true);
      let r = await fetch(url);
      assert.equal(r.status, 200);
      assert.equal((await r.json()).healthy, true);

      health.setPolling(false);
      r = await fetch(url);
      assert.equal(r.status, 503);
      assert.match((await r.json()).reasons.join(), /not receiving messages/);
    } finally { server.close(); }
  });
});
