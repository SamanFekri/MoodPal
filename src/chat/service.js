// Talk mode: a supportive, psychology-informed conversation. Owns the chat_sessions
// collection; the LLM client is injectable for tests.
const ChatSession = require('../models/chat_session');
const personalityService = require('../personality/service');

const CHAT_IDLE_MINUTES = 120;      // a quiet session ends and text goes back to being notes
const CONTEXT_MESSAGES = 16;        // how much history the model sees
const RISK_ORDER = { none: 0, low: 1, medium: 2, high: 3 };

class ChatService {
  constructor({ llm = null, personality = personalityService } = {}) {
    this._llm = llm;
    this.personality = personality;
  }

  get llm() {
    if (!this._llm) this._llm = require('../utils/llm');
    return this._llm;
  }

  // Active session, or null. Sessions idle for too long are closed on the way.
  async getActive(userId) {
    const session = await ChatSession.findOne({ user: userId, status: 'active' }).sort({ last_message_at: -1 });
    if (!session) return null;
    if (Date.now() - session.last_message_at.getTime() > CHAT_IDLE_MINUTES * 60 * 1000) {
      await this._end(session, 'idle');
      return null;
    }
    return session;
  }

  // Start (or replace) the user's talk session
  async start(userId, { openedFrom = 'menu' } = {}) {
    await ChatSession.updateMany({ user: userId, status: 'active' }, { status: 'ended', ended_at: new Date(), ended_reason: 'user' });
    return ChatSession.create({ user: userId, opened_from: openedFrom });
  }

  async end(userId, reason = 'user') {
    const session = await ChatSession.findOne({ user: userId, status: 'active' });
    if (!session) return null;
    await this._end(session, reason);
    return session;
  }

  async _end(session, reason) {
    session.status = 'ended';
    session.ended_at = new Date();
    session.ended_reason = reason;
    await session.save();
  }

  /**
   * Add the user's message, ask the model, store the answer.
   * @returns {{reply:string, risk:string, session}}
   */
  async reply(userId, text, apiKey, { firstName = '', model = undefined } = {}) {
    if (!apiKey) throw new Error('Missing OpenAI API key for this user');
    const session = await this.getActive(userId);
    if (!session) throw new Error('No active talk session');

    session.messages.push({ role: 'user', content: text });
    const history = session.messages.slice(-CONTEXT_MESSAGES).map(m => ({ role: m.role, content: m.content }));
    const personalityContext = await this.personality.getPersonalityContext(userId);

    const result = await this.llm.chatReply(history, apiKey, { personalityContext, firstName, model });
    const risk = RISK_ORDER[result.risk] !== undefined ? result.risk : 'none';

    session.messages.push({ role: 'assistant', content: result.reply, risk });
    if (RISK_ORDER[risk] > RISK_ORDER[session.highest_risk]) session.highest_risk = risk;
    session.last_message_at = new Date();
    await session.save();

    return { reply: result.reply, risk, session };
  }

  // What the user said in a session, for personality inference when it ends
  userTranscript(session) {
    return session.messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
  }
}

module.exports = new ChatService();
module.exports.ChatService = ChatService;
module.exports.CHAT_IDLE_MINUTES = CHAT_IDLE_MINUTES;
