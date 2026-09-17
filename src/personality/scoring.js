// Deterministic scoring of a completed personality test. Pure functions: no DB access.

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

// Answer value on the test's scale -> item score, with reverse-keyed items flipped
function itemScore(value, question, scale) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < scale.min || v > scale.max) {
    throw new Error(`Answer ${value} is outside the ${scale.min}-${scale.max} scale`);
  }
  return question.reverse ? (scale.max + scale.min - v) : v;
}

// mean of item scores per trait, normalised to 0..1
function likertMean(test, questions, answersByOrder) {
  const { scale } = test;
  const sums = {};
  const counts = {};
  for (const question of questions) {
    const value = answersByOrder[question.order];
    if (value === undefined || value === null) {
      throw new Error(`Missing answer for question ${question.order}`);
    }
    sums[question.trait] = (sums[question.trait] || 0) + itemScore(value, question, scale);
    counts[question.trait] = (counts[question.trait] || 0) + 1;
  }
  const traits = {};
  const raw = {};
  for (const trait of Object.keys(sums)) {
    const mean = sums[trait] / counts[trait];
    raw[trait] = mean;
    traits[trait] = clamp((mean - scale.min) / (scale.max - scale.min));
  }
  return { traits, raw, item_counts: counts };
}

const METHODS = {
  likert_mean: likertMean,
};

/**
 * @param {object} test       - personality_tests document (plain object)
 * @param {object[]} questions - ordered personality_test_questions for the test
 * @param {Array<{order:number,value:number}>} answers
 * @returns {{traits: Object<string,number>, raw: Object<string,number>, confidence: Object<string,number>, item_counts: Object<string,number>}}
 */
function scoreTest(test, questions, answers) {
  const method = METHODS[test.scoring?.method || 'likert_mean'];
  if (!method) {
    throw new Error(`Unknown scoring method: ${test.scoring?.method}`);
  }
  const answersByOrder = {};
  for (const answer of answers) {
    answersByOrder[answer.order] = answer.value;
  }
  const result = method(test, questions, answersByOrder);
  const testConfidence = test.scoring?.confidence ?? 0.7;
  result.confidence = Object.fromEntries(Object.keys(result.traits).map(t => [t, testConfidence]));
  return result;
}

// Human readable level for a 0..1 value
const LEVELS = [
  [0.15, 'very low'],
  [0.30, 'low'],
  [0.45, 'medium-low'],
  [0.55, 'medium'],
  [0.70, 'medium-high'],
  [0.85, 'high'],
  [Infinity, 'very high'],
];

function levelLabel(value) {
  for (const [limit, label] of LEVELS) {
    if (value < limit) return label;
  }
  return 'very high';
}

module.exports = { scoreTest, itemScore, levelLabel, clamp, METHODS };
