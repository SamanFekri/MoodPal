const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const AppConfig = require('../../src/models/app_config');
const AiUsage = require('../../src/models/ai_usage');
const providers = require('../../src/ai/providers');
const ai = require('../../src/ai/access');
const llm = require('../../src/utils/llm');
const chatService = require('../../src/chat/service');
const aiController = require('../../src/controllers/ai');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');

const GEMINI_KEY = 'AIzaSy-test-gemini-key-1234567890';
const OWN_KEY = 'sk-own-openai-key-1234567890abcdefgh';

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

describe('AI providers', () => {
  test('a plain string is the user\'s own OpenAI key; Gemini goes through Google\'s OpenAI-compatible endpoint', () => {
    assert.equal(providers.clientFor(OWN_KEY).baseURL, 'https://api.openai.com/v1');
    assert.equal(providers.clientFor({ provider: 'gemini', apiKey: GEMINI_KEY }).baseURL, providers.PROVIDERS.gemini.baseURL);
    assert.equal(typeof providers.clientFor({ provider: 'claude', apiKey: 'sk-ant-x' }).chat.completions.create, 'function');
    assert.equal(providers.modelFor({ provider: 'gemini', model: 'gemini-3.8-flash' }, 'gpt-5.6'), 'gemini-3.8-flash', 'the shared key\'s model wins');
    assert.equal(providers.modelFor(OWN_KEY, 'gpt-5-mini'), 'gpt-5-mini');
    assert.equal(providers.DEFAULT_PROVIDER, 'gemini');
  });

  test('Claude: an OpenAI-shaped request goes through the Anthropic SDK and comes back in the same shape', async () => {
    const sent = [];
    class FakeAnthropic {
      constructor(opts) { this.opts = opts; const reply = (req) => { sent.push(req); return FakeAnthropic.next(req); }; this.messages = { create: async (req) => reply({ ...req, endpoint: 'messages' }) }; this.beta = { messages: { create: async (req) => reply({ ...req, endpoint: 'beta' }) } }; this.models = { list: async () => ({ data: [] }) }; }
    }
    FakeAnthropic.next = () => ({ stop_reason: 'end_turn', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '```json\n{"reply":"hi","risk":"none"}\n```' }] });
    const client = providers.claudeClient('sk-ant-test', { Anthropic: FakeAnthropic });
    const res = await client.chat.completions.create({
      model: 'claude-opus-5-5', temperature: 0.8, max_completion_tokens: 220, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Be kind.' }, { role: 'user', content: 'hello' }, { role: 'assistant', content: 'hey' }, { role: 'user', content: 'again' }],
    });
    assert.equal(res.choices[0].message.content, '{"reply":"hi","risk":"none"}', 'code fence stripped, thinking ignored');
    const req = sent[0];
    assert.equal(req.endpoint, 'beta', 'refusal fallbacks on for Opus 5.5');
    assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(req.fallbacks, 'default');
    assert.equal(req.temperature, undefined, 'no sampling params (current Claude models reject them)');
    assert.match(req.system, /^Be kind\.[\s\S]*only the JSON object/);
    assert.deepEqual(req.messages.map(m => m.role), ['user', 'assistant', 'user']);
    assert.ok(req.max_tokens >= 4000, 'room for thinking and the answer');
    assert.deepEqual(req.output_config, { effort: 'low' });

    FakeAnthropic.next = () => ({ stop_reason: 'refusal', model: 'claude-haiku-5-5', content: [] });
    const refused = await client.chat.completions.create({ model: 'claude-haiku-5-5', max_completion_tokens: 100, messages: [{ role: 'user', content: 'x' }] });
    assert.equal(refused.choices[0].message.content, '', 'a refusal reads as empty (callers fall back)');
    assert.equal(sent[1].endpoint, 'messages', 'Haiku has no server-side fallback');
  });

  describe('llm on the shared key', () => {
    afterEach(() => llm._setClientFactory(null));

    test('Gemini: its model, a light effort, room for thinking, and JSON parsed even inside a code fence', async () => {
      const seen = [];
      llm._setClientFactory((cred) => ({ chat: { completions: { create: async (params) => { seen.push({ cred, params }); return { choices: [{ message: { content: '```json\n{"reply":"hey there","risk":"none"}\n```' } }] }; } } } }));
      const cred = { provider: 'gemini', apiKey: GEMINI_KEY, model: 'gemini-3.8-flash' };
      const out = await llm.chatReply([{ role: 'user', content: 'hi' }], cred, { model: 'gpt-5.6' });
      assert.equal(out.reply, 'hey there');
      assert.equal(seen[0].cred, cred);
      assert.equal(seen[0].params.model, 'gemini-3.8-flash');
      assert.equal(seen[0].params.reasoning_effort, 'low');
      assert.ok(seen[0].params.max_tokens >= 2000);
    });

    test('a provider without JSON mode: the request is retried without response_format', async () => {
      const seen = [];
      llm._setClientFactory(() => ({ chat: { completions: { create: async (params) => {
        seen.push(params);
        if (params.response_format) throw Object.assign(new Error('Invalid value at response_format'), { status: 400, param: 'response_format' });
        return { choices: [{ message: { content: '{"reply":"ok","risk":"low"}' } }] };
      } } } }));
      const out = await llm.chatReply([{ role: 'user', content: 'hi' }], { provider: 'gemini', apiKey: GEMINI_KEY, model: 'gemini-3.8-flash' });
      assert.equal(out.reply, 'ok');
      assert.equal(seen.length, 2);
      assert.equal(seen[1].response_format, undefined);
    });
  });
});

describe('shared AI key: access and limits', () => {
  let alice, bob, boss, server, base;
  const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  before(async () => { await db.connect(); await AiUsage.init(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    alice = await User.create({ id: 6001, first_name: 'Alice', timezone: 'Asia/Tehran' });
    bob = await User.create({ id: 6002, first_name: 'Bob' });
    boss = await User.create({ id: 6009, first_name: 'Boss', is_admin: true });
    aiController.verify = async () => true;   // no test reaches a provider
  });

  const share = async (patch = {}) => {
    await AppConfig.get();
    await AppConfig.setAiKey(GEMINI_KEY);
    await AppConfig.updateOne({ key: 'main' }, { ai_provider: 'gemini', ...patch });
  };

  test('own key first (no limit), else the shared key, else nothing', async () => {
    assert.equal(await ai.forUser(alice), null, 'no shared key, no own key');
    await share();
    const shared = await ai.forUser(alice);
    assert.equal(shared.own, false);
    assert.deepEqual(shared.cred, { provider: 'gemini', apiKey: GEMINI_KEY, model: 'gemini-3.8-flash' });
    assert.equal(shared.providerName, 'Google Gemini');
    await User.setOpenAIKey(alice._id, OWN_KEY);
    const own = await ai.forUser(alice);
    assert.equal(own.own, true); assert.equal(own.cred, OWN_KEY);
    await AppConfig.updateOne({ key: 'main' }, { ai_enabled: false });
    assert.equal(await ai.forUser(bob), null, 'switched off: only own keys');
  });

  test('Talk messages per person per day, reset the next day; own keys never counted', async () => {
    await share({ ai_daily_talk_per_user: 2 });
    const access = await ai.forUser(alice);
    const now = new Date('2026-11-21T10:00:00Z');
    assert.equal((await ai.consume(alice, access, 'talk', { now })).left, 1);
    assert.equal((await ai.consume(alice, access, 'talk', { now })).left, 0);
    await assert.rejects(ai.consume(alice, access, 'talk', { now }), (e) => e instanceof ai.AiLimitError && e.code === 'user_limit' && e.limit === 2);
    // background learning and insights don't use her Talk messages
    await ai.consume(alice, access, 'background', { now });
    await ai.consume(alice, access, 'insight', { now });
    assert.equal((await ai.consume(bob, await ai.forUser(bob), 'talk', { now })).left, 1, 'Bob has his own allowance');
    const tomorrow = new Date('2026-11-22T10:00:00Z');
    assert.equal((await ai.consume(alice, access, 'talk', { now: tomorrow })).left, 1, 'a new day');
    await User.setOpenAIKey(bob._id, OWN_KEY);
    for (let i = 0; i < 5; i++) assert.equal((await ai.consume(bob, await ai.forUser(bob), 'talk', { now })).own, true);
    assert.equal(await AiUsage.countDocuments({ user: bob._id, day: '2026-11-21', talk: { $gt: 1 } }), 0);
  });

  test('the daily cap covers everyone together; admin tools are counted but never blocked', async () => {
    await share({ ai_daily_talk_per_user: 10, ai_daily_total: 3 });
    const now = new Date('2026-11-21T10:00:00Z');
    await ai.consume(alice, await ai.forUser(alice), 'talk', { now });
    await ai.consume(bob, await ai.forUser(bob), 'insight', { now });
    await ai.consume(alice, await ai.forUser(alice), 'background', { now });
    await assert.rejects(ai.consume(bob, await ai.forUser(bob), 'talk', { now }), (e) => e.code === 'daily_cap');
    await ai.consume(boss, { own: false }, 'admin', { now });
    const today = await AiUsage.findOne({ day: '2026-11-21', user: null });
    assert.equal(today.total, 4, '3 + the admin tool');
    assert.equal((await ai.talkToday(bob, { now })).used, 0, 'the refused message gave its place back');
  });

  test('Admin → AI: only admins; the key is checked, stored encrypted and never sent back', async () => {
    assert.equal((await api('/api/admin/ai', { as: alice })).status, 403);
    let r = await api('/api/admin/ai', { as: boss });
    assert.equal(r.status, 200);
    assert.equal(r.body.provider, 'gemini'); assert.equal(r.body.has_key, false);
    assert.deepEqual(r.body.providers.map(p => p.id), ['gemini', 'openai', 'claude']);

    let checked = null;
    aiController.verify = async (provider, key) => { checked = { provider, key }; };
    r = await api('/api/admin/ai/key', { as: boss, method: 'POST', body: { provider: 'gemini', key: GEMINI_KEY } });
    assert.equal(r.status, 200);
    assert.deepEqual(checked, { provider: 'gemini', key: GEMINI_KEY });
    assert.equal(r.body.has_key, true); assert.equal(r.body.key_hint, '…7890');
    assert.ok(!JSON.stringify(r.body).includes(GEMINI_KEY), 'the key never comes back');
    const stored = await AppConfig.findOne({ key: 'main' }).select('+ai_api_key').lean();
    assert.notEqual(stored.ai_api_key, GEMINI_KEY, 'encrypted at rest');

    aiController.verify = async () => { throw Object.assign(new Error('API key not valid'), { status: 400 }); };
    r = await api('/api/admin/ai/key', { as: boss, method: 'POST', body: { provider: 'claude', key: 'sk-ant-bad-key-1234567890abc' } });
    assert.equal(r.status, 400); assert.equal(r.body.error, 'key_rejected');
    assert.equal((await api('/api/admin/ai', { as: boss })).body.provider, 'gemini', 'a rejected key changes nothing');

    aiController.verify = async () => true;
    r = await api('/api/admin/ai/key', { as: boss, method: 'POST', body: { provider: 'claude', key: 'sk-ant-good-key-1234567890abc' } });
    assert.equal(r.body.provider, 'claude'); assert.equal(r.body.model, 'claude-opus-5-5', 'switching provider takes its default model');

    r = await api('/api/admin/ai/settings', { as: boss, method: 'POST', body: { model: 'claude-haiku-5-5', talk_per_user: 30, daily_total: 0 } });
    assert.equal(r.body.model, 'claude-haiku-5-5'); assert.equal(r.body.talk_per_user, 30); assert.equal(r.body.daily_total, 0);
    assert.equal((await api('/api/admin/ai/settings', { as: boss, method: 'POST', body: { talk_per_user: -1 } })).body.error, 'invalid_talk_per_user');
    assert.equal((await api('/api/admin/ai/key', { as: boss, method: 'DELETE' })).body.has_key, false);
  });

  test('Admin → AI → For me: an admin picks their own key to test; nobody else changes', async () => {
    await share();
    await User.setOpenAIKey(boss._id, OWN_KEY);
    let r = await api('/api/admin/ai', { as: boss });
    assert.equal(r.body.mine.choice, 'auto');
    assert.equal(r.body.mine.using.source, 'own', 'automatic: own key first, like everyone');

    r = await api('/api/admin/ai/mine', { as: boss, method: 'POST', body: { choice: 'shared' } });
    assert.equal(r.body.mine.using.source, 'shared');
    assert.equal((await ai.forUser(boss)).own, false, 'the shared key, with its limits');

    // a private Claude test key: checked, switched to, no limits, never sent back
    let checked = null;
    aiController.verify = async (provider, key) => { checked = { provider, key }; };
    const TEST_KEY = 'sk-ant-admin-test-key-1234567890';
    r = await api('/api/admin/ai/mine/key', { as: boss, method: 'POST', body: { provider: 'claude', key: TEST_KEY } });
    assert.equal(r.status, 200);
    assert.deepEqual(checked, { provider: 'claude', key: TEST_KEY });
    assert.equal(r.body.mine.choice, 'test');
    assert.deepEqual(r.body.mine.using, { source: 'test', provider: 'claude', provider_name: 'Anthropic Claude', model: 'claude-opus-5-5' });
    assert.equal(r.body.mine.test.key_hint, '…7890');
    assert.ok(!JSON.stringify(r.body).includes(TEST_KEY), 'the key never comes back');
    assert.equal(r.body.provider, 'gemini', 'the shared key is untouched');

    r = await api('/api/admin/ai/mine', { as: boss, method: 'POST', body: { model: 'claude-haiku-5-5' } });
    assert.equal(r.body.mine.using.model, 'claude-haiku-5-5');
    const access = await ai.forUser(boss);
    assert.equal(access.test, true);
    assert.equal(access.cred.apiKey, TEST_KEY);
    assert.equal(access.model, 'claude-haiku-5-5');
    assert.deepEqual(await ai.consume(boss, access, 'talk'), { own: true }, 'a test key is never counted');
    assert.equal(await chatService.allowBackground(boss._id, access.cred), true);
    assert.equal(await AiUsage.countDocuments({}), 0);

    // others still get the shared Gemini key; a non-admin's choice is ignored
    assert.equal((await ai.forUser(alice)).provider, 'gemini');
    await User.updateOne({ _id: alice._id }, { ai_choice: 'shared' });
    await User.setOpenAIKey(alice._id, OWN_KEY);
    assert.equal((await ai.forUser(alice)).own, true, 'only admins can pick');

    // removing the test key goes back to automatic
    r = await api('/api/admin/ai/mine/key', { as: boss, method: 'DELETE' });
    assert.equal(r.body.mine.choice, 'auto'); assert.equal(r.body.mine.test.has_key, false);
    assert.equal((await api('/api/admin/ai/mine', { as: boss, method: 'POST', body: { choice: 'nope' } })).body.error, 'invalid_choice');
    assert.equal((await api('/api/admin/ai/mine', { as: alice, method: 'POST', body: { choice: 'own' } })).status, 403);
  });

  describe('Talk on the shared key', () => {
    const stub = { calls: [] };
    before(async () => {
      stub.chatReply = async (history, apiKey, opts) => { stub.calls.push({ apiKey, opts }); return { reply: 'I hear that.', risk: 'none' }; };
      stub.extractMemories = async () => ({ operations: [] });
      stub.inferPersonalityUpdates = async () => ({ updates: [] });
      chatService._llm = stub;
      require('../../src/memory/service')._llm = stub;
      require('../../src/personality/service')._llm = stub;
    });
    beforeEach(async () => { stub.calls = []; await ensurePersonalityCatalog({ log: () => {} }); personalityService.clearCache(); });

    test('mini app: no own key still talks, on the shared key, until the daily limit', async () => {
      assert.equal((await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'hi' } })).body.error, 'no_key');
      await share({ ai_daily_talk_per_user: 2 });
      const t = await api('/api/me/talk', { as: alice });
      assert.equal(t.body.has_key, true); assert.equal(t.body.own_key, false);
      assert.equal(t.body.provider, 'Google Gemini');
      assert.deepEqual(t.body.today, { used: 0, limit: 2, left: 2 });

      let r = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'rough day' } });
      assert.equal(r.status, 200);
      assert.deepEqual(stub.calls[0].apiKey, { provider: 'gemini', apiKey: GEMINI_KEY, model: 'gemini-3.8-flash' });
      assert.equal(stub.calls[0].opts.model, 'gemini-3.8-flash');
      assert.equal(r.body.today.left, 1);
      await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'still here' } });
      r = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'one more' } });
      assert.equal(r.status, 429); assert.equal(r.body.error, 'user_limit'); assert.equal(r.body.limit, 2);
      assert.equal(stub.calls.length, 2, 'the third message never reached the AI');

      // her own key: unlimited, and used instead of the shared one
      await User.setOpenAIKey(alice._id, OWN_KEY);
      r = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'with my key' } });
      assert.equal(r.status, 200); assert.equal(stub.calls.at(-1).apiKey, OWN_KEY); assert.equal(r.body.today, null);
    });

    test('bot: the intro says it\'s the free AI and what\'s left; at the limit a friendly stop in their language', async () => {
      await share({ ai_daily_talk_per_user: 1 });
      await User.updateOne({ _id: alice._id }, { language: 'fa' });
      const me = await User.findById(alice._id);
      const sent = [];
      const ctx = { user: me, chat: { type: 'private', id: me.id }, message: { text: '💬 گفت‌وگو' }, reply: async (t, extra) => sent.push({ t, extra }), sendChatAction: async () => {} };
      const talk = require('../../src/commands/talk');
      await talk.talkCommand(ctx);
      assert.match(sent[0].t, /Google Gemini/); assert.match(sent[0].t, /1 از 1/);
      sent.length = 0;
      ctx.message = { text: 'سلام' };
      assert.equal(await talk.handleTalkMessage(ctx), true);
      assert.equal(sent[0].t, 'I hear that.');
      ctx.message = { text: 'باز هم' };
      await talk.handleTalkMessage(ctx);
      assert.equal(sent[1].t, require('../../src/i18n').forLang('fa').talkLimitMsg(1));
      assert.equal(stub.calls.length, 1);
    });

    test('settings tell people which AI they\'re on', async () => {
      assert.equal((await api('/api/me/settings', { as: bob })).body.ai.source, 'none');
      await share();
      const s = (await api('/api/me/settings', { as: bob })).body.ai;
      assert.equal(s.source, 'shared'); assert.equal(s.provider, 'Google Gemini'); assert.equal(s.today.limit, 20);
      await User.setOpenAIKey(bob._id, OWN_KEY);
      assert.equal((await api('/api/me/settings', { as: bob })).body.ai.source, 'own');
    });
  });
});
