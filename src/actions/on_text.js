// write a function that handles the text message from the user
const { msgs } = require('../constants');
const Mood = require('../models/mood'); // Assuming you have a Mood model

async function handleTextMessage(ctx) {
  // check if user is a bot return
  if(ctx.user.is_bot) return; // Ignore messages from bots
  // get the last mood of the user
  const lastMood = await Mood.getLastMood(ctx.user._id);
  if (!lastMood) {
    return ctx.reply(msgs.noMoodMsg());
  }
  // get the note from the message
  const note = ctx.message.text;
  // add the note to the last mood
  await lastMood.addNote(note);
  // send a message to the user
  ctx.reply(msgs.noteSavedMsg());
}

module.exports = handleTextMessage;
  