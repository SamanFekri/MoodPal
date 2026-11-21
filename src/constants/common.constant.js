// The reply keyboard (menu) in each user's language. Button texts live in src/i18n (`menu`).
const i18n = require('../i18n');

// English labels; bot.js listens for every language's label (i18n.allMenuTexts)
const MENU_BUTTONS = {
  ...i18n.forLang('en').menu,
  // no longer shown in the keyboard; kept so a stale keyboard button still works
  LEGACY_YEAR_REPORT: '✨ 2025',
};

// Changes whenever the menu changes, so the bot can push the new keyboard to everyone
const MENU_SIGNATURE = Object.values(MENU_BUTTONS).join('|');

// the ✨ <year> button (Year in Moods, src/yearly) comes and goes with the admin switch
const yearly = () => globalThis.__moodpalYearly || { enabled: false, year: new Date().getFullYear() };
const yearButton = () => `✨ ${yearly().year}`;
// the menu a user should have now: changes with their language, and when Year in Moods is switched on or off
const menuSignature = (lang) => {
  const l = i18n.normalize(lang);
  return `${MENU_SIGNATURE}|year:${yearly().enabled ? yearly().year : 'off'}${l === i18n.DEFAULT_LANG ? '' : `|lang:${l}`}`;
};

const makeKeyboardMenu = (ctx) => {
  const user = (ctx && ctx.user) || {};
  const sig = menuSignature(user.language);
  // sending the menu keyboard means this user's client now has the current layout
  const Model = user.constructor;
  if (Model && typeof Model.updateOne === 'function' && user.menu_signature !== sig) {
    user.menu_signature = sig;
    Promise.resolve(Model.updateOne({ _id: user._id }, { menu_signature: sig })).catch(() => {});
  }
  const b = i18n.forUser(user).menu;
  const keyboard = [];
  keyboard.push([b.SET_MOOD]);
  keyboard.push([b.REPORT, b.EXPORT, b.SHARE]);
  keyboard.push([b.PERSONALITY_TEST, b.MY_PERSONALITY]);
  keyboard.push([b.TALK, b.LANGUAGE]);
  // Year in Moods: everyone once it's switched on; admins always (to test it)
  if (yearly().enabled || user.is_admin) {
    keyboard.push([yearButton()]);
  }
  // admins only: trigger a database backup straight from the chat
  if (user.is_admin) {
    keyboard.push([b.BACKUP_NOW]);
  }
  keyboard.push([user.is_mood_private ? b.VISIBILITY_PUBLIC : b.VISIBILITY_PRIVATE]);
  return keyboard;
};

// keyboard shown while a Talk conversation is running
const makeTalkKeyboard = (ctx) => {
  const b = i18n.forUser(ctx && ctx.user).menu;
  return [
    [b.END_TALK],
    [b.SET_MOOD, b.MY_PERSONALITY],
  ];
};

module.exports = { MENU_BUTTONS, MENU_SIGNATURE, yearButton, menuSignature, makeKeyboardMenu, makeTalkKeyboard };
