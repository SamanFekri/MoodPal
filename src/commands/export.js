// /export and the 📥 Export button: send the user their whole mood log (moods, notes, day and hour) as a CSV
const moodExport = require('../export/moods');

async function exportCommand(ctx) {
  try {
    await ctx.sendChatAction('upload_document').catch(() => {});
    await moodExport.sendToChat(ctx.user._id);
  } catch (error) {
    if (error instanceof moodExport.ExportError && error.code === 'no_moods') return ctx.reply("You haven't logged any moods yet. Pick one with 🤩 New mood and it will show up in your export.");
    if (error instanceof moodExport.ExportError && error.code === 'too_soon') return ctx.reply(`Your file is on its way. You can export again in ${error.retry_in_s}s.`);
    console.error('Mood export failed:', error.code || error.message);
    return ctx.reply("Sorry, I couldn't make your export right now. Please try again in a minute.").catch(() => {});
  }
}

module.exports = { exportCommand };
