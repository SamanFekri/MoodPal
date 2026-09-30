// Mini app settings: the user's own OpenAI key (verified, stored encrypted) and model choice.
const User = require('../models/user');
const llm = require('../utils/llm');
const reminders = require('../reminders/service');
const memory = require('../memory/service');
const UserMemory = require('../models/user_memory');

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
    ...(await (async () => {
      const fresh = await User.findById(user._id).select('reminder timezone is_mbti_shared memory_enabled is_mood_log_shared is_mood_notes_shared').lean() || user;
      const mbti = await require('../personality/service').getMbti(user._id);
      return {
        reminders: reminders.viewFor(fresh, await reminders.getSettings()),
        timezone: await reminders.timezoneView(fresh),
        // who can see your Moodling (MBTI-style character)
        privacy: {
          mbti_shared: fresh.is_mbti_shared !== false, mbti_type: mbti ? mbti.type : null,
          mood_log_shared: fresh.is_mood_log_shared !== false, mood_notes_shared: fresh.is_mood_notes_shared === true,
        },
        // what Talk remembers about you
        memory: { enabled: fresh.memory_enabled !== false, count: await UserMemory.countDocuments({ user: user._id }), max: memory.MAX_MEMORIES },
      };
    })()),
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

// POST /api/me/settings/reminders { enabled?, times?: ["HH:MM", …] | null, timezone?: IANA | null }
const setReminders = async (req, res) => {
  try {
    await reminders.updateForUser(req.user._id, req.body || {});
  } catch (error) {
    if (error instanceof reminders.ReminderInputError) return res.status(400).json({ error: error.code });
    throw error;
  }
  res.json(await view(req.user));
};

// POST /api/me/settings/timezone { timezone: IANA | null } — null goes back to the default
const setTimezone = async (req, res) => {
  const tz = req.body?.timezone ?? null;
  try {
    await reminders.setTimezone(req.user._id, tz === null ? null : String(tz).trim());
  } catch (error) {
    if (error instanceof reminders.ReminderInputError) return res.status(400).json({ error: error.code });
    throw error;
  }
  res.json(await view(req.user));
};

// POST /api/me/settings/privacy { mbti_shared?, mood_log_shared?, mood_notes_shared? } (booleans)
// what friends who follow you can see: your Moodling, your mood history, the notes in it
const PRIVACY_FIELDS = { mbti_shared: 'is_mbti_shared', mood_log_shared: 'is_mood_log_shared', mood_notes_shared: 'is_mood_notes_shared' };
const setPrivacy = async (req, res) => {
  const set = {};
  for (const [key, field] of Object.entries(PRIVACY_FIELDS)) {
    if (req.body?.[key] === undefined) continue;
    if (typeof req.body[key] !== 'boolean') return res.status(400).json({ error: 'invalid_value' });
    set[field] = req.body[key];
  }
  if (!Object.keys(set).length) return res.status(400).json({ error: 'invalid_value' });
  await User.updateOne({ _id: req.user._id }, set);
  res.json(await view(req.user));
};

// ---- what MoodPal remembers (Talk memory) ----

const memoryView = (m) => ({ id: m._id, text: m.text, category: m.category, importance: m.importance, updated_at: m.updatedAt });

// GET /api/me/memories
const listMemories = async (req, res) => {
  const notes = await memory.list(req.user._id);
  res.json({ enabled: req.user.memory_enabled !== false, max: memory.MAX_MEMORIES, memories: notes.map(memoryView) });
};

// DELETE /api/me/memories/:id — forget one note
const forgetMemory = async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
  const ok = await memory.forget(req.user._id, req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
};

// DELETE /api/me/memories — forget everything
const forgetAllMemories = async (req, res) => res.json({ deleted: await memory.forgetAll(req.user._id) });

// POST /api/me/settings/memory { enabled } — turning it off stops new notes and keeps Talk from using old ones
const setMemory = async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'invalid_value' });
  await User.updateOne({ _id: req.user._id }, { memory_enabled: req.body.enabled });
  res.json(await view(req.user));
};

// separate so tests can swap the OpenAI round-trip
const verify = (key) => llm.verifyApiKey(key);

module.exports = { getSettings, setKey, removeKey, setModel, setReminders, setTimezone, setPrivacy, setMemory, listMemories, forgetMemory, forgetAllMemories, verify };
