// Telegram handlers for the personality feature. All logic lives in
// src/personality/service.js; this file only talks to Telegram.
const { personality: msgs } = require('../constants');
const personalityService = require('../personality/service');
const i18n = require('../i18n');
const { localizeTest, localizeQuestion, localizeCharacter } = require('../i18n/personality');

// the user's dictionary, and tests / questions in their language
const tOf = (ctx) => i18n.forCtx(ctx);
const langOf = (ctx) => ctx.user?.language;
const testIn = (ctx, test) => localizeTest(test, langOf(ctx));

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
  const { session, current } = state;
  const t = tOf(ctx);
  const test = testIn(ctx, state.test);
  const question = localizeQuestion(current.question, state.test.key, langOf(ctx));
  return show(ctx, msgs.questionMsg(test, question, current.index, current.total, t), msgs.questionKeyboard(test, session._id, question, t), { edit });
}

// Entry point: 🧠 Personality Test button / /personality_test
async function personalityTestCommand(ctx) {
  const t = tOf(ctx);
  try {
    const active = await personalityService.getActiveSession(ctx.user._id);
    if (active) {
      const loaded = await personalityService.getTest(active.test_key);
      if (loaded) {
        return show(ctx, t.personality.resumeOrRestartMsg(testIn(ctx, loaded.test).name, active.answers.length, loaded.questions.length), msgs.resumeKeyboard(active.test_key, t));
      }
    }
    const tests = (await personalityService.listTests({ userId: ctx.user._id })).map(test => testIn(ctx, test));
    if (tests.length === 0) return ctx.reply(t.personality.noTestsMsg());
    return show(ctx, msgs.chooseTestMsg(tests, t), msgs.testListKeyboard(tests));
  } catch (error) {
    console.error('Error in personality_test command:', error);
  }
}

// Entry point: 🧠 My Personality button / /my_personality
async function myPersonalityCommand(ctx, { edit = false } = {}) {
  try {
    const profile = await personalityService.getProfile(ctx.user._id);
    const summary = await personalityService.getProfileSummary(ctx.user._id, { lang: langOf(ctx) });
    return show(ctx, summary, msgs.profileKeyboard(Boolean(profile), tOf(ctx)), { edit });
  } catch (error) {
    console.error('Error in my_personality command:', error);
  }
}

async function startTest(ctx, testKey) {
  const state = await personalityService.startTest(ctx.user._id, testKey);
  const current = personalityService.currentQuestion(state.session, state.questions);
  await show(ctx, msgs.testIntroMsg(testIn(ctx, state.test)), null, { edit: true });
  return renderQuestion(ctx, { ...state, current }, { edit: false });
}

async function continueTest(ctx) {
  const session = await personalityService.getActiveSession(ctx.user._id);
  if (!session) return show(ctx, tOf(ctx).personality.sessionExpiredMsg(), null, { edit: true });
  const loaded = await personalityService.getTest(session.test_key);
  const current = personalityService.currentQuestion(session, loaded.questions);
  return renderQuestion(ctx, { session, ...loaded, current }, { edit: true });
}

// ptest_start_<key> | ptest_continue | ptest_cancel
async function testCallback(ctx) {
  const P = tOf(ctx).personality;
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
      await ctx.answerCbQuery(cancelled ? P.cancelledToast() : undefined);
      return await show(ctx, cancelled ? P.cancelledMsg() : P.nothingToCancelMsg(), null, { edit: true });
    }
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in personality test callback:', error);
    ctx.answerCbQuery(P.somethingWrongToast()).catch(() => {});
  }
}

// pq_<sessionId>_<order>_<value>
async function answerCallback(ctx) {
  const P = tOf(ctx).personality;
  try {
    const [sessionId, order, value] = ctx.callbackQuery.data.slice(msgs.CALLBACK.ANSWER_PREFIX.length).split('_');
    const state = await personalityService.answerQuestion(ctx.user._id, sessionId, Number(order), Number(value));

    if (!state.session) {
      await ctx.answerCbQuery();
      return await show(ctx, P.sessionExpiredMsg(), null, { edit: true });
    }
    if (!state.done) {
      await ctx.answerCbQuery();
      return await renderQuestion(ctx, state, { edit: true });
    }

    await ctx.answerCbQuery(P.doneToast());
    await show(ctx, P.testCompletedMsg(testIn(ctx, state.test).name), null, { edit: true });
    if (state.test.key === 'mbti') {
      const mbti = require('../public/ui/mbti').fromTraits(state.result.traits);
      if (mbti) {
        const url = `${require('../constants').server.SERVER_BASE_URL}/result/${mbti.type}`;
        const character = localizeCharacter(mbti.type, require('../public/ui/mbti').CHARACTERS[mbti.type], langOf(ctx));
        await ctx.reply(P.mbtiResultMsg(mbti.type, character, url), { parse_mode: 'HTML' });
      }
    }
    return await myPersonalityCommand(ctx);
  } catch (error) {
    console.error('Error in personality answer callback:', error);
    ctx.answerCbQuery(P.somethingWrongToast()).catch(() => {});
  }
}

// pprof_retake | pprof_reset | pprof_reset_yes | pprof_reset_no
async function profileCallback(ctx) {
  const t = tOf(ctx);
  const P = t.personality;
  try {
    const data = ctx.callbackQuery.data.slice(msgs.CALLBACK.PROFILE_PREFIX.length);
    await ctx.answerCbQuery();
    switch (data) {
      case 'retake': {
        const tests = (await personalityService.listTests({ userId: ctx.user._id })).map(test => testIn(ctx, test));
        if (tests.length === 0) return show(ctx, P.noTestsMsg(), null, { edit: true });
        if (tests.length === 1) return startTest(ctx, tests[0].key);
        return show(ctx, msgs.chooseTestMsg(tests, t), msgs.testListKeyboard(tests), { edit: true });
      }
      case 'reset':
        return show(ctx, P.profileResetConfirmMsg(), msgs.resetConfirmKeyboard(t), { edit: true });
      case 'reset_yes':
        await personalityService.resetProfile(ctx.user._id);
        return show(ctx, P.profileResetDoneMsg(), null, { edit: true });
      case 'reset_no':
        return show(ctx, P.profileResetCancelledMsg(), null, { edit: true });
    }
  } catch (error) {
    console.error('Error in personality profile callback:', error);
  }
}

// start a specific test from outside the test menu (e.g. a /start deep link)
async function startTestByKey(ctx, testKey) {
  try {
    return await startTest(ctx, testKey);
  } catch (error) {
    console.error(`Error starting test ${testKey}:`, error);
  }
}

module.exports = {
  startTestByKey,
  personalityTestCommand,
  myPersonalityCommand,
  testCallback,
  answerCallback,
  profileCallback,
};
