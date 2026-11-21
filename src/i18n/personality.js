// Personality test content in other languages. Tests, questions and traits are stored in the database
// in English (src/personality/catalog.seed.js); these helpers swap in the user's language when one
// exists and keep the English text otherwise. Questions are matched by test key + order (1-based).
const content = {
  fa: require('./personality/fa'),
  ru: require('./personality/ru'),
};
const { normalize } = require('./index');

const of = (lang) => content[normalize(lang)] || null;

// { key, name, description, intro, scale } -> the same, translated
function localizeTest(test, lang) {
  const c = of(lang);
  const tr = test && c?.tests?.[test.key];
  if (!tr) return test;
  const labels = tr.scale || (test.scale && c.likert);
  return {
    ...test,
    name: tr.name || test.name,
    description: tr.description || test.description,
    intro: tr.intro || (test.intro ? c.intro : test.intro) || test.intro,
    ...(test.scale && labels ? { scale: { ...test.scale, labels } } : {}),
  };
}

function localizeQuestion(question, testKey, lang) {
  const text = of(lang)?.tests?.[testKey]?.items?.[question.order - 1];
  return text ? { ...question, text } : question;
}

const traitName = (trait, lang) => of(lang)?.traits?.[trait.key] || trait.name;
const categoryName = (category, fallback, lang) => of(lang)?.categories?.[category] || fallback;

// an MBTI-style character (src/public/ui/mbti.js) with its title, tagline and description translated
function localizeCharacter(type, character, lang) {
  const tr = of(lang)?.characters?.[type];
  return tr && character ? { ...character, ...tr } : character;
}

// the mini app's profile (personality service getProfileView) with names and levels in `lang`
function localizeProfileView(view, lang) {
  if (!view || !of(lang)) return view;
  const levels = require('./index').forLang(lang).personality.levels;
  return {
    ...view,
    categories: (view.categories || []).map(c => ({
      ...c,
      name: categoryName(c.key, c.name, lang),
      traits: c.traits.map(t => ({ ...t, name: traitName(t, lang), label: levels[t.label] || t.label })),
    })),
    from_talks: (view.from_talks || []).map(t => ({ ...t, name: traitName(t, lang) })),
  };
}

module.exports = { localizeTest, localizeQuestion, traitName, categoryName, localizeCharacter, localizeProfileView };
