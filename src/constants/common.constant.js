export const MENU_BUTTONS = {
  SET_MOOD: '🤩 New mood',
  REPORT: '📊 Report',
  // no longer shown in the keyboard; kept so a stale keyboard button still works
  LEGACY_YEAR_REPORT: '✨ 2025',
  SHARE: '🚀 Share',
  VISIBILITY_PUBLIC: '👀 Make Visibility Public',
  VISIBILITY_PRIVATE: '👻 Make Visibility Private',
  PERSONALITY_TEST: '🧠 Personality Test',
  MY_PERSONALITY: '🧠 My Personality'
}

export const makeKeyboardMenu = (ctx) => {
  let keyboard = []
  keyboard.push([MENU_BUTTONS.SET_MOOD])
  keyboard.push([MENU_BUTTONS.REPORT, MENU_BUTTONS.SHARE])
  keyboard.push([MENU_BUTTONS.PERSONALITY_TEST, MENU_BUTTONS.MY_PERSONALITY])
  if(ctx.user.is_mood_private) {
    keyboard.push([MENU_BUTTONS.VISIBILITY_PUBLIC])
  } else {
    keyboard.push([MENU_BUTTONS.VISIBILITY_PRIVATE])
  }
  return keyboard
}