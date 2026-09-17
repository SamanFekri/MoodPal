// Telegram handlers for the personality feature. All logic lives in
// src/personality/service.js; this file only talks to Telegram.
const { personality: msgs } = require('../constants');
const personalityService = require('../personality/service');

// Reply or edit-in-place depending on whether we came from a button
async function show(ctx, text, keyboard, { edit = false } = {}) {
  const extra = { parse_mode: 'HTML', reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined };
  if (edit && ctx.callbackQuery?.message) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (error) {
      // message unchanged / too old to edit -> fall back to a new message
      if (!/message is not modified/.test(error.message)) return ctx.reply(text, extra);
      return null;
    }
  }
  return ctx.reply(text, extra);
}

async function renderQuestion(ctx, state, { edit }) {
  const { session, test, current } = state;
  return show(ctx, msgs.questionMsg(test, current.question, current.index, current.total), msgs.questionKeyboard(test, session._id, current.question), { edit });
}

// Entry point: 🧠 Personality Test button / /personality_test
async function personalityTestCommand(ctx) {
  try {
    const active = await personalityService.getActiveSession(ctx.user._id);
    if (active) {
      const loaded = await personalityService.getTest(active.test_key);
      if (loaded) {
        return show(ctx, msgs.resumeOrRestartMsg(loaded.test, active.answers.length, loaded.questions.length), msgs.resumeKeyboard(active.test_key));
      }
    }
    const tests = await personalityService.listTests({ userId: ctx.user._id });
    if (tests.length === 0) return ctx.reply(msgs.noTestsMsg());
    return show(ctx, msgs.chooseTestMsg(tests), msgs.testListKeyboard(tests));
  } catch (error) {
    console.error('Error in personality_test command:', error);
  }
}

// Entry point: 🧠 My Personality button / /my_personality
async function myPersonalityCommand(ctx, { edit = false } = {}) {
  try {
    const profile = await personalityService.getProfile(ctx.user._id);
    const summary = await personalityService.getProfileSummary(ctx.user._id);
    return show(ctx, summary, msgs.profileKeyboard(Boolean(profile)), { edit });
  } catch (error) {
    console.error('Error in my_personality command:', error);
  }
}

async function startTest(ctx, testKey) {
  const state = await personalityService.startTest(ctx.user._id, testKey);
  const current = personalityService.currentQuestion(state.session, state.questions);
  await show(ctx, msgs.testIntroMsg(state.test), null, { edit: true });
  return renderQuestion(ctx, { ...state, current }, { edit: false });
}

async function continueTest(ctx) {
  const session = await personalityService.getActiveSession(ctx.user._id);
  if (!session) return show(ctx, msgs.sessionExpiredMsg(), null, { edit: true });
  const loaded = await personalityService.getTest(session.test_key);
  const current = personalityService.currentQuestion(session, loaded.questions);
  return renderQuestion(ctx, { session, ...loaded, current }, { edit: true });
}

// ptest_start_<key> | ptest_continue | ptest_cancel
async function testCallback(ctx) {
  try {
    const data = ctx.callbackQuery.data.slice(msgs.CALLBACK.TEST_PREFIX.length);
    if (data.startsWith('start_')) {
      await ctx.answerCbQuery();
      return await startTest(ctx, data.slice('start_'.length));
    }
    if (data === 'continue') {
      await ctx.answerCbQuery();
      return await continueTest(ctx);
    }
    if (data === 'cancel') {
      const cancelled = await personalityService.cancelTest(ctx.user._id);
      await ctx.answerCbQuery(cancelled ? 'Cancelled' : undefined);
      return await show(ctx, cancelled ? msgs.cancelledMsg() : msgs.nothingToCancelMsg(), null, { edit: true });
    }
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in personality test callback:', error);
    ctx.answerCbQuery('❌ Something went wrong. Please try again.').catch(() => {});
  }
}

// pq_<sessionId>_<order>_<value>
async function answerCallback(ctx) {
  try {
    const [sessionId, order, value] = ctx.callbackQuery.data.slice(msgs.CALLBACK.ANSWER_PREFIX.length).split('_');
    const state = await personalityService.answerQuestion(ctx.user._id, sessionId, Number(order), Number(value));

    if (!state.session) {
      await ctx.answerCbQuery();
      return await show(ctx, msgs.sessionExpiredMsg(), null, { edit: true });
    }
    if (!state.done) {
      await ctx.answerCbQuery();
      return await renderQuestion(ctx, state, { edit: true });
    }

    await ctx.answerCbQuery('✅ Done!');
    await show(ctx, msgs.testCompletedMsg(state.test), null, { edit: true });
    return await myPersonalityCommand(ctx);
  } catch (error) {
    console.error('Error in personality answer callback:', error);
    ctx.answerCbQuery('❌ Something went wrong. Please try again.').catch(() => {});
  }
}

// pprof_retake | pprof_reset | pprof_reset_yes | pprof_reset_no
async function profileCallback(ctx) {
  try {
    const data = ctx.callbackQuery.data.slice(msgs.CALLBACK.PROFILE_PREFIX.length);
    await ctx.answerCbQuery();
    switch (data) {
      case 'retake': {
        const tests = await personalityService.listTests({ userId: ctx.user._id });
        if (tests.length === 0) return show(ctx, msgs.noTestsMsg(), null, { edit: true });
        if (tests.length === 1) return startTest(ctx, tests[0].key);
        return show(ctx, msgs.chooseTestMsg(tests), msgs.testListKeyboard(tests), { edit: true });
      }
      case 'reset':
        return show(ctx, msgs.profileResetConfirmMsg(), msgs.resetConfirmKeyboard(), { edit: true });
      case 'reset_yes':
        await personalityService.resetProfile(ctx.user._id);
        return show(ctx, msgs.profileResetDoneMsg(), null, { edit: true });
      case 'reset_no':
        return show(ctx, msgs.profileResetCancelledMsg(), null, { edit: true });
    }
  } catch (error) {
    console.error('Error in personality profile callback:', error);
  }
}

module.exports = {
  personalityTestCommand,
  myPersonalityCommand,
  testCallback,
  answerCallback,
  profileCallback,
};
