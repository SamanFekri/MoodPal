// Messages and keyboards for the personality feature. Callback data prefixes:
//   ptest_*  test selection / lifecycle      pq_<session>_<order>_<value>  an answer
//   pprof_*  profile actions

export const CALLBACK = {
  TEST_PREFIX: 'ptest_',
  ANSWER_PREFIX: 'pq_',
  PROFILE_PREFIX: 'pprof_',
};

export const DISCLAIMER = '⚠️ <i>This is an approximate personality profile, not a clinical or medical diagnosis.</i>';

export const chooseTestMsg = (tests = []) => `
🧠 <b>Personality Tests</b>

Pick a test to start. You'll answer one question at a time — you can cancel anytime.
${tests.map(test => `
${test.completed ? '✅' : '📝'} <b>${test.name}</b> — ${test.question_count} questions (~${estimatedMinutes(test.question_count)} min)
<i>${test.description}</i>`).join('\n')}

${DISCLAIMER}
`;

// ~8 seconds per question
export const estimatedMinutes = (questionCount) => Math.max(1, Math.round((questionCount * 8) / 60));

export const noTestsMsg = () => `🧠 No personality tests are available right now.`;

export const resumeOrRestartMsg = (test, answered, total) => `
🧠 You have an unfinished <b>${test.name}</b> (${answered}/${total} answered).

Continue where you left off, or start over?
`;

export const testIntroMsg = (test) => `
🧠 <b>${test.name}</b>
${test.description}

${test.intro}
`;

export const questionMsg = (test, question, index, total) => `
🧠 <b>${test.name}</b> — question ${index + 1}/${total}
${progressBar(index, total)}

<b>${question.text}</b>
`;

export const cancelledMsg = () => `❌ Test cancelled. You can start again anytime from 🧠 Personality Test.`;
export const nothingToCancelMsg = () => `ℹ️ You don't have a test in progress.`;
export const sessionExpiredMsg = () => `ℹ️ That test is no longer active. Start a new one from 🧠 Personality Test.`;
export const testCompletedMsg = (test) => `✅ <b>${test.name} completed!</b> Here is your profile.\n\n💡 Take another test from 🧠 Personality Test to fill in more of it.`;

export const profileResetConfirmMsg = () => `
🗑 <b>Reset your personality profile?</b>

This deletes your test results, learned preferences and observation history. It cannot be undone.
`;
export const profileResetDoneMsg = () => `🗑 Your personality profile has been reset.`;
export const profileResetCancelledMsg = () => `👍 Your profile was kept.`;

export const progressBar = (index, total, width = 10) => {
  const filled = Math.round((index / total) * width);
  return '🟩'.repeat(filled) + '⬜️'.repeat(width - filled);
};

// ---- keyboards ----

export const testListKeyboard = (tests) => tests.map(test => ([
  { text: `${test.completed ? '✅' : '📝'} ${test.name} (${test.question_count})`, callback_data: `${CALLBACK.TEST_PREFIX}start_${test.key}` }
]));

export const resumeKeyboard = (testKey) => [
  [{ text: '▶️ Continue', callback_data: `${CALLBACK.TEST_PREFIX}continue` }],
  [
    { text: '🔄 Start over', callback_data: `${CALLBACK.TEST_PREFIX}start_${testKey}` },
    { text: '❌ Cancel', callback_data: `${CALLBACK.TEST_PREFIX}cancel` },
  ],
];

// Likert scale as one button per option, plus cancel. Labels come from the test definition.
export const questionKeyboard = (test, sessionId, question) => {
  const rows = [];
  const { min, max, labels } = test.scale;
  for (let v = min; v <= max; v++) {
    const label = labels[v - min] || String(v);
    rows.push([{ text: `${scaleEmoji(v, min, max)} ${label}`, callback_data: `${CALLBACK.ANSWER_PREFIX}${sessionId}_${question.order}_${v}` }]);
  }
  rows.push([{ text: '❌ Cancel test', callback_data: `${CALLBACK.TEST_PREFIX}cancel` }]);
  return rows;
};

const scaleEmoji = (v, min, max) => {
  const t = (v - min) / (max - min);
  return t <= 0 ? '🔴' : t < 0.5 ? '🟠' : t === 0.5 ? '⚪️' : t < 1 ? '🟢' : '💚';
};

export const profileKeyboard = (hasProfile) => {
  const rows = [[{ text: hasProfile ? '📝 Take / retake a test' : '📝 Take a test', callback_data: `${CALLBACK.PROFILE_PREFIX}retake` }]];
  if (hasProfile) rows.push([{ text: '🗑 Reset profile', callback_data: `${CALLBACK.PROFILE_PREFIX}reset` }]);
  return rows;
};

export const resetConfirmKeyboard = () => [[
  { text: '✅ Yes, reset', callback_data: `${CALLBACK.PROFILE_PREFIX}reset_yes` },
  { text: '↩️ Keep it', callback_data: `${CALLBACK.PROFILE_PREFIX}reset_no` },
]];
