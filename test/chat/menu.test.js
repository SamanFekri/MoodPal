const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const User = require('../../src/models/user');
const ChatSession = require('../../src/models/chat_session');
const { common } = require('../../src/constants');
const menuMiddleware = require('../../src/middlewares/menu.middleware');

function makeCtx(user, text = 'hello') {
  const ctx = { user, chat: { type: 'private', id: user.id }, message: { text }, sent: [], async reply(t, extra) { ctx.sent.push({ t, extra }); } };
  return ctx;
}

describe('keyboard menu refresh', () => {
  let alice;
  before(async () => { await db.connect(); });
  after(async () => { await db.disconnect(); });
  beforeEach(async () => { await db.clear(); alice = await User.create({ id: 4001, first_name: 'Alice' }); });

  test('a user with an outdated keyboard gets the current one on their next message, once', async () => {
    let ctx = makeCtx(alice); let nexts = 0;
    await menuMiddleware(ctx, async () => { nexts++; });
    assert.equal(nexts, 1);
    assert.equal(ctx.sent.length, 1);
    assert.match(ctx.sent[0].t, /menu has been updated/);
    const keys = ctx.sent[0].extra.reply_markup.keyboard.flat();
    assert.ok(keys.includes('💬 Talk') && keys.includes('🧠 Personality Test'));
    assert.ok(!keys.includes('🛑 End talk'), 'End talk only appears while talking');
    assert.equal((await User.findById(alice._id)).menu_signature, common.MENU_SIGNATURE);

    ctx = makeCtx(await User.findById(alice._id));
    await menuMiddleware(ctx, async () => {});
    assert.equal(ctx.sent.length, 0, 'not sent again');
  });

  test('during a Talk conversation the refreshed keyboard is the talk keyboard', async () => {
    await ChatSession.create({ user: alice._id });
    const ctx = makeCtx(alice);
    await menuMiddleware(ctx, async () => {});
    assert.deepEqual(ctx.sent[0].extra.reply_markup.keyboard, common.makeTalkKeyboard());
  });

  test('handlers that send the menu themselves mark it current, so no extra message follows', async () => {
    const ctx = makeCtx(alice);
    common.makeKeyboardMenu(ctx);              // what /start, mood saving etc. do
    await new Promise(r => setTimeout(r, 30));
    assert.equal((await User.findById(alice._id)).menu_signature, common.MENU_SIGNATURE);
    const next = makeCtx(await User.findById(alice._id));
    await menuMiddleware(next, async () => {});
    assert.equal(next.sent.length, 0);
  });

  test('ignores non-private chats and callback queries', async () => {
    const group = { ...makeCtx(alice), chat: { type: 'supergroup', id: -1 } };
    await menuMiddleware(group, async () => {});
    assert.equal(group.sent.length, 0);
    const cb = makeCtx(alice); delete cb.message;
    await menuMiddleware(cb, async () => {});
    assert.equal(cb.sent.length, 0);
  });
});
