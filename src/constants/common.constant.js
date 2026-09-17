export const MENU_BUTTONS = {
  SET_MOOD: '🤩 New mood',
  REPORT: '📊 Report',
  // no longer shown in the keyboard; kept so a stale keyboard button still works
  LEGACY_YEAR_REPORT: '✨ 2025',
  SHARE: '🚀 Share',
  VISIBILITY_PUBLIC: '👀 Make Visibility Public',
  VISIBILITY_PRIVATE: '👻 Make Visibility Private',
  PERSONALITY_TEST: '🧠 Personality Test',
  MY_PERSONALITY: '🧠 My Personality',
  TALK: '💬 Talk',
  END_TALK: '🛑 End talk'
}

// Changes whenever the menu changes, so the bot can push the new keyboard to everyone
export const MENU_SIGNATURE = Object.values(MENU_BUTTONS).join('|');

export const makeKeyboardMenu = (ctx) => {
  // sending the menu keyboard means this user's client now has the current layout
  const Model = ctx && ctx.user && ctx.user.constructor
  if (Model && typeof Model.updateOne === 'function' && ctx.user.menu_signature !== MENU_SIGNATURE) {
    ctx.user.menu_signature = MENU_SIGNATURE
    Promise.resolve(Model.updateOne({ _id: ctx.user._id }, { menu_signature: MENU_SIGNATURE })).catch(() => {})
  }
  let keyboard = []
  keyboard.push([MENU_BUTTONS.SET_MOOD])
  keyboard.push([MENU_BUTTONS.REPORT, MENU_BUTTONS.SHARE])
  keyboard.push([MENU_BUTTONS.PERSONALITY_TEST, MENU_BUTTONS.MY_PERSONALITY])
  keyboard.push([MENU_BUTTONS.TALK])
  if(ctx.user.is_mood_private) {
    keyboard.push([MENU_BUTTONS.VISIBILITY_PUBLIC])
  } else {
    keyboard.push([MENU_BUTTONS.VISIBILITY_PRIVATE])
  }
  return keyboard
}

// keyboard shown while a Talk conversation is running
export const makeTalkKeyboard = () => [
  [MENU_BUTTONS.END_TALK],
  [MENU_BUTTONS.SET_MOOD, MENU_BUTTONS.MY_PERSONALITY]
]