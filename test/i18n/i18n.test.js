const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const i18n = require('../../src/i18n');
const en = require('../../src/i18n/en');
const fa = require('../../src/i18n/fa');
const ru = require('../../src/i18n/ru');
const seed = require('../../src/personality/catalog.seed');
const { CHARACTERS } = require('../../src/public/ui/mbti');
const { localizeTest, localizeQuestion, traitName, localizeCharacter } = require('../../src/i18n/personality');

const RAW = { fa, ru };
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v);

// something every message function can be called with, without printing "undefined"
const SAMPLE = {
  first_name: 'Ada', _id: 'abc123', id: 42, name: 'Sad', code: 'sad', emoji: '😢', title: 'The Title', tagline: 'Tag', description: 'Desc',
  total_parts: 2, total_documents: 10, bytes: 2048, parts: [{}, { error: 'x' }], message: 'msg',
};
function callAll(dict, path = '') {
  const out = [];
  for (const [k, v] of Object.entries(dict)) {
    if (typeof v === 'function') {
      const args = k === 'joinNames' ? [['Ada', 'Kai', 'Lu']] : k === 'mbtiResultMsg' ? ['INFP', SAMPLE, 'https://x'] : [SAMPLE, 3, 2, 1, 5];
      out.push([`${path}${k}`, String(v(...args))]);
    } else if (isPlain(v)) {
      out.push(...callAll(v, `${path}${k}.`));
    }
  }
  return out;
}

describe('languages', () => {
  for (const lang of ['fa', 'ru']) {
    test(`${lang} has every English key, with the same kind of value, and nothing extra`, () => {
      const raw = RAW[lang];
      for (const [k, v] of Object.entries(en)) {
        // Year in Moods stays English for everyone (by choice), so it has no Farsi / Russian text
        if (k.startsWith('yearly')) { assert.ok(!(k in raw), `${lang} should leave "${k}" to English`); continue; }
        assert.ok(k in raw, `${lang} is missing "${k}"`);
        assert.equal(typeof raw[k], typeof v, `${lang}.${k} should be a ${typeof v}`);
        if (isPlain(v)) {
          for (const sub of Object.keys(v)) assert.ok(sub in raw[k], `${lang} is missing "${k}.${sub}"`);
          for (const sub of Object.keys(raw[k])) assert.ok(sub in v, `${lang} has "${k}.${sub}" that English doesn't`);
        }
      }
      for (const k of Object.keys(raw)) assert.ok(k in en, `${lang} has "${k}" that English doesn't`);
      assert.equal(raw.exportColumns.length, en.exportColumns.length);
    });
  }

  test('every message renders in every language without "undefined" or em dashes', () => {
    for (const lang of i18n.LANGS) {
      for (const [key, text] of callAll(i18n.forLang(lang))) {
        assert.ok(!/undefined/.test(text), `${lang}.${key}: ${text}`);
        assert.ok(!text.includes('—'), `${lang}.${key} has an em dash`);
      }
    }
  });

  test('Year in Moods speaks English in every language', () => {
    for (const lang of i18n.LANGS) assert.equal(i18n.forLang(lang).yearlyReadyMsg(), en.yearlyReadyMsg());
  });

  test('the OpenAI key prompt is recognisable in every language (it mentions OpenAI and sk-)', () => {
    for (const lang of i18n.LANGS) {
      const text = i18n.forLang(lang).askOpenAIKeyMsg();
      assert.match(text, /OpenAI/);
      assert.match(text, /sk-/);
    }
  });

  test('new users start in their Telegram language when we speak it, English otherwise', () => {
    assert.equal(i18n.detect('fa'), 'fa');
    assert.equal(i18n.detect('fa-IR'), 'fa');
    assert.equal(i18n.detect('ru'), 'ru');
    assert.equal(i18n.detect('en-US'), 'en');
    assert.equal(i18n.detect('de'), 'en');
    assert.equal(i18n.detect(undefined), 'en');
    assert.equal(i18n.forUser({ language: null }).code, 'en');
    assert.equal(i18n.forUser({ language: 'xx' }).code, 'en');
    assert.equal(i18n.forUser({ language: 'fa' }).code, 'fa');
  });

  test('a menu button text belongs to one button only, across all languages', () => {
    const seen = new Map();
    for (const lang of i18n.LANGS) {
      for (const [key, text] of Object.entries(i18n.forLang(lang).menu)) {
        if (seen.has(text)) assert.equal(seen.get(text), key, `"${text}" is used for ${seen.get(text)} and ${key}`);
        seen.set(text, key);
      }
    }
  });

  test('every mood has a name in every language', () => {
    const { MOODS } = require('../../src/constants/mood.constant');
    for (const lang of i18n.LANGS) for (const m of MOODS) assert.ok(i18n.forLang(lang).moods[m.code], `${lang} mood ${m.code}`);
  });
});

describe('personality content', () => {
  for (const lang of ['fa', 'ru']) {
    test(`${lang}: every test, question, trait and character is translated, in the same order`, () => {
      const content = require(`../../src/i18n/personality/${lang}`);
      for (const t of seed.TESTS) {
        const questions = seed.QUESTIONS.filter(q => q.test_key === t.key);
        assert.equal(content.tests[t.key]?.items?.length, questions.length, `${lang} ${t.key} item count`);
        const local = localizeTest(t, lang);
        assert.notEqual(local.name, t.name);
        assert.equal(local.scale.labels.length, t.scale.max - t.scale.min + 1);
        assert.notEqual(localizeQuestion(questions[0], t.key, lang).text, questions[0].text);
      }
      for (const trait of seed.TRAITS) assert.ok(content.traits[trait.key], `${lang} trait ${trait.key}`);
      for (const category of Object.keys(seed.CATEGORY_NAMES)) assert.ok(content.categories[category], `${lang} category ${category}`);
      for (const type of Object.keys(CHARACTERS)) {
        const c = localizeCharacter(type, CHARACTERS[type], lang);
        assert.equal(c.name, CHARACTERS[type].name, 'character names stay');
        assert.notEqual(c.tagline, CHARACTERS[type].tagline);
      }
    });
  }

  test('English stays as stored', () => {
    const t = seed.TESTS[0];
    assert.deepEqual(localizeTest(t, 'en'), t);
    assert.equal(traitName({ key: 'openness', name: 'Openness' }, null), 'Openness');
  });

  test('the profile summary speaks the user\'s language', () => {
    const { formatProfileSummary } = require('../../src/personality/context');
    const traits = { openness: { key: 'openness', name: 'Openness', category: 'big_five' } };
    const profile = { traits: { openness: 0.9 }, confidence: { openness: 0.7 } };
    assert.match(formatProfileSummary(profile, traits, { lang: 'fa' }), /گشودگی/);
    assert.match(formatProfileSummary(profile, traits, { lang: 'ru' }), /Открытость опыту/);
    assert.match(formatProfileSummary(profile, traits), /Openness/);
  });
});

describe('menu and language switch', () => {
  const db = require('../helpers/db');
  const User = require('../../src/models/user');
  const { common, moodKeyboard } = require('../../src/constants');
  const language = require('../../src/commands/language');
  let ada;

  before(async () => { await db.connect(); });
  after(async () => { await db.disconnect(); });
  beforeEach(async () => { await db.clear(); ada = await User.create({ id: 7001, first_name: 'Ada' }); });

  test('the menu is in the user\'s language and has the Language button', () => {
    const keys = (lang) => common.makeKeyboardMenu({ user: { language: lang } }).flat();
    assert.ok(keys('en').includes('🌐 Language') && keys('en').includes('🤩 New mood'));
    assert.ok(keys('fa').includes('🌐 زبان') && keys('fa').includes('🤩 حس جدید'));
    assert.ok(keys('ru').includes('🌐 Язык') && keys('ru').includes('🤩 Новое настроение'));
    assert.equal(common.menuSignature(null), common.menuSignature('en'));
    assert.notEqual(common.menuSignature('fa'), common.menuSignature('en'));
    assert.match(moodKeyboard(i18n.forLang('fa'))[0][0].text, /خوشحال/);
    assert.equal(moodKeyboard(i18n.forLang('fa'))[0][0].callback_data, 'mood_happy');
  });

  test('Telegram command lists exist for every language, with the same commands', () => {
    const names = (lang) => language.botCommands(lang).map(c => c.command);
    for (const lang of i18n.LANGS) {
      assert.deepEqual(names(lang), names('en'));
      for (const c of language.botCommands(lang)) assert.ok(c.description && c.description.length <= 256, `${lang} /${c.command}`);
    }
  });

  test('picking a language saves it, answers in it and sends the menu in it', async () => {
    const calls = [];
    const ctx = {
      user: ada, chat: { type: 'private', id: ada.id }, callbackQuery: { data: 'lang_fa' },
      telegram: { setMyCommands: async (cmds, extra) => calls.push({ cmds, extra }) },
      answerCbQuery: async (t) => calls.push({ toast: t }),
      editMessageText: async () => {},
      reply: async (t, extra) => calls.push({ reply: t, extra }),
    };
    await language.languageCallback(ctx);
    assert.equal((await User.findById(ada._id)).language, 'fa');
    assert.deepEqual(calls[0].extra, { scope: { type: 'chat', chat_id: ada.id } });
    assert.equal(calls[0].cmds.find(c => c.command === 'language').description, fa.commands.language);
    const reply = calls.find(c => c.reply);
    assert.equal(reply.reply, fa.languageChangedMsg());
    assert.ok(reply.extra.reply_markup.keyboard.flat().includes('🤩 حس جدید'));
  });

  test('the t.me/<bot>?start=language link opens the language picker', async () => {
    const start = require('../../src/commands/start');
    const sent = [];
    const ctx = { user: Object.assign(ada, { language: 'ru' }), payload: 'language', reply: async (t, extra) => sent.push({ t, extra }) };
    await start(ctx);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].t, ru.languageChooseMsg());
    assert.deepEqual(sent[0].extra.reply_markup.inline_keyboard[0].map(b => b.callback_data), ['lang_en', 'lang_fa', 'lang_ru']);
  });

  test('an unknown language in the callback changes nothing', async () => {
    const ctx = { user: ada, chat: { type: 'private', id: ada.id }, callbackQuery: { data: 'lang_xx' }, answerCbQuery: async () => {} };
    await language.languageCallback(ctx);
    assert.equal((await User.findById(ada._id)).language, null);
  });

  test('a new user starts in their Telegram language', async () => {
    const saveUser = require('../../src/middlewares/user.middleware');
    const ctx = { from: { id: 7002, first_name: 'Dariush', language_code: 'fa' }, chat: { type: 'private' } };
    await saveUser(ctx, () => {});
    assert.equal(ctx.user.language, 'fa');
    const ctx2 = { from: { id: 7003, first_name: 'Sam', language_code: 'de' }, chat: { type: 'private' } };
    await saveUser(ctx2, () => {});
    assert.equal(ctx2.user.language, 'en');
  });
});
