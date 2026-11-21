// Talk in the mini app: the same conversation as 💬 Talk in the bot (one active session per user),
// on the user's own OpenAI key or the admin's shared key (src/ai/access.js). Conversation logic lives
// in src/chat/service.js.
const chatService = require('../chat/service');
const llm = require('../utils/llm');
const ai = require('../ai/access');
const i18n = require('../i18n');

const MAX_LENGTH = 2000;
const REMIND_EVERY = 8; // assistant replies between "I'm an AI" reminders, same as the bot

const messageView = (m) => ({ role: m.role, content: m.content, risk: m.risk || 'none', at: m.at });

const view = async (user, session) => {
  const access = await ai.forUser(user);
  return {
  // whether Talk works for them (own key or the shared one), and which
  has_key: Boolean(access),
  own_key: Boolean(access?.own),
  provider: access?.providerName || null,
  model: access ? (access.model || llm.DEFAULT_MODEL) : (user.openai_model || llm.DEFAULT_MODEL),
  // the shared key's messages left today (null on their own key)
  today: access && !access.own ? await ai.talkToday(user) : null,
  active: Boolean(session),
  started_at: session?.createdAt || null,
  messages: session ? session.messages.map(messageView) : [],
  };
};

// GET /api/me/talk — the active conversation (a quiet one is closed on the way)
const getTalk = async (req, res) => res.json(await view(req.user, await chatService.getActive(req.user._id)));

// POST /api/me/talk/start — keeps a conversation that is already going (it may have started in the bot)
const startTalk = async (req, res) => {
  if (!await ai.forUser(req.user)) return res.status(409).json({ error: 'no_key' });
  const session = await chatService.getActive(req.user._id) || await chatService.start(req.user._id, { openedFrom: 'app' });
  res.json(await view(req.user, session));
};

// POST /api/me/talk/message { text } — starts a conversation if none is going
const sendMessage = async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'empty' });
  if (text.length > MAX_LENGTH) return res.status(400).json({ error: 'too_long', max: MAX_LENGTH });
  const access = await ai.forUser(req.user);
  if (!access) return res.status(409).json({ error: 'no_key' });
  // the shared key: one of today's messages, or a stop when they're used up
  try {
    await ai.consume(req.user, access, 'talk');
  } catch (error) {
    if (!(error instanceof ai.AiLimitError)) throw error;
    return res.status(429).json({ error: error.code, limit: error.limit });
  }
  if (!await chatService.getActive(req.user._id)) await chatService.start(req.user._id, { openedFrom: 'app' });

  const model = access.model;
  const t = i18n.forUser(req.user);
  let result;
  try {
    result = await chatService.reply(req.user._id, text, access.cred, { firstName: req.user.first_name, model, language: t.aiLanguage, fallbackReply: t.talkFallbackReply() });
  } catch (error) {
    console.error('Talk reply (mini app) failed:', error.message);
    if (llm.isAuthError(error) && access.own && !access.test) {
      await chatService.end(req.user._id, 'no_key');
      return res.status(409).json({ error: 'key_rejected' });
    }
    // the shared key or its model failed: the admin's to fix, the conversation stays open
    if ((!access.own || access.test) && (llm.isAuthError(error) || llm.isModelError?.(error))) return res.status(503).json({ error: 'shared_unavailable' });
    if (llm.isModelError?.(error)) {
      await chatService.end(req.user._id, 'error');
      return res.status(409).json({ error: 'model_unavailable', model: model || llm.DEFAULT_MODEL });
    }
    return res.status(502).json({ error: 'reply_failed' });
  }
  const { risk, session } = result;
  const assistantTurns = session.messages.filter(m => m.role === 'assistant').length;
  res.json({
    ...await view(req.user, session),
    // medium/high risk: the app shows the crisis note under the reply
    safety: risk === 'medium' || risk === 'high',
    reminder: assistantTurns % REMIND_EVERY === 0,
  });
};

// POST /api/me/talk/end — then, in the background, remember what matters and refine the profile
const endTalk = async (req, res) => {
  const session = await chatService.end(req.user._id, 'user');
  if (session) chatService.learnFromEnded(session).catch(err => console.error('Learning from a talk failed:', err.message));
  res.json({ ...await view(req.user, null), ended: Boolean(session) });
};

module.exports = { getTalk, startTalk, sendMessage, endTalk, MAX_LENGTH };
