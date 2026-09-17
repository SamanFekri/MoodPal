const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const ChatSession = require('../../src/models/chat_session');
const chatService = require('../../src/chat/service');
const { CHAT_IDLE_MINUTES } = require('../../src/chat/service');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');
const talk = require('../../src/commands/talk');
const handleTextMessage = require('../../src/actions/on_text');

// ---- LLM stub shared by the chat service ----
const llmStub = { calls: [], next: { reply: 'That sounds heavy. What happened today?', risk: 'none' } };
llmStub.chatReply = async (history, apiKey, opts) => { llmStub.calls.push({ history, apiKey, opts }); if (llmStub.next instanceof Error) throw llmStub.next; return llmStub.next; };
llmStub.inferPersonalityUpdates = async () => ({ updates: [] });
llmStub.isAuthError = (e) => e?.status === 401;
chatService._llm = llmStub;

function makeCtx(user, text, { callback = null } = {}) {
  const ctx = {
    user, from: { id: user.id }, chat: { id: user.id },
    message: text !== undefined ? { text } : undefined,
    callbackQuery: callback ? { data: callback } : undefined,
    sent: [], actions: [],
    async reply(t, extra) { ctx.sent.push({ text: t, extra }); return { message_id: ctx.sent.length }; },
    async sendChatAction(a) { ctx.actions.push(a); },
    async answerCbQuery() {},
    async editMessageReplyMarkup() {},
  };
  return ctx;
}
const last = (ctx) => ctx.sent.at(-1);
const replyKeys = (ctx) => (last(ctx).extra?.reply_markup?.keyboard || []).flat();

describe('Talk mode', () => {
  let alice;

  before(async () => { await db.connect(); });
  after(async () => { await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    personalityService.clearCache();
    llmStub.calls = [];
    llmStub.next = { reply: 'That sounds heavy. What happened today?', risk: 'none' };
    alice = await User.create({ id: 3001, first_name: 'Alice' });
    await Mood.create({ user: alice._id, mood: { code: 'sad', emoji: '😢', name: 'Sad' } });
  });

  test('without an OpenAI key: explains it is a bot, needs a key, and starts nothing', async () => {
    const ctx = makeCtx(alice, '💬 Talk');
    await talk.talkCommand(ctx);
    assert.equal(ctx.sent.length, 1);
    assert.match(last(ctx).text, /own OpenAI key/);
    assert.match(last(ctx).text, /\/set_openai_key/);
    assert.match(last(ctx).text, /AI bot/);
    assert.match(last(ctx).text, /not accurate/);
    assert.match(last(ctx).text, /not<\/b> therapy/);
    assert.equal(await chatService.getActive(alice._id), null);
    assert.ok(replyKeys(ctx).includes('💬 Talk'), 'main keyboard stays');
  });

  describe('with a key', () => {
    beforeEach(async () => { await User.setOpenAIKey(alice._id, 'sk-user-key-1234567890abcdefghij'); });

    test('starts with the disclaimer, swaps the keyboard, and answers messages with context', async () => {
      let ctx = makeCtx(alice, '💬 Talk');
      await talk.talkCommand(ctx);
      assert.match(last(ctx).text, /Let's talk, Alice/);
      assert.match(last(ctx).text, /AI bot.*not a human and not a therapist/);
      assert.match(last(ctx).text, /not accurate/);
      assert.match(last(ctx).text, /crisis line/);
      assert.deepEqual(replyKeys(ctx), ['🛑 End talk', '🤩 New mood', '🧠 My Personality']);
      assert.ok(await chatService.getActive(alice._id));

      ctx = makeCtx(alice, 'I had a terrible day at work and I feel like a failure.');
      await handleTextMessage(ctx);
      assert.deepEqual(ctx.actions, ['typing']);
      assert.equal(last(ctx).text, 'That sounds heavy. What happened today?');
      assert.deepEqual(replyKeys(ctx), ['🛑 End talk', '🤩 New mood', '🧠 My Personality']);
      assert.equal(llmStub.calls.length, 1);
      assert.equal(llmStub.calls[0].apiKey, 'sk-user-key-1234567890abcdefghij');
      assert.equal(llmStub.calls[0].opts.firstName, 'Alice');
      assert.deepEqual(llmStub.calls[0].history, [{ role: 'user', content: 'I had a terrible day at work and I feel like a failure.' }]);

      // nothing was saved as a mood note
      assert.equal((await Mood.getLastMood(alice._id)).note, '');
      const session = await chatService.getActive(alice._id);
      assert.equal(session.messages.length, 2);
      assert.equal(session.messages[1].role, 'assistant');

      // second turn carries the history
      ctx = makeCtx(alice, 'My manager shouted at me.');
      await handleTextMessage(ctx);
      assert.equal(llmStub.calls[1].history.length, 3);
    });

    test('passes the personality context to the model when the user has a profile', async () => {
      const s = await personalityService.startTest(alice._id, 'big_five');
      for (const q of s.questions) await personalityService.answerQuestion(alice._id, s.session._id, q.order, q.reverse ? 1 : 5);
      await talk.talkCommand(makeCtx(alice, '/talk'));
      await handleTextMessage(makeCtx(alice, 'hello there'));
      assert.match(llmStub.calls[0].opts.personalityContext, /^User personality context:/);
      assert.match(llmStub.calls[0].opts.personalityContext, /Openness: very high/);
    });

    test('adds the safety footer on medium/high risk and records it on the session', async () => {
      await talk.talkCommand(makeCtx(alice, '/talk'));
      llmStub.next = { reply: 'I am really glad you told me. Are you safe right now?', risk: 'high' };
      const ctx = makeCtx(alice, 'I do not want to be here anymore.');
      await handleTextMessage(ctx);
      assert.match(last(ctx).text, /Are you safe right now\?/);
      assert.match(last(ctx).text, /emergency number/);
      assert.match(last(ctx).text, /I'm an AI and I can't keep you safe/);
      const session = await chatService.getActive(alice._id);
      assert.equal(session.highest_risk, 'high');
      assert.equal(session.messages.at(-1).risk, 'high');

      llmStub.next = { reply: 'Okay.', risk: 'none' };
      const calm = makeCtx(alice, 'thanks');
      await handleTextMessage(calm);
      assert.doesNotMatch(last(calm).text, /emergency number/);
    });

    test('reminds the user it is an AI every few replies', async () => {
      await talk.talkCommand(makeCtx(alice, '/talk'));
      const texts = [];
      for (let i = 0; i < 8; i++) { const ctx = makeCtx(alice, `message ${i}`); await handleTextMessage(ctx); texts.push(last(ctx).text); }
      assert.doesNotMatch(texts[0], /Reminder: I'm an AI/);
      assert.match(texts[7], /Reminder: I'm an AI, not a therapist/);
    });

    test('ending the talk restores notes and feeds the conversation into the personality profile', async () => {
      let inferred = null;
      const original = personalityService.inferFromText;
      personalityService.inferFromText = async (userId, text, key) => { inferred = { userId, text, key }; return { applied: [], rejected: [] }; };
      try {
        await talk.talkCommand(makeCtx(alice, '/talk'));
        await handleTextMessage(makeCtx(alice, 'I always overthink everything before I make even small decisions.'));
        await handleTextMessage(makeCtx(alice, 'And I really prefer people to be direct with me.'));

        const end = makeCtx(alice, '🛑 End talk');
        await talk.endTalkCommand(end);
        assert.match(last(end).text, /Talk ended/);
        assert.match(last(end).text, /saved as mood notes again/);
        assert.ok(replyKeys(end).includes('💬 Talk'));
        assert.equal(await chatService.getActive(alice._id), null);
        assert.equal((await ChatSession.findOne({ user: alice._id })).ended_reason, 'user');
        await new Promise(r => setTimeout(r, 20));
        assert.ok(inferred, 'personality inference ran');
        assert.match(inferred.text, /overthink everything/);
        assert.doesNotMatch(inferred.text, /That sounds heavy/, 'only the user side is analysed');

        // back to notes, with the "talk about it" offer
        const note = makeCtx(alice, 'Feeling a bit better now.');
        await handleTextMessage(note);
        assert.equal((await Mood.getLastMood(alice._id)).note, 'Feeling a bit better now.');
        assert.match(last(note).text, /saved successfully/);
        assert.match(last(note).text, /Want to talk about it\?/);
        assert.equal(last(note).extra.reply_markup.inline_keyboard[0][0].callback_data, 'talk_note');
        assert.equal(llmStub.calls.length, 2, 'the note did not go to the model');
      } finally {
        personalityService.inferFromText = original;
      }
    });

    test('"Talk about it" opens a conversation with the note as the first message', async () => {
      await handleTextMessage(makeCtx(alice, 'Everything feels pointless lately.'));
      const ctx = makeCtx(alice, undefined, { callback: 'talk_note' });
      await talk.talkAboutNoteCallback(ctx);
      assert.match(ctx.sent[0].text, /Let's talk/);
      assert.equal(ctx.sent[1].text, 'That sounds heavy. What happened today?');
      assert.equal(llmStub.calls[0].history[0].content, 'Sad: Everything feels pointless lately.');
      const session = await chatService.getActive(alice._id);
      assert.equal(session.opened_from, 'note');
    });

    test('ending an inactive talk says so; an idle session expires back to notes', async () => {
      const none = makeCtx(alice, '/end_talk');
      await talk.endTalkCommand(none);
      assert.match(last(none).text, /not in a conversation/);

      await talk.talkCommand(makeCtx(alice, '/talk'));
      await ChatSession.updateOne({ user: alice._id, status: 'active' }, { last_message_at: new Date(Date.now() - (CHAT_IDLE_MINUTES + 1) * 60000) });
      const ctx = makeCtx(alice, 'late night thought');
      await handleTextMessage(ctx);
      assert.equal((await Mood.getLastMood(alice._id)).note, 'late night thought');
      assert.equal((await ChatSession.findOne({ user: alice._id })).ended_reason, 'idle');
      assert.equal(llmStub.calls.length, 0);
    });

    test('a rejected key ends the talk and tells the user; other errors keep the session', async () => {
      await talk.talkCommand(makeCtx(alice, '/talk'));
      llmStub.next = Object.assign(new Error('rate limited'), { status: 429 });
      let ctx = makeCtx(alice, 'hi');
      await handleTextMessage(ctx);
      assert.match(last(ctx).text, /couldn't get a reply/);
      assert.ok(await chatService.getActive(alice._id));

      llmStub.next = Object.assign(new Error('bad key'), { status: 401 });
      ctx = makeCtx(alice, 'hi again');
      await handleTextMessage(ctx);
      assert.match(last(ctx).text, /OpenAI rejected your key/);
      assert.equal(await chatService.getActive(alice._id), null);
      assert.equal((await ChatSession.findOne({ user: alice._id })).ended_reason, 'no_key');
    });

    test('removing the key mid-conversation ends it gracefully', async () => {
      await talk.talkCommand(makeCtx(alice, '/talk'));
      await User.setOpenAIKey(alice._id, null);
      const ctx = makeCtx(alice, 'still there?');
      await handleTextMessage(ctx);
      assert.match(last(ctx).text, /own OpenAI key/);
      assert.equal(await chatService.getActive(alice._id), null);
      assert.equal(llmStub.calls.length, 0);
    });

    test('sessions are per user', async () => {
      const bob = await User.create({ id: 3002, first_name: 'Bob' });
      await Mood.create({ user: bob._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' } });
      await talk.talkCommand(makeCtx(alice, '/talk'));
      const ctx = makeCtx(bob, 'just a note from bob');
      await handleTextMessage(ctx);
      assert.equal((await Mood.getLastMood(bob._id)).note, 'just a note from bob');
      assert.equal(llmStub.calls.length, 0);
      assert.equal(await chatService.getActive(bob._id), null);
    });
  });
});
