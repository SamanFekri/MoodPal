// Seed data for the personality catalog: trait registry, tests and questions.
// Applied by src/personality/migrate.js (idempotent, versioned). Tuning a trait's
// learning_rate / stability / enabled flag in the DB survives re-runs unless the
// seed's `version` is bumped.

// Category defaults: Big Five is slow-changing, communication style adapts fast.
//   stability     = how far a trait may drift from its baseline (1 - stability)
//   learning_rate = share of an observation blended in per update (× confidence)
const CATEGORY_DEFAULTS = {
  big_five:            { stability: 0.9,  learning_rate: 0.03 },
  big_five_facet:      { stability: 0.85, learning_rate: 0.04 },
  communication:       { stability: 0.3,  learning_rate: 0.2 },
  emotional_style:     { stability: 0.5,  learning_rate: 0.12 },
  thinking_style:      { stability: 0.6,  learning_rate: 0.1 },
  behavioral:          { stability: 0.6,  learning_rate: 0.1 },
};

const CATEGORY_NAMES = {
  big_five: 'Big Five',
  big_five_facet: 'Big Five facets',
  communication: 'Communication preferences',
  emotional_style: 'Conversation & emotional style',
  thinking_style: 'Thinking & decision style',
  behavioral: 'Behavioral preferences',
};

// [key, name, description]
const TRAIT_ROWS = {
  big_five: [
    ['openness', 'Openness', 'Curiosity, imagination and openness to new ideas and experiences.'],
    ['conscientiousness', 'Conscientiousness', 'Organisation, dependability and self-discipline.'],
    ['extraversion', 'Extraversion', 'Sociability, energy and enjoyment of being around people.'],
    ['agreeableness', 'Agreeableness', 'Compassion, cooperativeness and trust in others.'],
    ['neuroticism', 'Neuroticism', 'Tendency to experience negative emotions such as anxiety or moodiness.'],
  ],
  big_five_facet: [
    ['imagination', 'Imagination', 'Rich fantasy life and vivid mental imagery.'],
    ['artistic_interest', 'Artistic interest', 'Appreciation of art, beauty and aesthetics.'],
    ['emotionality', 'Emotionality', 'Awareness of and openness to one\'s own feelings.'],
    ['adventurousness', 'Adventurousness', 'Eagerness to try new activities and experiences.'],
    ['intellect', 'Intellect', 'Interest in abstract ideas and intellectual challenges.'],
    ['self_efficacy', 'Self-efficacy', 'Confidence in one\'s ability to accomplish things.'],
    ['orderliness', 'Orderliness', 'Preference for structure, tidiness and organisation.'],
    ['achievement_striving', 'Achievement striving', 'Drive to set and reach ambitious goals.'],
    ['self_discipline', 'Self-discipline', 'Ability to start and finish tasks despite distractions.'],
    ['friendliness', 'Friendliness', 'Warmth and ease in making friends.'],
    ['gregariousness', 'Gregariousness', 'Enjoyment of crowds and group company.'],
    ['assertiveness', 'Assertiveness', 'Taking charge and speaking up.'],
    ['activity_level', 'Activity level', 'Pace of life and preference for being busy.'],
    ['excitement_seeking', 'Excitement seeking', 'Craving stimulation and thrills.'],
    ['cheerfulness', 'Cheerfulness', 'Tendency to feel joy and optimism.'],
    ['trust', 'Trust', 'Belief that others are honest and well-intentioned.'],
    ['altruism', 'Altruism', 'Genuine concern for and willingness to help others.'],
    ['cooperation', 'Cooperation', 'Preference for compromise over confrontation.'],
    ['modesty', 'Modesty', 'Reluctance to claim superiority over others.'],
    ['sympathy', 'Sympathy', 'Tender-heartedness and compassion.'],
    ['anxiety', 'Anxiety', 'Tendency to worry and feel tense.'],
    ['anger', 'Anger', 'How easily frustration turns into irritation or anger.'],
    ['depression', 'Depression', 'Tendency towards low mood and discouragement.'],
    ['self_consciousness', 'Self-consciousness', 'Sensitivity to what others think; shyness.'],
    ['vulnerability', 'Vulnerability', 'Difficulty coping under stress or pressure.'],
  ],
  communication: [
    ['communication_directness', 'Directness', 'Preference for blunt, straight-to-the-point communication over softened phrasing.'],
    ['communication_formality', 'Formality', 'Preference for formal language over casual, relaxed tone.'],
    ['preferred_response_length', 'Response length', 'Preference for detailed, long answers (high) versus concise ones (low).'],
    ['technical_depth', 'Technical depth', 'Desire for technical, in-depth explanations.'],
    ['explanation_detail', 'Explanation detail', 'Desire for step-by-step, thorough explanations.'],
    ['preference_for_examples', 'Examples', 'How much the user values concrete examples.'],
    ['preference_for_summaries', 'Summaries', 'How much the user values TL;DR style summaries.'],
  ],
  emotional_style: [
    ['emotional_expressiveness', 'Emotional expressiveness', 'How openly the user shares feelings in conversation.'],
    ['emotional_support_preference', 'Emotional support preference', 'Preference for empathy and validation over pure problem-solving.'],
    ['humor_preference', 'Humor', 'Appreciation of jokes and playful tone.'],
    ['seriousness', 'Seriousness', 'Preference for a serious, focused tone.'],
    ['enthusiasm', 'Enthusiasm', 'Energy and excitement expressed in conversation.'],
    ['warmth', 'Warmth', 'Preference for a friendly, caring tone.'],
  ],
  thinking_style: [
    ['analytical_thinking', 'Analytical thinking', 'Reliance on logic, data and structured reasoning.'],
    ['intuitive_thinking', 'Intuitive thinking', 'Reliance on gut feeling and pattern recognition.'],
    ['decision_speed', 'Decision speed', 'Tendency to decide quickly rather than slowly.'],
    ['deliberation', 'Deliberation', 'Tendency to weigh options carefully before acting.'],
    ['need_for_certainty', 'Need for certainty', 'Discomfort with open questions and unknowns.'],
    ['ambiguity_tolerance', 'Ambiguity tolerance', 'Comfort with vague or unresolved situations.'],
  ],
  behavioral: [
    ['risk_tolerance', 'Risk tolerance', 'Willingness to accept uncertain outcomes.'],
    ['novelty_seeking', 'Novelty seeking', 'Attraction to new things and change.'],
    ['patience', 'Patience', 'Ability to wait calmly.'],
    ['persistence', 'Persistence', 'Continuing despite setbacks.'],
    ['flexibility', 'Flexibility', 'Willingness to change plans and adapt.'],
    ['routine_preference', 'Routine preference', 'Comfort in predictable, repeated patterns.'],
    ['goal_orientation', 'Goal orientation', 'Focus on outcomes and targets.'],
    ['curiosity', 'Curiosity', 'Desire to explore and learn.'],
  ],
};

const TRAITS = Object.entries(TRAIT_ROWS).flatMap(([category, rows]) =>
  rows.map(([key, name, description]) => ({
    key,
    name,
    category,
    description,
    default_value: 0.5,
    min_value: 0,
    max_value: 1,
    stability: CATEGORY_DEFAULTS[category].stability,
    learning_rate: CATEGORY_DEFAULTS[category].learning_rate,
    enabled: true,
    version: 1,
  }))
);

// ---- Big Five test: Mini-IPIP (Donnellan et al., 2006), public domain ----
const BIG_FIVE_TEST = {
  key: 'big_five',
  name: 'Big Five personality test',
  description: '20 short statements measuring the five major personality dimensions.',
  intro: 'For each statement, pick how accurately it describes you. There are no right or wrong answers — go with your first instinct.',
  scale: {
    min: 1,
    max: 5,
    labels: ['Very inaccurate', 'Somewhat inaccurate', 'Neutral', 'Somewhat accurate', 'Very accurate'],
  },
  scoring: { method: 'likert_mean', confidence: 0.7 },
  enabled: true,
  version: 1,
};

// [trait, text, reverse]
const BIG_FIVE_ITEMS = [
  ['extraversion', 'I am the life of the party.', false],
  ['agreeableness', 'I sympathize with others\' feelings.', false],
  ['conscientiousness', 'I get chores done right away.', false],
  ['neuroticism', 'I have frequent mood swings.', false],
  ['openness', 'I have a vivid imagination.', false],
  ['extraversion', 'I don\'t talk a lot.', true],
  ['agreeableness', 'I am not interested in other people\'s problems.', true],
  ['conscientiousness', 'I often forget to put things back in their proper place.', true],
  ['neuroticism', 'I am relaxed most of the time.', true],
  ['openness', 'I am not interested in abstract ideas.', true],
  ['extraversion', 'I talk to a lot of different people at parties.', false],
  ['agreeableness', 'I feel others\' emotions.', false],
  ['conscientiousness', 'I like order.', false],
  ['neuroticism', 'I get upset easily.', false],
  ['openness', 'I have difficulty understanding abstract ideas.', true],
  ['extraversion', 'I keep in the background.', true],
  ['agreeableness', 'I am not really interested in others.', true],
  ['conscientiousness', 'I make a mess of things.', true],
  ['neuroticism', 'I seldom feel blue.', true],
  ['openness', 'I do not have a good imagination.', true],
];

const BIG_FIVE_QUESTIONS = BIG_FIVE_ITEMS.map(([trait, text, reverse], i) => ({
  test_key: 'big_five',
  order: i + 1,
  text,
  trait,
  reverse,
  enabled: true,
  version: 1,
}));

module.exports = {
  CATEGORY_DEFAULTS,
  CATEGORY_NAMES,
  TRAITS,
  TESTS: [BIG_FIVE_TEST],
  QUESTIONS: BIG_FIVE_QUESTIONS,
};
