// Builds the compact "User personality context" block that is prepended to LLM
// prompts, and the user-facing profile summary. Pure functions: no DB access.
const { levelLabel } = require('./scoring');
const { CATEGORY_NAMES } = require('./catalog.seed');

// Only traits with some evidence are included
const MIN_CONFIDENCE_FOR_CONTEXT = 0.05;

// Some communication traits read better as a preference than as a level
const SPECIAL_LABELS = {
  preferred_response_length: (v) => (v < 0.4 ? 'concise' : v < 0.65 ? 'balanced' : 'detailed'),
};

function describe(traitKey, value) {
  return SPECIAL_LABELS[traitKey] ? SPECIAL_LABELS[traitKey](value) : levelLabel(value);
}

// Sections and the traits shown in each, in display order
const CONTEXT_SECTIONS = [
  { title: null, category: 'big_five' },
  { title: 'Communication', category: 'communication' },
  { title: 'Conversation style', category: 'emotional_style' },
  { title: 'Thinking style', category: 'thinking_style' },
  { title: 'Behavior', category: 'behavioral' },
];

/**
 * @param {{traits:Object, confidence:Object}|null} profile - plain profile (see PersonalityProfile#toPlain)
 * @param {Object<string,object>} traitsByKey
 * @returns {string} '' when there is nothing to say (no profile / no evidence)
 */
function buildPersonalityContext(profile, traitsByKey) {
  if (!profile || !profile.traits) return '';

  const lines = [];
  for (const section of CONTEXT_SECTIONS) {
    const rows = Object.values(traitsByKey)
      .filter(t => t.category === section.category && t.enabled !== false)
      .filter(t => profile.traits[t.key] !== undefined && (profile.confidence?.[t.key] ?? 0) >= MIN_CONFIDENCE_FOR_CONTEXT)
      .map(t => `${t.name}: ${describe(t.key, profile.traits[t.key])}`);
    if (rows.length === 0) continue;
    if (lines.length > 0) lines.push('');
    if (section.title) lines.push(`${section.title}:`);
    lines.push(...rows);
  }

  if (lines.length === 0) return '';
  return ['User personality context:', ...lines].join('\n');
}

// Instructions that accompany the context in a system prompt
const CONTEXT_INSTRUCTIONS = 'Use this context only to adapt your tone, length and style to the user. Do not mention, list or reveal these traits unless the user explicitly asks about their personality profile.';

function bar(value, width = 10) {
  const filled = Math.round(value * width);
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

/**
 * Telegram (HTML) summary of a profile grouped by category. Only measured traits are listed.
 */
function formatProfileSummary(profile, traitsByKey, { title = '🧠 <b>My Personality</b>' } = {}) {
  const lines = [title, ''];
  const measured = Object.values(traitsByKey).filter(t =>
    profile?.traits?.[t.key] !== undefined && (profile.confidence?.[t.key] ?? 0) >= MIN_CONFIDENCE_FOR_CONTEXT
  );

  if (measured.length === 0) {
    lines.push('No personality data yet. Take the 🧠 Personality Test to build your profile.');
  } else {
    const byCategory = {};
    for (const t of measured) (byCategory[t.category] ||= []).push(t);
    for (const category of Object.keys(CATEGORY_NAMES)) {
      const traits = byCategory[category];
      if (!traits) continue;
      lines.push(`<b>${CATEGORY_NAMES[category]}</b>`);
      for (const t of traits) {
        const v = profile.traits[t.key];
        const c = profile.confidence[t.key] ?? 0;
        lines.push(`${bar(v)} ${t.name}: <i>${describe(t.key, v)}</i> (${Math.round(v * 100)}%, confidence ${Math.round(c * 100)}%)`);
      }
      lines.push('');
    }
    const unmeasured = Object.values(traitsByKey).length - measured.length;
    if (unmeasured > 0) {
      lines.push(`<i>${unmeasured} more traits will fill in as you take other tests and from your conversations.</i>`);
      lines.push('');
    }
  }

  lines.push('⚠️ <i>This is an approximate personality profile based on a short self-report questionnaire and conversation patterns. It is not a clinical or medical diagnosis.</i>');
  return lines.join('\n');
}

module.exports = { buildPersonalityContext, formatProfileSummary, describe, CONTEXT_INSTRUCTIONS, MIN_CONFIDENCE_FOR_CONTEXT };
