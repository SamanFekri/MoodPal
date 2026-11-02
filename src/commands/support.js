// Bot side of the support network: answering an invitation, sharing a hard mood with a friend after
// the "share how you're feeling?" prompt, and "Send a hug". The logic lives in src/support/service.js.
const { msgs } = require('../constants');
const support = require('../support/service');
const { logTelegramError } = require('../utils/tg_errors');

const answer = (ctx, text) => ctx.answerCbQuery(text).catch(logTelegramError('answerCbQuery'));
const data = (ctx) => ctx.callbackQuery?.data || '';

// 💛 Yes, I'm in / Not now (under an invitation to be someone's support friend)
async function inviteAnswerCallback(ctx) {
  try {
    const accept = data(ctx).startsWith(support.CB.ACCEPT);
    const id = data(ctx).slice((accept ? support.CB.ACCEPT : support.CB.DECLINE).length);
    let result;
    try { result = await support.respond(ctx.user._id, id, accept); }
    catch { await answer(ctx); return ctx.editMessageText(msgs.supportInviteGoneMsg()).catch(() => {}); }
    await answer(ctx);
    if (!result.changed) return ctx.editMessageText(msgs.supportInviteGoneMsg()).catch(() => {});
    const owner = await require('../models/user').findById(result.row.user).select('first_name').lean();
    await ctx.editMessageText(accept ? msgs.supportInviteAcceptedMsg(owner?.first_name || 'they') : msgs.supportInviteDeclinedMsg()).catch(() => {});
  } catch (error) {
    console.error('Error answering a support invitation:', error);
  }
}

// a friend's name under "Would you like to share how you're feeling with a friend?"
async function shareCallback(ctx) {
  try {
    if (data(ctx) === support.CB.SHARE_DONE) {
      await answer(ctx);
      return ctx.editMessageText(msgs.supportPromptDoneMsg()).catch(() => {});
    }
    // 💛 Share with everyone
    if (data(ctx).startsWith(support.CB.SHARE_ALL)) {
      let results;
      try { results = await support.shareMoodMany(ctx.user._id, data(ctx).slice(support.CB.SHARE_ALL.length), 'all'); }
      catch (error) { return answer(ctx, error.code === 'too_old' ? 'That mood is too old to share now' : "Couldn't share that"); }
      const told = results.filter(r => r.status === 'sent' || r.status === 'already');
      if (!told.length) return answer(ctx, "Couldn't reach anyone right now");
      const names = told.map(r => r.first_name || 'a friend');
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
      await answer(ctx, `Shared with ${told.length} ${told.length === 1 ? 'friend' : 'friends'} 💛`);
      return ctx.editMessageText(msgs.supportSharedAllMsg(list)).catch(() => {});
    }
    const [moodId, friendId] = data(ctx).slice(support.CB.SHARE.length).split('_');
    let result;
    try { result = await support.shareMood(ctx.user._id, moodId, friendId); }
    catch (error) {
      const why = { too_old: 'That mood is too old to share now', receive_off: "They've turned off support messages" }[error.code] || "Couldn't share that";
      return answer(ctx, why);
    }
    if (result.status === 'failed') return answer(ctx, "Couldn't reach them right now");
    await answer(ctx, result.status === 'already' ? 'Already shared with them' : `Shared with ${result.to.first_name || 'them'} 💛`);
    // the chosen friend leaves the list; the others stay so they can share with more people
    const rows = (ctx.callbackQuery.message?.reply_markup?.inline_keyboard || [])
      .map(row => row.filter(b => b.callback_data !== data(ctx)))
      .filter(row => row.length);
    const others = rows.some(row => row.some(b => b.callback_data?.startsWith(support.CB.SHARE) && b.callback_data !== support.CB.SHARE_DONE && !b.callback_data.startsWith(support.CB.SHARE_ALL)));
    await ctx.editMessageText(others ? msgs.supportSharedWithMsg(result.to.first_name || 'them') : msgs.supportPromptDoneMsg(), others ? { reply_markup: { inline_keyboard: rows } } : undefined).catch(() => {});
  } catch (error) {
    console.error('Error sharing a mood:', error);
  }
}

// 🤗 Send a hug (under a support message): sent once, then the button goes away
async function hugCallback(ctx) {
  try {
    const toId = data(ctx).slice(support.CB.HUG.length);
    const ok = await support.sendHug(ctx.user, toId);
    await answer(ctx, ok ? msgs.supportHugSentMsg() : msgs.supportHugNotAllowedMsg());
    if (!ok) return;
    const rows = (ctx.callbackQuery.message?.reply_markup?.inline_keyboard || [])
      .map(row => row.filter(b => !b.callback_data?.startsWith(support.CB.HUG)))
      .filter(row => row.length);
    await ctx.editMessageReplyMarkup(rows.length ? { inline_keyboard: rows } : undefined).catch(() => {});
  } catch (error) {
    console.error('Error sending a hug:', error);
  }
}

module.exports = { inviteAnswerCallback, shareCallback, hugCallback };
