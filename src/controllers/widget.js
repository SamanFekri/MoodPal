// Home-screen widget: private image links a widget app (Scriptable on iOS, an image-from-URL widget
// on Android) can show. A Telegram mini app can't put a real widget on the home screen, so the server
// draws the picture. Links carry a secret token the user can reset or turn off; friends appear only
// while they share their mood with the user (same rule as the Friends tab), and notes are never shown.
const crypto = require('crypto');
const User = require('../models/user');
const Mood = require('../models/mood');
const Share = require('../models/share');
const render = require('../widget/render');

const baseUrl = () => require('../constants').server.SERVER_BASE_URL;
const fullname = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Unnamed';

const view = async (userId) => {
  const user = await User.findById(userId).select('+widget_token').lean();
  if (!user?.widget_token) return { enabled: false, links: null, friends: [] };
  const root = `${baseUrl()}/w/${user.widget_token}`;
  const shares = await Share.getFollowings(userId);
  return {
    enabled: true,
    links: { me: `${root}/me.png`, friends: `${root}/friends.png` },
    friends: shares.filter(s => s.followed).map(s => ({ id: s.followed.id, fullname: fullname(s.followed), link: `${root}/friend/${s.followed.id}.png` })),
  };
};

// GET /api/me/widget
const getWidget = async (req, res) => res.json(await view(req.user._id));

// POST /api/me/widget — turn the links on, or { reset: true } for new ones (old links stop working)
const enableWidget = async (req, res) => {
  const user = await User.findById(req.user._id).select('+widget_token');
  if (!user.widget_token || req.body?.reset === true) {
    user.widget_token = crypto.randomBytes(18).toString('base64url');
    await user.save();
  }
  res.json(await view(req.user._id));
};

// DELETE /api/me/widget — every link stops working
const disableWidget = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { widget_token: null });
  res.json(await view(req.user._id));
};

// ---- the images (no Telegram auth: the token is the key) ----

const ownerOf = async (token) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const owner = await User.findOne({ widget_token: token });
  return owner && !owner.is_blocked ? owner : null;
};

const sendPng = (res, png) => {
  // widget apps refresh on their own schedule; a short cache keeps repeated fetches cheap
  res.set('Cache-Control', 'private, max-age=60');
  res.type('png').send(png);
};

const lastMoodView = async (userId) => {
  const m = await Mood.getLastMood(userId);
  return m ? { mood: { code: m.mood.code, name: m.mood.name }, timestamp: m.timestamp } : null;
};

// GET /w/:token/me.png
const meImage = async (req, res) => {
  const owner = await ownerOf(req.params.token);
  if (!owner) return res.status(404).json({ error: 'not_found' });
  const last = await lastMoodView(owner._id);
  sendPng(res, await render.renderSingle({ name: 'You', ...last, empty: 'Log a mood in the bot' }));
};

// GET /w/:token/friend/:telegramId.png — only while that person shares their mood with the owner
const friendImage = async (req, res) => {
  const owner = await ownerOf(req.params.token);
  if (!owner) return res.status(404).json({ error: 'not_found' });
  const friend = await User.findOne({ id: Number(req.params.telegramId) });
  const share = friend && await Share.findOne({ follower: owner._id, followed: friend._id, disabled: false }).lean();
  if (!share) return sendPng(res, await render.renderSingle({ name: friend ? friend.first_name : 'MoodPal', empty: 'Not shared with you' }));
  const last = await lastMoodView(friend._id);
  sendPng(res, await render.renderSingle({ name: friend.first_name || fullname(friend), ...last, empty: 'No mood yet' }));
};

// GET /w/:token/friends.png — newest moods first
const friendsImage = async (req, res) => {
  const owner = await ownerOf(req.params.token);
  if (!owner) return res.status(404).json({ error: 'not_found' });
  const shares = await Share.getFollowings(owner._id);
  const friends = (await Promise.all(shares.filter(s => s.followed).map(async (s) => {
    const last = await lastMoodView(s.followed._id);
    return last ? { name: s.followed.first_name || fullname(s.followed), ...last } : null;
  }))).filter(Boolean).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  sendPng(res, await render.renderFriends({ friends }));
};

module.exports = { getWidget, enableWidget, disableWidget, meImage, friendImage, friendsImage };
