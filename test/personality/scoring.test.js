const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { scoreTest, itemScore, levelLabel } = require('../../src/personality/scoring');
const seed = require('../../src/personality/catalog.seed');

const bigFive = seed.TESTS.find(t => t.key === 'big_five');
const questions = seed.QUESTIONS.filter(q => q.test_key === 'big_five');

const answerAll = (value) => questions.map(q => ({ order: q.order, value }));
const answerBy = (fn) => questions.map(q => ({ order: q.order, value: fn(q) }));

describe('personality scoring', () => {
  test('is deterministic', () => {
    const answers = answerBy(q => ((q.order * 7) % 5) + 1);
    const a = scoreTest(bigFive, questions, answers);
    const b = scoreTest(bigFive, questions, answers);
    assert.deepEqual(a, b);
  });

  test('all "very accurate" gives 1.0 on non-reversed traits and 0.0 on fully reversed ones', () => {
    // openness has 1 normal + 3 reversed items, others have 2 + 2
    const result = scoreTest(bigFive, questions, answerAll(5));
    assert.equal(result.traits.extraversion, 0.5);
    assert.equal(result.traits.openness, 0.25);
  });

  test('neutral answers give 0.5 everywhere', () => {
    const result = scoreTest(bigFive, questions, answerAll(3));
    for (const value of Object.values(result.traits)) assert.equal(value, 0.5);
  });

  test('reverse-scored questions flip the item score', () => {
    const scale = bigFive.scale;
    assert.equal(itemScore(5, { reverse: true }, scale), 1);
    assert.equal(itemScore(1, { reverse: true }, scale), 5);
    assert.equal(itemScore(2, { reverse: true }, scale), 4);
    assert.equal(itemScore(4, { reverse: false }, scale), 4);
  });

  test('answering "agree" on positive and "disagree" on reversed items yields max trait', () => {
    const result = scoreTest(bigFive, questions, answerBy(q => (q.reverse ? 1 : 5)));
    for (const trait of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']) {
      assert.equal(result.traits[trait], 1, trait);
    }
    const low = scoreTest(bigFive, questions, answerBy(q => (q.reverse ? 5 : 1)));
    for (const value of Object.values(low.traits)) assert.equal(value, 0);
  });

  test('values stay within 0..1 and confidence comes from the test definition', () => {
    const result = scoreTest(bigFive, questions, answerBy(q => ((q.order * 3) % 5) + 1));
    for (const trait of Object.keys(result.traits)) {
      assert.ok(result.traits[trait] >= 0 && result.traits[trait] <= 1);
      assert.equal(result.confidence[trait], bigFive.scoring.confidence);
      assert.equal(result.item_counts[trait], 4);
    }
  });

  test('rejects missing answers and out-of-scale values', () => {
    assert.throws(() => scoreTest(bigFive, questions, answerAll(3).slice(1)), /Missing answer/);
    assert.throws(() => scoreTest(bigFive, questions, answerAll(6)), /outside/);
    assert.throws(() => scoreTest(bigFive, questions, answerAll(0)), /outside/);
  });

  test('unknown scoring method throws', () => {
    assert.throws(() => scoreTest({ ...bigFive, scoring: { method: 'nope' } }, questions, answerAll(3)), /Unknown scoring method/);
  });

  test('level labels cover the whole range', () => {
    assert.equal(levelLabel(0), 'very low');
    assert.equal(levelLabel(0.2), 'low');
    assert.equal(levelLabel(0.5), 'medium');
    assert.equal(levelLabel(0.65), 'medium-high');
    assert.equal(levelLabel(0.8), 'high');
    assert.equal(levelLabel(1), 'very high');
  });

  test('seed catalog is consistent', () => {
    const traitKeys = new Set(seed.TRAITS.map(t => t.key));
    assert.equal(traitKeys.size, seed.TRAITS.length, 'trait keys are unique');
    for (const q of seed.QUESTIONS) assert.ok(traitKeys.has(q.trait), `${q.test_key} question ${q.order} references known trait`);
    for (const t of seed.TESTS) {
      const qs = seed.QUESTIONS.filter(q => q.test_key === t.key);
      assert.ok(qs.length >= 10, `${t.key} has enough questions`);
      assert.ok(qs.some(q => q.reverse), `${t.key} has reverse-keyed items`);
      const perTrait = qs.reduce((a, q) => ((a[q.trait] = (a[q.trait] || 0) + 1), a), {});
      assert.ok(Object.values(perTrait).every(n => n >= 2), `${t.key} has at least 2 items per trait`);
      assert.equal(new Set(qs.map(q => q.order)).size, qs.length, `${t.key} orders are unique`);
    }
    assert.equal(new Set(seed.QUESTIONS.map(q => q.trait)).size, seed.TRAITS.length, 'every trait is measured by some test');
    for (const t of seed.TRAITS) {
      assert.ok(t.default_value >= 0 && t.default_value <= 1);
      assert.ok(t.learning_rate > 0 && t.learning_rate <= 1);
      assert.ok(t.stability >= 0 && t.stability <= 1);
    }
    const required = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism',
      'communication_directness', 'preferred_response_length', 'technical_depth', 'humor_preference',
      'analytical_thinking', 'risk_tolerance', 'curiosity', 'vulnerability'];
    for (const key of required) assert.ok(traitKeys.has(key), key);
  });
});
