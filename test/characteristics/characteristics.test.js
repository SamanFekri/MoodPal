const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const UserMemory = require('../../src/models/user_memory');
const CharacteristicAnalysis = require('../../src/models/characteristic_analysis');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');
const characteristics = require('../../src/characteristics/service');

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

// what the model "answers": one good characteristic, plus things validation must drop
const MODEL_ANSWER = {
  insufficient_evidence: false,
  characteristics: [
    { key: 'independent', description: 'Likes to choose their own way.', confidence: 0.86, evidence: 'Notes often describe deciding things alone.', communication_recommendation: 'Offer options rather than instructions.', how_to_communicate: ['Offer choices', 'Avoid orders'], example: 'Which of these feels right for you?' },
    { key: 'talk_it_out', confidence: 0.3, evidence: 'Some long notes.' },                                   // too unsure
    { key: 'made_up_label', confidence: 0.9, evidence: 'Whatever.' },                                     // not in the catalog
    { key: 'deep_thinker', confidence: 0.7, evidence: '' },                                              // no evidence
    { key: 'soft_landing', confidence: 0.8, evidence: 'Shows signs of depression. Notes get short on bad days.', example: 'Want to talk about it first?' },
    { key: 'independent', confidence: 0.9, evidence: 'Duplicate.' },                                     // repeated
  ],
  guide: {
    overall_communication_style: 'Calm and direct works best.',
    what_works: ['Give them choices', 'Probably has ADHD, so keep it short'],
    what_to_avoid: ['Too many instructions'],
    best_approach: 'Be calm and direct. They might have an anxiety disorder. Offer two options.',
    example_phrases: ['Here are two ways, which one do you like?'],
  },
};

describe('admin characteristics analysis', () => {
  let server, base, admin, ana, calls;
  const api = (path, as, { method = 'GET' } = {}) => fetch(base + path, { method, headers: { 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) } }).then(async r => ({ status: r.status, body: await r.json() }));

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); characteristics._llm = null; });
  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    personalityService.clearCache();
    delete process.env.OPENAI_API_KEY;
    calls = [];
    characteristics._llm = {
      DEFAULT_MODEL: 'gpt-5.6',
      analyzeCharacteristics: async (catalog, data, apiKey, opts) => { calls.push({ catalog, data, apiKey, opts }); return JSON.parse(JSON.stringify(MODEL_ANSWER)); },
      isAuthError: (e) => e?.status === 401,
      isModelError: () => false,
    };
    admin = await User.create({ id: 9, first_name: 'Root', is_admin: true, openai_model: 'gpt-5-mini' });
    ana = await User.create({ id: 1, first_name: 'Ana', username: 'ana_s', timezone: 'Europe/Berlin' });
    await Mood.create({ user: ana._id, mood: { code: 'tired', emoji: '😴', name: 'Tired' }, note: 'Decided to skip the party and rest', timestamp: new Date(Date.now() - 3600000) });
    await Mood.create({ user: ana._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' }, timestamp: new Date(Date.now() - 7200000) });
    await UserMemory.create({ user: ana._id, text: 'Prefers to figure things out alone first', category: 'preferences', importance: 4 });
  });

  test('only admins can see or run it', async () => {
    assert.equal((await api('/api/admin/users/1/characteristics', ana)).status, 403);
    assert.equal((await api('/api/admin/users/1/calculate-characteristics', ana, { method: 'POST' })).status, 403);
    assert.equal(calls.length, 0);
  });

  test('without any OpenAI key it says so and never calls OpenAI', async () => {
    const view = await api('/api/admin/users/1/characteristics', admin);
    assert.equal(view.status, 200);
    assert.equal(view.body.can_calculate, false);
    assert.equal(view.body.latest, null);
    const r = await api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'no_key');
    assert.equal(calls.length, 0);
  });

  test('a run uses the admin\'s key and model, sends no identity, keeps only valid non-clinical results', async () => {
    await User.setOpenAIKey(admin._id, 'sk-admin-key-1234567890abcdefghij');
    const r = await api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    assert.equal(r.status, 201);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].apiKey, 'sk-admin-key-1234567890abcdefghij');
    assert.equal(calls[0].opts.model, 'gpt-5-mini');
    assert.equal(calls[0].catalog.length, 16);

    // the data: moods with notes, memories; never their name, username or ids
    const sent = JSON.stringify(calls[0].data);
    assert.match(sent, /Decided to skip the party/);
    assert.match(sent, /figure things out alone/);
    assert.doesNotMatch(sent, /Ana|ana_s|"id"/);
    assert.equal(calls[0].data.mood_checkins.length, 2);

    const a = r.body;
    assert.equal(a.status, 'ok');
    assert.equal(a.model, 'gpt-5-mini');
    assert.equal(a.key_source, 'admin');
    assert.deepEqual(a.characteristics.map(c => c.key), ['independent', 'soft_landing'], 'unknown, unsure, unsupported and repeated ones are dropped; sorted by confidence');
    assert.equal(a.characteristics[0].name, 'Independent');
    assert.equal(a.characteristics[0].confidence, 0.86);
    assert.deepEqual(a.characteristics[0].how_to_communicate, ['Offer choices', 'Avoid orders']);
    assert.equal(a.characteristics[1].evidence, 'Notes get short on bad days.', 'the clinical sentence is removed');
    assert.deepEqual(a.guide.what_works, ['Give them choices']);
    assert.equal(a.guide.best_approach, 'Be calm and direct. Offer two options.');
    assert.equal(a.data_used.moods, 2);
    assert.equal(a.data_used.notes, 1);
    assert.equal(a.data_used.memories, 1);

    const view = await api('/api/admin/users/1/characteristics', admin);
    assert.equal(view.body.latest.id, a.id);
    assert.equal(view.body.can_calculate, true);
  });

  test('recalculating keeps the earlier runs, each can be opened again', async () => {
    await User.setOpenAIKey(admin._id, 'sk-admin-key-1234567890abcdefghij');
    const first = await api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    characteristics._llm.analyzeCharacteristics = async () => ({ characteristics: [{ key: 'planner', confidence: 0.75, evidence: 'Plans the week in notes.' }], guide: { best_approach: 'Give structure.' } });
    const second = await api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    const view = await api('/api/admin/users/1/characteristics', admin);
    assert.deepEqual(view.body.history.map(h => h.id), [second.body.id, first.body.id]);
    assert.deepEqual(view.body.history[0].names, ['Planner']);
    const old = await api(`/api/admin/users/1/characteristics/${first.body.id}`, admin);
    assert.deepEqual(old.body.characteristics.map(c => c.key), ['independent', 'soft_landing']);
    assert.equal((await CharacteristicAnalysis.countDocuments({ user: ana._id })), 2);
  });

  test('the server key wins when set; a person with no data is "insufficient evidence" without calling OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'sk-server-key-1234567890abcdefghij';
    const empty = await User.create({ id: 5, first_name: 'New' });
    const r = await api('/api/admin/users/5/calculate-characteristics', admin, { method: 'POST' });
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'insufficient_evidence');
    assert.equal(r.body.key_source, 'server');
    assert.deepEqual(r.body.characteristics, []);
    assert.equal(calls.length, 0);

    characteristics._llm.analyzeCharacteristics = async (c, d, apiKey) => { calls.push(apiKey); return { insufficient_evidence: true, characteristics: [], guide: {} }; };
    const thin = await api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    assert.equal(thin.body.status, 'insufficient_evidence');
    assert.deepEqual(calls, ['sk-server-key-1234567890abcdefghij']);
    assert.ok(empty);
  });

  test('new moods never trigger an analysis, and two clicks at once run it only once', async () => {
    await User.setOpenAIKey(admin._id, 'sk-admin-key-1234567890abcdefghij');
    await Mood.create({ user: ana._id, mood: { code: 'sad', emoji: '😢', name: 'Sad' }, note: 'rough day' });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(calls.length, 0);

    let release;
    characteristics._llm.analyzeCharacteristics = () => new Promise(r => { release = () => r(MODEL_ANSWER); });
    const one = api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    await new Promise(r => setTimeout(r, 100));
    const two = await api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    assert.equal(two.status, 409);
    release();
    assert.equal((await one).status, 201);
  });

  test('OpenAI errors come back as a clear message and nothing is saved', async () => {
    await User.setOpenAIKey(admin._id, 'sk-admin-key-1234567890abcdefghij');
    characteristics._llm.analyzeCharacteristics = async () => { throw Object.assign(new Error('Incorrect API key'), { status: 401 }); };
    const r = await api('/api/admin/users/1/calculate-characteristics', admin, { method: 'POST' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'bad_key');
    assert.equal(await CharacteristicAnalysis.countDocuments(), 0);
  });
});
