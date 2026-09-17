const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { validateLLMUpdates, blendObservation, applyUpdates, LIMITS } = require('../../src/personality/evolution');
const seed = require('../../src/personality/catalog.seed');

const traitsByKey = Object.fromEntries(seed.TRAITS.map(t => [t.key, t]));
const traitsByKeyWithDisabled = { ...traitsByKey, humor_preference: { ...traitsByKey.humor_preference, enabled: false } };

describe('LLM update validation', () => {
  test('accepts a well-formed update', () => {
    const { valid, rejected } = validateLLMUpdates({
      updates: [{ trait: 'communication_directness', change: 0.08, confidence: 0.8, evidence: 'User repeatedly requested concise answers.' }]
    }, traitsByKey);
    assert.equal(rejected.length, 0);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].trait, 'communication_directness');
    assert.equal(valid[0].change, 0.08);
  });

  test('accepts a JSON string and absolute values', () => {
    const { valid } = validateLLMUpdates(JSON.stringify({ updates: [{ trait: 'patience', value: 0.9, confidence: 0.5 }] }), traitsByKey);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].value, 0.9);
    assert.equal(valid[0].change, null);
  });

  test('rejects invalid JSON and missing updates array without throwing', () => {
    assert.equal(validateLLMUpdates('{not json', traitsByKey).rejected[0].reason, 'invalid_json');
    assert.equal(validateLLMUpdates({ foo: 1 }, traitsByKey).rejected[0].reason, 'missing_updates_array');
    assert.equal(validateLLMUpdates(null, traitsByKey).rejected[0].reason, 'missing_updates_array');
    assert.equal(validateLLMUpdates({ updates: 'nope' }, traitsByKey).rejected[0].reason, 'missing_updates_array');
  });

  test('rejects unknown and disabled traits', () => {
    const { valid, rejected } = validateLLMUpdates({ updates: [
      { trait: 'iq', change: 0.1, confidence: 0.9 },
      { trait: 'humor_preference', change: 0.1, confidence: 0.9 },
      { trait: 42, change: 0.1, confidence: 0.9 },
    ] }, traitsByKeyWithDisabled);
    assert.equal(valid.length, 0);
    assert.deepEqual(rejected.map(r => r.reason), ['unknown_trait', 'trait_disabled', 'unknown_trait']);
  });

  test('rejects change outside limits, zero change, and out-of-range values', () => {
    const { valid, rejected } = validateLLMUpdates({ updates: [
      { trait: 'patience', change: 0.5, confidence: 0.9 },
      { trait: 'curiosity', change: -0.26, confidence: 0.9 },
      { trait: 'warmth', change: 0, confidence: 0.9 },
      { trait: 'trust', value: 1.2, confidence: 0.9 },
      { trait: 'anger', value: -0.1, confidence: 0.9 },
      { trait: 'modesty', change: 'lots', confidence: 0.9 },
      { trait: 'altruism', confidence: 0.9 },
    ] }, traitsByKey);
    assert.equal(valid.length, 0);
    assert.deepEqual(rejected.map(r => r.reason), [
      'change_out_of_limits', 'change_out_of_limits', 'zero_change', 'value_out_of_range', 'value_out_of_range', 'invalid_change', 'missing_change_or_value',
    ]);
  });

  test('rejects invalid or too-low confidence', () => {
    const { rejected } = validateLLMUpdates({ updates: [
      { trait: 'patience', change: 0.1, confidence: 1.5 },
      { trait: 'patience', change: 0.1, confidence: -1 },
      { trait: 'patience', change: 0.1, confidence: 'high' },
      { trait: 'patience', change: 0.1 },
      { trait: 'patience', change: 0.1, confidence: 0.01 },
    ] }, traitsByKey);
    assert.deepEqual(rejected.map(r => r.reason), ['invalid_confidence', 'invalid_confidence', 'invalid_confidence', 'invalid_confidence', 'confidence_too_low']);
  });

  test('rejects duplicates and caps the batch size', () => {
    const many = Array.from({ length: LIMITS.MAX_UPDATES_PER_BATCH + 3 }, (_, i) => ({ trait: seed.TRAITS[i].key, change: 0.05, confidence: 0.6 }));
    const { valid, rejected } = validateLLMUpdates({ updates: [...many, { trait: seed.TRAITS[0].key, change: 0.05, confidence: 0.6 }] }, traitsByKey);
    assert.equal(valid.length, LIMITS.MAX_UPDATES_PER_BATCH);
    assert.ok(rejected.every(r => r.reason === 'too_many_updates'));
  });

  test('truncates long evidence', () => {
    const { valid } = validateLLMUpdates({ updates: [{ trait: 'patience', change: 0.1, confidence: 0.5, evidence: 'x'.repeat(2000) }] }, traitsByKey);
    assert.equal(valid[0].evidence.length, LIMITS.MAX_EVIDENCE_LENGTH);
  });
});

describe('gradual blending', () => {
  const fast = traitsByKey.communication_directness; // learning_rate 0.2, stability 0.3
  const slow = traitsByKey.openness;                  // learning_rate 0.03, stability 0.9

  test('follows new = old*(1-rate) + observed*rate with rate = learning_rate*confidence', () => {
    const r = blendObservation({ old: 0.5, baseline: 0.5, observed: 1, confidence: 1, trait: fast });
    assert.ok(Math.abs(r.value - (0.5 * 0.8 + 1 * 0.2)) < 1e-12);
    assert.equal(r.effective_rate, 0.2);
    const half = blendObservation({ old: 0.5, baseline: 0.5, observed: 1, confidence: 0.5, trait: fast });
    assert.ok(Math.abs(half.value - (0.5 * 0.9 + 1 * 0.1)) < 1e-12);
  });

  test('a single observation cannot significantly change a trait', () => {
    for (const trait of Object.values(traitsByKey)) {
      const r = blendObservation({ old: 0.5, baseline: 0.5, observed: 1, confidence: 1, trait });
      assert.ok(r.value - 0.5 <= 0.2 + 1e-12, `${trait.key} moved ${r.value - 0.5}`);
    }
  });

  test('stable traits move much less than dynamic traits for the same evidence', () => {
    const s = blendObservation({ old: 0.5, baseline: 0.5, observed: 1, confidence: 0.9, trait: slow });
    const f = blendObservation({ old: 0.5, baseline: 0.5, observed: 1, confidence: 0.9, trait: fast });
    assert.ok(f.value - 0.5 > 5 * (s.value - 0.5), `fast ${f.value} vs slow ${s.value}`);
  });

  test('stability caps total drift from the baseline', () => {
    let value = 0.5;
    for (let i = 0; i < 500; i++) {
      value = blendObservation({ old: value, baseline: 0.5, observed: 1, confidence: 1, trait: slow }).value;
    }
    assert.ok(Math.abs(value - (0.5 + (1 - slow.stability))) < 1e-9, `converged to ${value}`);

    value = 0.5;
    for (let i = 0; i < 500; i++) {
      value = blendObservation({ old: value, baseline: 0.5, observed: 0, confidence: 1, trait: fast }).value;
    }
    // 0.5 - 0.7 would be negative, so the 0..1 range wins over the drift limit
    assert.ok(Math.abs(value - Math.max(0, 0.5 - (1 - fast.stability))) < 1e-9, `converged to ${value}`);
  });

  test('never leaves the 0..1 range', () => {
    const fluid = { ...fast, stability: 0, learning_rate: 1 };
    assert.equal(blendObservation({ old: 0.95, baseline: 0.95, observed: 5, confidence: 1, trait: fluid }).value, 1);
    assert.equal(blendObservation({ old: 0.05, baseline: 0.05, observed: -5, confidence: 1, trait: fluid }).value, 0);
    assert.equal(blendObservation({ old: 0.5, baseline: 0.5, observed: 1, confidence: 3, trait: fluid }).value, 1);
  });

  test('confidence grows but never exceeds 1', () => {
    let c = 0;
    for (let i = 0; i < 200; i++) {
      c = blendObservation({ old: 0.5, oldConfidence: c, baseline: 0.5, observed: 0.6, confidence: 1, trait: fast }).confidence;
    }
    assert.ok(c > 0.9 && c <= 1);
  });

  test('applyUpdates uses trait defaults for unseen traits and records a log', () => {
    const profile = { traits: {}, confidence: {}, baseline: {} };
    const { log } = applyUpdates(profile, [{ trait: 'patience', change: 0.2, value: null, confidence: 1, evidence: 'waited calmly' }], traitsByKey);
    assert.equal(log.length, 1);
    assert.equal(log[0].before, 0.5);
    assert.equal(profile.baseline.patience, 0.5);
    assert.ok(profile.traits.patience > 0.5 && profile.traits.patience < 0.6);
    assert.ok(profile.confidence.patience > 0);
  });
});
