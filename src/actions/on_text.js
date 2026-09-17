// write a function that handles the text message from the user
const { msgs } = require('../constants');
const Mood = require('../models/mood'); // Assuming you have a Mood model
const { looksLikeOpenAIKey, saveOpenAIKey } = require('../commands/openai_key');
const { handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD } = require('../commands/talk');

async function handleTextMessage(ctx) {
  // check if user is a bot return
  if (ctx.user.is_bot) return; // Ignore messages from bots
  // an OpenAI key (or a reply to the key prompt) must never be saved as a mood note
  if (looksLikeOpenAIKey(ctx)) {
    return saveOpenAIKey(ctx, ctx.message.text);
  }
  if ((ctx.message.text || '').startsWith('/')) return;
  // in a Talk conversation, messages go to the AI companion instead of the note
  if (await handleTalkMessage(ctx)) return;
  // get the last mood of the user
  const lastMood = await Mood.getLastMood(ctx.user._id);
  if (!lastMood) {
    return ctx.reply(msgs.noMoodMsg());
  }
  // get the note from the message
  const note = ctx.message.text;
  // add the note to the last mood
  await lastMood.addNote(note);
  // send a message to the user, with the option to talk it through
  ctx.reply(`${msgs.noteSavedMsg()}\n${msgs.talkAboutNoteMsg()}`, { reply_markup: { inline_keyboard: TALK_ABOUT_NOTE_KEYBOARD } });
}

module.exports = handleTextMessage;
