const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cryptoJs = require('crypto-js');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const { app } = require('../../src/server');
const User = require('../../src/models/user');
const Share = require('../../src/models/share');
const Mood = require('../../src/models/mood');
const ChatSession = require('../../src/models/chat_session');
const MBTI = require('../../src/public/ui/mbti');
const { ensurePersonalityCatalog } = require('../../src/personality/migrate');
const personalityService = require('../../src/personality/service');
const chatService = require('../../src/chat/service');
const memory = require('../../src/memory/service');

const stub = {
  inferPersonalityUpdates: async () => ({ updates: [{ trait: 'humor_preference', change: 0.15, confidence: 0.9, evidence: 'I laugh at everything, honestly' }] }),
  extractMemories: async () => ({ operations: [{ op: 'add', text: 'Loves stand-up comedy', importance: 3 }] }),
};
personalityService._llm = stub;
memory._llm = stub;

function signInitData(tgUser) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000) - 5), query_id: 'q', user: JSON.stringify(tgUser) };
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('\n');
  const secret = cryptoJs.HmacSHA256(process.env.BOT_TOKEN, 'WebAppData');
  const p = new URLSearchParams(params); p.set('hash', cryptoJs.HmacSHA256(str, secret).toString(cryptoJs.enc.Hex));
  return p.toString();
}
async function takeMbti(user, type) {
  const { questions } = await personalityService.getTest('mbti');
  const { session } = await personalityService.startTest(user._id, 'mbti');
  for (const q of questions) {
    const i = MBTI.DIMENSIONS.findIndex(d => d.key === q.trait);
    const right = type[i] === MBTI.DIMENSIONS[i].right.letter;
    await personalityService.answerQuestion(user._id, session._id, q.order, right !== q.reverse ? 5 : 1);
  }
}

describe('personality from talks, and the admin MBTI filter', () => {
  let server, base, admin, ana, ben, cy;
  const api = (path, as) => fetch(base + path, { headers: { 'X-Telegram-Init-Data': signInitData({ id: as.id, first_name: as.first_name }) } }).then(async r => ({ status: r.status, body: await r.json() }));
  before(async () => { await db.connect(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
  after(async () => { server.close(); await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    await ensurePersonalityCatalog({ log: () => {} });
    personalityService.clearCache();
    admin = await User.create({ id: 9, first_name: 'Root', is_admin: true });
    ana = await User.create({ id: 1, first_name: 'Ana' });
    ben = await User.create({ id: 2, first_name: 'Ben' });
    cy = await User.create({ id: 3, first_name: 'Cy' });
  });

  test('admin can filter people by their MBTI type, and sees each type on the list', async () => {
    await takeMbti(ana, 'ENFP');
    await takeMbti(ben, 'ISFJ');
    let r = await api('/api/admin/users?mbti=ENFP', admin);
    assert.deepEqual(r.body.users.map(u => [u.id, u.mbti]), [[1, 'ENFP']]);
    assert.equal(r.body.filter.mbti, 'ENFP');
    r = await api('/api/admin/users?mbti=isfj', admin);
    assert.deepEqual(r.body.users.map(u => u.id), [2], 'case does not matter');
    r = await api('/api/admin/users?mbti=any', admin);
    assert.deepEqual(r.body.users.map(u => u.id).sort(), [1, 2], 'everyone who took the test');
    r = await api('/api/admin/users', admin);
    assert.equal(r.body.users.find(u => u.id === 3).mbti, null);
    assert.equal(r.body.users.find(u => u.id === 1).mbti, 'ENFP');
    assert.equal((await api('/api/admin/users?mbti=XXXX', admin)).body.users.length, 4, 'an unknown type is ignored');
    assert.equal((await api('/api/admin/users?mbti=ENFP', ana)).status, 403);
  });

  test('traits learned from talks show with their percentage and how much talking moved them', async () => {
    await personalityService.inferFromText(ana._id, 'some long chat text '.repeat(5), 'sk-test');
    await personalityService.inferFromText(ana._id, 'another long chat text '.repeat(5), 'sk-test');
    const mine = await api('/api/me/personality', ana);
    const t = mine.body.profile.from_talks.find(x => x.key === 'humor_preference');
    assert.ok(t, 'humor appears under "Learned from your talks"');
    assert.equal(t.talks, 2);
    assert.ok(t.change > 0, 'moved up');
    assert.ok(t.value > 0.5 && t.value <= 1, `current value ${t.value}`);
    assert.equal(t.evidence, 'I laugh at everything, honestly', 'you see why');

    // friends with a shared personality see the trait but not the quote from the private chat
    await User.updateOne({ _id: ana._id }, { is_personality_shared: true });
    await Share.createShare(ben._id, ana._id);
    const friendView = await api('/api/friends/1/personality', ben);
    const ft = friendView.body.profile.from_talks.find(x => x.key === 'humor_preference');
    assert.ok(ft);
    assert.equal(ft.evidence, undefined, 'no quotes for anyone else');
    assert.equal((await api('/api/admin/users/1/personality', admin)).body.profile.from_talks[0].evidence, undefined);
  });

  test('a talk that ends by going quiet also updates personality and memory', async () => {
    await User.setOpenAIKey(ana._id, 'sk-test-key-1234567890abcdefghij');
    await Mood.create({ user: ana._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' } });
    const old = new Date(Date.now() - 5 * 3600 * 1000);
    await ChatSession.create({ user: ana._id, last_message_at: old, messages: [
      { role: 'user', content: 'I went to a comedy show last night and laughed the whole time, it was the best' },
      { role: 'assistant', content: 'That sounds like a great night.' },
    ] });
    assert.equal(await chatService.getActive(ana._id), null, 'the quiet talk is closed');
    await chatService.endJob;
    const view = await personalityService.getProfileView(ana._id);
    assert.ok(view.from_talks.some(x => x.key === 'humor_preference'), 'personality learned from it');
    assert.deepEqual((await memory.list(ana._id)).map(m => m.text), ['Loves stand-up comedy'], 'and memory too');
  });
});
