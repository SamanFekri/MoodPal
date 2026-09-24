const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';
process.env.KEY_ENCRYPTION_SECRET = process.env.KEY_ENCRYPTION_SECRET || 'test-secret';

const db = require('../helpers/db');
const User = require('../../src/models/user');
const Mood = require('../../src/models/mood');
const AppConfig = require('../../src/models/app_config');
const { common } = require('../../src/constants');
const { backupNowCommand } = require('../../src/commands/backup');
const backupService = require('../../src/backup/service');

function makeCtx(user) {
  const ctx = {
    user, chat: { id: user.id }, message: { text: '💾 Backup now' },
    sent: [], edited: [],
    async reply(text, extra) { ctx.sent.push({ text, extra }); return { message_id: ctx.sent.length }; },
    telegram: { async editMessageText(chatId, id, _x, text) { ctx.edited.push(text); return true; } },
  };
  return ctx;
}

describe('backup from the bot', () => {
  let admin, alice, realRun;

  before(async () => { await db.connect(); realRun = backupService.runBackup; });
  after(async () => { backupService.runBackup = realRun; await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    backupService.runBackup = realRun;
    admin = await User.create({ id: 501, first_name: 'Root', is_admin: true });
    alice = await User.create({ id: 502, first_name: 'Alice' });
    await Mood.create({ user: alice._id, mood: { code: 'happy', emoji: '😊', name: 'Happy' }, note: 'hi' });
  });

  test('the keyboard button is admin-only', () => {
    assert.ok(common.makeKeyboardMenu({ user: { is_admin: true } }).flat().includes('💾 Backup now'));
    assert.ok(!common.makeKeyboardMenu({ user: {} }).flat().includes('💾 Backup now'));
    assert.ok(!common.makeKeyboardMenu({ user: { is_admin: false } }).flat().includes('💾 Backup now'));
  });

  test('a non-admin gets a polite refusal and no backup runs', async () => {
    let ran = false;
    backupService.runBackup = async () => { ran = true; return {}; };
    const ctx = makeCtx(alice);
    await backupNowCommand(ctx);
    assert.match(ctx.sent[0].text, /admins only/);
    assert.equal(ran, false);
  });

  test('an admin gets progress then the result, with real counts', async () => {
    await AppConfig.setToken('gyb_test_token');
    const uploads = [];
    const client = {
      uploadBackup: async (buffer, filename) => { uploads.push({ filename, bytes: buffer.length }); return { id: 'bk_1', status: 'RECEIVED' }; },
    };
    backupService.runBackup = (opts = {}) => realRun({ ...opts, client });

    const ctx = makeCtx(admin);
    await backupNowCommand(ctx);
    assert.match(ctx.sent[0].text, /Building the backup/);
    assert.equal(uploads.length, 1);
    assert.match(ctx.edited.at(-1), /Backup sent/);
    assert.match(ctx.edited.at(-1), /3 documents/);     // 2 users + 1 mood
    assert.equal((await AppConfig.get()).last_backup_status, 'success');
  });

  test('a failure is reported to the admin instead of failing silently', async () => {
    const ctx = makeCtx(admin);
    await backupNowCommand(ctx);                         // no token configured
    assert.match(ctx.edited.at(-1), /Backup failed: No GotYouBro token/);
  });

  test('a partly-sent backup says so', async () => {
    await AppConfig.setToken('gyb_test_token');
    let attempt = 0;
    const client = { uploadBackup: async () => { attempt += 1; if (attempt === 2) throw new Error('Telegram rejected the upload'); return { id: 'bk', status: 'RECEIVED' }; } };
    backupService.runBackup = (opts = {}) => realRun({ ...opts, client, targetUncompressed: 300 });

    const ctx = makeCtx(admin);
    await backupNowCommand(ctx);
    assert.match(ctx.edited.at(-1), /partly sent/);
    assert.equal((await AppConfig.get()).last_backup_status, 'partial');
  });
});
