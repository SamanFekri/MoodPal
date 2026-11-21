// Languages the bot speaks. English is the default and the fallback: a key missing from another
// language's dictionary uses the English text, so a half-translated string never breaks a message.
//
//   const i18n = require('../i18n');
//   const t = i18n.forCtx(ctx);          // in a bot handler (uses ctx.user.language)
//   const t = i18n.forUser(user);        // when messaging someone else (their language, not yours)
//   t.noMoodMsg(); t.menu.SET_MOOD; t.moods.happy
const en = require('./en');

const LANGS = ['en', 'fa', 'ru'];
const DEFAULT_LANG = 'en';

// one level deep: namespaces like `menu` or `personality` merge key by key
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    const isPlain = v && typeof v === 'object' && !Array.isArray(v);
    out[k] = isPlain && base[k] && typeof base[k] === 'object' ? { ...base[k], ...v } : v;
  }
  return out;
}

const dicts = {
  en,
  fa: merge(en, require('./fa')),
  ru: merge(en, require('./ru')),
};

const normalize = (lang) => (LANGS.includes(lang) ? lang : DEFAULT_LANG);
const isSupported = (lang) => LANGS.includes(lang);

// a brand-new user's language from their Telegram app's language; everything else is English
function detect(telegramLanguageCode) {
  const code = String(telegramLanguageCode || '').toLowerCase();
  if (code.startsWith('fa')) return 'fa';
  if (code.startsWith('ru')) return 'ru';
  return DEFAULT_LANG;
}

const forLang = (lang) => dicts[normalize(lang)];
const forUser = (user) => forLang(user?.language);
const forCtx = (ctx) => forUser(ctx?.user);

// every language's text for one menu button, so a keyboard in any language keeps working
const allMenuTexts = (key) => [...new Set(LANGS.map(l => dicts[l].menu[key]).filter(Boolean))];

// display name of a mood in a language (moods are stored with their English name)
const moodName = (lang, code, fallback = '') => forLang(lang).moods[code] || fallback || code;

module.exports = { LANGS, DEFAULT_LANG, normalize, isSupported, detect, forLang, forUser, forCtx, allMenuTexts, moodName, dicts };
