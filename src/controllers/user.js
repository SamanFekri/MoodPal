const Share = require('../models/share');
const Mood = require('../models/mood');
const personalityService = require('../personality/service');

// get followings of a user
const getFollowings = async (req, res) => {
  const userId = req.user ? req.user._id : req.params.userId;
  const followings = await Share.getFollowings(userId);
  // for all followings, get their last moods and return the last mood of each following
  const followingsWithLastMood = await Promise.all(followings.map(async (following) => {
    let lastMood = await Mood.getLastMood(following.followed._id);
    if (!lastMood) return null;

    // only expose what the miniapp needs. Notes are private: they stay between the
    // user, the bot and (for their own history) themselves, so they are never sent here.
    return {
      id: following.followed.id,
      fullname: [following.followed.first_name, following.followed.last_name].filter(Boolean).join(' '),
      username: following.followed.username || null,
      link: `tg://user?id=${following.followed.id}`,
      image: `/public/moods/${lastMood.mood.code}.webp`,
      tgs: `/public/tgs/${lastMood.mood.code}.tgs`,
      mood: lastMood.mood,
      timestamp: lastMood.timestamp,
      personality_shared: Boolean(following.followed.is_personality_shared),
      _uid: following.followed._id,
      _mbtiShared: following.followed.is_mbti_shared !== false,
    };
  }));

  // does each of them also see my mood? (for the unfollow options on their profile)
  const backShares = await Share.find({ followed: userId, disabled: false }).select('follower').lean();
  const followsMe = new Set(backShares.map(s => String(s.follower)));
  for (const f of followingsWithLastMood) if (f) f.follows_me = followsMe.has(String(f._uid));

  // their MBTI-style character (type only), unless they hide it
  const visible = followingsWithLastMood.filter(f => f && f._mbtiShared);
  const types = visible.length ? await personalityService.getMbtiMany(visible.map(f => f._uid)) : new Map();
  for (const f of followingsWithLastMood) {
    if (!f) continue;
    const mbti = f._mbtiShared ? types.get(String(f._uid)) : null;
    f.mbti = mbti ? mbti.type : null;
    delete f._uid; delete f._mbtiShared;
  }

  // Filter out null values, newest mood first
  const filteredFollowings = followingsWithLastMood
    .filter(following => following !== null)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json(filteredFollowings);
}

// GET /api/friends/:telegramId/moods?before=<ISO date>&limit= — a friend's mood history, newest
// first. Only for people who follow them, only if they share it; notes only if they share those too.
const User = require('../models/user');
const FRIEND_MOODS_PAGE = 30;
const getFriendMoods = async (req, res) => {
  const friend = await User.findOne({ id: Number(req.params.telegramId) });
  if (!friend) return res.status(404).json({ error: 'not_found' });
  const share = await Share.findOne({ follower: req.user._id, followed: friend._id, disabled: false });
  if (!share) return res.status(403).json({ error: 'not_following' });
  if (friend.is_mood_log_shared === false) return res.json({ shared: false, moods: [], has_more: false, next_before: null });

  const withNotes = friend.is_mood_notes_shared === true;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || FRIEND_MOODS_PAGE));
  const before = req.query.before ? new Date(req.query.before) : null;
  const filter = { user: friend._id };
  if (before && !isNaN(before)) filter.timestamp = { $lt: before };
  const rows = await Mood.find(filter).sort({ timestamp: -1 }).limit(limit + 1).select(withNotes ? 'mood note timestamp' : 'mood timestamp').lean();
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  res.json({
    shared: true,
    notes_shared: withNotes,
    moods: page.map(m => ({ mood: m.mood, ...(withNotes && m.note ? { note: m.note } : {}), timestamp: m.timestamp, tgs: `/public/tgs/${m.mood.code}.tgs` })),
    has_more: hasMore,
    next_before: hasMore ? page[page.length - 1].timestamp : null,
  });
};

// ---- unfollowing (quiet: the other person is not notified) ----

const userByTelegramId = (telegramId) => User.findOne({ id: Number(telegramId) });

// DELETE /api/friends/:telegramId — stop seeing their mood
const unfollow = async (req, res) => {
  const other = await userByTelegramId(req.params.telegramId);
  if (!other) return res.status(404).json({ error: 'not_found' });
  await Share.disableShare(req.user._id, other._id);
  res.json({ ok: true });
};

// GET /api/me/followers — who can see my mood
const listFollowers = async (req, res) => {
  const shares = await Share.find({ followed: req.user._id, disabled: false }).populate('follower', 'id first_name last_name username').lean();
  const mine = await Share.find({ follower: req.user._id, disabled: false }).select('followed').lean();
  const iFollow = new Set(mine.map(s => String(s.followed)));
  res.json({
    followers: shares.filter(s => s.follower).map(s => ({
      id: s.follower.id,
      fullname: [s.follower.first_name, s.follower.last_name].filter(Boolean).join(' '),
      username: s.follower.username || null,
      i_follow_them: iFollow.has(String(s.follower._id)),
      since: s.updatedAt || s.createdAt,
    })).sort((a, b) => new Date(b.since) - new Date(a.since)),
  });
};

// DELETE /api/me/followers/:telegramId — stop them seeing my mood
const removeFollower = async (req, res) => {
  const other = await userByTelegramId(req.params.telegramId);
  if (!other) return res.status(404).json({ error: 'not_found' });
  await Share.disableShare(other._id, req.user._id);
  res.json({ ok: true });
};

module.exports = {
  getFollowings,
  getFriendMoods,
  unfollow,
  listFollowers,
  removeFollower,
}
