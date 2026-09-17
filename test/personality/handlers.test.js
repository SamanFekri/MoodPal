const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../helpers/db');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');
const handlers = require('../../src/commands/personality');
const PersonalityTestSession = require('../../src/models/personality_test_session');
const User = require('../../src/models/user');

// Minimal Telegraf-like context that records what the bot would send
function makeCtx(user, callbackData) {
  const ctx = {
    user,
    chat: { id: user.id },
    sent: [],      // ctx.reply calls
    edited: [],    // ctx.editMessageText calls
    cbAnswers: [],
    callbackQuery: callbackData ? { data: callbackData, message: { message_id: 1 } } : undefined,
    async reply(text, extra) { ctx.sent.push({ text, extra }); return { message_id: ctx.sent.length }; },
    async editMessageText(text, extra) { ctx.edited.push({ text, extra }); return true; },
    async answerCbQuery(text) { ctx.cbAnswers.push(text); },
  };
  return ctx;
}

const buttons = (msg) => (msg.extra?.reply_markup?.inline_keyboard || []).flat();

describe('personality telegram handlers', () => {
  let alice;

  before(async () => { await db.connect(); });
  after(async () => { await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    personalityService.clearCache();
    alice = await User.create({ id: 2001, first_name: 'Alice' });
  });

  test('🧠 Personality Test lists tests, starting one shows question 1 with the Likert keyboard', async () => {
    let ctx = makeCtx(alice);
    await handlers.personalityTestCommand(ctx);
    const startButtons = buttons(ctx.sent[0]).filter(b => b.callback_data.startsWith('ptest_start_'));
    assert.ok(startButtons.length >= 6, 'lists several tests');
    const startButton = startButtons[0];
    assert.equal(startButton.callback_data, 'ptest_start_big_five');
    assert.match(startButton.text, /^📝 .*\(20\)$/);
    assert.match(ctx.sent[0].text, /20 questions \(~3 min\)/);
    assert.match(ctx.sent[0].text, /not a clinical or medical diagnosis/);

    ctx = makeCtx(alice, startButton.callback_data);
    await handlers.testCallback(ctx);
    assert.match(ctx.edited[0].text, /Big Five personality test/);          // intro edited in place
    const q1 = ctx.sent[0];
    assert.match(q1.text, /question 1\/20/);
    assert.match(q1.text, /I am the life of the party/);
    const answers = buttons(q1).filter(b => b.callback_data.startsWith('pq_'));
    assert.equal(answers.length, 5);
    assert.ok(answers.every(b => Buffer.byteLength(b.callback_data) <= 64), 'callback data fits Telegram limit');
    assert.ok(buttons(q1).some(b => b.callback_data === 'ptest_cancel'));
  });

  test('answering all 20 questions via callbacks completes the test and shows the profile', async () => {
    let ctx = makeCtx(alice, 'ptest_start_big_five');
    await handlers.testCallback(ctx);
    let question = ctx.sent[0];

    for (let i = 1; i <= 20; i++) {
      const answer = buttons(question).find(b => b.callback_data.startsWith('pq_') && b.callback_data.endsWith('_5'));
      ctx = makeCtx(alice, answer.callback_data);
      await handlers.answerCallback(ctx);
      if (i < 20) {
        question = ctx.edited[0];
        assert.match(question.text, new RegExp(`question ${i + 1}/20`));
      }
    }

    assert.equal(ctx.cbAnswers.at(-1), '✅ Done!');
    assert.match(ctx.edited[0].text, /completed/);
    const summary = ctx.sent[0];
    assert.match(summary.text, /My Personality/);
    assert.match(summary.text, /Extraversion/);
    assert.match(summary.text, /not a clinical or medical diagnosis/);
    assert.ok(buttons(summary).some(b => b.callback_data === 'pprof_retake'));
    assert.ok(buttons(summary).some(b => b.callback_data === 'pprof_reset'));

    const profile = await personalityService.getProfile(alice._id);
    assert.equal(profile.traits.extraversion, 0.5);   // all "5": 2 normal + 2 reversed
    assert.equal(profile.traits.openness, 0.25);      // 1 normal + 3 reversed

    // the completed test is now marked in the list
    ctx = makeCtx(alice);
    await handlers.personalityTestCommand(ctx);
    const bigFive = buttons(ctx.sent[0]).find(b => b.callback_data === 'ptest_start_big_five');
    assert.match(bigFive.text, /^✅ /);
    assert.ok(buttons(ctx.sent[0]).some(b => b.text.startsWith('📝 ')), 'other tests still pending');
  });

  test('a stale answer (old session id) does not crash and tells the user', async () => {
    const ctx = makeCtx(alice, 'pq_64b000000000000000000000_1_3');
    await handlers.answerCallback(ctx);
    assert.match(ctx.edited[0].text, /no longer active/);
  });

  test('cancel, then resume prompt, then restart from question 1', async () => {
    let ctx = makeCtx(alice, 'ptest_start_big_five');
    await handlers.testCallback(ctx);
    const first = buttons(ctx.sent[0]).find(b => b.callback_data.startsWith('pq_'));
    ctx = makeCtx(alice, first.callback_data);
    await handlers.answerCallback(ctx);

    // menu button while a test is running -> continue / start over / cancel
    ctx = makeCtx(alice);
    await handlers.personalityTestCommand(ctx);
    assert.match(ctx.sent[0].text, /1\/20 answered/);
    const names = buttons(ctx.sent[0]).map(b => b.callback_data);
    assert.deepEqual(names, ['ptest_continue', 'ptest_start_big_five', 'ptest_cancel']);

    ctx = makeCtx(alice, 'ptest_continue');
    await handlers.testCallback(ctx);
    assert.match(ctx.edited[0].text, /question 2\/20/);

    ctx = makeCtx(alice, 'ptest_start_big_five');
    await handlers.testCallback(ctx);
    assert.match(ctx.sent[0].text, /question 1\/20/);
    assert.equal(await PersonalityTestSession.countDocuments({ user: alice._id, status: 'cancelled' }), 1);

    ctx = makeCtx(alice, 'ptest_cancel');
    await handlers.testCallback(ctx);
    assert.match(ctx.edited[0].text, /cancelled/i);
    assert.equal(await personalityService.getActiveSession(alice._id), null);

    ctx = makeCtx(alice, 'ptest_cancel');
    await handlers.testCallback(ctx);
    assert.match(ctx.edited[0].text, /don't have a test in progress/);
  });

  test('🧠 My Personality without a profile offers the test; reset requires confirmation', async () => {
    let ctx = makeCtx(alice);
    await handlers.myPersonalityCommand(ctx);
    assert.match(ctx.sent[0].text, /Take the 🧠 Personality Test/);
    assert.deepEqual(buttons(ctx.sent[0]).map(b => b.callback_data), ['pprof_retake']);

    // retake shows the list of tests (there are several)
    ctx = makeCtx(alice, 'pprof_retake');
    await handlers.profileCallback(ctx);
    assert.match(ctx.edited[0].text, /Personality Tests/);
    assert.ok(buttons(ctx.edited[0]).filter(b => b.callback_data.startsWith('ptest_start_')).length >= 6);

    await personalityService.recordLLMUpdates(alice._id, { updates: [{ trait: 'patience', change: 0.1, confidence: 0.9 }] });
    ctx = makeCtx(alice, 'pprof_reset');
    await handlers.profileCallback(ctx);
    assert.match(ctx.edited[0].text, /Reset your personality profile/);
    ctx = makeCtx(alice, 'pprof_reset_no');
    await handlers.profileCallback(ctx);
    assert.ok(await personalityService.getProfile(alice._id));
    ctx = makeCtx(alice, 'pprof_reset_yes');
    await handlers.profileCallback(ctx);
    assert.match(ctx.edited[0].text, /has been reset/);
    assert.equal(await personalityService.getProfile(alice._id), null);
    assert.equal(await personalityService.getActiveSession(alice._id), null);
  });
});
