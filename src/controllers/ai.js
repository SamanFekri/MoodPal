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

// GET /api/admin/ai — provider, model, limits, whether a key is set, usage today and this month
const get = async (req, res) => res.json(await ai.adminView());

// POST /api/admin/ai/settings { enabled?, provider?, model?, talk_per_user?, daily_total? }
const saveSettings = async (req, res) => {
  try { res.json(await ai.updateSettings(req.body || {})); } catch (error) { fail(res, error); }
};

// POST /api/admin/ai/key { provider, key } — verified with the provider, then stored encrypted
const setKey = async (req, res) => {
  try { res.json(await ai.setKey(req.body?.provider, req.body?.key, { verify: (p, k) => module.exports.verify(p, k) })); } catch (error) { fail(res, error); }
};

// DELETE /api/admin/ai/key
const removeKey = async (req, res) => res.json(await ai.removeKey());

// swappable in tests
const verify = (provider, key) => providers.verify(provider, key);

module.exports = { get, saveSettings, setKey, removeKey, verify };
