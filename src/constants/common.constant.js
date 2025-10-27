export const MENU_BUTTONS = {
  SET_MOOD: '🤩 New mood',
  REPORT: '📊 Report',
  YEAR_REPORT: '✨ 2025',
  SHARE: '🚀 Share',
  VISIBILITY_PUBLIC: '👀 Make Visibility Public',
  VISIBILITY_PRIVATE: '👻 Make Visibility Private'
}

export const makeKeyboardMenu = (ctx) => {
  let keyboard = []
  keyboard.push([MENU_BUTTONS.SET_MOOD])
  keyboard.push([MENU_BUTTONS.REPORT, MENU_BUTTONS.SHARE, MENU_BUTTONS.YEAR_REPORT])
  if(ctx.user.is_mood_private) {
    keyboard.push([MENU_BUTTONS.VISIBILITY_PUBLIC])
  } else {
    keyboard.push([MENU_BUTTONS.VISIBILITY_PRIVATE])
  }
  return keyboard
}