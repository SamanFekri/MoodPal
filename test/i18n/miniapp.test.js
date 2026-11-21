const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.BOT_USERNAME = process.env.BOT_USERNAME || 'MoodPalBot';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');
const { setTelegram } = require('../../src/utils/telegram');
const miniapp = require('../../src/i18n/miniapp');
const { CHARACTERS } = require('../../src/public/ui/mbti');

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const hash = cryptoJs.HmacSHA256(str, cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData')).toString(cryptoJs.enc.Hex);
  const p = new URLSearchParams(params); p.set('hash', hash);
  return p.toString();
}

describe('mini app language tables', () => {
  const fa = require('../../src/i18n/miniapp/fa');
  const ru = require('../../src/i18n/miniapp/ru');

  test('Farsi and Russian translate the same texts', () => {
    assert.deepEqual(Object.keys(fa).sort(), Object.keys(ru).sort());
  });

  test('every text keeps its {placeholders}, and nothing has an em dash', () => {
    const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
    for (const [name, table] of [['fa', fa], ['ru', ru]]) {
      for (const [key, value] of Object.entries(table)) {
        for (const v of [].concat(value)) {
          // a plural form may leave {n} out only where the English does too
          // named keys (talkIntroHtml) aren't English text; their English lives in the page (UI_EN)
          const english = key === 'talkIntroHtml' ? '{model}' : key;
          // a count text may add {n} (Farsi has one plural form, so "once a day" becomes "{n} times a day")
          const mine = holes(v).split(',').filter(h => !(h === 'n' && !english.includes('{n}'))).join(',');
          assert.equal(mine, holes(english), `${name}: "${key}"`);
          assert.ok(!v.includes('—'), `${name}: "${key}" has an em dash`);
        }
        if (Array.isArray(value)) assert.equal(value.length, 3, `${name}: "${key}" needs one, few and many`);
      }
    }
  });

  test('texts the page asks for by name exist in the tables', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../src/public/ui/index.html'), 'utf8');
    const asked = new Set([...html.matchAll(/\$t\('((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n')));
    // admin-only screens stay English; everything else on the page should be translated
    const missing = [...asked].filter(k => !(k in fa) && !/^(Moods|Insights)$/.test(k));
    assert.deepEqual(missing, []);
  });

  test('a table has the moods, the right direction, and every Moodling', () => {
    const t = miniapp.table('fa');
    assert.equal(t.dir, 'rtl');
    assert.equal(t.ui.Happy, 'خوشحال');
    assert.equal(miniapp.table('ru').dir, 'ltr');
    for (const lang of ['fa', 'ru']) {
      for (const type of Object.keys(CHARACTERS)) {
        const c = miniapp.table(lang).characters[type];
        for (const list of ['strengths', 'tendencies', 'funTraits', 'behaviors']) {
          assert.equal(c[list].length, CHARACTERS[type][list].length, `${lang} ${type} ${list}`);
        }
        assert.ok(c.title && c.tagline && c.description);
      }
    }
    assert.equal(miniapp.table('en'), null);
  });
});

describe('mini app language API', () => {
  let server, base, ada;
  const api = (p, { as, method = 'GET', body } = {}) => fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(as ? { 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  before(async () => {
    await db.connect();
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    personalityService.clearCache();
    ada = await User.create({ id: 71, first_name: 'Ada' });
    setTelegram({ setMyCommands: async () => true });
  });

  test('/i18n/<lang>.json serves Farsi and Russian, and nothing else', async () => {
    const fa = await api('/i18n/fa.json');
    assert.equal(fa.status, 200);
    assert.equal(fa.body.dir, 'rtl');
    assert.equal(fa.body.ui.Settings, 'تنظیمات');
    assert.equal((await api('/i18n/ru.json')).body.ui.Settings, 'Настройки');
    assert.equal((await api('/i18n/de.json')).status, 404);
  });

  test('sign-in tells the page the language, and Settings changes it', async () => {
    const auth = await fetch(base + '/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: signInitData({ id: 71, first_name: 'Ada' }) }) }).then(r => r.json());
    assert.equal(auth.language, 'en');

    const settings = await api('/api/me/settings', { as: ada });
    assert.equal(settings.body.language.current, 'en');
    assert.deepEqual(settings.body.language.choices.map(c => c.code), ['en', 'fa', 'ru']);

    const changed = await api('/api/me/settings/language', { as: ada, method: 'POST', body: { language: 'ru' } });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.language.current, 'ru');
    assert.equal((await User.findById(ada._id)).language, 'ru');
    assert.equal((await api('/api/me/settings/language', { as: ada, method: 'POST', body: { language: 'xx' } })).status, 400);
  });

  test('admins see each person\'s language, and how many use each', async () => {
    const boss = await User.create({ id: 72, first_name: 'Boss', is_admin: true });
    await User.create({ id: 73, first_name: 'Dara', language: 'fa' });
    await User.create({ id: 74, first_name: 'Olga', language: 'ru' });
    const list = await api('/api/admin/users', { as: boss });
    assert.equal(list.status, 200);
    const lang = Object.fromEntries(list.body.users.map(u => [u.first_name || u.fullname, u.language]));
    assert.equal(list.body.users.find(u => u.id === 73).language, 'fa');
    assert.equal(list.body.users.find(u => u.id === 74).language, 'ru');
    assert.equal(list.body.users.find(u => u.id === 71).language, 'en', 'no language set reads as English');
    assert.deepEqual(list.body.languages, { en: 2, fa: 1, ru: 1 });
    // filter by language; English includes people who never picked one
    const ids = async (lang) => (await api(`/api/admin/users?lang=${lang}`, { as: boss })).body.users.map(u => u.id).sort();
    assert.deepEqual(await ids('fa'), [73]);
    assert.deepEqual(await ids('ru'), [74]);
    assert.deepEqual(await ids('en'), [71, 72]);
    assert.equal((await api('/api/admin/users?lang=fa', { as: boss })).body.filter.lang, 'fa');
    assert.equal((await api('/api/admin/users?lang=xx', { as: boss })).body.users.length, 4, 'an unknown language is ignored');
    const one = await api('/api/admin/users/73/connections', { as: boss });
    assert.equal(one.body.user.language, 'fa');
    assert.ok(lang);
  });

  test('tests and questions come back in the user\'s language', async () => {
    await User.updateOne({ _id: ada._id }, { language: 'fa' });
    const mine = await api('/api/me/personality', { as: ada });
    const bigFive = mine.body.tests.find(t => t.key === 'big_five');
    assert.equal(bigFive.name, 'تست شخصیت پنج عامل بزرگ');
    const started = await api('/api/me/personality/tests/big_five/start', { as: ada, method: 'POST' });
    assert.equal(started.body.session.questions[0].text, 'من روح مهمونی‌ام.');
    assert.equal(started.body.session.test.scale.labels[4], 'خیلی درست');
  });
});
