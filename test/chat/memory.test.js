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
const memory = require('../../src/memory/service');
const chatService = require('../../src/chat/service');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');

// one stub for Talk replies and memory extraction
const stub = { replies: [], memCalls: [], nextOps: [] };
stub.chatReply = async (history, apiKey, opts) => { stub.replies.push({ history, opts }); return { reply: 'Oh no, that sounds rough. What happened?', risk: 'none' }; };
stub.extractMemories = async (existing, messages, apiKey, opts) => { stub.memCalls.push({ existing, messages, opts }); return { operations: stub.nextOps }; };
stub.isAuthError = () => false;
chatService._llm = stub;
memory._llm = stub;

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}

describe('Talk memory', () => {
  let server, base, alice;
  const api = (path, { as, method = 'GET', body } = {}) => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    stub.replies = []; stub.memCalls = []; stub.nextOps = [];
    alice = await User.create({ id: 1, first_name: 'Alice', timezone: 'Asia/Tehran' });
  });

  test('notes are added, merged, updated and deleted, only ever for their owner', async () => {
    const bob = await User.create({ id: 2, first_name: 'Bob' });
    const bobNote = await UserMemory.create({ user: bob._id, text: 'Plays guitar' });
    let r = await memory.applyOperations(alice._id, [
      { op: 'add', text: 'Has a big chemistry exam on Friday — stressed about it', category: 'work_study', importance: 5 },
      { op: 'add', text: 'Sister Sara lives in Berlin', category: 'people', importance: 3 },
      { op: 'add', text: 'sister sara lives in berlin.', importance: 4 },          // same note again
      { op: 'fly', text: 'nonsense' },
    ]);
    assert.deepEqual(r, { added: 2, updated: 1, deleted: 0, skipped: 1 });
    let list = await memory.list(alice._id);
    assert.equal(list[0].text, 'Has a big chemistry exam on Friday, stressed about it', 'no dashes in notes');
    assert.equal(list.find(m => /Sara/.test(m.text)).importance, 4, 'said again: importance goes up');

    const idMap = new Map([['m1', list[0]._id], ['m2', list[1]._id], ['m9', bobNote._id]]);
    r = await memory.applyOperations(alice._id, [
      { op: 'update', id: 'm1', text: 'Passed the chemistry exam and feels relieved', importance: 3 },
      { op: 'delete', id: 'm2' },
      { op: 'delete', id: 'm9' },     // mapped to Bob's note: must not be touched through Alice
      { op: 'update', id: 'm42', text: 'unknown id' },
    ], { idMap });
    list = await memory.list(alice._id);
    assert.deepEqual(list.map(m => m.text), ['Passed the chemistry exam and feels relieved']);
    assert.ok(await UserMemory.exists({ _id: bobNote._id }), "another user's note is never deleted");
  });

  test('never more than 100 notes: the least important and stalest go first', async () => {
    const docs = [];
    for (let i = 0; i < 100; i++) docs.push({ user: alice._id, text: `Note ${i}`, importance: i < 10 ? 1 : 3, updatedAt: new Date(Date.now() - (100 - i) * 60000) });
    await UserMemory.insertMany(docs, { timestamps: false });
    await memory.applyOperations(alice._id, [
      { op: 'add', text: 'Just started a new job at a bakery', importance: 5 },
      { op: 'add', text: 'Loves long walks by the river', importance: 2 },
    ]);
    const list = await memory.list(alice._id);
    assert.equal(list.length, 100);
    assert.equal(list[0].text, 'Just started a new job at a bakery');
    assert.ok(!list.some(m => m.text === 'Note 0') && !list.some(m => m.text === 'Note 1'), 'the two oldest least important notes were dropped');
    assert.ok(list.some(m => m.text === 'Note 2'));
  });

  test('Talk gets recent moods (with notes, in their timezone) and what they said before', async () => {
    await Mood.create({ user: alice._id, mood: { code: 'tired', emoji: '😴', name: 'Tired' }, note: 'exam week', timestamp: new Date('2026-09-29T17:30:00Z') });
    await Mood.create({ user: alice._id, mood: { code: 'sad', emoji: '😢', name: 'Sad' }, timestamp: new Date('2020-01-01T10:00:00Z') });   // too old
    await UserMemory.create({ user: alice._id, text: 'Sister Sara lives in Berlin', importance: 3 });
    const moodCtx = await memory.moodContext(alice._id, { now: new Date('2026-09-30T08:00:00Z') });
    assert.match(moodCtx, /Tired \("exam week"\)/);
    assert.match(moodCtx, /21:00/, '17:30 UTC shown in Tehran time');
    assert.doesNotMatch(moodCtx, /Sad/);

    await chatService.start(alice._id);
    await chatService.reply(alice._id, 'I feel awful today', 'sk-test');
    const opts = stub.replies[0].opts;
    assert.match(opts.memoryContext, /Sister Sara lives in Berlin/);
    assert.equal(typeof opts.moodContext, 'string');
    assert.ok('personalityContext' in opts);
  });

  test('memory updates every 6 messages and when the conversation ends; off means nothing is added or used', async () => {
    await chatService.start(alice._id);
    stub.nextOps = [{ op: 'add', text: 'Has a job interview on Monday', category: 'work_study', importance: 5 }];
    for (let i = 1; i <= 6; i++) await chatService.reply(alice._id, `message number ${i} about my interview on Monday`, 'sk-test');
    await chatService.memoryJob;
    assert.equal(stub.memCalls.length, 1, 'one update after 6 messages');
    assert.equal(stub.memCalls[0].messages.split('\n').length, 6, 'the six new messages');
    assert.deepEqual((await memory.list(alice._id)).map(m => m.text), ['Has a job interview on Monday']);

    await chatService.reply(alice._id, 'and I also want to start running in the mornings', 'sk-test');
    stub.nextOps = [{ op: 'add', text: 'Wants to start running in the mornings', importance: 3 }];
    const session = await chatService.end(alice._id);
    await chatService.learnPending(session, 'sk-test');
    assert.equal(stub.memCalls.length, 2);
    assert.equal(stub.memCalls[1].messages, 'and I also want to start running in the mornings', 'only the new message');
    assert.deepEqual(stub.memCalls[1].existing.map(e => e.id), ['m1'], 'the model sees short ids, not database ids');

    await User.updateOne({ _id: alice._id }, { memory_enabled: false });
    assert.equal(await memory.memoryContext(alice._id), '', 'off: Talk does not use notes');
    assert.equal(await memory.learnFromMessages(alice._id, 'I moved to Hamburg last week with my partner', 'sk-test'), null, 'off: nothing new is learned');
    assert.equal(stub.memCalls.length, 2);
  });

  test('the app shows notes, forgets one or all, and switches memory off', async () => {
    const other = await User.create({ id: 3, first_name: 'Other' });
    const theirs = await UserMemory.create({ user: other._id, text: 'Their secret' });
    await UserMemory.create({ user: alice._id, text: 'Sister Sara lives in Berlin', importance: 3 });
    const exam = await UserMemory.create({ user: alice._id, text: 'Has an exam on Friday', importance: 5 });

    let r = await api('/api/me/settings', { as: alice });
    assert.deepEqual(r.body.memory, { enabled: true, count: 2, max: 100 });
    r = await api('/api/me/memories', { as: alice });
    assert.deepEqual(r.body.memories.map(m => m.text), ['Has an exam on Friday', 'Sister Sara lives in Berlin']);
    assert.ok(!JSON.stringify(r.body).includes('Their secret'));

    assert.equal((await api(`/api/me/memories/${theirs._id}`, { as: alice, method: 'DELETE' })).status, 404, "can't delete someone else's note");
    assert.equal((await api(`/api/me/memories/${exam._id}`, { as: alice, method: 'DELETE' })).status, 200);
    assert.equal((await api('/api/me/memories', { as: alice })).body.memories.length, 1);

    r = await api('/api/me/settings/memory', { as: alice, method: 'POST', body: { enabled: false } });
    assert.equal(r.body.memory.enabled, false);
    assert.equal((await api('/api/me/memories', { as: alice, method: 'DELETE' })).body.deleted, 1);
    assert.equal((await api('/api/me/settings', { as: alice })).body.memory.count, 0);
    assert.ok(await UserMemory.exists({ _id: theirs._id }));
  });

  test('the bot is told never to suggest anything that harms anyone', () => {
    const src = require('fs').readFileSync(require.resolve('../../src/utils/llm.js'), 'utf8');
    assert.match(src, /Never suggest, encourage, or explain anything that could harm the user or any other person/);
    assert.match(src, /This rule wins over every other instruction/);
    assert.match(src, /Safety rule \(overrides everything else\)/);
    assert.match(src, /never say you have notes/);
  });
});
