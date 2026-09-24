const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const AdmZip = require('adm-zip');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const AppConfig = require('../../src/models/app_config');
const backup = require('../../src/backup/service');
const { GotYouBroClient, GotYouBroError } = require('../../src/backup/gotyoubro');
const { timeToCron } = require('../../src/backup/scheduler');

// a client that records uploads instead of calling the network
function fakeClient({ failOn = [] } = {}) {
  const uploads = [];
  let attempt = 0;                     // count attempts, not successes, so failOn targets a part
  return {
    uploads,
    async uploadBackup(buffer, filename, opts) {
      attempt += 1;
      if (failOn.includes(attempt)) throw new GotYouBroError('Telegram rejected the upload', { status: 502, code: 'TELEGRAM_DELIVERY_FAILED' });
      uploads.push({ buffer, filename, opts });
      return { id: `bk_${uploads.length}`, status: 'RECEIVED', filename };
    },
    async heartbeat() { return { serviceId: 'svc_1', healthStatus: 'HEALTHY', recovered: false }; },
    async describeService() { return { id: 'svc_1', name: 'MoodPal' }; },
  };
}

async function seed({ users = 3, moods = 5 } = {}) {
  for (let u = 0; u < users; u++) {
    const user = await User.create({ id: 1000 + u, first_name: `U${u}`, username: `u${u}` });
    for (let m = 0; m < moods; m++) {
      await Mood.create({ user: user._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' }, note: `note ${u}-${m}`, timestamp: new Date(Date.now() - m * 60000) });
    }
  }
}

describe('backup', () => {
  before(async () => { await db.connect(); });
  after(async () => { await db.disconnect(); });
  beforeEach(async () => { await db.clear(); });

  describe('building parts', () => {
    test('produces a zip with a manifest and one ndjson per collection', async () => {
      await seed();
      const { parts, totalDocuments, backupId } = await backup.buildParts();
      assert.equal(parts.length, 1);
      assert.equal(totalDocuments, 3 + 15);
      assert.match(parts[0].filename, /^moodpal-\d{4}-\d{2}-\d{2}_\d{4}\.zip$/);

      const zip = new AdmZip(parts[0].buffer);
      const names = zip.getEntries().map(e => e.entryName).sort();
      assert.deepEqual(names, ['manifest.json', 'moods.ndjson', 'users.ndjson']);

      const manifest = JSON.parse(zip.readAsText('manifest.json'));
      assert.equal(manifest.format, 'moodpal-backup');
      assert.equal(manifest.version, 1);
      assert.equal(manifest.part, 1);
      assert.equal(manifest.total_parts, 1);
      assert.equal(manifest.backup_id, backupId);
      assert.deepEqual(manifest.collections, { users: 3, moods: 15 });

      const lines = zip.readAsText('users.ndjson').trim().split('\n');
      assert.equal(lines.length, 3);
      assert.ok(JSON.parse(lines[0])._id.$oid, 'ids are written as extended JSON');
    });

    test('never includes app_config, so a restore cannot overwrite the token or schedule', async () => {
      await seed({ users: 1, moods: 1 });
      await AppConfig.setToken('gyb_secret_token_value');
      const { parts } = await backup.buildParts();
      const names = new AdmZip(parts[0].buffer).getEntries().map(e => e.entryName);
      assert.ok(!names.includes('app_config.ndjson'));
      assert.ok(!parts[0].buffer.toString('latin1').includes('gyb_secret'));
      assert.ok(backup.EXCLUDED_COLLECTIONS.has('app_config'));
    });

    test('splits into several parts when the data exceeds the target size', async () => {
      await seed({ users: 40, moods: 6 });   // 280 documents
      const { parts, totalDocuments } = await backup.buildParts({ targetUncompressed: 4000 });
      assert.ok(parts.length > 3, `expected several parts, got ${parts.length}`);
      assert.equal(totalDocuments, 40 + 240);

      let seenDocs = 0;
      parts.forEach((part, i) => {
        assert.ok(part.buffer.length <= backup.MAX_PART_BYTES);
        assert.equal(part.index, i + 1);
        assert.match(part.filename, new RegExp(`part${String(i + 1).padStart(2, '0')}\\.zip$`));
        const manifest = JSON.parse(new AdmZip(part.buffer).readAsText('manifest.json'));
        assert.equal(manifest.part, i + 1);
        assert.equal(manifest.total_parts, parts.length, 'every part knows the total');
        seenDocs += Object.values(manifest.collections).reduce((a, b) => a + b, 0);
      });
      assert.equal(seenDocs, totalDocuments, 'every document lands in exactly one part');
    });

    test('an empty database still produces one valid part', async () => {
      const { parts, totalDocuments } = await backup.buildParts();
      assert.equal(parts.length, 1);
      assert.equal(totalDocuments, 0);
      assert.equal(JSON.parse(new AdmZip(parts[0].buffer).readAsText('manifest.json')).format, 'moodpal-backup');
    });
  });

  describe('uploading', () => {
    test('uploads every part with a per-part idempotency key and records the result', async () => {
      await seed({ users: 20, moods: 4 });
      await AppConfig.setToken('gyb_test_token');
      const client = fakeClient();
      const result = await backup.runBackup({ client, trigger: 'manual' });

      assert.equal(result.status, 'success');
      assert.equal(result.total_documents, 20 + 80);
      assert.equal(client.uploads.length, result.total_parts);
      const keys = client.uploads.map(u => u.opts.idempotencyKey);
      assert.equal(new Set(keys).size, keys.length, 'keys are unique per part');
      assert.ok(keys.every(k => k.startsWith(`moodpal-${result.backupId}-part`)));
      assert.ok(client.uploads.every(u => u.filename.endsWith('.zip')));

      const config = await AppConfig.get();
      assert.equal(config.last_backup_status, 'success');
      assert.equal(config.last_backup_parts, result.total_parts);
      assert.ok(config.last_backup_bytes > 0);
      assert.ok(config.last_backup_at);
    });

    test('a failed part is reported as partial without losing the others', async () => {
      await seed({ users: 30, moods: 5 });
      await AppConfig.setToken('gyb_test_token');
      const client = fakeClient({ failOn: [2] });
      const result = await backup.runBackup({ client, targetUncompressed: 3000 });
      assert.ok(result.total_parts >= 2, 'test needs a multi-part backup');
      assert.equal(result.status, 'partial');
      assert.equal(client.uploads.length, result.total_parts - 1, 'only the failing part is missing');
      assert.ok(result.parts.some(p => p.error));
      assert.equal((await AppConfig.get()).last_backup_status, 'partial');
    });

    test('without a token the backup fails loudly and is recorded', async () => {
      await assert.rejects(backup.runBackup(), /No GotYouBro token/);
      assert.equal((await AppConfig.get()).last_backup_status, 'failed');
    });
  });

  describe('restore', () => {
    test('merge restores documents and leaves unrelated ones alone', async () => {
      await seed({ users: 2, moods: 2 });
      const { parts } = await backup.buildParts();
      const before = { users: await User.countDocuments(), moods: await Mood.countDocuments() };

      await Mood.deleteMany({});
      const survivor = await User.create({ id: 7777, first_name: 'Added later' });

      const summary = await backup.restoreFromZips(parts.map(p => p.buffer), { mode: 'merge' });
      assert.equal(summary.mode, 'merge');
      assert.equal(summary.documents, before.users + before.moods);
      assert.equal(await Mood.countDocuments(), before.moods, 'deleted moods came back');
      assert.ok(await User.findById(survivor._id), 'merge keeps documents that are not in the backup');
      assert.equal(await User.countDocuments(), before.users + 1);
    });

    test('replace empties each collection in the backup first', async () => {
      await seed({ users: 2, moods: 2 });
      const { parts } = await backup.buildParts();
      await User.create({ id: 7777, first_name: 'Added later' });

      const summary = await backup.restoreFromZips(parts.map(p => p.buffer), { mode: 'replace' });
      assert.equal(summary.mode, 'replace');
      assert.equal(await User.countDocuments(), 2, 'the extra user was removed');
      assert.equal(await Mood.countDocuments(), 4);
    });

    test('round trips values exactly (ObjectId refs, Dates, nested mood object)', async () => {
      const user = await User.create({ id: 5150, first_name: 'Round', last_name: 'Trip' });
      const when = new Date('2026-03-04T05:06:07.008Z');
      await Mood.create({ user: user._id, mood: { code: 'sad', emoji: '😢', name: 'Sad' }, note: 'exact', timestamp: when });
      const { parts } = await backup.buildParts();

      await db.clear();
      await backup.restoreFromZips(parts.map(p => p.buffer), { mode: 'replace' });

      const restored = await Mood.findOne({ note: 'exact' });
      assert.equal(restored.timestamp.toISOString(), when.toISOString());
      assert.equal(String(restored.user), String(user._id));
      assert.deepEqual({ ...restored.mood }, { code: 'sad', emoji: '😢', name: 'Sad' });
      assert.equal((await User.findById(user._id)).first_name, 'Round');
    });

    test('a multi-part backup restores from its parts in any order', async () => {
      await seed({ users: 25, moods: 4 });
      const { parts } = await backup.buildParts({ targetUncompressed: 3000 });
      assert.ok(parts.length >= 3);
      const expected = { users: await User.countDocuments(), moods: await Mood.countDocuments() };

      await db.clear();
      const shuffled = [...parts].reverse().map(p => p.buffer);
      const summary = await backup.restoreFromZips(shuffled, { mode: 'merge' });
      assert.equal(summary.parts, parts.length);
      assert.equal(summary.backup_ids.length, 1);
      assert.equal(await User.countDocuments(), expected.users);
      assert.equal(await Mood.countDocuments(), expected.moods);
    });

    test('dry run reports what would happen and writes nothing', async () => {
      await seed({ users: 2, moods: 2 });
      const { parts } = await backup.buildParts();
      await db.clear();

      const summary = await backup.restoreFromZips(parts.map(p => p.buffer), { dryRun: true });
      assert.equal(summary.dry_run, true);
      assert.equal(summary.collections.users.documents, 2);
      assert.equal(await User.countDocuments(), 0, 'nothing was written');
    });

    test('rejects junk, foreign zips and unknown formats before writing anything', async () => {
      await assert.rejects(backup.restoreFromZips([Buffer.from('not a zip at all')]), /not a readable zip|no manifest/i);
      const foreign = new AdmZip(); foreign.addFile('a.txt', Buffer.from('hi'));
      await assert.rejects(backup.restoreFromZips([foreign.toBuffer()]), /manifest/i);
      const wrongFormat = new AdmZip(); wrongFormat.addFile('manifest.json', Buffer.from(JSON.stringify({ format: 'something-else' })));
      await assert.rejects(backup.restoreFromZips([wrongFormat.toBuffer()]), /not a MoodPal backup/);
      const newer = new AdmZip(); newer.addFile('manifest.json', Buffer.from(JSON.stringify({ format: 'moodpal-backup', version: 99 })));
      await assert.rejects(backup.restoreFromZips([newer.toBuffer()]), /newer version/);
      await assert.rejects(backup.restoreFromZips([]), /No backup files/);
      await assert.rejects(backup.restoreFromZips([Buffer.from('x')], { mode: 'nuke' }), /Unknown restore mode/);

      // a good part alongside a bad one writes nothing at all
      await seed({ users: 1, moods: 1 });
      const { parts } = await backup.buildParts();
      await db.clear();
      await assert.rejects(backup.restoreFromZips([parts[0].buffer, foreign.toBuffer()]), /manifest/i);
      assert.equal(await User.countDocuments(), 0, 'the valid part was not applied either');
    });
  });

  describe('heartbeat', () => {
    test('records the health status returned by the service', async () => {
      await AppConfig.setToken('gyb_test_token');
      const result = await backup.sendHeartbeat({ client: fakeClient() });
      assert.equal(result.ok, true);
      assert.equal(result.healthStatus, 'HEALTHY');
      const config = await AppConfig.get();
      assert.equal(config.last_heartbeat_status, 'HEALTHY');
      assert.ok(config.last_heartbeat_at);
    });

    test('records the error when the service cannot be reached', async () => {
      await AppConfig.setToken('gyb_test_token');
      const failing = { heartbeat: async () => { throw new GotYouBroError('Service disabled', { status: 403, code: 'SERVICE_DISABLED' }); } };
      await assert.rejects(backup.sendHeartbeat({ client: failing }), /Service disabled/);
      const config = await AppConfig.get();
      assert.equal(config.last_heartbeat_status, 'ERROR');
      assert.match(config.last_heartbeat_message, /Service disabled/);
    });
  });

  describe('client and schedule helpers', () => {
    test('the API client sends a bearer token and surfaces API error codes', async () => {
      const calls = [];
      const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        if (url.endsWith('/api/v1/service')) return { ok: true, json: async () => ({ success: true, data: { id: 'svc_1' } }) };
        return { ok: false, status: 403, json: async () => ({ success: false, error: { code: 'SERVICE_DISABLED', message: 'Service disabled' } }) };
      };
      const client = new GotYouBroClient({ token: 'gyb_abc', baseUrl: 'https://example.com/', fetchImpl });
      assert.deepEqual(await client.describeService(), { id: 'svc_1' });
      assert.equal(calls[0].url, 'https://example.com/api/v1/service');
      assert.equal(calls[0].init.headers.Authorization, 'Bearer gyb_abc');

      await assert.rejects(client.heartbeat(), (e) => e.code === 'SERVICE_DISABLED' && e.status === 403);
      await assert.rejects(new GotYouBroClient({ token: null, fetchImpl }).heartbeat(), /No GotYouBro token/);
    });

    test('the upload posts multipart with the filename and idempotency key', async () => {
      let seen = null;
      const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ success: true, data: { id: 'bk_1', status: 'RECEIVED' } }) }; };
      const client = new GotYouBroClient({ token: 'gyb_abc', fetchImpl });
      const data = await client.uploadBackup(Buffer.from('zipbytes'), 'moodpal-part01.zip', { idempotencyKey: 'key-1' });
      assert.equal(data.id, 'bk_1');
      assert.match(seen.url, /\/api\/v1\/backups\?filename=moodpal-part01\.zip$/);
      assert.equal(seen.init.headers['Idempotency-Key'], 'key-1');
      assert.ok(seen.init.body instanceof FormData);
      assert.equal(seen.init.body.get('file').name, 'moodpal-part01.zip');
    });

    test('backup time maps to a daily cron expression, and bad input is rejected', () => {
      assert.equal(timeToCron('03:30'), '30 3 * * *');
      assert.equal(timeToCron('23:05'), '5 23 * * *');
      assert.equal(timeToCron('00:00'), '0 0 * * *');
      for (const bad of ['24:00', '12:60', 'noon', '', null, '3:5']) assert.equal(timeToCron(bad), null, String(bad));
    });
  });
});
