// /export and the 📥 Export button: send the user their whole mood log (moods, notes, day and hour) as a CSV
const moodExport = require('../export/moods');
const i18n = require('../i18n');

async function exportCommand(ctx) {
  try {
    await ctx.sendChatAction('upload_document').catch(() => {});
    await moodExport.sendToChat(ctx.user._id);
  } catch (error) {
    const t = i18n.forCtx(ctx);
    if (error instanceof moodExport.ExportError && error.code === 'no_moods') return ctx.reply(t.exportNoMoodsMsg());
    if (error instanceof moodExport.ExportError && error.code === 'too_soon') return ctx.reply(t.exportTooSoonMsg(error.retry_in_s));
    console.error('Mood export failed:', error.code || error.message);
    return ctx.reply(t.exportFailedMsg()).catch(() => {});
  }
}

module.exports = { exportCommand };
