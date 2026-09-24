// Admin-only: run a database backup from the chat (keyboard button or /backup).
const { msgs, common } = require('../constants');
const backupService = require('../backup/service');

async function backupNowCommand(ctx) {
  try {
    if (!ctx.user?.is_admin) return ctx.reply(msgs.backupNotAdminMsg());

    const status = await ctx.reply(msgs.backupStartedMsg(), { parse_mode: 'HTML' });
    const edit = (text) => ctx.telegram
      .editMessageText(ctx.chat.id, status.message_id, undefined, text, { parse_mode: 'HTML' })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML' }));

    try {
      const result = await backupService.runBackup({ trigger: 'bot' });
      if (result.status === 'success') return edit(msgs.backupDoneMsg(result));
      if (result.status === 'partial') return edit(msgs.backupPartialMsg(result));
      return edit(msgs.backupFailedMsg(result.message));
    } catch (error) {
      console.error('Backup from the bot failed:', error.message);
      return edit(msgs.backupFailedMsg(error.message));
    }
  } catch (error) {
    console.error('Error in backup command:', error);
  }
}

module.exports = { backupNowCommand };
