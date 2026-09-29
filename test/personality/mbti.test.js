const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.BOT_USERNAME = process.env.BOT_USERNAME || 'MoodPalBot';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const MBTI = require('../../src/public/ui/mbti');
const seed = require('../../src/personality/catalog.seed');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

// the answer (1..5) that pushes a question towards the wanted letter of its dimension
function answerFor(type, question) {
  const i = MBTI.DIMENSIONS.findIndex(d => d.key === question.trait);
  const wantRight = type[i] === MBTI.DIMENSIONS[i].right.letter;
  return wantRight !== question.reverse ? 5 : 1;
}

describe('MBTI-style test', () => {
  describe('characters and helpers', () => {
    test('all 16 types have a complete, distinct, animated character and no emoji', () => {
      assert.equal(MBTI.TYPES.length, 16);
      const names = new Set(), titles = new Set();
      for (const type of MBTI.TYPES) {
        const c = MBTI.CHARACTERS[type];
        assert.ok(c, type);
        for (const key of ['name', 'title', 'tagline', 'description']) assert.ok(c[key], `${type}.${key}`);
        for (const key of ['strengths', 'tendencies', 'funTraits', 'behaviors']) assert.ok(c[key].length >= 3, `${type}.${key}`);
        assert.equal(c.emoji, undefined);
        assert.ok(!EMOJI.test(JSON.stringify(c)), `${type} text has no emoji`);
        assert.match(c.colors.body, /^#[0-9a-f]{6}$/i);
        names.add(c.name); titles.add(c.title);
        const svg = MBTI.svg(type);
        assert.match(svg, /^<svg[^>]+viewBox/);
        assert.ok(!/NaN|undefined/.test(svg), `${type} art has no broken coordinates`);
        assert.ok(!/\sid="/.test(svg), 'no ids, so many characters can share a page');
        assert.ok(!EMOJI.test(svg), `${type} art has no emoji`);
        for (const part of ['mb-breathe', 'mb-eyes', 'mb-arm-l', 'mb-arm-r']) assert.ok(svg.includes(part), `${type} animates ${part}`);
      }
      assert.equal(names.size, 16, 'unique names');
      assert.equal(titles.size, 16, 'unique titles');
      assert.equal(MBTI.svg('XXXX'), '');
    });

    test('every letter and group has its own little icon character', () => {
      for (const kind of ['I', 'E', 'S', 'N', 'T', 'F', 'J', 'P', 'NT', 'NF', 'SJ', 'SP', 'strengths', 'tendencies', 'fun', 'behaviors']) {
        const svg = MBTI.icon(kind);
        assert.match(svg, /^<svg/, kind);
        assert.ok(!/NaN|undefined/.test(svg) && !EMOJI.test(svg), kind);
      }
      assert.equal(MBTI.icon('nope'), '');
      for (const d of MBTI.DIMENSIONS) assert.equal(d.left.emoji, undefined);
    });

    test('traits map to the four letters, ties lean E/N/F/P, and every combination is a type', () => {
      const t = (e, n, f, p) => MBTI.fromTraits({ mbti_extraversion: e, mbti_intuition: n, mbti_feeling: f, mbti_perceiving: p });
      assert.equal(t(0.9, 0.8, 0.7, 0.6).type, 'ENFP');
      assert.equal(t(0.1, 0.2, 0.3, 0.4).type, 'ISTJ');
      assert.equal(t(0.5, 0.5, 0.5, 0.5).type, 'ENFP', 'a perfect tie goes right');
      const r = t(0.2, 0.75, 0.5, 0.1);
      assert.equal(r.type, 'INFJ');
      assert.deepEqual(r.dimensions.map(d => d.percent), [80, 75, 50, 90]);
      assert.equal(t(0.2, 0.75, 0.5, undefined), null, 'needs all four');
      const seen = new Set();
      for (let m = 0; m < 16; m++) seen.add(t(m & 8 ? 0.9 : 0.1, m & 4 ? 0.9 : 0.1, m & 2 ? 0.9 : 0.1, m & 1 ? 0.9 : 0.1).type);
      assert.deepEqual([...seen].sort(), [...MBTI.TYPES].sort());
      assert.equal(MBTI.shareText('ENFP'), 'I got ENFP — The Spark!\nWhich MBTI character are you?');
    });

    test('the seed test is balanced: 6 statements per letter pair, half reverse-worded, interleaved', () => {
      const qs = seed.QUESTIONS.filter(q => q.test_key === 'mbti');
      assert.equal(qs.length, 24);
      for (const d of MBTI.DIMENSIONS) {
        const mine = qs.filter(q => q.trait === d.key);
        assert.equal(mine.length, 6, d.key);
        assert.equal(mine.filter(q => q.reverse).length, 3, d.key);
      }
      for (let i = 1; i < qs.length; i++) assert.notEqual(qs[i].trait, qs[i - 1].trait, 'no two in a row from the same pair');
      const t = seed.TESTS.find(x => x.key === 'mbti');
      assert.match(t.description + t.intro, /not a scientific or clinical/i);
      assert.equal(seed.TRAITS.find(x => x.key === 'mbti_feeling').learning_rate, 0, 'conversations never nudge the letters');
    });
  });

  describe('taking the test', () => {
    let server, base;
    const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
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
    });

    test('every one of the 16 results can be reached by answering', async () => {
      const { questions } = await personalityService.getTest('mbti');
      for (const [i, type] of MBTI.TYPES.entries()) {
        const user = await User.create({ id: 5000 + i, first_name: type });
        const { session } = await personalityService.startTest(user._id, 'mbti');
        let state;
        for (const q of questions) state = await personalityService.answerQuestion(user._id, session._id, q.order, answerFor(type, q));
        assert.equal(state.done, true);
        const view = await personalityService.getProfileView(user._id);
        assert.equal(view.mbti.type, type, `answers aimed at ${type}`);
        assert.ok(view.mbti.dimensions.every(d => d.percent === 100), 'fully one-sided answers give 100%');
        assert.ok(!view.categories.some(c => c.key === 'mbti'), 'the letters show as a character, not as trait bars');
      }
    });

    test('mixed answers give percentages; retaking replaces the result', async () => {
      const user = await User.create({ id: 1, first_name: 'Mix' });
      const { questions } = await personalityService.getTest('mbti');
      const run = async (fn) => {
        const { session } = await personalityService.startTest(user._id, 'mbti');
        for (const q of questions) await personalityService.answerQuestion(user._id, session._id, q.order, fn(q));
        return (await personalityService.getProfileView(user._id)).mbti;
      };
      assert.equal((await run(q => answerFor('INTJ', q))).type, 'INTJ');
      // "Kinda?" (3) everywhere except one strong E answer -> E by a hair, the rest are ties (-> N, F, P)
      const second = await run(q => (q.trait === 'mbti_extraversion' && q.order === 1 ? 5 : 3));
      assert.equal(second.type, 'ENFP', 'the retake wins');
      const e = second.dimensions.find(d => d.key === 'mbti_extraversion');
      assert.equal(e.letter, 'E');
      assert.ok(e.percent > 50 && e.percent < 60, `${e.percent}`);
    });

    test('mini app API: the test is listed right after Big Five, progress survives leaving, a finished test returns the character', async () => {
      const me = await User.create({ id: 1, first_name: 'Me' });
      let r = await api('/api/me/personality', { as: me });
      assert.equal(r.body.tests[0].key, 'big_five', 'existing tests keep their order');
      assert.equal(r.body.tests[1].key, 'mbti');
      assert.equal(r.body.tests[1].question_count, 24);

      r = await api('/api/me/personality/tests/mbti/start', { method: 'POST', as: me });
      const sessionId = r.body.session.id;
      assert.deepEqual(r.body.session.test.scale.labels, ['Nope, not me', 'Not really', 'Kinda?', 'Pretty much', "That's so me!"]);
      assert.ok(r.body.session.questions.every(q => q.trait === undefined), 'answers are not hinted');

      const { questions } = await personalityService.getTest('mbti');
      for (const q of questions.slice(0, 10)) await api(`/api/me/personality/session/${sessionId}/answer`, { method: 'POST', as: me, body: { order: q.order, value: answerFor('ESFP', q) } });
      r = await api('/api/me/personality/session', { as: me });
      assert.equal(r.body.session.answered, 10, 'leaving halfway keeps the progress');

      for (const q of questions.slice(10)) r = await api(`/api/me/personality/session/${sessionId}/answer`, { method: 'POST', as: me, body: { order: q.order, value: answerFor('ESFP', q) } });
      assert.equal(r.body.done, true);
      assert.equal(r.body.profile.mbti.type, 'ESFP');
      assert.equal(r.body.tests.find(t => t.key === 'mbti').completed, true);
    });

    test('friends see your Moodling unless you hide it in Settings (hidden everywhere others look)', async () => {
      const Share = require('../../src/models/share');
      const Mood = require('../../src/models/mood');
      const me = await User.create({ id: 1, first_name: 'Me' });
      const friend = await User.create({ id: 2, first_name: 'Friend' });
      const stranger = await User.create({ id: 3, first_name: 'Stranger' });
      await Mood.create({ user: me._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' } });
      await Share.createShare(friend._id, me._id);   // friend follows my mood

      // before the test there is nothing to show
      let r = await api('/api/friends', { as: friend });
      assert.equal(r.body[0].mbti, null);
      assert.equal((await api('/api/me/settings', { as: me })).body.privacy.mbti_shared, true, 'shown by default');

      const { questions } = await personalityService.getTest('mbti');
      const { session } = await personalityService.startTest(me._id, 'mbti');
      for (const q of questions) await personalityService.answerQuestion(me._id, session._id, q.order, answerFor('ISFJ', q));

      r = await api('/api/friends', { as: friend });
      assert.equal(r.body[0].mbti, 'ISFJ', 'on my card in their friends grid');
      r = await api('/api/friends/1/personality', { as: friend });
      assert.equal(r.body.shared, false, 'the rest of my personality is still private');
      assert.equal(r.body.profile, null);
      assert.equal(r.body.mbti.type, 'ISFJ', 'but my Moodling is visible on my profile');
      assert.equal((await api('/api/friends/1/personality', { as: stranger })).status, 403, 'only people who follow me');
      assert.equal((await api('/api/me/settings', { as: me })).body.privacy.mbti_type, 'ISFJ');

      // share the whole personality publicly, then hide the Moodling
      const sharing = await api('/api/me/personality/sharing', { method: 'POST', as: me, body: { enabled: true } });
      const token = sharing.body.public_url.split('/p/')[1];
      assert.equal((await api(`/api/public/personality/${token}`)).body.profile.mbti.type, 'ISFJ');

      assert.equal((await api('/api/me/settings/privacy', { method: 'POST', as: me, body: { mbti_shared: 'no' } })).status, 400);
      r = await api('/api/me/settings/privacy', { method: 'POST', as: me, body: { mbti_shared: false } });
      assert.equal(r.body.privacy.mbti_shared, false);

      assert.equal((await api('/api/friends', { as: friend })).body[0].mbti, null, 'gone from their grid');
      r = await api('/api/friends/1/personality', { as: friend });
      assert.equal(r.body.shared, true);
      assert.equal(r.body.mbti, undefined, 'gone from my profile');
      assert.equal(r.body.profile.mbti, null, 'and from the shared personality');
      assert.equal((await api(`/api/public/personality/${token}`)).body.profile.mbti, null, 'and from the public link');
      assert.equal((await personalityService.getProfileView(me._id)).mbti.type, 'ISFJ', 'I still see it myself');

      await api('/api/me/settings/privacy', { method: 'POST', as: me, body: { mbti_shared: true } });
      assert.equal((await api('/api/friends', { as: friend })).body[0].mbti, 'ISFJ', 'and back');
    });

    test('/result/<type> serves the app with a link preview; anything else still serves the app', async () => {
      const ok = await fetch(`${base}/result/enfp`);
      assert.equal(ok.status, 200);
      const html = await ok.text();
      assert.match(html, /<title>ENFP — The Spark · MoodPal<\/title>/);
      assert.match(html, /property="og:title" content="ENFP — The Spark · MoodPal"/);
      assert.match(html, /name="moodpal-bot" content="MoodPalBot"/);
      assert.match(html, /\/public\/ui\/mbti\.js/);

      const bad = await fetch(`${base}/result/ABCD`);
      assert.equal(bad.status, 200);
      assert.doesNotMatch(await bad.text(), /og:title/);
      assert.equal((await fetch(`${base}/public/ui/mbti.js`)).status, 200);
    });
  });
});
