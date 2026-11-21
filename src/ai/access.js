// Which AI key a person uses, and the limits on the admin's shared key.
//
//   1. their own OpenAI key (Settings or /set_openai_key): used first, no limits
//   2. otherwise the admin's shared key (Admin → AI): Gemini by default, or OpenAI / Claude, limited
//   3. otherwise no AI
//
// Admins can pick for themselves only (Admin → AI → For me), to test: their own OpenAI key, the shared
// key (with its limits), or a private test key of any provider (no limits, nobody else uses it).
//
// Limits on the shared key: Talk messages per person per day (their local day), and every request
// through it per day for the whole bot (UTC day; 0 = no cap). The weekly insight, memory and
// personality learning don't use up a person's Talk messages but do count toward the daily cap.
const AppConfig = require('../models/app_config');
const AiUsage = require('../models/ai_usage');
const User = require('../models/user');
const providers = require('./providers');

const KINDS = ['talk', 'insight', 'background', 'admin'];

class AiLimitError extends Error {
  constructor(reason, limit) { super(reason); this.code = reason; this.limit = limit; }
}

// ---------- days ----------

const dayIn = (tz, now = new Date()) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
};
const userDay = (user, now) => dayIn(user?.timezone || process.env.REMINDER_TIMEZONE || process.env.TZ || 'UTC', now);
const botDay = (now) => dayIn('UTC', now);

// ---------- the shared key ----------

async function settings() {
  const c = await AppConfig.get();
  const provider = providers.PROVIDERS[c.ai_provider] ? c.ai_provider : providers.DEFAULT_PROVIDER;
  return {
    enabled: c.ai_enabled !== false,
    provider,
    model: c.ai_model || providers.PROVIDERS[provider].defaultModel,
    talk_per_user: c.ai_daily_talk_per_user ?? 20,
    daily_total: c.ai_daily_total ?? 1000,
  };
}

// { provider, apiKey, model } or null when there's no shared key or it's switched off
async function sharedCred() {
  const s = await settings();
  if (!s.enabled) return null;
  const apiKey = await AppConfig.getAiKey();
  return apiKey ? { provider: s.provider, apiKey, model: s.model } : null;
}

// ---------- a person's access ----------

/**
 * The key `user` uses right now.
 * @returns {Promise<null | { cred, own: boolean, provider: string, providerName: string, model: string }>}
 */
const CHOICES = ['auto', 'own', 'shared', 'test'];

async function forUser(userOrId) {
  let user = userOrId?._id ? userOrId : await User.findById(userOrId).select('openai_model timezone is_admin ai_choice ai_test_provider ai_test_model').lean();
  if (!user) return null;
  // a partial user (e.g. only _id), or an admin whose pick may have changed since this object was loaded:
  // read the choice fresh from the database
  if (user.is_admin === undefined || user.is_admin) {
    const fresh = await User.findById(user._id).select('is_admin ai_choice ai_test_provider ai_test_model').lean();
    if (fresh) user = { ...(user.toObject ? user.toObject() : user), ...fresh };
  }
  const choice = user.is_admin && CHOICES.includes(user.ai_choice) ? user.ai_choice : 'auto';

  const own = async () => {
    const ownKey = await User.getOpenAIKey(user._id);
    if (!ownKey) return null;
    return { cred: ownKey, own: true, provider: 'openai', providerName: providers.PROVIDERS.openai.name, model: user.openai_model || undefined };
  };
  const shared = async () => {
    const cred = await sharedCred();
    if (!cred) return null;
    return { cred, own: false, provider: cred.provider, providerName: providers.PROVIDERS[cred.provider].name, model: cred.model };
  };
  // an admin's private test key: counted like their own key (no limits); test marks it for error messages
  const test = async () => {
    const provider = providers.PROVIDERS[user.ai_test_provider] ? user.ai_test_provider : null;
    const apiKey = provider && await User.getAiTestKey(user._id);
    if (!apiKey) return null;
    const model = user.ai_test_model || providers.PROVIDERS[provider].defaultModel;
    return { cred: { provider, apiKey, model, test: true }, own: true, test: true, provider, providerName: providers.PROVIDERS[provider].name, model };
  };

  if (choice === 'own') return own();
  if (choice === 'shared') return shared();
  if (choice === 'test') return test();
  return (await own()) || shared();
}

// count one request in a row, but only while `field` is under `limit` (null = no limit); atomic
async function bump(day, userId, field, limit) {
  const query = { day, user: userId };
  if (limit !== null && limit !== undefined) query[field] = { $lt: limit };
  try {
    return await AiUsage.findOneAndUpdate(query, { $inc: { [field]: 1, total: 1 } }, { upsert: true, new: true });
  } catch (error) {
    // the row exists but is at the limit: the conditional upsert tries to insert a duplicate
    if (error?.code === 11000) return null;
    throw error;
  }
}

/**
 * Uses one request of `kind` for `user` on the shared key. Own keys are never counted.
 * Throws AiLimitError('user_limit' | 'daily_cap') when there's nothing left.
 */
async function consume(user, access, kind, { now = new Date() } = {}) {
  if (!access || access.own) return { own: true };
  if (!KINDS.includes(kind)) throw new Error(`Unknown AI usage kind: ${kind}`);
  const s = await settings();
  // the whole bot first (admin tools are never blocked, only counted)
  const cap = s.daily_total > 0 && kind !== 'admin' ? s.daily_total : null;
  const bot = await bump(botDay(now), null, 'total', cap);
  if (!bot) throw new AiLimitError('daily_cap', s.daily_total);
  if (kind !== 'talk') {
    await bump(userDay(user, now), user._id, kind, null);
    return { own: false };
  }
  const mine = await bump(userDay(user, now), user._id, 'talk', s.talk_per_user);
  if (!mine) {
    await AiUsage.updateOne({ day: botDay(now), user: null }, { $inc: { total: -1 } });   // give the cap back
    throw new AiLimitError('user_limit', s.talk_per_user);
  }
  return { own: false, used: mine.talk, limit: s.talk_per_user, left: Math.max(0, s.talk_per_user - mine.talk) };
}

// a person's Talk messages today on the shared key: { used, limit, left }
async function talkToday(user, { now = new Date() } = {}) {
  const s = await settings();
  const row = await AiUsage.findOne({ day: userDay(user, now), user: user._id }).select('talk').lean();
  const used = row?.talk || 0;
  return { used, limit: s.talk_per_user, left: Math.max(0, s.talk_per_user - used) };
}

// ---------- admin ----------

// what an admin picked for themselves (Admin → AI → For me)
async function mine(userOrId) {
  const id = userOrId?._id || userOrId;
  const u = await User.findById(id).select('is_admin ai_choice ai_test_provider ai_test_model').lean();
  if (!u) return null;
  const [ownKey, testKey, access] = await Promise.all([User.getOpenAIKey(id), User.getAiTestKey(id), forUser(id)]);
  return {
    choice: CHOICES.includes(u.ai_choice) ? u.ai_choice : 'auto',
    has_own_key: Boolean(ownKey),
    test: {
      provider: providers.PROVIDERS[u.ai_test_provider] ? u.ai_test_provider : null,
      model: u.ai_test_model || null,
      has_key: Boolean(testKey),
      key_hint: testKey ? `…${testKey.slice(-4)}` : null,
    },
    // what Talk, insights and admin tools use for them right now
    using: access ? { source: access.test ? 'test' : access.own ? 'own' : 'shared', provider: access.provider, provider_name: access.providerName, model: access.model || null } : null,
  };
}

// { choice?, model? } for the admin's own pick; the model is for their test key
async function updateMine(userId, patch = {}) {
  const set = {};
  if (patch.choice !== undefined) {
    if (!CHOICES.includes(patch.choice)) throw new AiSettingsError('invalid_choice');
    set.ai_choice = patch.choice;
  }
  if (patch.model !== undefined) {
    if (patch.model !== null && patch.model !== '' && !isModelId(patch.model)) throw new AiSettingsError('invalid_model');
    set.ai_test_model = patch.model || null;
  }
  if (Object.keys(set).length) await User.updateOne({ _id: userId }, set);
  return mine(userId);
}

// the admin's private test key, checked with the provider first; picking it switches them to it
async function setMyKey(userId, provider, apiKey, { verify = providers.verify } = {}) {
  if (!providers.PROVIDERS[provider]) throw new AiSettingsError('invalid_provider');
  const key = String(apiKey || '').trim();
  if (key.length < 20 || /\s/.test(key)) throw new AiSettingsError('invalid_key');
  await verify(provider, key);
  const u = await User.findById(userId).select('ai_test_provider').lean();
  await User.updateOne({ _id: userId }, { ai_test_provider: provider, ai_choice: 'test', ...(u?.ai_test_provider !== provider ? { ai_test_model: null } : {}) });
  await User.setAiTestKey(userId, key);
  return mine(userId);
}

async function removeMyKey(userId) {
  const u = await User.findById(userId).select('ai_choice').lean();
  await User.updateOne({ _id: userId }, { ai_test_provider: null, ai_test_model: null, ...(u?.ai_choice === 'test' ? { ai_choice: 'auto' } : {}) });
  await User.setAiTestKey(userId, null);
  return mine(userId);
}

async function adminView({ now = new Date() } = {}) {
  const s = await settings();
  const apiKey = await AppConfig.getAiKey();
  const today = botDay(now);
  const month = today.slice(0, 7);
  const [todayRow, monthRows, top] = await Promise.all([
    AiUsage.findOne({ day: today, user: null }).lean(),
    AiUsage.aggregate([{ $match: { user: null, day: { $regex: `^${month}` } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    AiUsage.aggregate([
      { $match: { user: { $ne: null }, day: today } },
      { $sort: { total: -1 } }, { $limit: 10 },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
      { $project: { total: 1, talk: 1, u: { $arrayElemAt: ['$u', 0] } } },
    ]),
  ]);
  return {
    enabled: s.enabled,
    provider: s.provider,
    model: s.model,
    has_key: Boolean(apiKey),
    key_hint: apiKey ? `…${apiKey.slice(-4)}` : null,
    talk_per_user: s.talk_per_user,
    daily_total: s.daily_total,
    providers: providers.PROVIDER_IDS.map(id => ({ id, name: providers.PROVIDERS[id].name, default_model: providers.PROVIDERS[id].defaultModel, models: providers.PROVIDERS[id].models })),
    usage: {
      today: todayRow?.total || 0,
      month: monthRows[0]?.total || 0,
      top_today: top.map(r => ({ id: r.u?.id ?? null, name: [r.u?.first_name, r.u?.last_name].filter(Boolean).join(' ') || r.u?.username || 'Someone', total: r.total, talk: r.talk })),
    },
  };
}

const isModelId = (m) => typeof m === 'string' && /^[a-z0-9][a-z0-9.\-_]{1,63}$/i.test(m);

class AiSettingsError extends Error { constructor(code) { super(code); this.code = code; } }

// { enabled?, provider?, model?, talk_per_user?, daily_total? }; switching provider resets the model
async function updateSettings(patch = {}) {
  const set = {};
  if (patch.enabled !== undefined) set.ai_enabled = Boolean(patch.enabled);
  if (patch.provider !== undefined) {
    if (!providers.PROVIDERS[patch.provider]) throw new AiSettingsError('invalid_provider');
    set.ai_provider = patch.provider;
    if (patch.model === undefined) set.ai_model = null;
  }
  if (patch.model !== undefined) {
    if (patch.model !== null && patch.model !== '' && !isModelId(patch.model)) throw new AiSettingsError('invalid_model');
    set.ai_model = patch.model || null;
  }
  for (const [field, key, max] of [['ai_daily_talk_per_user', 'talk_per_user', 1000], ['ai_daily_total', 'daily_total', 1000000]]) {
    if (patch[key] === undefined) continue;
    const n = Number(patch[key]);
    if (!Number.isInteger(n) || n < 0 || n > max) throw new AiSettingsError(`invalid_${key}`);
    set[field] = n;
  }
  await AppConfig.get();
  if (Object.keys(set).length) await AppConfig.updateOne({ key: 'main' }, set);
  return adminView();
}

// saves the key after checking it with the provider (lists models, no tokens spent)
async function setKey(provider, apiKey, { verify = providers.verify } = {}) {
  const p = provider || (await settings()).provider;
  if (!providers.PROVIDERS[p]) throw new AiSettingsError('invalid_provider');
  const key = String(apiKey || '').trim();
  if (key.length < 20 || /\s/.test(key)) throw new AiSettingsError('invalid_key');
  await verify(p, key);
  const c = await settings();
  await AppConfig.updateOne({ key: 'main' }, { ai_provider: p, ...(c.provider !== p ? { ai_model: null } : {}) });
  await AppConfig.setAiKey(key);
  return adminView();
}

async function removeKey() {
  await AppConfig.setAiKey(null);
  return adminView();
}

module.exports = { forUser, mine, updateMine, setMyKey, removeMyKey, CHOICES, sharedCred, consume, talkToday, settings, adminView, updateSettings, setKey, removeKey, AiLimitError, AiSettingsError, KINDS, _days: { userDay, botDay } };
