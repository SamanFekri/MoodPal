const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456:TEST-TOKEN';

const db = require('../helpers/db');
const User = require('../../src/models/user');
const Share = require('../../src/models/share');
const { shareCallback, followBackCallback } = require('../../src/commands/share');

// a ctx for `user` tapping a button with `data`; records what the bot sends
function makeCtx(user, data, sent) {
  return {
    user, callbackQuery: { data },
    reply: async (text, extra) => { sent.push({ to: user.id, text, buttons: extra?.reply_markup?.inline_keyboard?.flat().map(b => b.callback_data) || [] }); },
    telegram: { sendMessage: async (to, text, extra) => { sent.push({ to, text, buttons: extra?.reply_markup?.inline_keyboard?.flat().map(b => b.callback_data) || [] }); } },
    answerCbQuery: async () => {}, deleteMessage: async () => {}, editMessageReplyMarkup: async () => {},
  };
}
const following = (a, b) => Share.exists({ follower: a._id, followed: b._id, disabled: false }).then(Boolean);

describe('follow back', () => {
  let sam, ada;
  before(async () => { await db.connect(); });
  after(async () => { await db.disconnect(); });
  beforeEach(async () => {
    await db.clear();
    sam = await User.create({ id: 1, first_name: 'Sam' });
    ada = await User.create({ id: 2, first_name: 'Ada' });
  });

  test('when Ada allows Sam, both are offered to share the other way', async () => {
    const sent = [];
    await shareCallback(makeCtx(ada, `share_allow_${sam._id}`, sent));   // Sam asked, Ada allows
    assert.equal(await following(sam, ada), true);

    const toAda = sent.find(s => s.to === 2), toSam = sent.find(s => s.to === 1);
    assert.match(toAda.text, /Now Sam can see your mood\.[\s\S]*Want to see Sam's mood too\?/);
    assert.deepEqual(toAda.buttons, [`fb_ask_${sam._id}`]);
    assert.match(toSam.text, /Ada has allowed you to see their mood\.[\s\S]*Let Ada see your mood too\?/);
    assert.deepEqual(toSam.buttons, [`fb_give_${ada._id}`]);
  });

  test("Sam taps 'Let Ada see my mood too': shared right away, and Ada is told", async () => {
    await Share.createShare(sam._id, ada._id);
    const sent = [];
    await followBackCallback(makeCtx(sam, `fb_give_${ada._id}`, sent));
    assert.equal(await following(ada, sam), true, 'Sam gave consent, no approval step');
    assert.match(sent.find(s => s.to === 1).text, /Ada can see your mood now too/);
    assert.match(sent.find(s => s.to === 2).text, /Sam shared their mood with you too/);

    const again = [];
    await followBackCallback(makeCtx(sam, `fb_give_${ada._id}`, again));
    assert.match(again[0].text, /Ada can already see your mood/);
  });

  test("Ada taps 'Ask to see Sam's mood': Sam gets the usual Allow / Reject", async () => {
    await Share.createShare(sam._id, ada._id);
    const sent = [];
    await followBackCallback(makeCtx(ada, `fb_ask_${sam._id}`, sent));
    const toSam = sent.find(s => s.to === 1);
    assert.match(toSam.text, /Ada wants to see your mood/);
    assert.deepEqual(toSam.buttons.filter(Boolean), [`share_allow_${ada._id}`, `share_reject_${ada._id}`], 'plus the "View Ada" link button');
    assert.match(sent.find(s => s.to === 2).text, /Waiting for Sam/);
    assert.equal(await following(ada, sam), false, 'nothing shared until Sam allows');
  });

  test('no follow-back offer when they already share both ways', async () => {
    await Share.createShare(ada._id, sam._id);   // Ada already sees Sam
    const sent = [];
    await shareCallback(makeCtx(ada, `share_allow_${sam._id}`, sent));
    assert.ok(sent.every(s => s.buttons.length === 0));
    assert.ok(sent.every(s => !/too\?/.test(s.text)));
  });
});
