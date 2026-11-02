// Mini app API for the support network (logic in src/support/service.js).
const support = require('../support/service');

const ERRORS = {
  invalid_value: [400, "That setting isn't valid."],
  friend_not_found: [404, "Couldn't find that friend."],
  not_found: [404, 'Not found.'],
  not_yourself: [400, "You can't pick yourself."],
  not_connected: [400, 'You can only pick people who share moods with you.'],
  too_many: [400, `You can have up to ${support.MAX_CONTACTS} support friends.`],
  declined_recently: [400, 'They said not now recently. Try again in a few days.'],
  mood_not_found: [404, "Couldn't find that mood."],
  too_old: [400, 'That mood is too old to share now.'],
  receive_off: [400, "They've turned off support messages."],
};
const handle = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    const known = error instanceof support.SupportError && ERRORS[error.code];
    if (!known) throw error;
    res.status(known[0]).json({ error: error.code, message: known[1] });
  }
};
const send = async (req, res) => res.json(await support.view(req.user._id));

// GET /api/me/support
const getSupport = handle(send);
// POST /api/me/support/settings { auto?, emotions?, immediate?, repeat_on?, repeat_count?, repeat_hours?, days_on?, days?, delay_minutes?, cooldown_hours?, manual_prompt?, receive? }
const saveSettings = handle(async (req, res) => { await support.updateSettings(req.user._id, req.body || {}); await send(req, res); });
// POST /api/me/support/contacts { telegram_id } — invites them (they get a message in the bot)
const addContact = handle(async (req, res) => {
  const { delivered } = await support.invite(req.user._id, req.body?.telegram_id);
  res.json({ ...await support.view(req.user._id), delivered });
});
// DELETE /api/me/support/contacts/:telegramId
const removeContact = handle(async (req, res) => { await support.removeContact(req.user._id, req.params.telegramId); await send(req, res); });
// POST /api/me/support/supporting/:invitationId { accept } — answer an invitation from the mini app
const answerInvitation = handle(async (req, res) => {
  if (typeof req.body?.accept !== 'boolean') throw new support.SupportError('invalid_value');
  if (!/^[a-f0-9]{24}$/i.test(req.params.invitationId)) throw new support.SupportError('not_found');
  await support.respond(req.user._id, req.params.invitationId, req.body.accept);
  await send(req, res);
});
// DELETE /api/me/support/supporting/:telegramId — stop being someone's support friend
const stopSupporting = handle(async (req, res) => { await support.stopSupporting(req.user._id, req.params.telegramId); await send(req, res); });
// POST /api/me/support/share { mood_id, telegram_id }
const shareMood = handle(async (req, res) => {
  const result = await support.shareMood(req.user._id, req.body?.mood_id, req.body?.telegram_id);
  res.status(result.status === 'failed' ? 502 : 200).json({ status: result.status, to: { id: result.to.id, first_name: result.to.first_name || '' } });
});

module.exports = { getSupport, saveSettings, addContact, removeContact, answerInvitation, stopSupporting, shareMood };
