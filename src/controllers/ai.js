// Admin → AI: the shared AI key everyone without their own OpenAI key uses (src/ai/access.js).
// The key is checked with the provider before it's saved and is never sent back (only its last 4).
const ai = require('../ai/access');
const providers = require('../ai/providers');

const fail = (res, error) => {
  if (error instanceof ai.AiSettingsError) return res.status(400).json({ error: error.code });
  if (providers.isAuthError(error)) return res.status(400).json({ error: 'key_rejected' });
  console.error('Shared AI key check failed:', error.message);
  return res.status(502).json({ error: 'verify_failed', message: String(error.message || '').slice(0, 200) });
};

// every answer carries the shared key's view plus `mine`: what this admin uses for themselves
const withMine = async (req, view) => ({ ...(view || await ai.adminView()), mine: await ai.mine(req.user._id) });

// GET /api/admin/ai — provider, model, limits, whether a key is set, usage today and this month
const get = async (req, res) => res.json(await withMine(req));

// POST /api/admin/ai/settings { enabled?, provider?, model?, talk_per_user?, daily_total? }
const saveSettings = async (req, res) => {
  try { res.json(await withMine(req, await ai.updateSettings(req.body || {}))); } catch (error) { fail(res, error); }
};

// POST /api/admin/ai/key { provider, key } — verified with the provider, then stored encrypted
const setKey = async (req, res) => {
  try { res.json(await withMine(req, await ai.setKey(req.body?.provider, req.body?.key, { verify: (p, k) => module.exports.verify(p, k) }))); } catch (error) { fail(res, error); }
};

// DELETE /api/admin/ai/key
const removeKey = async (req, res) => res.json(await withMine(req, await ai.removeKey()));

// ----- for me only: the key this admin uses themselves, to test -----

// POST /api/admin/ai/mine { choice?: 'auto'|'own'|'shared'|'test', model? }
const saveMine = async (req, res) => {
  try { await ai.updateMine(req.user._id, req.body || {}); res.json(await withMine(req)); } catch (error) { fail(res, error); }
};

// POST /api/admin/ai/mine/key { provider, key } — checked, stored encrypted, and switched to
const setMyKey = async (req, res) => {
  try { await ai.setMyKey(req.user._id, req.body?.provider, req.body?.key, { verify: (p, k) => module.exports.verify(p, k) }); res.json(await withMine(req)); } catch (error) { fail(res, error); }
};

// DELETE /api/admin/ai/mine/key
const removeMyKey = async (req, res) => { await ai.removeMyKey(req.user._id); res.json(await withMine(req)); };

// swappable in tests
const verify = (provider, key) => providers.verify(provider, key);

module.exports = { get, saveSettings, setKey, removeKey, saveMine, setMyKey, removeMyKey, verify };
