// Personality evolution: validating LLM-suggested updates and blending them into a
// profile gradually. Pure functions: no DB access.
const { clamp } = require('./scoring');

// Hard limits, independent of what the LLM claims
const LIMITS = {
  MAX_CHANGE: 0.25,          // |change| per suggestion
  MAX_EVIDENCE_LENGTH: 500,
  MAX_UPDATES_PER_BATCH: 10,
  MIN_CONFIDENCE: 0.05,       // below this a suggestion is noise
};

/**
 * Validate the raw JSON returned by the LLM against the trait catalog.
 * Never throws for bad LLM output; returns what can be applied and why the rest was rejected.
 *
 * @param {any} raw - parsed JSON (or string) from the LLM
 * @param {Object<string, object>} traitsByKey - enabled traits from personality_traits
 * @returns {{valid: object[], rejected: Array<{update:any, reason:string}>}}
 */
function validateLLMUpdates(raw, traitsByKey) {
  const rejected = [];
  const valid = [];

  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return { valid, rejected: [{ update: raw, reason: 'invalid_json' }] }; }
  }
  const updates = parsed && Array.isArray(parsed.updates) ? parsed.updates : null;
  if (!updates) {
    return { valid, rejected: [{ update: parsed, reason: 'missing_updates_array' }] };
  }

  const seen = new Set();
  for (const update of updates.slice(0, LIMITS.MAX_UPDATES_PER_BATCH)) {
    if (!update || typeof update !== 'object') { rejected.push({ update, reason: 'not_an_object' }); continue; }

    const trait = typeof update.trait === 'string' ? update.trait.trim() : '';
    const def = traitsByKey[trait];
    if (!def) { rejected.push({ update, reason: 'unknown_trait' }); continue; }
    if (def.enabled === false) { rejected.push({ update, reason: 'trait_disabled' }); continue; }
    if (seen.has(trait)) { rejected.push({ update, reason: 'duplicate_trait' }); continue; }

    const confidence = Number(update.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) { rejected.push({ update, reason: 'invalid_confidence' }); continue; }
    if (confidence < LIMITS.MIN_CONFIDENCE) { rejected.push({ update, reason: 'confidence_too_low' }); continue; }

    const hasChange = update.change !== undefined && update.change !== null;
    const hasValue = update.value !== undefined && update.value !== null;
    let change = null, value = null;
    if (hasChange) {
      change = Number(update.change);
      if (!Number.isFinite(change)) { rejected.push({ update, reason: 'invalid_change' }); continue; }
      if (Math.abs(change) > LIMITS.MAX_CHANGE) { rejected.push({ update, reason: 'change_out_of_limits' }); continue; }
      if (change === 0) { rejected.push({ update, reason: 'zero_change' }); continue; }
    } else if (hasValue) {
      value = Number(update.value);
      if (!Number.isFinite(value) || value < def.min_value || value > def.max_value) { rejected.push({ update, reason: 'value_out_of_range' }); continue; }
    } else {
      rejected.push({ update, reason: 'missing_change_or_value' });
      continue;
    }

    const evidence = typeof update.evidence === 'string' ? update.evidence.slice(0, LIMITS.MAX_EVIDENCE_LENGTH) : '';
    seen.add(trait);
    valid.push({ trait, change, value, confidence, evidence });
  }

  for (const extra of updates.slice(LIMITS.MAX_UPDATES_PER_BATCH)) {
    rejected.push({ update: extra, reason: 'too_many_updates' });
  }

  return { valid, rejected };
}

/**
 * Blend one observation into a trait value.
 *   effective_rate = learning_rate × confidence
 *   new            = old × (1 − effective_rate) + observed × effective_rate
 * then the result is kept within (1 − stability) of the baseline and within [min,max].
 *
 * @returns {{value:number, confidence:number, observed:number, effective_rate:number}}
 */
function blendObservation({ old, oldConfidence = 0, baseline, observed, confidence, trait }) {
  const min = trait.min_value ?? 0;
  const max = trait.max_value ?? 1;
  const anchor = Number.isFinite(baseline) ? baseline : (Number.isFinite(old) ? old : trait.default_value ?? 0.5);
  const current = Number.isFinite(old) ? old : anchor;
  const target = clamp(observed, min, max);

  const effectiveRate = clamp((trait.learning_rate ?? 0.1) * clamp(confidence), 0, 1);
  let next = current * (1 - effectiveRate) + target * effectiveRate;

  const drift = 1 - clamp(trait.stability ?? 0.5);
  next = clamp(next, anchor - drift, anchor + drift);
  next = clamp(next, min, max);

  // confidence creeps up with consistent evidence, never past 1
  const nextConfidence = clamp(oldConfidence + (1 - oldConfidence) * effectiveRate * 0.5);

  return { value: next, confidence: nextConfidence, observed: target, effective_rate: effectiveRate };
}

/**
 * Apply a list of validated updates to a plain profile object (traits/confidence/baseline maps).
 * Mutates and returns `profile`, plus a log of what happened per trait.
 */
function applyUpdates(profile, updates, traitsByKey) {
  const log = [];
  for (const update of updates) {
    const trait = traitsByKey[update.trait];
    if (!trait) continue;
    const before = profile.traits[update.trait] ?? trait.default_value ?? 0.5;
    const observed = update.change !== null && update.change !== undefined
      ? before + update.change
      : update.value;
    const result = blendObservation({
      old: before,
      oldConfidence: profile.confidence[update.trait] ?? 0,
      baseline: profile.baseline[update.trait],
      observed,
      confidence: update.confidence,
      trait,
    });
    if (profile.baseline[update.trait] === undefined) {
      profile.baseline[update.trait] = trait.default_value ?? 0.5;
    }
    profile.traits[update.trait] = result.value;
    profile.confidence[update.trait] = result.confidence;
    log.push({ trait: update.trait, before, after: result.value, observed: result.observed, confidence: update.confidence, evidence: update.evidence });
  }
  return { profile, log };
}

module.exports = { validateLLMUpdates, blendObservation, applyUpdates, LIMITS };
