// The mini app's language table, served as /i18n/<lang>.json: its UI text (src/i18n/miniapp/<lang>.js),
// mood names, and the Moodlings' words. English needs no table: the page is written in English.
const i18n = require('./index');
const { MOODS } = require('../constants/mood.constant');
const characterLists = require('./miniapp/characters');

const TABLES = { fa: require('./miniapp/fa'), ru: require('./miniapp/ru') };
const LOCALES = { fa: 'fa-IR', ru: 'ru-RU' };
const cache = new Map();

function table(lang) {
  if (!TABLES[lang]) return null;
  if (cache.has(lang)) return cache.get(lang);
  const t = i18n.forLang(lang);
  // moods are stored and sent with their English name; the page looks the name up here
  const moods = Object.fromEntries(MOODS.map(m => [m.name, t.moods[m.code]]));
  const personality = require(`./personality/${lang}`);
  const characters = {};
  for (const type of Object.keys(personality.characters)) {
    characters[type] = { ...personality.characters[type], ...(characterLists[lang]?.[type] || {}) };
  }
  const out = { lang, dir: t.dir, locale: LOCALES[lang], ui: { ...moods, ...TABLES[lang] }, characters };
  cache.set(lang, out);
  return out;
}

module.exports = { table, LANGS: Object.keys(TABLES) };
