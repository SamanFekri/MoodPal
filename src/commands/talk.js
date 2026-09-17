// Talk mode handlers. Conversation logic lives in src/chat/service.js.
const { msgs, common } = require('../constants');
const User = require('../models/user');
const chatService = require('../chat/service');
const personalityService = require('../personality/service');
const llm = require('../utils/llm');

const REMIND_EVERY = 8; // assistant replies between "I'm an AI" reminders

const mainKeyboard = (ctx) => ({ keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true });
const talkKeyboard = () => ({ keyboard: common.makeTalkKeyboard(), resize_keyboard: true });

// 💬 Talk / /talk — start a conversation (requires the user's own OpenAI key)
async function startTalk(ctx, { openedFrom = 'menu', opener = null } = {}) {
  const apiKey = await User.getOpenAIKey(ctx.user._id);
  if (!apiKey) {
    return ctx.reply(msgs.talkNeedsKeyMsg(), { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx) });
  }
  await chatService.start(ctx.user._id, { openedFrom });
  await ctx.reply(msgs.talkIntroMsg(ctx.user.first_name), { parse_mode: 'HTML', reply_markup: talkKeyboard() });
  // "talk about it" from a note: the note becomes the first thing they said
  if (opener) return respond(ctx, opener, apiKey);
}

async function talkCommand(ctx) {
  try {
    await startTalk(ctx, { openedFrom: ctx.message?.text?.startsWith('/') ? 'command' : 'menu' });
  } catch (error) {
    console.error('Error in talk command:', error);
  }
}

// 🛑 End talk / /end_talk
async function endTalkCommand(ctx) {
  try {
    const session = await chatService.end(ctx.user._id, 'user');
    if (!session) return ctx.reply(msgs.talkNotActiveMsg(), { reply_markup: mainKeyboard(ctx) });
    await ctx.reply(msgs.talkEndedMsg(), { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx) });
    learnFromSession(ctx.user._id, session).catch(err => console.error('Personality inference from talk failed:', err.message));
  } catch (error) {
    console.error('Error in end_talk command:', error);
  }
}

// what the user said in the conversation refines their personality profile, gradually
async function learnFromSession(userId, session) {
  const transcript = chatService.userTranscript(session);
  if (transcript.length < 60) return;
  const apiKey = await User.getOpenAIKey(userId);
  if (apiKey) await personalityService.inferFromText(userId, transcript, apiKey);
}

async function respond(ctx, text, apiKey) {
  await ctx.sendChatAction('typing').catch(() => {});
  try {
    const { reply, risk, session } = await chatService.reply(ctx.user._id, text, apiKey, { firstName: ctx.user.first_name });
    let out = reply;
    if (risk === 'medium' || risk === 'high') out += `\n${msgs.talkSafetyFooterMsg()}`;
    const assistantTurns = session.messages.filter(m => m.role === 'assistant').length;
    if (assistantTurns % REMIND_EVERY === 0) out += `\n\n${msgs.talkReminderMsg()}`;
    await ctx.reply(out, { parse_mode: 'HTML', reply_markup: talkKeyboard() });
  } catch (error) {
    console.error('Talk reply failed:', error.message);
    if (llm.isAuthError(error)) {
      await chatService.end(ctx.user._id, 'no_key');
      return ctx.reply(msgs.talkKeyRejectedMsg(), { reply_markup: mainKeyboard(ctx) });
    }
    await ctx.reply(msgs.talkErrorMsg(), { reply_markup: talkKeyboard() });
  }
}

// Called from the text handler: true if the message was consumed by an active conversation
async function handleTalkMessage(ctx) {
  const session = await chatService.getActive(ctx.user._id);
  if (!session) return false;
  const apiKey = await User.getOpenAIKey(ctx.user._id);
  if (!apiKey) {
    await chatService.end(ctx.user._id, 'no_key');
    await ctx.reply(msgs.talkNeedsKeyMsg(), { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx) });
    return true;
  }
  await respond(ctx, ctx.message.text, apiKey);
  return true;
}

// inline button under a saved note
const TALK_ABOUT_NOTE_KEYBOARD = [[{ text: '💬 Talk about it', callback_data: 'talk_note' }]];

async function talkAboutNoteCallback(ctx) {
  try {
    await ctx.answerCbQuery();
    const Mood = require('../models/mood');
    const lastMood = await Mood.getLastMood(ctx.user._id);
    const opener = lastMood?.note ? `${lastMood.mood.name}: ${lastMood.note}` : null;
    try { await ctx.editMessageReplyMarkup(undefined); } catch {}
    await startTalk(ctx, { openedFrom: 'note', opener });
  } catch (error) {
    console.error('Error in talk_note callback:', error);
  }
}

module.exports = { talkCommand, endTalkCommand, handleTalkMessage, talkAboutNoteCallback, TALK_ABOUT_NOTE_KEYBOARD, startTalk };
