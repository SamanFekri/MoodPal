// Mini app settings: the user's own OpenAI key (verified, stored encrypted) and model choice.
const User = require('../models/user');
const llm = require('../utils/llm');
const reminders = require('../reminders/service');
const memory = require('../memory/service');
const UserMemory = require('../models/user_memory');
const i18n = require('../i18n');

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
    // which AI they're on: their own key (unlimited), MoodPal's shared key (limited), or none
    ai: await (async () => {
      const ai = require('../ai/access');
      const access = await ai.forUser(user);
      if (!access) return { source: 'none' };
      if (access.own) return { source: 'own', provider: access.providerName };
      return { source: 'shared', provider: access.providerName, model: access.model, today: await ai.talkToday(user) };
    })(),
    ...(await (async () => {
      const fresh = await User.findById(user._id).select('reminder timezone is_mbti_shared memory_enabled is_mood_log_shared is_mood_notes_shared language').lean() || user;
      const mbti = await require('../personality/service').getMbti(user._id);
      return {
        reminders: reminders.viewFor(fresh, await reminders.getSettings()),
        timezone: await reminders.timezoneView(fresh),
        // who can see your Moodling (MBTI-style character)
        privacy: {
          mbti_shared: fresh.is_mbti_shared !== false, mbti_type: mbti ? mbti.type : null,
          mood_log_shared: fresh.is_mood_log_shared !== false, mood_notes_shared: fresh.is_mood_notes_shared === true,
        },
        // the language the bot and the mini app speak (src/i18n)
        language: { current: i18n.normalize(fresh.language), choices: i18n.LANGS.map(code => ({ code, name: i18n.forLang(code).nativeName, flag: i18n.forLang(code).flag, dir: i18n.forLang(code).dir })) },
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

// POST /api/me/settings/language { language: 'en' | 'fa' | 'ru' } — the bot's menu follows on the next message
const setLanguage = async (req, res) => {
  const lang = req.body?.language;
  if (!i18n.isSupported(lang)) return res.status(400).json({ error: 'invalid_language' });
  await User.updateOne({ _id: req.user._id }, { language: lang });
  req.user.language = lang;
  // the command list in Telegram's Menu button, for this chat
  const { botCommands } = require('../commands/language');
  require('../utils/telegram').getTelegram().setMyCommands(botCommands(lang), { scope: { type: 'chat', chat_id: req.user.id } })
    .catch(error => console.error('setMyCommands from the mini app failed:', error.message));
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
const PRIVACY_FIELDS = {
  mbti_shared: 'is_mbti_shared', mood_log_shared: 'is_mood_log_shared', mood_notes_shared: 'is_mood_notes_shared',
};
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

module.exports = {
  setLanguage, getSettings, setKey, removeKey, setModel, setReminders, setTimezone, setPrivacy, setMemory, listMemories, forgetMemory, forgetAllMemories, verify };
