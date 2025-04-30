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


export const MOODS = [
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
export const MOOD_CODES = MOODS.map(mood => mood.code);
export const MOOD_EMOJIS = MOODS.map(mood => mood.emoji);
export const MOOD_NAMES = MOODS.map(mood => mood.name);
export const MOOD_MAP = MOODS.reduce((acc, mood) => {
  acc[mood.code] = mood
  return acc;
}, {});