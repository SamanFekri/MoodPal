// Admin-only: send a message, photo, video, GIF, audio or file to every user.
const AppConfig = require('../models/app_config');
const broadcast = require('../broadcast/service');

const fail = (res, error) => {
  if (error instanceof broadcast.BroadcastInputError) return res.status(400).json({ error: error.code });
  console.error('Broadcast failed:', error.message);
  return res.status(502).json({ error: 'telegram_failed', message: error.description || error.message });
};

// GET /api/admin/broadcasts — audience size, speed, recent broadcasts with progress
const list = async (req, res) => res.json(await broadcast.view());

// POST /api/admin/broadcasts/media?name=<file name> (body: the raw file, Content-Type set)
// Uploads to the admin's own chat once and returns the Telegram file_id to broadcast with.
const upload = async (req, res) => {
  try {
    const name = String(req.query.name || '').slice(0, 120);
    const media = await broadcast.uploadMedia(req.user.id, req.body, { mime: req.get('content-type'), name });
    res.json(media);
  } catch (error) { fail(res, error); }
};

// POST /api/admin/broadcasts/test { text, kind, file_id, file_name, button } — only to the admin
const test = async (req, res) => {
  try { await broadcast.sendTest(req.user.id, req.body || {}); res.json({ ok: true }); } catch (error) { fail(res, error); }
};

// POST /api/admin/broadcasts { text, kind, file_id, file_name, button } — queue it for everyone
const create = async (req, res) => {
  try {
    const b = await broadcast.create(req.user._id, req.body || {});
    res.json({ id: b._id, total: b.total, ...(await broadcast.view()) });
  } catch (error) { fail(res, error); }
};

// POST /api/admin/broadcasts/:id/cancel — stop sending; whoever already got it keeps it
const cancel = async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
  const b = await broadcast.cancel(req.params.id);
  if (!b) return res.status(404).json({ error: 'not_sending' });
  res.json(await broadcast.view());
};

// POST /api/admin/broadcasts/settings { rate_per_second }
const settings = async (req, res) => {
  const n = parseInt(req.body?.rate_per_second, 10);
  if (!Number.isFinite(n) || n < 1 || n > 25) return res.status(400).json({ error: 'invalid_rate_per_second' });
  await AppConfig.get();
  await AppConfig.updateOne({ key: 'main' }, { broadcast_rate_per_second: n });
  res.json(await broadcast.view());
};

module.exports = { list, upload, test, create, cancel, settings };
