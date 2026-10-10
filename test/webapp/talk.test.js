const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const ChatSession = require('../../src/models/chat_session');
const chatService = require('../../src/chat/service');
const talk = require('../../src/commands/talk');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');

// ---- LLM stub: no test ever reaches OpenAI ----
const llmStub = { calls: [], next: null };
llmStub.chatReply = async (history, apiKey, opts) => { llmStub.calls.push({ history, apiKey, opts }); if (llmStub.next instanceof Error) throw llmStub.next; return llmStub.next; };
llmStub.inferPersonalityUpdates = async () => ({ updates: [] });
llmStub.extractMemories = async () => ({ operations: [] });
chatService._llm = llmStub;
require('../../src/memory/service')._llm = llmStub;
require('../../src/personality/service')._llm = llmStub;

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

let server, base;
const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
  method,
  headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const KEY = 'sk-user-key-1234567890abcdefghij';

describe('Talk in the mini app', () => {
  let alice;

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
    llmStub.calls = [];
    llmStub.next = { reply: 'That sounds heavy. What happened today?', risk: 'none' };
    alice = await User.create({ id: 4001, first_name: 'Alice' });
  });

  test('without a key: says so and never calls OpenAI', async () => {
    const r = await api('/api/me/talk', { as: alice });
    assert.equal(r.status, 200);
    assert.equal(r.body.has_key, false);
    assert.equal(r.body.active, false);
    assert.deepEqual(r.body.messages, []);
    assert.equal((await api('/api/me/talk/start', { as: alice, method: 'POST' })).status, 409);
    const send = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'hi' } });
    assert.equal(send.status, 409);
    assert.equal(send.body.error, 'no_key');
    assert.equal(llmStub.calls.length, 0);
    assert.equal(await ChatSession.countDocuments(), 0);
  });

  describe('with a key', () => {
    beforeEach(async () => { await User.setOpenAIKey(alice._id, KEY); });

    test('a message starts a conversation, gets a reply on the user\'s key and model, and is kept', async () => {
      await User.updateOne({ _id: alice._id }, { openai_model: 'gpt-5-mini' });
      const r = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: '  Rough day. Can we talk?  ' } });
      assert.equal(r.status, 200);
      assert.equal(r.body.active, true);
      assert.equal(r.body.model, 'gpt-5-mini');
      assert.deepEqual(r.body.messages.map(m => [m.role, m.content]), [['user', 'Rough day. Can we talk?'], ['assistant', 'That sounds heavy. What happened today?']]);
      assert.equal(r.body.safety, false);
      assert.equal(llmStub.calls[0].apiKey, KEY);
      assert.equal(llmStub.calls[0].opts.model, 'gpt-5-mini');
      assert.equal(llmStub.calls[0].opts.firstName, 'Alice');
      const session = await ChatSession.findOne({ user: alice._id });
      assert.equal(session.opened_from, 'app');
      // and it comes back when the tab is opened again
      const again = await api('/api/me/talk', { as: alice });
      assert.equal(again.body.messages.length, 2);
    });

    test('it is the same conversation as the bot: a talk started in the app answers bot messages too', async () => {
      await api('/api/me/talk/start', { as: alice, method: 'POST' });
      const ctx = { user: await User.findById(alice._id), message: { text: 'still here' }, sent: [], async reply(t) { ctx.sent.push(t); }, async sendChatAction() {} };
      assert.equal(await talk.handleTalkMessage(ctx), true);
      const r = await api('/api/me/talk', { as: alice });
      assert.deepEqual(r.body.messages.map(m => m.content), ['still here', 'That sounds heavy. What happened today?']);
      // start keeps the conversation that is already going
      const started = await api('/api/me/talk/start', { as: alice, method: 'POST' });
      assert.equal(started.body.messages.length, 2);
      assert.equal(await ChatSession.countDocuments({ user: alice._id }), 1);
    });

    test('a risky reply is flagged so the app shows the crisis note', async () => {
      llmStub.next = { reply: "I'm really glad you told me.", risk: 'high' };
      const r = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'I feel hopeless' } });
      assert.equal(r.body.safety, true);
      assert.equal(r.body.messages.at(-1).risk, 'high');
    });

    test('rejects empty and too long messages', async () => {
      assert.equal((await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: '   ' } })).body.error, 'empty');
      assert.equal((await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'x'.repeat(2001) } })).body.error, 'too_long');
      assert.equal(llmStub.calls.length, 0);
    });

    test('a rejected key ends the conversation and saves nothing', async () => {
      llmStub.next = Object.assign(new Error('bad key'), { status: 401 });
      const r = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'hello' } });
      assert.equal(r.status, 409);
      assert.equal(r.body.error, 'key_rejected');
      assert.equal(await chatService.getActive(alice._id), null);
      const s = await ChatSession.findOne({ user: alice._id });
      assert.equal(s.messages.length, 0);
    });

    test('a failed reply keeps the conversation and saves nothing, so the message can be sent again', async () => {
      llmStub.next = new Error('network down');
      const r = await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'hello' } });
      assert.equal(r.status, 502);
      const view = await api('/api/me/talk', { as: alice });
      assert.equal(view.body.active, true);
      assert.deepEqual(view.body.messages, []);
    });

    test('end closes the conversation', async () => {
      await api('/api/me/talk/message', { as: alice, method: 'POST', body: { text: 'hello' } });
      const r = await api('/api/me/talk/end', { as: alice, method: 'POST' });
      assert.equal(r.body.ended, true);
      assert.equal(r.body.active, false);
      assert.equal(await chatService.getActive(alice._id), null);
      assert.equal((await api('/api/me/talk/end', { as: alice, method: 'POST' })).body.ended, false);
    });
  });

  describe('admin: who has an OpenAI key', () => {
    let admin, bob;
    beforeEach(async () => {
      admin = await User.create({ id: 4009, first_name: 'Root', is_admin: true });
      bob = await User.create({ id: 4002, first_name: 'Bob' });
      await User.setOpenAIKey(bob._id, KEY);
    });

    test('filters by key and marks rows, never sending the key itself', async () => {
      const withKey = await api('/api/admin/users?key=with', { as: admin });
      assert.deepEqual(withKey.body.users.map(u => u.id), [4002]);
      assert.equal(withKey.body.users[0].has_openai_key, true);
      assert.equal(withKey.body.filter.key, 'with');
      assert.ok(!JSON.stringify(withKey.body).includes(KEY));
      assert.ok(!('openai_api_key' in withKey.body.users[0]));

      const without = await api('/api/admin/users?key=without&sort=name', { as: admin });
      assert.deepEqual(without.body.users.map(u => u.id).sort(), [4001, 4009]);
      assert.ok(without.body.users.every(u => u.has_openai_key === false));

      // a removed key counts as no key
      await User.setOpenAIKey(bob._id, null);
      assert.equal((await api('/api/admin/users?key=with&count=1', { as: admin })).body.total_users, 0);
      // anything else is ignored
      assert.equal((await api('/api/admin/users?key=maybe', { as: admin })).body.filter.key, null);
    });

    test('is admin only', async () => {
      assert.equal((await api('/api/admin/users?key=with', { as: bob })).status, 403);
    });
  });
});
