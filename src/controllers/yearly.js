// Mini app API for Year in Moods (src/yearly/service.js). Videos are made in the background and
// arrive in the bot chat, so these answer right away.
const yearly = require('../yearly/service');
const User = require('../models/user');

const background = (p) => p.catch(error => console.error('Year in Moods request failed:', error.message));

// GET /api/me/yearly
const getMine = (req, res) => res.json({ available: yearly.available(req.user), year: yearly.state.year, enabled: yearly.state.enabled });

// POST /api/me/yearly — make mine; it arrives in my chat with the bot
const requestMine = (req, res) => {
  if (!yearly.available(req.user)) return res.status(403).json({ error: 'not_open' });
  background(yearly.requestOwn(req.user));
  res.json({ ok: true });
};

// GET /api/admin/yearly
const adminView = async (req, res) => res.json(await yearly.adminView());

// POST /api/admin/yearly/settings { enabled?, year? }
const saveSettings = async (req, res) => {
  try {
    res.json(await yearly.updateSettings(req.user._id, { enabled: req.body?.enabled, year: req.body?.year }));
  } catch (error) {
    if (error.message === 'invalid_value') return res.status(400).json({ error: 'invalid_value' });
    throw error;
  }
};

// POST /api/admin/users/:telegramId/yearly — their video, sent to the admin's own chat to check
const previewFor = async (req, res) => {
  const subject = await User.findOne({ id: Number(req.params.telegramId) }).select('_id').lean();
  if (!subject) return res.status(404).json({ error: 'not_found' });
  background(yearly.deliver({ subjectId: subject._id, chatId: req.user.id, preview: String(subject._id) !== String(req.user._id) }));
  res.json({ ok: true });
};

module.exports = { getMine, requestMine, adminView, saveSettings, previewFor };
