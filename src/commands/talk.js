// Talk mode handlers. Conversation logic lives in src/chat/service.js; which AI key a person uses
// (their own OpenAI key, or the admin's shared key with its limits) in src/ai/access.js.
const { common } = require('../constants');
const i18n = require('../i18n');
const { moodName } = i18n;
const User = require('../models/user');
const chatService = require('../chat/service');
const llm = require('../utils/llm');
const ai = require('../ai/access');

const REMIND_EVERY = 8; // assistant replies between "I'm an AI" reminders

const mainKeyboard = (ctx) => ({ keyboard: common.makeKeyboardMenu(ctx), resize_keyboard: true });
const talkKeyboard = (ctx) => ({ keyboard: common.makeTalkKeyboard(ctx), resize_keyboard: true });

// 💬 Talk / /talk — start a conversation (requires the user's own OpenAI key)
// own OpenAI key first (no limit), else the admin's shared key (limited), else no Talk
async function startTalk(ctx, { openedFrom = 'menu', opener = null } = {}) {
  const msgs = i18n.forCtx(ctx);
  const access = await ai.forUser(ctx.user);
  if (!access) {
    return ctx.reply(msgs.talkNeedsKeyMsg(), { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx) });
  }
  await chatService.start(ctx.user._id, { openedFrom });
  let intro = msgs.talkIntroMsg(ctx.user.first_name);
  if (!access.own) {
    const today = await ai.talkToday(ctx.user);
    intro += `\n${msgs.talkSharedNoteMsg(access.providerName, today.left, today.limit)}`;
  }
  await ctx.reply(intro, { parse_mode: 'HTML', reply_markup: talkKeyboard(ctx) });
  // "talk about it" from a note: the note becomes the first thing they said
  if (opener) return respond(ctx, opener, access);
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
  const msgs = i18n.forCtx(ctx);
  try {
    const session = await chatService.end(ctx.user._id, 'user');
    if (!session) return ctx.reply(msgs.talkNotActiveMsg(), { reply_markup: mainKeyboard(ctx) });
    await ctx.reply(msgs.talkEndedMsg(), { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx) });
    learnFromSession(ctx.user._id, session).catch(err => console.error('Personality inference from talk failed:', err.message));
  } catch (error) {
    console.error('Error in end_talk command:', error);
  }
}

// what the user said in the conversation refines their personality profile, gradually,
// and anything important they said since the last memory update is remembered
async function learnFromSession(userId, session) {
  return chatService.learnFromEnded(session);
}

async function respond(ctx, text, access) {
  const msgs = i18n.forCtx(ctx);
  // the shared key: one of today's messages, or a friendly stop when they're used up
  try {
    await ai.consume(ctx.user, access, 'talk');
  } catch (error) {
    if (!(error instanceof ai.AiLimitError)) throw error;
    return ctx.reply(error.code === 'user_limit' ? msgs.talkLimitMsg(error.limit) : msgs.talkDailyCapMsg(), { parse_mode: 'HTML', reply_markup: talkKeyboard(ctx) });
  }
  await ctx.sendChatAction('typing').catch(() => {});
  try {
    const { reply, risk, session } = await chatService.reply(ctx.user._id, text, access.cred, { firstName: ctx.user.first_name, model: access.model, language: msgs.aiLanguage, fallbackReply: msgs.talkFallbackReply() });
    let out = reply;
    if (risk === 'medium' || risk === 'high') out += `\n${msgs.talkSafetyFooterMsg()}`;
    const assistantTurns = session.messages.filter(m => m.role === 'assistant').length;
    if (assistantTurns % REMIND_EVERY === 0) out += `\n\n${msgs.talkReminderMsg()}`;
    await ctx.reply(out, { parse_mode: 'HTML', reply_markup: talkKeyboard(ctx) });
  } catch (error) {
    console.error('Talk reply failed:', error.message);
    // a rejected key or a missing model: their own key is theirs to fix; the shared one is the admin's
    if (llm.isAuthError(error) && access.own && !access.test) {
      await chatService.end(ctx.user._id, 'no_key');
      return ctx.reply(msgs.talkKeyRejectedMsg(), { reply_markup: mainKeyboard(ctx) });
    }
    if (llm.isAuthError(error) || (llm.isModelError?.(error) && (!access.own || access.test))) {
      console.error('The shared AI key or model failed:', error.message);
      return ctx.reply(msgs.talkSharedUnavailableMsg(), { reply_markup: talkKeyboard(ctx) });
    }
    if (llm.isModelError?.(error)) {
      await chatService.end(ctx.user._id, 'error');
      return ctx.reply(msgs.talkModelUnavailableMsg(ctx.user.openai_model || llm.DEFAULT_MODEL), { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx) });
    }
    await ctx.reply(msgs.talkErrorMsg(), { reply_markup: talkKeyboard(ctx) });
  }
}

// Called from the text handler: true if the message was consumed by an active conversation
async function handleTalkMessage(ctx) {
  const session = await chatService.getActive(ctx.user._id);
  if (!session) return false;
  const access = await ai.forUser(ctx.user);
  if (!access) {
    await chatService.end(ctx.user._id, 'no_key');
    await ctx.reply(i18n.forCtx(ctx).talkNeedsKeyMsg(), { parse_mode: 'HTML', reply_markup: mainKeyboard(ctx) });
    return true;
  }
  await respond(ctx, ctx.message.text, access);
  return true;
}

// inline button under a saved note (`t`: the user's dictionary from src/i18n)
const TALK_ABOUT_NOTE_KEYBOARD = (t = i18n.forLang()) => [[{ text: t.talkAboutButton(), callback_data: 'talk_note' }]];

async function talkAboutNoteCallback(ctx) {
  try {
    await ctx.answerCbQuery();
    const Mood = require('../models/mood');
    const lastMood = await Mood.getLastMood(ctx.user._id);
    const opener = lastMood?.note ? `${moodName(ctx.user.language, lastMood.mood.code, lastMood.mood.name)}: ${lastMood.note}` : null;
    try { await ctx.editMessageReplyMarkup(undefined); } catch {}
    await startTalk(ctx, { openedFrom: 'note', opener });
  } catch (error) {
    console.error('Error in talk_note callback:', error);
  }
}

module.exports = { talkCommand, endTalkCommand, handleTalkMessage, talkAboutNoteCallback, TALK_ABOUT_NOTE_KEYBOARD, startTalk };
