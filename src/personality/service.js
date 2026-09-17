// Personality service: the single entry point handlers use. Owns all DB access for
// the personality collections and delegates math to scoring / evolution / context.
const PersonalityTrait = require('../models/personality_trait');
const PersonalityTest = require('../models/personality_test');
const PersonalityTestQuestion = require('../models/personality_test_question');
const PersonalityProfile = require('../models/personality_profile');
const PersonalityObservation = require('../models/personality_observation');
const PersonalityTestSession = require('../models/personality_test_session');
const Cache = require('../utils/cache');

const { scoreTest } = require('./scoring');
const { validateLLMUpdates, applyUpdates } = require('./evolution');
const { buildPersonalityContext, formatProfileSummary } = require('./context');

const catalogCache = new Cache(10 * 60 * 1000);

class PersonalityService {
  // llm is injectable so inference can be tested without OpenAI
  constructor({ llm = null } = {}) {
    this._llm = llm;
  }

  get llm() {
    if (!this._llm) this._llm = require('../utils/llm');
    return this._llm;
  }

  // ---------- catalog ----------

  async getTraits({ fresh = false } = {}) {
    if (!fresh) {
      const cached = catalogCache.get('traits');
      if (cached) return cached;
    }
    const traits = await PersonalityTrait.getEnabledMap();
    catalogCache.set('traits', traits);
    return traits;
  }

  clearCache() {
    catalogCache.clear();
  }

  // Enabled tests in display order, with question counts and (for a user) which ones they completed
  async listTests({ userId = null } = {}) {
    const tests = await PersonalityTest.find({ enabled: true }).sort({ order: 1, name: 1 }).lean();
    const counts = await PersonalityTestQuestion.aggregate([
      { $match: { enabled: true } },
      { $group: { _id: '$test_key', count: { $sum: 1 } } },
    ]);
    const countByKey = Object.fromEntries(counts.map(c => [c._id, c.count]));
    const completed = new Set();
    if (userId) {
      const profile = await PersonalityProfile.findByUser(userId);
      for (const source of profile?.sources || []) completed.add(source.test_key);
    }
    return tests
      .map(test => ({ ...test, question_count: countByKey[test.key] || 0, completed: completed.has(test.key) }))
      .filter(test => test.question_count > 0);
  }

  async getTest(testKey) {
    const test = await PersonalityTest.findOne({ key: testKey, enabled: true }).lean();
    if (!test) return null;
    const questions = await PersonalityTestQuestion.getForTest(testKey);
    return { test, questions };
  }

  // ---------- test sessions ----------

  getActiveSession(userId) {
    return PersonalityTestSession.findActive(userId);
  }

  // Cancels any running session for the user and starts a fresh one
  async startTest(userId, testKey) {
    const loaded = await this.getTest(testKey);
    if (!loaded || loaded.questions.length === 0) {
      throw new Error(`Unknown or empty test: ${testKey}`);
    }
    await PersonalityTestSession.updateMany({ user: userId, status: 'in_progress' }, { status: 'cancelled' });
    const session = await PersonalityTestSession.create({ user: userId, test_key: testKey });
    return { session, ...loaded };
  }

  async cancelTest(userId) {
    const result = await PersonalityTestSession.updateMany({ user: userId, status: 'in_progress' }, { status: 'cancelled' });
    return result.modifiedCount > 0;
  }

  // Current question for a session (null when all answered)
  currentQuestion(session, questions) {
    const index = session.current_index;
    if (index >= questions.length) return null;
    return { question: questions[index], index, total: questions.length };
  }

  /**
   * Record an answer. Ignores answers for a question other than the current one
   * (e.g. a stale/tapped-twice inline button) and returns the current state.
   * @returns {{done:boolean, session, test, questions, current?, result?, profile?}}
   */
  async answerQuestion(userId, sessionId, questionOrder, value) {
    const session = await PersonalityTestSession.findOne({ _id: sessionId, user: userId, status: 'in_progress' });
    if (!session) return { done: false, session: null };

    const { test, questions } = await this.getTest(session.test_key);
    const current = this.currentQuestion(session, questions);

    if (current && current.question.order === Number(questionOrder)) {
      const v = Number(value);
      if (!Number.isFinite(v) || v < test.scale.min || v > test.scale.max) {
        throw new Error(`Answer ${value} is outside the ${test.scale.min}-${test.scale.max} scale`);
      }
      session.answers.push({ question: current.question._id, order: current.question.order, value: v });
      session.current_index += 1;
    }

    const next = this.currentQuestion(session, questions);
    if (next) {
      await session.save();
      return { done: false, session, test, questions, current: next };
    }

    // all answered -> score, persist, fold into the profile
    const result = scoreTest(test, questions, session.answers.map(a => ({ order: a.order, value: a.value })));
    session.status = 'completed';
    session.completed_at = new Date();
    session.scores = result.traits;
    await session.save();
    const profile = await this.applyTestResult(userId, session, result);
    return { done: true, session, test, questions, result, profile };
  }

  // ---------- profile ----------

  async getProfile(userId) {
    const profile = await PersonalityProfile.findByUser(userId);
    return profile ? profile.toPlain() : null;
  }

  async _getOrCreateProfileDoc(userId) {
    let profile = await PersonalityProfile.findByUser(userId);
    if (!profile) profile = new PersonalityProfile({ user: userId });
    return profile;
  }

  // A test result becomes the new baseline for the traits it measured
  async applyTestResult(userId, session, result) {
    const profile = await this._getOrCreateProfileDoc(userId);
    const observations = [];
    for (const [trait, value] of Object.entries(result.traits)) {
      const before = profile.traits.get(trait);
      profile.traits.set(trait, value);
      profile.baseline.set(trait, value);
      profile.confidence.set(trait, result.confidence[trait]);
      observations.push({
        user: userId, trait, source: 'test', observed_value: value, confidence: result.confidence[trait],
        evidence: `Test ${session.test_key}`, applied: true, value_before: before, value_after: value,
      });
    }
    profile.sources.push({ test_key: session.test_key, session: session._id, taken_at: session.completed_at || new Date() });
    await profile.save();
    await PersonalityObservation.insertMany(observations);
    return profile.toPlain();
  }

  /**
   * Validate LLM output and blend accepted updates into the user's profile.
   * `raw` may be a JSON string or object shaped like { updates: [...] }; if it carries a
   * user_id it must match `userId`, otherwise the whole batch is rejected.
   * @returns {{applied: object[], rejected: object[], profile: object|null}}
   */
  async recordLLMUpdates(userId, raw, { evidenceSource = 'llm' } = {}) {
    const traits = await this.getTraits();

    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
    }
    if (parsed && parsed.user_id !== undefined && String(parsed.user_id) !== String(userId)) {
      return { applied: [], rejected: [{ update: parsed, reason: 'user_id_mismatch' }], profile: await this.getProfile(userId) };
    }

    const { valid, rejected } = validateLLMUpdates(parsed ?? raw, traits);

    const observations = rejected.map(r => ({
      user: userId,
      trait: typeof r.update?.trait === 'string' ? r.update.trait.slice(0, 100) : 'unknown',
      source: evidenceSource,
      observed_value: Number.isFinite(Number(r.update?.value)) ? Number(r.update.value) : undefined,
      change: Number.isFinite(Number(r.update?.change)) ? Number(r.update.change) : undefined,
      confidence: Number.isFinite(Number(r.update?.confidence)) ? Math.min(1, Math.max(0, Number(r.update.confidence))) : undefined,
      evidence: typeof r.update?.evidence === 'string' ? r.update.evidence.slice(0, 500) : '',
      applied: false,
      rejection_reason: r.reason,
    }));

    let profilePlain = null;
    let log = [];
    if (valid.length > 0) {
      const profileDoc = await this._getOrCreateProfileDoc(userId);
      const plain = profileDoc.toPlain();
      ({ log } = applyUpdates(plain, valid, traits));
      for (const entry of log) {
        profileDoc.traits.set(entry.trait, entry.after);
        profileDoc.confidence.set(entry.trait, plain.confidence[entry.trait]);
        if (!profileDoc.baseline.has(entry.trait)) profileDoc.baseline.set(entry.trait, plain.baseline[entry.trait]);
        observations.push({
          user: userId, trait: entry.trait, source: evidenceSource,
          observed_value: entry.observed, change: valid.find(v => v.trait === entry.trait)?.change ?? undefined,
          confidence: entry.confidence, evidence: entry.evidence,
          applied: true, value_before: entry.before, value_after: entry.after,
        });
      }
      profileDoc.observation_count += log.length;
      await profileDoc.save();
      profilePlain = profileDoc.toPlain();
    } else {
      profilePlain = await this.getProfile(userId);
    }

    if (observations.length > 0) await PersonalityObservation.insertMany(observations);
    return { applied: log, rejected, profile: profilePlain };
  }

  async resetProfile(userId) {
    const [profile, observations, sessions] = await Promise.all([
      PersonalityProfile.deleteOne({ user: userId }),
      PersonalityObservation.deleteMany({ user: userId }),
      PersonalityTestSession.deleteMany({ user: userId }),
    ]);
    return { profile: profile.deletedCount, observations: observations.deletedCount, sessions: sessions.deletedCount };
  }

  // ---------- LLM integration ----------

  // Compact context block for prompts; '' when the user has no usable profile
  async getPersonalityContext(userId) {
    const profile = await this.getProfile(userId);
    if (!profile) return '';
    return buildPersonalityContext(profile, await this.getTraits());
  }

  /**
   * Structured profile for the mini app: traits grouped by category with labels,
   * only measured ones (confidence > 0). `null` when the user has no profile.
   */
  async getProfileView(userId) {
    const [profile, traits] = await Promise.all([this.getProfile(userId), this.getTraits()]);
    if (!profile) return null;
    const { CATEGORY_NAMES } = require('./catalog.seed');
    const { describe, MIN_CONFIDENCE_FOR_CONTEXT } = require('./context');
    const categories = [];
    for (const [key, name] of Object.entries(CATEGORY_NAMES)) {
      const rows = Object.values(traits)
        .filter(t => t.category === key)
        .filter(t => profile.traits[t.key] !== undefined && (profile.confidence[t.key] ?? 0) >= MIN_CONFIDENCE_FOR_CONTEXT)
        .map(t => ({
          key: t.key,
          name: t.name,
          description: t.description,
          value: Math.round(profile.traits[t.key] * 1000) / 1000,
          confidence: Math.round((profile.confidence[t.key] ?? 0) * 1000) / 1000,
          label: describe(t.key, profile.traits[t.key]),
        }));
      if (rows.length) categories.push({ key, name, traits: rows });
    }
    if (categories.length === 0) return null;
    return {
      categories,
      measured: categories.reduce((n, c) => n + c.traits.length, 0),
      total: Object.keys(traits).length,
      tests_taken: [...new Set((profile.sources || []).map(s => s.test_key))],
      observation_count: profile.observation_count,
      updated_at: profile.sources?.at(-1)?.taken_at || null,
    };
  }

  async getProfileSummary(userId) {
    const [profile, traits] = await Promise.all([this.getProfile(userId), this.getTraits()]);
    return formatProfileSummary(profile, traits);
  }

  // Ask the LLM what a piece of conversation reveals, then apply it gradually
  async inferFromText(userId, text, apiKey) {
    if (!apiKey || !text || text.trim().length === 0) return { applied: [], rejected: [], profile: null };
    const traits = await this.getTraits();
    const raw = await this.llm.inferPersonalityUpdates(text, apiKey, Object.values(traits));
    return this.recordLLMUpdates(userId, raw);
  }
}

module.exports = new PersonalityService();
module.exports.PersonalityService = PersonalityService;
