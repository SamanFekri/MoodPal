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

module.exports = {
  getFollowings,
  getFriendMoods
}
