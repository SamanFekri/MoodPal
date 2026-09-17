const { msgs } = require('../constants');
const User = require('../models/user');
const llm = require('../utils/llm');

// Best effort: remove the user's message so the key doesn't stay in the chat history
async function deleteUserMessage(ctx) {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Could not delete message containing API key:', error.message);
  }
}

// Verify the key against OpenAI, then store it encrypted
async function saveOpenAIKey(ctx, rawKey) {
  const apiKey = (rawKey || '').trim();

  if (!llm.isValidKeyFormat(apiKey)) {
    await deleteUserMessage(ctx);
    return ctx.reply(msgs.openAIKeyInvalidFormatMsg(), { parse_mode: 'HTML' });
  }

  await deleteUserMessage(ctx);
  const status = await ctx.reply(msgs.openAIKeyVerifyingMsg());

  let text;
  try {
    await llm.verifyApiKey(apiKey);
    await User.setOpenAIKey(ctx.user._id, apiKey);
    text = msgs.openAIKeySavedMsg();
  } catch (error) {
    console.error('OpenAI key verification failed:', error.message);
    text = llm.isAuthError(error) ? msgs.openAIKeyRejectedMsg() : msgs.openAIKeyErrorMsg();
  }

  try {
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, text, { parse_mode: 'HTML' });
  } catch {
    await ctx.reply(text, { parse_mode: 'HTML' });
  }
}

// /set_openai_key [key] — with a key it saves it directly, otherwise asks for it
async function setOpenAIKeyCommand(ctx) {
  try {
    if (ctx.payload) {
      return await saveOpenAIKey(ctx, ctx.payload);
    }
    await ctx.reply(msgs.askOpenAIKeyMsg(), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { force_reply: true, input_field_placeholder: 'sk-...' }
    });
  } catch (error) {
    console.error('Error in set_openai_key command:', error);
  }
}

async function removeOpenAIKeyCommand(ctx) {
  try {
    const existing = await User.getOpenAIKey(ctx.user._id);
    if (!existing) {
      return ctx.reply(msgs.openAIKeyNotSetMsg());
    }
    await User.setOpenAIKey(ctx.user._id, null);
    ctx.reply(msgs.openAIKeyRemovedMsg());
  } catch (error) {
    console.error('Error in remove_openai_key command:', error);
  }
}

// True when a plain text message is (or replies to the prompt with) an OpenAI key
function looksLikeOpenAIKey(ctx) {
  const text = ctx.message?.text || '';
  const repliedToPrompt = ctx.message?.reply_to_message?.from?.is_bot
    && /OpenAI API key/i.test(ctx.message.reply_to_message.text || '');
  return repliedToPrompt || llm.isValidKeyFormat(text);
}

module.exports = {
  setOpenAIKeyCommand,
  removeOpenAIKeyCommand,
  saveOpenAIKey,
  looksLikeOpenAIKey,
};
