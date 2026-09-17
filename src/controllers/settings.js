// Mini app settings: the user's own OpenAI key (verified, stored encrypted) and model choice.
const User = require('../models/user');
const llm = require('../utils/llm');

const view = async (user) => {
  const key = await User.getOpenAIKey(user._id);
  return {
    openai: {
      has_key: Boolean(key),
      key_hint: key ? `sk-…${key.slice(-4)}` : null,
      model: user.openai_model || llm.DEFAULT_MODEL,
      default_model: llm.DEFAULT_MODEL,
      models: llm.MODEL_CHOICES,
    },
  };
};

// GET /api/me/settings
const getSettings = async (req, res) => res.json(await view(req.user));

// POST /api/me/settings/openai-key { key } — verify with OpenAI, then store encrypted
const setKey = async (req, res) => {
  const key = String(req.body?.key || '').trim();
  if (!llm.isValidKeyFormat(key)) return res.status(400).json({ error: 'invalid_format' });
  try {
    await module.exports.verify(key);
  } catch (error) {
    return res.status(llm.isAuthError(error) ? 401 : 502).json({ error: llm.isAuthError(error) ? 'rejected' : 'verify_failed' });
  }
  await User.setOpenAIKey(req.user._id, key);
  res.json(await view(req.user));
};

// DELETE /api/me/settings/openai-key
const removeKey = async (req, res) => {
  await User.setOpenAIKey(req.user._id, null);
  res.json(await view(req.user));
};

// POST /api/me/settings/model { model }
const setModel = async (req, res) => {
  const model = req.body?.model === null || req.body?.model === '' ? null : String(req.body?.model || '').trim();
  if (model !== null && !llm.isValidModelId(model)) return res.status(400).json({ error: 'invalid_model' });
  const user = await User.findByIdAndUpdate(req.user._id, { openai_model: model }, { new: true });
  res.json(await view(user));
};

// separate so tests can swap the OpenAI round-trip
const verify = (key) => llm.verifyApiKey(key);

module.exports = { getSettings, setKey, removeKey, setModel, verify };
