const { share } = require('../constants');
const i18n = require('../i18n');
const User = require('../models/user');
const Share = require('../models/share');
const { logTelegramError } = require('../utils/tg_errors');

const isSharing = (followerId, followedId) => Share.exists({ follower: followerId, followed: followedId, disabled: false });

// `follower` asks to see `followed`'s mood: `followed` gets Allow / Reject. Used by share links
// (/start sm-…) and by the follow-back button.
async function requestToFollow(ctx, follower, followed) {
  if (!followed || String(followed._id) === String(follower._id)) return;
  const msgs = i18n.forCtx(ctx);
  if (await isSharing(follower._id, followed._id)) {
    return ctx.reply(msgs.hasAlreadySharedMsg(followed), { parse_mode: 'HTML' });
  }
  // they read the request, so it's in their language
  const theirs = i18n.forUser(followed);
  await ctx.telegram.sendMessage(followed.id, theirs.askForShareMoodMsg(follower), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: share.ALLOW_SHARE_MOOD_INLINE_KEYBOARD(follower, theirs) },
  });
  await ctx.reply(msgs.waitingForShareMsg(followed), { parse_mode: 'HTML' });
}

const createShareLinkCommand = async (ctx) => {
  return ctx.reply(
    i18n.forCtx(ctx).createShareLinkMsg(ctx.user),
    {
      parse_mode: 'HTML',
      // disable web page preview
      disable_web_page_preview: true,
    }
  );
}

const allowShareCallback = async (ctx, userId) => {
  try {
    const follower = await User.findById(userId);
    const followed = ctx.user;
    const msgs = i18n.forCtx(ctx);
    const theirs = i18n.forUser(follower);
    await Share.createShare(follower._id, followed._id);
    await ctx.deleteMessage().catch(logTelegramError('deleteMessage'));
    // offer to share the other way too, unless they already do
    const mutual = await isSharing(followed._id, follower._id);
    await ctx.reply(`${msgs.shareAllowedMsg(follower)}${mutual ? '' : `\n\n${msgs.followBackAskMsg(follower)}`}`, {
      parse_mode: 'HTML',
      ...(mutual ? {} : { reply_markup: { inline_keyboard: share.FOLLOW_BACK_ASK_KEYBOARD(follower, msgs) } }),
    }).catch(logTelegramError('reply'));
    await ctx.telegram.sendMessage(follower.id, `${theirs.sharePermissionGrantedMsg(followed)}${mutual ? '' : `\n\n${theirs.followBackGiveMsg(followed)}`}`, {
      parse_mode: 'HTML',
      ...(mutual ? {} : { reply_markup: { inline_keyboard: share.FOLLOW_BACK_GIVE_KEYBOARD(followed, theirs) } }),
    }).catch(logTelegramError('sendMessage'));
  } catch (err) {
    console.log(err);
  }
}

const rejectShareCallback = async (ctx, userId) => {
  const follower = await User.findById(userId);
  // check if exists disable share
  const share = await Share.findOne({ follower: follower._id, followed: ctx.user._id });
  if (share) {
    await Share.disableShare(follower._id, ctx.user._id);
  }
  await ctx.deleteMessage().catch(logTelegramError('deleteMessage'));
  await ctx.reply(i18n.forCtx(ctx).rejectShareMsg(follower), { parse_mode: 'HTML' }).catch(logTelegramError('reply'));
}

const shareCallback = async (ctx) => {
  let params = ctx.callbackQuery.data.split('_');
  if (params.length !== 3) {
    return;
  }
  if (params[1] === 'allow') {
    await allowShareCallback(ctx, params[2]);
  } else if (params[1] === 'reject') {
    await rejectShareCallback(ctx, params[2]);
  }
}
// fb_ask_<userId>: I ask to see their mood (they get Allow / Reject)
// fb_give_<userId>: I let them see my mood (my own consent, so it's shared right away)
const followBackCallback = async (ctx) => {
  const [, kind, otherId] = ctx.callbackQuery.data.split('_');
  const other = /^[a-f0-9]{24}$/i.test(otherId || '') ? await User.findById(otherId) : null;
  await ctx.answerCbQuery().catch(() => {});
  if (!other) return;
  // the button is used once
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  if (kind === 'ask') return requestToFollow(ctx, ctx.user, other);
  if (kind === 'give') {
    const msgs = i18n.forCtx(ctx);
    if (await isSharing(other._id, ctx.user._id)) return ctx.reply(msgs.alreadySeesYouMsg(other), { parse_mode: 'HTML' });
    await Share.createShare(other._id, ctx.user._id);
    await ctx.reply(msgs.sharedBackMsg(other), { parse_mode: 'HTML' });
    await ctx.telegram.sendMessage(other.id, i18n.forUser(other).sharedBackNoticeMsg(ctx.user), { parse_mode: 'HTML' }).catch(logTelegramError('sendMessage'));
  }
};

module.exports = {
  createShareLinkCommand,
  shareCallback,
  followBackCallback,
  requestToFollow,
}