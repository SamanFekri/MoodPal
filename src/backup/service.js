// Database backup and restore.
//
// A backup is a zip per part containing one NDJSON file per collection plus a
// manifest. Documents are written as MongoDB Extended JSON so ObjectIds and Dates
// survive the round trip exactly. Parts are kept under the size the upload service
// accepts, so a large database becomes several uploads instead of one failed one.
const mongoose = require('mongoose');
const AdmZip = require('adm-zip');
const { EJSON } = require('bson');
const crypto = require('crypto');

const AppConfig = require('../models/app_config');
const { GotYouBroClient } = require('./gotyoubro');

// Hard ceiling for one uploaded zip. The service accepts larger files, but Telegram
// (its delivery target) does not, so we stay comfortably below 50MB.
const MAX_PART_BYTES = 45 * 1024 * 1024;
// How much uncompressed NDJSON goes into one part before it is zipped. JSON of this
// shape compresses roughly 5-10x, so this lands far under MAX_PART_BYTES; if a part
// still comes out too big the builder retries that part with a smaller target.
const DEFAULT_TARGET_UNCOMPRESSED = 40 * 1024 * 1024;
const MANIFEST_NAME = 'manifest.json';
const FORMAT = 'moodpal-backup';
const FORMAT_VERSION = 1;

// app_config holds the upload token and the schedule. Restoring it from an old dump
// would silently change this deployment's configuration, so it never goes in a backup.
const EXCLUDED_COLLECTIONS = new Set(['app_config']);

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;

async function listBackupCollections() {
  const all = await mongoose.connection.db.listCollections().toArray();
  return all
    .map(c => c.name)
    .filter(name => !name.startsWith('system.') && !EXCLUDED_COLLECTIONS.has(name))
    .sort();
}

/**
 * Build the backup as an array of zip buffers, each under MAX_PART_BYTES.
 * @returns {Promise<{backupId:string, parts:Array<{index:number, filename:string, buffer:Buffer, collections:Object}>, totalDocuments:number}>}
 */
async function buildParts({ targetUncompressed = DEFAULT_TARGET_UNCOMPRESSED, backupId = crypto.randomUUID(), createdAt = new Date() } = {}) {
  const names = await listBackupCollections();
  const parts = [];
  let totalDocuments = 0;

  // documents of the current part, grouped per collection
  let current = new Map();
  let currentBytes = 0;

  const flush = async (force = false) => {
    if (currentBytes === 0 && !force) return;
    const index = parts.length + 1;
    const counts = {};
    const zip = new AdmZip();
    for (const [name, lines] of current) {
      counts[name] = lines.length;
      zip.addFile(`${name}.ndjson`, Buffer.from(lines.join('\n') + '\n', 'utf8'));
    }
    zip.addFile(MANIFEST_NAME, Buffer.from(JSON.stringify({
      format: FORMAT,
      version: FORMAT_VERSION,
      backup_id: backupId,
      part: index,
      created_at: createdAt.toISOString(),
      collections: counts,
    }, null, 2), 'utf8'));
    const buffer = zip.toBuffer();
    parts.push({ index, filename: `moodpal-${stamp(createdAt)}-part${pad(index)}.zip`, buffer, collections: counts });
    current = new Map();
    currentBytes = 0;
    return buffer.length;
  };

  for (const name of names) {
    const cursor = mongoose.connection.db.collection(name).find({}).batchSize(500);
    for await (const doc of cursor) {
      const line = EJSON.stringify(doc, { relaxed: false });
      if (currentBytes + line.length > targetUncompressed && currentBytes > 0) await flush();
      if (!current.has(name)) current.set(name, []);
      current.get(name).push(line);
      currentBytes += line.length + 1;
      totalDocuments += 1;
    }
  }
  await flush(parts.length === 0);   // always produce at least one (possibly empty) part

  // A part that still exceeds the limit means the data barely compressed. Rebuild the
  // whole backup with a smaller target rather than shipping something that cannot upload.
  const tooBig = parts.find(p => p.buffer.length > MAX_PART_BYTES);
  if (tooBig) {
    if (targetUncompressed <= 2 * 1024 * 1024) {
      throw new Error(`Cannot split the backup below ${MAX_PART_BYTES} bytes per part`);
    }
    return buildParts({ targetUncompressed: Math.floor(targetUncompressed / 2), backupId, createdAt });
  }

  // now that the count is known, stamp total_parts into every manifest
  for (const part of parts) {
    const zip = new AdmZip(part.buffer);
    const manifest = JSON.parse(zip.readAsText(MANIFEST_NAME));
    manifest.total_parts = parts.length;
    zip.updateFile(MANIFEST_NAME, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
    part.buffer = zip.toBuffer();
    if (parts.length === 1) part.filename = `moodpal-${stamp(createdAt)}.zip`;
  }

  return { backupId, parts, totalDocuments };
}

/**
 * Build the backup and upload every part to GotYouBro.
 * Records the outcome on AppConfig so the admin UI can show it.
 */
async function runBackup({ client = null, trigger = 'manual', targetUncompressed = DEFAULT_TARGET_UNCOMPRESSED } = {}) {
  const config = await AppConfig.get();
  const token = await AppConfig.getToken();
  const api = client || new GotYouBroClient({ token, baseUrl: config.gyb_base_url });
  if (!token && !client) {
    const message = 'No GotYouBro token configured';
    await AppConfig.updateOne({ key: 'main' }, { last_backup_at: new Date(), last_backup_status: 'failed', last_backup_message: message });
    throw new Error(message);
  }

  const startedAt = new Date();
  const { backupId, parts, totalDocuments } = await buildParts({ createdAt: startedAt, targetUncompressed });
  const results = [];
  let uploaded = 0;
  let bytes = 0;

  for (const part of parts) {
    try {
      const data = await api.uploadBackup(part.buffer, part.filename, {
        // a retry of the same part on the same day replays instead of duplicating
        idempotencyKey: `moodpal-${backupId}-part${part.index}`,
      });
      uploaded += 1;
      bytes += part.buffer.length;
      results.push({ part: part.index, filename: part.filename, bytes: part.buffer.length, id: data?.id || null, status: data?.status || 'RECEIVED' });
    } catch (error) {
      results.push({ part: part.index, filename: part.filename, bytes: part.buffer.length, error: error.message, code: error.code || null });
    }
  }

  const status = uploaded === parts.length ? 'success' : uploaded === 0 ? 'failed' : 'partial';
  const message = status === 'success'
    ? `${uploaded}/${parts.length} part${parts.length === 1 ? '' : 's'}, ${totalDocuments} documents`
    : results.find(r => r.error)?.error || 'Upload failed';
  await AppConfig.updateOne({ key: 'main' }, {
    last_backup_at: new Date(),
    last_backup_status: status,
    last_backup_message: message,
    last_backup_parts: parts.length,
    last_backup_bytes: bytes,
  });

  return { backupId, trigger, status, message, parts: results, total_parts: parts.length, total_documents: totalDocuments, bytes, started_at: startedAt };
}

/**
 * Restore documents from one or more backup zips.
 * @param {Buffer[]} buffers  zip parts, in any order
 * @param {{mode?: 'merge'|'replace', dryRun?: boolean}} options
 *   merge   - upsert by _id, leaving documents that are not in the backup untouched
 *   replace - empty each collection present in the backup, then insert
 */
async function restoreFromZips(buffers, { mode = 'merge', dryRun = false } = {}) {
  if (!['merge', 'replace'].includes(mode)) throw new Error(`Unknown restore mode: ${mode}`);
  if (!buffers || buffers.length === 0) throw new Error('No backup files provided');

  // read every part first, so a malformed file fails before anything is written
  const partsRead = [];
  for (const [i, buffer] of buffers.entries()) {
    let zip;
    try {
      zip = new AdmZip(buffer);
    } catch (error) {
      throw new Error(`File ${i + 1} is not a readable zip`);
    }
    const manifestEntry = zip.getEntry(MANIFEST_NAME);
    if (!manifestEntry) throw new Error(`File ${i + 1} has no ${MANIFEST_NAME}: not a MoodPal backup`);
    let manifest;
    try {
      manifest = JSON.parse(zip.readAsText(manifestEntry));
    } catch {
      throw new Error(`File ${i + 1} has an unreadable ${MANIFEST_NAME}`);
    }
    if (manifest.format !== FORMAT) throw new Error(`File ${i + 1} is not a MoodPal backup (format: ${manifest.format})`);
    if (manifest.version > FORMAT_VERSION) throw new Error(`File ${i + 1} was made by a newer version (${manifest.version})`);

    const collections = new Map();
    for (const entry of zip.getEntries()) {
      if (entry.entryName === MANIFEST_NAME || entry.isDirectory) continue;
      if (!entry.entryName.endsWith('.ndjson') || entry.entryName.includes('/')) continue;   // flat, known names only
      const name = entry.entryName.slice(0, -'.ndjson'.length);
      const docs = zip.readAsText(entry).split('\n').filter(Boolean).map(line => EJSON.parse(line, { relaxed: false }));
      collections.set(name, docs);
    }
    partsRead.push({ manifest, collections });
  }

  const summary = { mode, dry_run: dryRun, parts: partsRead.length, backup_ids: [...new Set(partsRead.map(p => p.manifest.backup_id))], collections: {}, documents: 0 };
  const emptied = new Set();

  for (const part of partsRead) {
    for (const [name, docs] of part.collections) {
      summary.collections[name] = summary.collections[name] || { documents: 0, restored: 0 };
      summary.collections[name].documents += docs.length;
      summary.documents += docs.length;
      if (dryRun || docs.length === 0) continue;

      const col = mongoose.connection.db.collection(name);
      if (mode === 'replace' && !emptied.has(name)) {
        await col.deleteMany({});
        emptied.add(name);
      }
      const ops = docs.map(doc => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } }));
      for (let i = 0; i < ops.length; i += 500) {
        const res = await col.bulkWrite(ops.slice(i, i + 500), { ordered: false });
        summary.collections[name].restored += (res.upsertedCount || 0) + (res.modifiedCount || 0) + (res.matchedCount || 0);
      }
    }
  }

  return summary;
}

// POST a heartbeat and record the outcome
async function sendHeartbeat({ client = null } = {}) {
  const config = await AppConfig.get();
  const token = await AppConfig.getToken();
  const api = client || new GotYouBroClient({ token, baseUrl: config.gyb_base_url });
  try {
    const data = await api.heartbeat();
    await AppConfig.updateOne({ key: 'main' }, {
      last_heartbeat_at: new Date(),
      last_heartbeat_status: data?.healthStatus || 'HEALTHY',
      last_heartbeat_message: data?.recovered ? 'recovered' : null,
    });
    return { ok: true, ...data };
  } catch (error) {
    await AppConfig.updateOne({ key: 'main' }, {
      last_heartbeat_at: new Date(),
      last_heartbeat_status: 'ERROR',
      last_heartbeat_message: error.message,
    });
    throw error;
  }
}

module.exports = {
  buildParts,
  runBackup,
  restoreFromZips,
  sendHeartbeat,
  listBackupCollections,
  MAX_PART_BYTES,
  DEFAULT_TARGET_UNCOMPRESSED,
  EXCLUDED_COLLECTIONS,
  FORMAT,
  FORMAT_VERSION,
};
