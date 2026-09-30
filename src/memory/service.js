// What MoodPal remembers about a person, and what Talk knows when it replies.
//
// Notes come from the user's own Talk messages: every few messages (and when a conversation
// ends) the model reads the new messages next to the current list and returns add / update /
// delete operations. At most MAX_MEMORIES are kept; when the list is full the least important,
// least recently touched notes go first. The user can see, delete and switch this off in Settings.
const UserMemory = require('../models/user_memory');
const User = require('../models/user');
const Mood = require('../models/mood');

const MAX_MEMORIES = 100;
const EXTRACT_EVERY = 6;             // user messages between memory updates during a conversation
const MAX_OPS = 10;
const CATEGORIES = ['life', 'people', 'feelings', 'preferences', 'goals', 'health', 'work_study', 'other'];
const RECENT_MOODS = 8;
const RECENT_MOOD_DAYS = 14;

const clean = (text) => String(text || '')
  .replace(/\s*(?:—|–|--)\s*/g, ', ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200);
const same = (a, b) => clean(a).toLowerCase().replace(/[.!]+$/, '') === clean(b).toLowerCase().replace(/[.!]+$/, '');
const clampImportance = (n, fallback = 3) => (Number.isFinite(Number(n)) ? Math.min(5, Math.max(1, Math.round(Number(n)))) : fallback);

class MemoryService {
  constructor({ llm = null } = {}) { this._llm = llm; }

  get llm() {
    if (!this._llm) this._llm = require('../utils/llm');
    return this._llm;
  }

  async isEnabled(userId) {
    const u = await User.findById(userId).select('memory_enabled').lean();
    return Boolean(u) && u.memory_enabled !== false;
  }

  // most important first, then most recently touched
  list(userId) {
    return UserMemory.find({ user: userId }).sort({ importance: -1, updatedAt: -1 }).lean();
  }

  /**
   * Apply model-proposed operations. Ids in `ops` are the short ids ("m1"...) from `idMap`,
   * so the model can never touch another user's notes. Returns what actually changed.
   */
  async applyOperations(userId, ops, { idMap = new Map(), sessionId = null } = {}) {
    const result = { added: 0, updated: 0, deleted: 0, skipped: 0 };
    if (!Array.isArray(ops)) return result;
    const existing = await UserMemory.find({ user: userId }).lean();

    for (const op of ops.slice(0, MAX_OPS)) {
      const kind = op?.op;
      if (kind === 'add') {
        const text = clean(op.text);
        if (text.length < 3) { result.skipped++; continue; }
        const dup = existing.find(m => same(m.text, text));
        if (dup) {
          // said again: it matters, so it moves up and stays fresh
          await UserMemory.updateOne({ _id: dup._id }, { $inc: { times_seen: 1 }, $max: { importance: clampImportance(op.importance) } });
          result.updated++;
          continue;
        }
        const doc = await UserMemory.create({
          user: userId, text,
          category: CATEGORIES.includes(op.category) ? op.category : 'other',
          importance: clampImportance(op.importance),
          source_session: sessionId,
        });
        existing.push(doc.toObject());
        result.added++;
      } else if (kind === 'update' || kind === 'delete') {
        const realId = idMap.get(String(op.id));
        if (!realId) { result.skipped++; continue; }
        if (kind === 'delete') {
          const r = await UserMemory.deleteOne({ _id: realId, user: userId });
          result.deleted += r.deletedCount;
          continue;
        }
        const set = {};
        if (op.text && clean(op.text).length >= 3) set.text = clean(op.text);
        if (op.importance !== undefined) set.importance = clampImportance(op.importance);
        if (op.category && CATEGORIES.includes(op.category)) set.category = op.category;
        const r = await UserMemory.updateOne({ _id: realId, user: userId }, { $set: set, $inc: { times_seen: 1 } });
        result.updated += r.modifiedCount;
      } else {
        result.skipped++;
      }
    }
    await this.enforceLimit(userId);
    return result;
  }

  // keep the most important, most recently touched MAX_MEMORIES
  async enforceLimit(userId) {
    const count = await UserMemory.countDocuments({ user: userId });
    if (count <= MAX_MEMORIES) return 0;
    const drop = await UserMemory.find({ user: userId }).sort({ importance: 1, updatedAt: 1 }).limit(count - MAX_MEMORIES).select('_id').lean();
    await UserMemory.deleteMany({ _id: { $in: drop.map(d => d._id) } });
    return drop.length;
  }

  // Read new messages and update the list (on the user's own key). Silent no-op when turned off.
  async learnFromMessages(userId, messages, apiKey, { model = undefined, sessionId = null } = {}) {
    const text = Array.isArray(messages) ? messages.join('\n') : String(messages || '');
    if (!apiKey || text.trim().length < 20) return null;
    if (!(await this.isEnabled(userId))) return null;
    const current = await this.list(userId);
    const idMap = new Map(current.map((m, i) => [`m${i + 1}`, m._id]));
    const existing = current.map((m, i) => ({ id: `m${i + 1}`, text: m.text, category: m.category, importance: m.importance }));
    const raw = await this.llm.extractMemories(existing, text, apiKey, { model });
    return this.applyOperations(userId, raw?.operations, { idMap, sessionId });
  }

  // ---- what Talk knows when it replies ----

  async memoryContext(userId) {
    if (!(await this.isEnabled(userId))) return '';
    const notes = await this.list(userId);
    if (!notes.length) return '';
    return `Things they told you before (most important first):\n${notes.map(n => `- ${n.text}`).join('\n')}`;
  }

  // their last few moods, in their own timezone, with the notes they wrote
  async moodContext(userId, { now = new Date() } = {}) {
    const user = await User.findById(userId).select('timezone').lean();
    const moods = await Mood.find({ user: userId, timestamp: { $gte: new Date(now - RECENT_MOOD_DAYS * 86400000) } })
      .sort({ timestamp: -1 }).limit(RECENT_MOODS).select('mood note timestamp').lean();
    if (!moods.length) return '';
    let tz = 'UTC';
    try { if (user?.timezone) { new Intl.DateTimeFormat('en', { timeZone: user.timezone }); tz = user.timezone; } } catch {}
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const lines = moods.map(m => `- ${fmt.format(m.timestamp)}: ${m.mood?.name || m.mood?.code}${m.note ? ` ("${String(m.note).slice(0, 160)}")` : ''}`);
    return `How they've been feeling lately (their mood check-ins, newest first):\n${lines.join('\n')}`;
  }

  async forget(userId, memoryId) {
    const r = await UserMemory.deleteOne({ _id: memoryId, user: userId });
    return r.deletedCount > 0;
  }

  async forgetAll(userId) {
    const r = await UserMemory.deleteMany({ user: userId });
    return r.deletedCount;
  }
}

module.exports = new MemoryService();
module.exports.MemoryService = MemoryService;
module.exports.MAX_MEMORIES = MAX_MEMORIES;
module.exports.EXTRACT_EVERY = EXTRACT_EVERY;
