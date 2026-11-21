// Share keyboards. `t` is the dictionary (src/i18n) of the person who sees the buttons.
const en = require('../i18n/en');

// follow-back buttons (fb_ask_<userId>: ask to see their mood, fb_give_<userId>: let them see mine)
const FOLLOW_BACK_ASK_KEYBOARD = (other, t = en) => [[{ text: t.followBackAskButton(other.first_name), callback_data: `fb_ask_${other._id}` }]];
const FOLLOW_BACK_GIVE_KEYBOARD = (other, t = en) => [[{ text: t.followBackGiveButton(other.first_name), callback_data: `fb_give_${other._id}` }]];

const ALLOW_SHARE_MOOD_INLINE_KEYBOARD = (follower, t = en) => [
  [{ text: t.viewUserButton(follower.first_name), url: `tg://user?id=${follower.id}` }],
  [
    { text: t.allowButton(), callback_data: `share_allow_${follower._id}` },
    { text: t.rejectButton(), callback_data: `share_reject_${follower._id}` },
  ],
];

module.exports = { FOLLOW_BACK_ASK_KEYBOARD, FOLLOW_BACK_GIVE_KEYBOARD, ALLOW_SHARE_MOOD_INLINE_KEYBOARD };
