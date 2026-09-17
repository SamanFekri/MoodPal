const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildPersonalityContext, formatProfileSummary } = require('../../src/personality/context');
const seed = require('../../src/personality/catalog.seed');

const traitsByKey = Object.fromEntries(seed.TRAITS.map(t => [t.key, t]));

describe('personality context for the LLM', () => {
  test('returns an empty string for users without a profile', () => {
    assert.equal(buildPersonalityContext(null, traitsByKey), '');
    assert.equal(buildPersonalityContext(undefined, traitsByKey), '');
    assert.equal(buildPersonalityContext({ traits: {}, confidence: {} }, traitsByKey), '');
  });

  test('renders levels grouped by section in the expected format', () => {
    const ctx = buildPersonalityContext({
      traits: { openness: 0.8, conscientiousness: 0.62, extraversion: 0.2, agreeableness: 0.75,
        communication_directness: 0.8, technical_depth: 0.78, preferred_response_length: 0.2, communication_formality: 0.25 },
      confidence: { openness: 0.7, conscientiousness: 0.7, extraversion: 0.7, agreeableness: 0.7,
        communication_directness: 0.5, technical_depth: 0.5, preferred_response_length: 0.5, communication_formality: 0.5 },
    }, traitsByKey);

    assert.ok(ctx.startsWith('User personality context:\n'));
    assert.match(ctx, /^Openness: high$/m);
    assert.match(ctx, /^Conscientiousness: medium-high$/m);
    assert.match(ctx, /^Extraversion: low$/m);
    assert.match(ctx, /^Agreeableness: high$/m);
    assert.match(ctx, /\n\nCommunication:\n/);
    assert.match(ctx, /^Directness: high$/m);
    assert.match(ctx, /^Technical depth: high$/m);
    assert.match(ctx, /^Response length: concise$/m);
    assert.match(ctx, /^Formality: low$/m);
    // numbers never leak into the prompt
    assert.doesNotMatch(ctx, /0\.\d/);
  });

  test('skips traits with no confidence (unmeasured)', () => {
    const ctx = buildPersonalityContext({
      traits: { openness: 0.9, patience: 0.9 },
      confidence: { openness: 0.7, patience: 0 },
    }, traitsByKey);
    assert.match(ctx, /Openness/);
    assert.doesNotMatch(ctx, /Patience/);
  });

  test('ignores disabled traits', () => {
    const traits = { ...traitsByKey, openness: { ...traitsByKey.openness, enabled: false } };
    const ctx = buildPersonalityContext({ traits: { openness: 0.9 }, confidence: { openness: 0.9 } }, traits);
    assert.equal(ctx, '');
  });
});

describe('profile summary for the user', () => {
  test('always carries the non-diagnosis disclaimer', () => {
    assert.match(formatProfileSummary(null, traitsByKey), /not a clinical or medical diagnosis/);
    assert.match(formatProfileSummary({ traits: { openness: 0.7 }, confidence: { openness: 0.7 } }, traitsByKey), /not a clinical or medical diagnosis/);
  });

  test('tells users without data to take the test', () => {
    assert.match(formatProfileSummary(null, traitsByKey), /Take the 🧠 Personality Test/);
  });

  test('lists measured traits with their category', () => {
    const summary = formatProfileSummary({ traits: { openness: 0.7, curiosity: 0.6 }, confidence: { openness: 0.7, curiosity: 0.3 } }, traitsByKey);
    assert.match(summary, /<b>Big Five<\/b>/);
    assert.match(summary, /Openness: <i>high<\/i> \(70%, confidence 70%\)/);
    assert.match(summary, /<b>Behavioral preferences<\/b>/);
    assert.match(summary, /Curiosity/);
    assert.doesNotMatch(summary, /Extraversion/);
  });
});
