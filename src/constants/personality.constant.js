// Messages and keyboards for the personality feature. Callback data prefixes:
//   ptest_*  test selection / lifecycle      pq_<session>_<order>_<value>  an answer
//   pprof_*  profile actions
// Texts come from src/i18n (`t.personality`); `t` is the user's dictionary, English by default.
// Tests and questions passed in here are already in the user's language (src/i18n/personality.js).
const en = require('../i18n/en');

const CALLBACK = {
  TEST_PREFIX: 'ptest_',
  ANSWER_PREFIX: 'pq_',
  PROFILE_PREFIX: 'pprof_',
};

const P = (t) => (t || en).personality;

// ~8 seconds per question
const estimatedMinutes = (questionCount) => Math.max(1, Math.round((questionCount * 8) / 60));

const progressBar = (index, total, width = 10) => {
  const filled = Math.round((index / total) * width);
  return '🟩'.repeat(filled) + '⬜️'.repeat(width - filled);
};

const chooseTestMsg = (tests = [], t) => `
${P(t).chooseTestTitle}

${P(t).chooseTestIntro}
${tests.map(test => `
${test.completed ? '✅' : '📝'} ${P(t).testLine(test.name, test.question_count, estimatedMinutes(test.question_count))}
<i>${test.description}</i>`).join('\n')}

${P(t).disclaimer}
`;

const testIntroMsg = (test) => `
🧠 <b>${test.name}</b>
${test.description}

${test.intro}
`;

const questionMsg = (test, question, index, total, t) => `
${P(t).questionHeader(test.name, index + 1, total)}
${progressBar(index, total)}

<b>${question.text}</b>
`;

// ---- keyboards ----

const testListKeyboard = (tests) => tests.map(test => ([
  { text: `${test.completed ? '✅' : '📝'} ${test.name} (${test.question_count})`, callback_data: `${CALLBACK.TEST_PREFIX}start_${test.key}` }
]));

const resumeKeyboard = (testKey, t) => [
  [{ text: P(t).continueButton, callback_data: `${CALLBACK.TEST_PREFIX}continue` }],
  [
    { text: P(t).startOverButton, callback_data: `${CALLBACK.TEST_PREFIX}start_${testKey}` },
    { text: P(t).cancelButton, callback_data: `${CALLBACK.TEST_PREFIX}cancel` },
  ],
];

const scaleEmoji = (v, min, max) => {
  const x = (v - min) / (max - min);
  return x <= 0 ? '🔴' : x < 0.5 ? '🟠' : x === 0.5 ? '⚪️' : x < 1 ? '🟢' : '💚';
};

// Likert scale as one button per option, plus cancel. Labels come from the test definition.
const questionKeyboard = (test, sessionId, question, t) => {
  const rows = [];
  const { min, max, labels } = test.scale;
  for (let v = min; v <= max; v++) {
    const label = labels[v - min] || String(v);
    rows.push([{ text: `${scaleEmoji(v, min, max)} ${label}`, callback_data: `${CALLBACK.ANSWER_PREFIX}${sessionId}_${question.order}_${v}` }]);
  }
  rows.push([{ text: P(t).cancelTestButton, callback_data: `${CALLBACK.TEST_PREFIX}cancel` }]);
  return rows;
};

const profileKeyboard = (hasProfile, t) => {
  const rows = [[{ text: hasProfile ? P(t).retakeTestButton : P(t).takeTestButton, callback_data: `${CALLBACK.PROFILE_PREFIX}retake` }]];
  if (hasProfile) rows.push([{ text: P(t).resetProfileButton, callback_data: `${CALLBACK.PROFILE_PREFIX}reset` }]);
  return rows;
};

const resetConfirmKeyboard = (t) => [[
  { text: P(t).resetYesButton, callback_data: `${CALLBACK.PROFILE_PREFIX}reset_yes` },
  { text: P(t).keepItButton, callback_data: `${CALLBACK.PROFILE_PREFIX}reset_no` },
]];

module.exports = {
  CALLBACK,
  DISCLAIMER: en.personality.disclaimer,
  estimatedMinutes,
  progressBar,
  chooseTestMsg,
  testIntroMsg,
  questionMsg,
  testListKeyboard,
  resumeKeyboard,
  questionKeyboard,
  profileKeyboard,
  resetConfirmKeyboard,
};
