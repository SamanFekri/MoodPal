const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const translateService = require('../../src/translate/service');

// ---- stubs: no test reaches Google or OpenAI ----
const llmStub = { calls: [], next: { english: 'I am tired of everything', language: 'fa' }, DEFAULT_MODEL: 'gpt-5.6' };
llmStub.translateToEnglish = async (text, apiKey, opts) => { llmStub.calls.push({ text, apiKey, opts }); if (llmStub.next instanceof Error) throw llmStub.next; return llmStub.next; };
llmStub.isAuthError = (e) => e?.status === 401;
translateService._llm = llmStub;
require('../../src/characteristics/service')._llm = llmStub;

const googleCalls = [];
let googleNext = { status: 200, body: { data: { translations: [{ translatedText: 'Tired of everything', detectedSourceLanguage: 'fa' }] } } };
translateService._fetch = async (url, init) => { googleCalls.push({ url, body: JSON.parse(init.body) }); return { ok: googleNext.status < 400, status: googleNext.status, json: async () => googleNext.body }; };

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}
let server, base;
const api = (path, { as, method = 'GET' } = {}) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const ADMIN_KEY = 'sk-admin-key-1234567890abcdefghij';

describe('admin: translate mood notes', () => {
  let admin, ali, mood, noNote;

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });

  beforeEach(async () => {
    await db.clear();
    translateService.cache.clear();
    llmStub.calls = []; googleCalls.length = 0;
    llmStub.next = { english: 'I am tired of everything', language: 'fa' };
    googleNext = { status: 200, body: { data: { translations: [{ translatedText: 'Tired of everything', detectedSourceLanguage: 'fa' }] } } };
    delete process.env.GOOGLE_TRANSLATE_API_KEY; delete process.env.OPENAI_API_KEY;
    admin = await User.create({ id: 5009, first_name: 'Root', is_admin: true });
    ali = await User.create({ id: 5001, first_name: 'Ali' });
    mood = await Mood.create({ user: ali._id, mood: { code: 'tired', emoji: '😴', name: 'Tired' }, note: 'از همه چی خسته‌ام' });
    noNote = await Mood.create({ user: ali._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' }, timestamp: new Date(Date.now() - 1000) });
  });
  afterEach(() => { delete process.env.GOOGLE_TRANSLATE_API_KEY; delete process.env.OPENAI_API_KEY; });

  test('with no translator the moods say so and nothing is sent anywhere', async () => {
    const moods = await api('/api/admin/users/5001/moods', { as: admin });
    assert.deepEqual(moods.body.translate, { available: false, provider: null });
    assert.ok(moods.body.moods.every(m => m.id));
    const r = await api(`/api/admin/moods/${mood._id}/translate`, { as: admin, method: 'POST' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'no_provider');
    assert.equal(llmStub.calls.length + googleCalls.length, 0);
  });

  test("falls back to OpenAI on the admin's own key, and caches", async () => {
    await User.setOpenAIKey(admin._id, ADMIN_KEY);
    assert.deepEqual((await api('/api/admin/users/5001/moods', { as: admin })).body.translate, { available: true, provider: 'openai' });
    const r = await api(`/api/admin/moods/${mood._id}/translate`, { as: admin, method: 'POST' });
    assert.equal(r.status, 200);
    assert.deepEqual({ text: r.body.text, language: r.body.language, provider: r.body.provider, same: r.body.same }, { text: 'I am tired of everything', language: 'fa', provider: 'openai', same: false });
    assert.equal(llmStub.calls[0].apiKey, ADMIN_KEY);
    assert.equal(llmStub.calls[0].text, 'از همه چی خسته‌ام');
    assert.ok(!JSON.stringify(r.body).includes(ADMIN_KEY));
    const again = await api(`/api/admin/moods/${mood._id}/translate`, { as: admin, method: 'POST' });
    assert.equal(again.body.cached, true);
    assert.equal(llmStub.calls.length, 1);
  });

  test('the server OpenAI key wins over the admin key', async () => {
    process.env.OPENAI_API_KEY = 'sk-server-key-1234567890abcdefghij';
    await User.setOpenAIKey(admin._id, ADMIN_KEY);
    await api(`/api/admin/moods/${mood._id}/translate`, { as: admin, method: 'POST' });
    assert.equal(llmStub.calls[0].apiKey, 'sk-server-key-1234567890abcdefghij');
  });

  test('Google Translate is used when its key is set', async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = 'g-key';
    await User.setOpenAIKey(admin._id, ADMIN_KEY);
    assert.equal((await api('/api/admin/users/5001/moods', { as: admin })).body.translate.provider, 'google');
    const r = await api(`/api/admin/moods/${mood._id}/translate`, { as: admin, method: 'POST' });
    assert.deepEqual({ text: r.body.text, language: r.body.language, provider: r.body.provider }, { text: 'Tired of everything', language: 'fa', provider: 'google' });
    assert.match(googleCalls[0].url, /translation\.googleapis\.com\/language\/translate\/v2\?key=g-key/);
    assert.deepEqual(googleCalls[0].body, { q: 'از همه چی خسته‌ام', target: 'en', format: 'text' });
    assert.equal(llmStub.calls.length, 0);
  });

  test('English notes come back marked as already English', async () => {
    await User.setOpenAIKey(admin._id, ADMIN_KEY);
    llmStub.next = { english: 'long week', language: 'en' };
    const m = await Mood.create({ user: ali._id, mood: { code: 'tired', emoji: '😴', name: 'Tired' }, note: 'long week' });
    assert.equal((await api(`/api/admin/moods/${m._id}/translate`, { as: admin, method: 'POST' })).body.same, true);
  });

  test('errors: no note, unknown mood, rejected key, provider down', async () => {
    await User.setOpenAIKey(admin._id, ADMIN_KEY);
    assert.equal((await api(`/api/admin/moods/${noNote._id}/translate`, { as: admin, method: 'POST' })).body.error, 'empty');
    assert.equal((await api('/api/admin/moods/000000000000000000000000/translate', { as: admin, method: 'POST' })).status, 404);
    assert.equal((await api('/api/admin/moods/not-an-id/translate', { as: admin, method: 'POST' })).status, 404);
    llmStub.next = Object.assign(new Error('bad'), { status: 401 });
    assert.equal((await api(`/api/admin/moods/${mood._id}/translate`, { as: admin, method: 'POST' })).body.error, 'bad_key');
    process.env.GOOGLE_TRANSLATE_API_KEY = 'g-key';
    googleNext = { status: 500, body: { error: { message: 'down' } } };
    const down = await api(`/api/admin/moods/${mood._id}/translate`, { as: admin, method: 'POST' });
    assert.equal(down.status, 502);
    assert.equal(down.body.error, 'failed');
  });

  test('is admin only', async () => {
    await User.setOpenAIKey(ali._id, ADMIN_KEY);
    assert.equal((await api(`/api/admin/moods/${mood._id}/translate`, { as: ali, method: 'POST' })).status, 403);
    assert.equal(llmStub.calls.length, 0);
  });
});
