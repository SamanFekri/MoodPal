// the mood constant is a list of moods that can be used in the app
// 😊 Happy
// 😌 Relaxed
// 😁 Excited
// 🤩 Motivated
// 😐 Neutral
// 🤔 Confused
// 🥱 Bored
// 🤷 Uncertain
// 😞 Disappointed
// 😰 Anxious
// 😡 Angry
// 😢 Sad
// 😩 Overwhelmed
// 🤯 Overthinking
// 😴 Tired
// 😬 Nervous
// 🤒 Sick
// 😈 Naughty


const MOODS = [
  {emoji: '😊', name: 'Happy', code: 'happy'},
  {emoji: '😌', name: 'Relaxed', code: 'relaxed'},
  {emoji: '😁', name: 'Excited', code: 'excited'},
  {emoji: '🤩', name: 'Motivated', code: 'motivated'},
  {emoji: '😐', name: 'Neutral', code: 'neutral'},
  {emoji: '🤔', name: 'Confused', code: 'confused'},
  {emoji: '🥱', name: 'Bored', code: 'bored'},
  {emoji: '🤷', name: 'Uncertain', code: 'uncertain'},
  {emoji: '😞', name: 'Disappointed', code: 'disappointed'},
  {emoji: '😰', name: 'Anxious', code: 'anxious'},
  {emoji: '😡', name: 'Angry', code: 'angry'},
  {emoji: '😢', name: 'Sad', code: 'sad'},
  {emoji: '😩', name: 'Overwhelmed', code: 'overwhelmed'},
  {emoji: '🤯', name: 'Overthinking', code: 'overthinking'},
  {emoji: '😴', name: 'Tired', code: 'tired'},
  {emoji: '😬', name: 'Nervous', code: 'nervous'},
  {emoji: '🤒', name: 'Sick', code: 'sick'},
  {emoji: '😈', name: 'Naughty', code: 'naughty'}
]
const MOOD_CODES = MOODS.map(mood => mood.code);
const MOOD_EMOJIS = MOODS.map(mood => mood.emoji);
const MOOD_NAMES = MOODS.map(mood => mood.name);
const MOOD_MAP = MOODS.reduce((acc, mood) => {
  acc[mood.code] = mood
  return acc;
}, {});
// max 6 emojis per row
const MOOD_INLINE_KEYBOARD_ROW = 3;
// the mood picker with names in the user's language (`t` from src/i18n); callback data is the same in all
const moodKeyboard = (t = null) => MOODS.reduce((acc, mood, index) => {
  if (index % MOOD_INLINE_KEYBOARD_ROW === 0) {
    acc.push([]);
  }
  acc[acc.length - 1].push({
    text: `${mood.emoji} ${t?.moods?.[mood.code] || mood.name}`,
    callback_data: `mood_${mood.code}`
  });
  return acc;
}, []);
const MOOD_INLINE_KEYBOARD = moodKeyboard();

module.exports = { MOODS, MOOD_CODES, MOOD_EMOJIS, MOOD_NAMES, MOOD_MAP, MOOD_INLINE_KEYBOARD_ROW, MOOD_INLINE_KEYBOARD, moodKeyboard };