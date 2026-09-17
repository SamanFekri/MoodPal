const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const db = require('../helpers/db');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const { PersonalityService } = require('../../src/personality/service');
const PersonalityTrait = require('../../src/models/personality_trait');
const PersonalityTest = require('../../src/models/personality_test');
const PersonalityTestQuestion = require('../../src/models/personality_test_question');
const PersonalityProfile = require('../../src/models/personality_profile');
const PersonalityObservation = require('../../src/models/personality_observation');
const PersonalityTestSession = require('../../src/models/personality_test_session');
const User = require('../../src/models/user');
const seed = require('../../src/personality/catalog.seed');

// LLM stub: returns whatever the test queued, records what it was asked
function makeLLMStub() {
  const stub = { calls: [], next: { updates: [] } };
  stub.inferPersonalityUpdates = async (text, apiKey, traits) => {
    stub.calls.push({ text, apiKey, traitCount: traits.length });
    return stub.next;
  };
  return stub;
}

// Answer every question of a running session; answerFn(question) -> value
async function completeTest(service, userId, session, questions, answerFn) {
  let state;
  for (const q of questions) {
    state = await service.answerQuestion(userId, session._id, q.order, answerFn(q));
  }
  return state;
}

describe('personality service (database)', () => {
  let service, llm, alice, bob;

  before(async () => {
    await db.connect();
  });
  after(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    llm = makeLLMStub();
    service = new PersonalityService({ llm });
    service.clearCache();
    alice = await User.create({ id: 1001, first_name: 'Alice' });
    bob = await User.create({ id: 1002, first_name: 'Bob' });
  });

  describe('migration / catalog', () => {
    test('seeds all traits, tests and questions into their own collections', async () => {
      assert.equal(await PersonalityTrait.countDocuments(), seed.TRAITS.length);
      assert.equal(await PersonalityTest.countDocuments(), 1);
      assert.equal(await PersonalityTestQuestion.countDocuments(), 20);
      assert.equal(PersonalityTrait.collection.collectionName, 'personality_traits');
      assert.equal(PersonalityTest.collection.collectionName, 'personality_tests');
      assert.equal(PersonalityTestQuestion.collection.collectionName, 'personality_test_questions');
      assert.equal(PersonalityProfile.collection.collectionName, 'personality_profiles');
      assert.equal(PersonalityObservation.collection.collectionName, 'personality_observations');
    });

    test('is idempotent and preserves database-side tuning unless the seed version is bumped', async () => {
      await PersonalityTrait.updateOne({ key: 'patience' }, { learning_rate: 0.42, enabled: false });
      const second = await ensurePersonalityCatalog({ log: () => {} });
      assert.equal(second.traits.inserted, 0);
      assert.equal(second.traits.updated, 0);
      const patience = await PersonalityTrait.findOne({ key: 'patience' }).lean();
      assert.equal(patience.learning_rate, 0.42);
      assert.equal(patience.enabled, false);
      assert.equal(await PersonalityTrait.countDocuments(), seed.TRAITS.length);

      // a newer seed version overwrites
      await PersonalityTrait.updateOne({ key: 'patience' }, { version: 0 });
      const third = await ensurePersonalityCatalog({ log: () => {} });
      assert.equal(third.traits.updated, 1);
      assert.equal((await PersonalityTrait.findOne({ key: 'patience' }).lean()).learning_rate, seed.CATEGORY_DEFAULTS.behavioral.learning_rate);
    });

    test('trait CRUD works through the model and disabled traits drop out of the enabled map', async () => {
      await PersonalityTrait.create({ key: 'sarcasm', name: 'Sarcasm', category: 'emotional_style', learning_rate: 0.3, stability: 0.4 });
      let map = await service.getTraits({ fresh: true });
      assert.ok(map.sarcasm);
      assert.equal(map.sarcasm.default_value, 0.5);
      await PersonalityTrait.updateOne({ key: 'sarcasm' }, { enabled: false });
      map = await service.getTraits({ fresh: true });
      assert.equal(map.sarcasm, undefined);
      await PersonalityTrait.deleteOne({ key: 'sarcasm' });
      assert.equal(await PersonalityTrait.countDocuments({ key: 'sarcasm' }), 0);
      await assert.rejects(PersonalityTrait.create({ key: 'openness', name: 'dup', category: 'big_five' }), /duplicate/);
    });
  });

  describe('test flow', () => {
    test('walks through every question, scores, and saves profile + session + observations', async () => {
      const { session, questions, test: bigFive } = await service.startTest(alice._id, 'big_five');
      assert.equal(session.status, 'in_progress');
      assert.equal(questions.length, 20);

      const mid = await service.answerQuestion(alice._id, session._id, 1, 5);
      assert.equal(mid.done, false);
      assert.equal(mid.current.index, 1);
      assert.equal(mid.current.question.order, 2);

      const final = await completeTest(service, alice._id, session, questions.slice(1), q => (q.reverse ? 1 : 5));
      assert.equal(final.done, true);
      for (const t of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']) {
        assert.equal(final.result.traits[t], 1, t);
        assert.equal(final.profile.traits[t], 1);
        assert.equal(final.profile.baseline[t], 1);
        assert.equal(final.profile.confidence[t], bigFive.scoring.confidence);
      }

      const saved = await PersonalityTestSession.findById(session._id);
      assert.equal(saved.status, 'completed');
      assert.equal(saved.answers.length, 20);
      assert.equal(saved.scores.get('openness'), 1);
      assert.ok(saved.completed_at);

      const profile = await PersonalityProfile.findByUser(alice._id);
      assert.equal(profile.sources.length, 1);
      assert.equal(profile.sources[0].test_key, 'big_five');
      assert.equal(await PersonalityObservation.countDocuments({ user: alice._id, source: 'test', applied: true }), 5);
      assert.equal(await service.getActiveSession(alice._id), null);
    });

    test('ignores stale or repeated answers for a question that is not current', async () => {
      const { session } = await service.startTest(alice._id, 'big_five');
      await service.answerQuestion(alice._id, session._id, 1, 3);
      const again = await service.answerQuestion(alice._id, session._id, 1, 5); // tapped twice
      assert.equal(again.current.question.order, 2);
      const skip = await service.answerQuestion(alice._id, session._id, 7, 5);  // out of order
      assert.equal(skip.current.question.order, 2);
      const doc = await PersonalityTestSession.findById(session._id);
      assert.equal(doc.answers.length, 1);
      assert.equal(doc.answers[0].value, 3);
    });

    test('rejects answers outside the scale', async () => {
      const { session } = await service.startTest(alice._id, 'big_five');
      await assert.rejects(service.answerQuestion(alice._id, session._id, 1, 9), /outside/);
      await assert.rejects(service.answerQuestion(alice._id, session._id, 1, 'x'), /outside/);
    });

    test('cancel marks the session cancelled and leaves no profile', async () => {
      const { session } = await service.startTest(alice._id, 'big_five');
      await service.answerQuestion(alice._id, session._id, 1, 3);
      assert.equal(await service.cancelTest(alice._id), true);
      assert.equal(await service.cancelTest(alice._id), false);
      assert.equal((await PersonalityTestSession.findById(session._id)).status, 'cancelled');
      assert.equal(await service.getProfile(alice._id), null);
      const stale = await service.answerQuestion(alice._id, session._id, 2, 3);
      assert.equal(stale.session, null);
    });

    test('restart cancels the running session and starts from question 1', async () => {
      const first = await service.startTest(alice._id, 'big_five');
      await service.answerQuestion(alice._id, first.session._id, 1, 3);
      await service.answerQuestion(alice._id, first.session._id, 2, 3);
      const second = await service.startTest(alice._id, 'big_five');
      assert.notEqual(String(second.session._id), String(first.session._id));
      assert.equal(second.session.current_index, 0);
      assert.equal((await PersonalityTestSession.findById(first.session._id)).status, 'cancelled');
      assert.equal(String((await service.getActiveSession(alice._id))._id), String(second.session._id));
    });

    test('retaking the test replaces the baseline', async () => {
      const a = await service.startTest(alice._id, 'big_five');
      await completeTest(service, alice._id, a.session, a.questions, q => (q.reverse ? 1 : 5));
      assert.equal((await service.getProfile(alice._id)).traits.extraversion, 1);
      const b = await service.startTest(alice._id, 'big_five');
      await completeTest(service, alice._id, b.session, b.questions, q => (q.reverse ? 5 : 1));
      const profile = await service.getProfile(alice._id);
      assert.equal(profile.traits.extraversion, 0);
      assert.equal(profile.baseline.extraversion, 0);
      assert.equal(profile.sources.length, 2);
    });

    test('unknown test key throws', async () => {
      await assert.rejects(service.startTest(alice._id, 'mbti'), /Unknown or empty test/);
    });
  });

  describe('user isolation', () => {
    test('sessions, profiles and observations never cross users', async () => {
      const a = await service.startTest(alice._id, 'big_five');
      const b = await service.startTest(bob._id, 'big_five');

      // bob cannot answer alice's session
      const hijack = await service.answerQuestion(bob._id, a.session._id, 1, 5);
      assert.equal(hijack.session, null);
      assert.equal((await PersonalityTestSession.findById(a.session._id)).answers.length, 0);

      await completeTest(service, alice._id, a.session, a.questions, q => (q.reverse ? 1 : 5));
      await completeTest(service, bob._id, b.session, b.questions, q => (q.reverse ? 5 : 1));

      assert.equal((await service.getProfile(alice._id)).traits.openness, 1);
      assert.equal((await service.getProfile(bob._id)).traits.openness, 0);
      assert.equal(await PersonalityProfile.countDocuments(), 2);

      await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'patience', change: 0.1, confidence: 0.9 }] });
      assert.equal((await service.getProfile(bob._id)).traits.patience, undefined);
      assert.equal(await PersonalityObservation.countDocuments({ user: bob._id, source: 'llm' }), 0);

      // reset only touches one user
      await service.resetProfile(alice._id);
      assert.equal(await service.getProfile(alice._id), null);
      assert.ok(await service.getProfile(bob._id));
      assert.equal(await PersonalityObservation.countDocuments({ user: bob._id }), 5);
      assert.equal(await PersonalityObservation.countDocuments({ user: alice._id }), 0);
    });

    test('LLM output carrying a different user_id is rejected as a whole', async () => {
      const result = await service.recordLLMUpdates(alice._id, { user_id: String(bob._id), updates: [{ trait: 'patience', change: 0.1, confidence: 0.9 }] });
      assert.equal(result.applied.length, 0);
      assert.equal(result.rejected[0].reason, 'user_id_mismatch');
      assert.equal(await service.getProfile(alice._id), null);
      assert.equal(await service.getProfile(bob._id), null);
    });

    test('LLM output carrying the correct user_id is accepted', async () => {
      const result = await service.recordLLMUpdates(alice._id, { user_id: String(alice._id), updates: [{ trait: 'patience', change: 0.1, confidence: 0.9 }] });
      assert.equal(result.applied.length, 1);
    });
  });

  describe('evolution through LLM observations', () => {
    test('applies valid updates gradually and persists observations', async () => {
      const s = await service.startTest(alice._id, 'big_five');
      await completeTest(service, alice._id, s.session, s.questions, () => 3);   // everything 0.5

      const result = await service.recordLLMUpdates(alice._id, {
        updates: [
          { trait: 'communication_directness', change: 0.08, confidence: 0.8, evidence: 'User repeatedly requested concise answers.' },
          { trait: 'openness', change: 0.08, confidence: 0.8, evidence: 'Curious about new ideas.' },
          { trait: 'made_up_trait', change: 0.08, confidence: 0.8 },
          { trait: 'patience', change: 0.9, confidence: 0.8 },
        ]
      });
      assert.equal(result.applied.length, 2);
      assert.deepEqual(result.rejected.map(r => r.reason), ['unknown_trait', 'change_out_of_limits']);

      const profile = await service.getProfile(alice._id);
      const directness = profile.traits.communication_directness;
      const openness = profile.traits.openness;
      // rate = learning_rate * confidence; observed = 0.5 + 0.08
      assert.ok(Math.abs(directness - (0.5 + 0.08 * 0.2 * 0.8)) < 1e-9, `directness ${directness}`);
      assert.ok(Math.abs(openness - (0.5 + 0.08 * 0.03 * 0.8)) < 1e-9, `openness ${openness}`);
      assert.ok(directness - 0.5 > 5 * (openness - 0.5), 'communication adapts faster than Big Five');
      assert.equal(profile.observation_count, 2);

      const observations = await PersonalityObservation.find({ user: alice._id, source: 'llm' }).sort({ trait: 1 }).lean();
      assert.equal(observations.length, 4);
      const applied = observations.filter(o => o.applied);
      assert.equal(applied.length, 2);
      assert.equal(applied.find(o => o.trait === 'communication_directness').evidence, 'User repeatedly requested concise answers.');
      assert.equal(applied.find(o => o.trait === 'communication_directness').value_before, 0.5);
      const rejected = observations.filter(o => !o.applied);
      assert.deepEqual(rejected.map(o => o.rejection_reason).sort(), ['change_out_of_limits', 'unknown_trait']);
    });

    test('creates a profile from defaults for users who never took a test', async () => {
      const result = await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'humor_preference', value: 0.9, confidence: 0.6 }] });
      assert.equal(result.applied.length, 1);
      const profile = await service.getProfile(alice._id);
      assert.equal(profile.baseline.humor_preference, 0.5);
      assert.ok(profile.traits.humor_preference > 0.5 && profile.traits.humor_preference < 0.55);
      assert.equal(profile.traits.openness, undefined);
    });

    test('a single message never moves a trait far, and repeated evidence converges slowly', async () => {
      const single = await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'communication_directness', change: 0.25, confidence: 1 }] });
      assert.ok(Math.abs(single.applied[0].after - single.applied[0].before) <= 0.05 + 1e-9);

      for (let i = 0; i < 30; i++) {
        await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'communication_directness', change: 0.25, confidence: 1 }] });
      }
      const profile = await service.getProfile(alice._id);
      // stability 0.3 -> at most 0.7 away from the 0.5 baseline, i.e. never above 1 and at most 1.0 cap
      assert.ok(profile.traits.communication_directness <= 1);
      assert.ok(profile.traits.communication_directness > 0.9, `converged to ${profile.traits.communication_directness}`);
      assert.ok(profile.confidence.communication_directness > 0.5);
    });

    test('big five stays within (1 - stability) of the test baseline no matter how much evidence arrives', async () => {
      const s = await service.startTest(alice._id, 'big_five');
      await completeTest(service, alice._id, s.session, s.questions, () => 3);
      for (let i = 0; i < 100; i++) {
        await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'extraversion', change: 0.25, confidence: 1 }] });
      }
      const profile = await service.getProfile(alice._id);
      assert.ok(profile.traits.extraversion <= 0.5 + (1 - 0.9) + 1e-9, `extraversion ${profile.traits.extraversion}`);
      assert.equal(profile.baseline.extraversion, 0.5);
    });

    test('garbage LLM output is recorded as rejected and changes nothing', async () => {
      const r1 = await service.recordLLMUpdates(alice._id, 'not json at all');
      assert.equal(r1.applied.length, 0);
      assert.equal(r1.rejected[0].reason, 'invalid_json');
      const r2 = await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'openness', change: 0.1, confidence: 7 }] });
      assert.equal(r2.rejected[0].reason, 'invalid_confidence');
      assert.equal(await service.getProfile(alice._id), null);
      assert.equal(await PersonalityObservation.countDocuments({ user: alice._id, applied: false }), 2);
    });

    test('inferFromText sends the trait catalog to the LLM and applies the validated result', async () => {
      llm.next = { updates: [
        { trait: 'preferred_response_length', change: -0.1, confidence: 0.7, evidence: 'asked for short answers' },
        { trait: 'nonsense', change: 0.1, confidence: 0.7 },
      ] };
      const result = await service.inferFromText(alice._id, 'please keep it short, just the gist', 'sk-user-key');
      assert.equal(llm.calls.length, 1);
      assert.equal(llm.calls[0].apiKey, 'sk-user-key');
      assert.equal(llm.calls[0].traitCount, seed.TRAITS.length);
      assert.equal(result.applied.length, 1);
      assert.equal(result.rejected.length, 1);
      assert.ok((await service.getProfile(alice._id)).traits.preferred_response_length < 0.5);
    });

    test('inferFromText is a no-op without an API key or text', async () => {
      await service.inferFromText(alice._id, 'hello there', null);
      await service.inferFromText(alice._id, '   ', 'sk-key');
      assert.equal(llm.calls.length, 0);
      assert.equal(await service.getProfile(alice._id), null);
    });
  });

  describe('LLM context', () => {
    test('is empty for users without a profile', async () => {
      assert.equal(await service.getPersonalityContext(alice._id), '');
      assert.equal(await service.getPersonalityContext(new mongoose.Types.ObjectId()), '');
    });

    test('reflects the profile after a test and LLM updates', async () => {
      const s = await service.startTest(alice._id, 'big_five');
      await completeTest(service, alice._id, s.session, s.questions, q => (q.trait === 'extraversion' ? (q.reverse ? 5 : 1) : (q.reverse ? 1 : 5)));
      // several consistent observations are needed before a preference clearly shifts
      for (let i = 0; i < 5; i++) {
        await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'preferred_response_length', value: 0, confidence: 1 }] });
      }
      const ctx = await service.getPersonalityContext(alice._id);
      assert.match(ctx, /^User personality context:/);
      assert.match(ctx, /^Openness: very high$/m);
      assert.match(ctx, /^Extraversion: very low$/m);
      assert.match(ctx, /^Communication:$/m);
      assert.match(ctx, /^Response length: concise$/m);
      assert.doesNotMatch(ctx, /Patience/);
    });

    test('summary for a user without a profile invites them to take the test and carries the disclaimer', async () => {
      const summary = await service.getProfileSummary(alice._id);
      assert.match(summary, /Take the 🧠 Personality Test/);
      assert.match(summary, /not a clinical or medical diagnosis/);
    });
  });

  describe('reset', () => {
    test('removes profile, observations and sessions', async () => {
      const s = await service.startTest(alice._id, 'big_five');
      await completeTest(service, alice._id, s.session, s.questions, () => 3);
      await service.recordLLMUpdates(alice._id, { updates: [{ trait: 'patience', change: 0.1, confidence: 0.5 }] });
      const counts = await service.resetProfile(alice._id);
      assert.deepEqual(counts, { profile: 1, observations: 6, sessions: 1 });
      assert.equal(await service.getProfile(alice._id), null);
      assert.equal(await PersonalityTestSession.countDocuments({ user: alice._id }), 0);
      assert.equal(await service.getPersonalityContext(alice._id), '');
    });
  });
});
