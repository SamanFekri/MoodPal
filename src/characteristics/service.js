// Admin-only "characteristics": an OpenAI read of how a person tends to communicate and what kind
// of approach they welcome, from data MoodPal already has (personality profile, mood check-ins
// with notes, notes remembered from Talk). It runs only when an admin asks for it, never on its own,
// and every run is kept. Results are communication observations, not diagnoses: anything clinical
// the model writes anyway is dropped before saving.
const User = require('../models/user');
const Mood = require('../models/mood');
const UserMemory = require('../models/user_memory');
const CharacteristicAnalysis = require('../models/characteristic_analysis');
const personalityService = require('../personality/service');
const { CHARACTERISTICS, BY_KEY } = require('./catalog');

const MAX_MOODS = 150;               // most recent check-ins sent
const MAX_NOTE = 280;
const MAX_MEMORIES = 60;
const MAX_INPUT_CHARS = 30000;
const MIN_CONFIDENCE = 0.5;
const MAX_CHARACTERISTICS = 8;

// clinical labels the analysis must never contain
const CLINICAL = /\b(depress(?:ion|ed|ive)|anxiety disorder|adhd|bipolar|ptsd|ocd|autis(?:m|tic)|asperger|narcissis(?:m|t|tic)|personality disorder|borderline|psychopath\w*|sociopath\w*|schizo\w*|disorder\w*|diagnos\w*|mental illness|mentally ill)\b/i;

class CharacteristicsError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const text = (v, max = 400) => String(v ?? '').replace(/\s*(?:—|–|--)\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max);
// drop the sentences that use a clinical label, keep the rest
const scrub = (v, max) => text(v, max).split(/(?<=[.!?])\s+/).filter(s => !CLINICAL.test(s)).join(' ').trim();
const list = (v, { max = 6, len = 200 } = {}) => (Array.isArray(v) ? v : [])
  .map(x => text(x, len)).filter(x => x && !CLINICAL.test(x)).slice(0, max);

class CharacteristicsService {
  constructor({ llm = null } = {}) {
    this._llm = llm;
    this.running = new Set();          // people being analyzed right now (one run at a time each)
  }

  get llm() {
    if (!this._llm) this._llm = require('../utils/llm');
    return this._llm;
  }

  // the server's key (OPENAI_API_KEY) if set, otherwise the requesting admin's own saved key
  async resolveKey(adminId) {
    const admin = await User.findById(adminId).select('openai_model').lean();
    const model = process.env.OPENAI_MODEL || admin?.openai_model || this.llm.DEFAULT_MODEL || 'gpt-5.6';
    if (process.env.OPENAI_API_KEY) return { apiKey: process.env.OPENAI_API_KEY, source: 'server', model };
    const apiKey = await User.getOpenAIKey(adminId);
    return apiKey ? { apiKey, source: 'admin', model } : null;
  }

  // What is sent to OpenAI: no name, username or ids; only what helps read how they communicate.
  async buildInput(user) {
    let tz = 'UTC';
    try { if (user.timezone) { new Intl.DateTimeFormat('en', { timeZone: user.timezone }); tz = user.timezone; } } catch {}
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

    const [moods, profile, memories] = await Promise.all([
      Mood.find({ user: user._id }).sort({ timestamp: -1 }).limit(MAX_MOODS).select('mood note timestamp').lean(),
      personalityService.getProfileView(user._id, { withEvidence: true }).catch(() => null),   // evidence: what they said in Talk
      user.memory_enabled === false ? [] : UserMemory.find({ user: user._id }).sort({ importance: -1, updatedAt: -1 }).limit(MAX_MEMORIES).select('text category importance').lean(),
    ]);

    const traits = (profile?.categories || []).flatMap(c => c.traits.map(t => ({
      trait: t.name, area: c.name, value: Math.round(t.value * 100), level: t.label, confidence: Math.round(t.confidence * 100),
    })));
    const checkins = moods.map(m => ({ when: fmt.format(m.timestamp), mood: m.mood?.name || m.mood?.code, ...(m.note ? { note: text(m.note, MAX_NOTE) } : {}) }));
    const counts = {};
    for (const m of moods) { const k = m.mood?.name || m.mood?.code; if (k) counts[k] = (counts[k] || 0) + 1; }

    const data = {
      timezone: tz,
      mood_checkins_total: moods.length,
      mood_counts: counts,
      personality: {
        // their result in the MBTI-style test, with how strongly each letter came out
        ...(profile?.mbti ? { mbti_style_type: { type: profile.mbti.type, letters: profile.mbti.dimensions.map(d => ({ letter: d.letter, strength_percent: d.percent })) } } : {}),
        traits,
        // what the AI picked up from their conversations in Talk: where the trait is now, how far
        // talking moved it, in how many conversations, and what they said that moved it last
        ...(profile?.from_talks?.length ? { learned_from_talks: profile.from_talks.map(t => ({
          trait: t.name, value: Math.round((t.value || 0) * 100), moved_by: Math.round((t.change || 0) * 100), conversations: t.talks,
          ...(t.evidence ? { what_they_said: text(t.evidence, 160) } : {}),
        })) } : {}),
      },
      mood_checkins: checkins,
      conversation_notes: memories.map(m => ({ text: m.text, about: m.category, importance: m.importance })),
    };
    // stay within budget: the oldest check-ins go first
    while (JSON.stringify(data).length > MAX_INPUT_CHARS && data.mood_checkins.length > 10) data.mood_checkins.pop();

    const sent = moods.slice(0, data.mood_checkins.length);
    return {
      data,
      used: {
        moods: sent.length,
        notes: sent.filter(m => m.note && String(m.note).trim()).length,
        traits: traits.length,
        mbti: profile?.mbti?.type || null,
        talk_traits: profile?.from_talks?.length || 0,
        memories: memories.length,
        from: sent.length ? sent[sent.length - 1].timestamp : null,
        to: sent.length ? sent[0].timestamp : null,
      },
    };
  }

  // keep only catalog characteristics with real evidence and enough confidence; nothing clinical
  sanitize(raw) {
    const seen = new Set();
    const characteristics = (Array.isArray(raw?.characteristics) ? raw.characteristics : [])
      .map(c => {
        const def = BY_KEY.get(String(c?.key || '').trim());
        const confidence = Number(c?.confidence);
        if (!def || seen.has(def.key) || !Number.isFinite(confidence)) return null;
        const evidence = scrub(c.evidence, 400);
        if (!evidence) return null;
        seen.add(def.key);
        return {
          key: def.key,
          name: def.name,
          description: scrub(c.description, 240) || def.description,
          confidence: Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100,
          evidence,
          communication_recommendation: scrub(c.communication_recommendation, 240),
          how_to_communicate: list(c.how_to_communicate, { max: 5, len: 160 }),
          example: scrub(c.example, 240),
        };
      })
      .filter(c => c && c.confidence >= MIN_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_CHARACTERISTICS);

    const g = raw?.guide || {};
    const guide = {
      overall_communication_style: scrub(g.overall_communication_style, 400),
      what_works: list(g.what_works),
      what_to_avoid: list(g.what_to_avoid),
      best_approach: scrub(g.best_approach, 700),
      example_phrases: list(g.example_phrases, { max: 4, len: 240 }),
    };
    const insufficient = raw?.insufficient_evidence === true || characteristics.length === 0;
    return {
      status: insufficient ? 'insufficient_evidence' : 'ok',
      characteristics: insufficient ? [] : characteristics,
      guide: insufficient ? { overall_communication_style: '', what_works: [], what_to_avoid: [], best_approach: '', example_phrases: [] } : guide,
    };
  }

  /** Runs one analysis for `user` on behalf of `adminId` and saves it. Throws CharacteristicsError. */
  async calculate(user, adminId) {
    const id = String(user._id);
    if (this.running.has(id)) throw new CharacteristicsError('already_running');
    this.running.add(id);
    try {
      const key = await this.resolveKey(adminId);
      if (!key) throw new CharacteristicsError('no_key');
      const { data, used } = await this.buildInput(user);

      let result;
      if (!used.moods && !used.traits && !used.memories && !used.mbti && !used.talk_traits) {
        // nothing to read: no need to ask OpenAI
        result = this.sanitize({ insufficient_evidence: true });
      } else {
        let raw;
        try {
          raw = await this.llm.analyzeCharacteristics(CHARACTERISTICS, data, key.apiKey, { model: key.model });
        } catch (error) {
          if (this.llm.isAuthError?.(error)) throw new CharacteristicsError('bad_key', error.message);
          if (this.llm.isModelError?.(error)) throw new CharacteristicsError('model_unavailable', error.message);
          throw new CharacteristicsError('openai_failed', error.message);
        }
        result = this.sanitize(raw);
      }

      const doc = await CharacteristicAnalysis.create({ user: user._id, requested_by: adminId, model: key.model, key_source: key.source, ...result, data_used: used });
      return this.view(doc.toObject());
    } finally {
      this.running.delete(id);
    }
  }

  async latest(userId) {
    const doc = await CharacteristicAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }).lean();
    return doc ? this.view(doc) : null;
  }

  async get(userId, analysisId) {
    const doc = await CharacteristicAnalysis.findOne({ _id: analysisId, user: userId }).lean().catch(() => null);
    return doc ? this.view(doc) : null;
  }

  // every past run, newest first, short form (for the history list)
  async history(userId, limit = 20) {
    const docs = await CharacteristicAnalysis.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).select('model status characteristics.name characteristics.confidence createdAt').lean();
    return docs.map(d => ({ id: String(d._id), created_at: d.createdAt, model: d.model, status: d.status, names: (d.characteristics || []).map(c => c.name) }));
  }

  view(d) {
    return {
      id: String(d._id),
      created_at: d.createdAt,
      model: d.model,
      key_source: d.key_source,
      status: d.status,
      characteristics: d.characteristics || [],
      guide: d.guide,
      data_used: d.data_used,
    };
  }
}

module.exports = new CharacteristicsService();
module.exports.CharacteristicsService = CharacteristicsService;
module.exports.CharacteristicsError = CharacteristicsError;
module.exports.CLINICAL = CLINICAL;
