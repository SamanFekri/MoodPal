const { msgs } = require('../constants');
const User = require('../models/user');
const Share = require('../models/share');

const createShareLinkCommand = async (ctx) => {
  ctx.reply(
    msgs.createShareLinkMsg(ctx.user),
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
    await Share.createShare(follower._id, followed._id);
    ctx.deleteMessage();
    ctx.reply(msgs.shareAllowedMsg(follower), { parse_mode: 'HTML' });
    ctx.telegram.sendMessage(follower.id, msgs.sharePermissionGrantedMsg(followed), { parse_mode: 'HTML' });
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
  ctx.deleteMessage();
  ctx.reply(msgs.rejectShareMsg(follower), { parse_mode: 'HTML' });
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
module.exports = {
  createShareLinkCommand,
  shareCallback,
}