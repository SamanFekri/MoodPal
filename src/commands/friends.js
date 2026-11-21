// /friends: who you follow, who follows you, and buttons to unfollow / stop sharing / both.
// Quiet on purpose: the other person is not notified.
const User = require('../models/user');
const Share = require('../models/share');
const i18n = require('../i18n');

const MAX_BUTTONS = 30;
const nameOf = (u, t = i18n.forLang()) => [u.first_name, u.last_name].filter(Boolean).join(' ') || t.someone;

async function view(user) {
  const t = i18n.forUser(user);
  const name = (u) => nameOf(u, t);
  const [following, followers] = await Promise.all([
    Share.find({ follower: user._id, disabled: false }).populate('followed', 'id first_name last_name').lean(),
    Share.find({ followed: user._id, disabled: false }).populate('follower', 'id first_name last_name').lean(),
  ]);
  const iSee = following.map(s => s.followed).filter(Boolean);
  const seeMe = followers.map(s => s.follower).filter(Boolean);
  const seeMeIds = new Set(seeMe.map(u => String(u._id)));

  if (!iSee.length && !seeMe.length) {
    return { text: t.friendsNoneMsg(), keyboard: [] };
  }
  const list = (users) => (users.length ? users.map(name).join(t.listSep) : t.nobody());
  const lines = [t.friendsTitle()];
  lines.push(`\n${t.friendsYouSee(list(iSee))}`);
  lines.push(t.friendsSeeYou(list(seeMe)));
  lines.push(`\n${t.friendsHint()}`);

  const keyboard = [];
  for (const u of iSee) {
    const row = [{ text: t.friendsUnfollowButton(name(u)), callback_data: `fr_uf_${u._id}` }];
    if (seeMeIds.has(String(u._id))) row.push({ text: t.friendsBothButton(), callback_data: `fr_both_${u._id}` });
    keyboard.push(row);
  }
  for (const u of seeMe) keyboard.push([{ text: t.friendsHideButton(name(u)), callback_data: `fr_rm_${u._id}` }]);
  return { text: lines.join('\n'), keyboard: keyboard.slice(0, MAX_BUTTONS) };
}

async function friendsCommand(ctx) {
  const v = await view(ctx.user);
  return ctx.reply(v.text, { parse_mode: 'HTML', reply_markup: v.keyboard.length ? { inline_keyboard: v.keyboard } : undefined });
}

// fr_uf_<id>: stop seeing their mood · fr_rm_<id>: stop them seeing mine · fr_both_<id>: both
async function friendsCallback(ctx) {
  const [, kind, otherId] = ctx.callbackQuery.data.split('_');
  const other = /^[a-f0-9]{24}$/i.test(otherId || '') ? await User.findById(otherId) : null;
  if (!other) return ctx.answerCbQuery().catch(() => {});
  if (kind === 'uf' || kind === 'both') await Share.disableShare(ctx.user._id, other._id);
  if (kind === 'rm' || kind === 'both') await Share.disableShare(other._id, ctx.user._id);
  const t = i18n.forCtx(ctx);
  const n = nameOf(other, t);
  const done = { uf: t.friendsUnfollowedToast(n), rm: t.friendsRemovedToast(n), both: t.friendsBothToast(n) }[kind];
  await ctx.answerCbQuery(done).catch(() => {});
  const v = await view(ctx.user);
  await ctx.editMessageText(v.text, { parse_mode: 'HTML', reply_markup: v.keyboard.length ? { inline_keyboard: v.keyboard } : undefined }).catch(() => {});
}

module.exports = { friendsCommand, friendsCallback, view };
