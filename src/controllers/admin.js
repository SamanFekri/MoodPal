// Admin-only mini app API (req.user.is_admin, set by hand in the database).
const mongoose = require('mongoose');
const User = require('../models/user');
const Mood = require('../models/mood');
const Share = require('../models/share');
const PersonalityTrait = require('../models/personality_trait');
const personalityService = require('../personality/service');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const USERS_PAGE_SIZE = 20;
const MOODS_PAGE_SIZE = 30;

const publicUser = (u) => ({
  id: u.id,
  fullname: [u.first_name, u.last_name].filter(Boolean).join(' '),
  username: u.username || null,
});

// GET /api/admin/users?q=&page=&trait=<key>&min=&max=&notes=with|without&sort=activity|mood
// Every user with their latest mood. `sort` picks recency of activity (default) or of the
// last mood they registered. `notes` keeps only users whose last mood has (or lacks) a note.
// `trait` keeps only users whose personality profile has that trait within [min,max] (0..1).
const listUsers = async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(0, parseInt(req.query.page, 10) || 0);
  const sortBy = req.query.sort === 'mood' ? 'mood' : 'activity';
  const notes = req.query.notes === 'with' || req.query.notes === 'without' ? req.query.notes : null;

  const filter = { is_bot: { $ne: true } };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ first_name: rx }, { last_name: rx }, { username: rx }];
    if (/^\d+$/.test(q)) filter.$or.push({ id: Number(q) });
  }

  // optional personality filter: join the profile and keep users in the requested range
  const traitKey = typeof req.query.trait === 'string' && /^[a-z_]+$/.test(req.query.trait) ? req.query.trait : null;
  const min = Math.max(0, Math.min(1, parseFloat(req.query.min ?? 0) || 0));
  const max = Math.max(0, Math.min(1, isNaN(parseFloat(req.query.max)) ? 1 : parseFloat(req.query.max)));
  const profileStages = traitKey ? [
    { $lookup: { from: 'personality_profiles', localField: '_id', foreignField: 'user', as: 'profile' } },
    { $unwind: '$profile' },
    { $match: { [`profile.traits.${traitKey}`]: { $gte: min, $lte: max } } },
  ] : [];

  // the latest mood has to be joined before paging, because both the notes filter and the
  // "last mood" sort are derived from it (uses the { user, timestamp } index)
  const shapeStages = [
    { $lookup: {
      from: 'moods', let: { uid: '$_id' },
      pipeline: [{ $match: { $expr: { $eq: ['$user', '$$uid'] } } }, { $sort: { timestamp: -1 } }, { $limit: 1 }, { $project: { mood: 1, note: 1, timestamp: 1 } }],
      as: 'last_mood',
    } },
    { $addFields: {
      last_mood_doc: { $arrayElemAt: ['$last_mood', 0] },
      // users from before last_active_at existed fall back to their last write
      active_at: { $ifNull: ['$last_active_at', { $ifNull: ['$updatedAt', '$createdAt'] }] },
    } },
    { $addFields: {
      last_mood_at: '$last_mood_doc.timestamp',
      has_note: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$last_mood_doc.note', ''] } } } }, 0] },
    } },
  ];
  const notesStages = notes ? [{ $match: { has_note: notes === 'with' } }] : [];
  const sortStage = sortBy === 'mood'
    ? { $sort: { last_mood_at: -1, _id: -1 } }   // users with no mood sort last
    : { $sort: { active_at: -1, _id: -1 } };

  const countPipeline = [{ $match: filter }, ...profileStages, ...(notes ? [...shapeStages, ...notesStages] : []), { $count: 'n' }];

  const [rows, countRows, moodCount] = await Promise.all([
    User.aggregate([
      { $match: filter },
      ...profileStages,
      ...shapeStages,
      ...notesStages,
      sortStage,
      { $skip: page * USERS_PAGE_SIZE },
      { $limit: USERS_PAGE_SIZE },
      { $lookup: {
        from: 'moods', let: { uid: '$_id' },
        pipeline: [{ $match: { $expr: { $eq: ['$user', '$$uid'] } } }, { $count: 'n' }],
        as: 'mood_count',
      } },
      // whether the admin already follows this user
      { $lookup: {
        from: 'shares', let: { uid: '$_id' },
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$followed', '$$uid'] }, { $eq: ['$follower', req.user._id] }, { $eq: ['$disabled', false] }] } } }, { $limit: 1 }],
        as: 'friend',
      } },
      // $arrayElemAt instead of $first: works on MongoDB 4.2+
      { $project: { id: 1, first_name: 1, last_name: 1, username: 1, is_mood_private: 1, is_blocked: 1, is_admin: 1, has_note: 1, last_active_at: '$active_at', last_mood: '$last_mood_doc', mood_count: { $ifNull: [{ $arrayElemAt: ['$mood_count.n', 0] }, 0] }, is_friend: { $gt: [{ $size: '$friend' }, 0] }, trait_value: traitKey ? `$profile.traits.${traitKey}` : null } },
    ]),
    User.aggregate(countPipeline),
    Mood.estimatedDocumentCount(),
  ]);
  const total = countRows[0]?.n || 0;

  res.json({
    page,
    page_size: USERS_PAGE_SIZE,
    has_more: (page + 1) * USERS_PAGE_SIZE < total,
    total_users: total,
    total_moods: moodCount,
    sort: sortBy,
    filter: {
      trait: traitKey ? { trait: traitKey, min, max } : null,
      notes,
    },
    users: rows.map(u => ({
      ...publicUser(u),
      is_mood_private: Boolean(u.is_mood_private),
      is_blocked: Boolean(u.is_blocked),
      is_admin: Boolean(u.is_admin),
      is_friend: Boolean(u.is_friend),
      has_note: Boolean(u.has_note),
      last_active_at: u.last_active_at,
      mood_count: u.mood_count,
      trait_value: traitKey ? u.trait_value : undefined,
      last_mood: u.last_mood ? { mood: u.last_mood.mood, note: u.last_mood.note || '', timestamp: u.last_mood.timestamp, tgs: `/public/tgs/${u.last_mood.mood.code}.tgs` } : null,
    })),
  });
};

// GET /api/admin/users/:telegramId/moods?before=<ISO date>&limit= — history, newest first, cursor paginated
const userMoods = async (req, res) => {
  const user = await User.findOne({ id: Number(req.params.telegramId) });
  if (!user) return res.status(404).json({ error: 'not_found' });
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || MOODS_PAGE_SIZE));
  const before = req.query.before ? new Date(req.query.before) : null;

  const filter = { user: user._id };
  if (before && !isNaN(before)) filter.timestamp = { $lt: before };
  const moods = await Mood.find(filter).sort({ timestamp: -1 }).limit(limit + 1).select('mood note timestamp').lean();
  const hasMore = moods.length > limit;
  const pageMoods = moods.slice(0, limit);

  res.json({
    user: publicUser(user),
    moods: pageMoods.map(m => ({ mood: m.mood, note: m.note || '', timestamp: m.timestamp, tgs: `/public/tgs/${m.mood.code}.tgs` })),
    has_more: hasMore,
    next_before: hasMore ? pageMoods[pageMoods.length - 1].timestamp : null,
  });
};

// POST /api/admin/users/:telegramId/friend   — admin follows the user (they appear in the admin's Friends tab)
// DELETE /api/admin/users/:telegramId/friend — stop following
const setFriend = async (req, res) => {
  const user = await User.findOne({ id: Number(req.params.telegramId) });
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (String(user._id) === String(req.user._id)) return res.status(400).json({ error: 'cannot_friend_self' });

  if (req.method === 'DELETE') {
    await Share.disableShare(req.user._id, user._id);
    return res.json({ is_friend: false });
  }
  await Share.createShare(req.user._id, user._id);
  res.json({ is_friend: true });
};

// POST /api/admin/users/:telegramId/block   — block a user (bot ignores them, mini app refuses)
// DELETE /api/admin/users/:telegramId/block — unblock
const setBlocked = async (req, res) => {
  const user = await User.findOne({ id: Number(req.params.telegramId) });
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (String(user._id) === String(req.user._id)) return res.status(400).json({ error: 'cannot_block_self' });
  if (user.is_admin) return res.status(400).json({ error: 'cannot_block_admin' });

  const blocked = req.method !== 'DELETE';
  await User.updateOne({ _id: user._id }, { is_blocked: blocked });
  res.json({ is_blocked: blocked });
};

// GET /api/admin/users/:telegramId/personality — anyone's profile, regardless of their sharing setting
const userPersonality = async (req, res) => {
  const user = await User.findOne({ id: Number(req.params.telegramId) });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user: publicUser(user), shared: Boolean(user.is_personality_shared), profile: await personalityService.getProfileView(user._id) });
};

// GET /api/admin/graph?limit= — who follows whose mood.
// Nodes are the users involved in at least one active share; an edge points from the
// follower to the person whose mood they can see.
const MAX_GRAPH_NODES = 400;
const followGraph = async (req, res) => {
  const limit = Math.min(MAX_GRAPH_NODES, Math.max(10, parseInt(req.query.limit, 10) || MAX_GRAPH_NODES));

  const shares = await Share.find({ disabled: false }).select('follower followed').lean();
  // rank users by how many edges they touch, so a truncated graph keeps the busiest part
  const degree = new Map();
  for (const s of shares) {
    for (const side of [String(s.follower), String(s.followed)]) degree.set(side, (degree.get(side) || 0) + 1);
  }
  const keep = new Set([...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id));
  const edges = shares.filter(s => keep.has(String(s.follower)) && keep.has(String(s.followed)));

  const ids = [...keep].map(id => new mongoose.Types.ObjectId(id));
  const [users, latestMoods, totalUsers] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('id first_name last_name username is_admin is_blocked is_mood_private').lean(),
    Mood.aggregate([
      { $match: { user: { $in: ids } } },
      { $sort: { user: 1, timestamp: -1 } },
      { $group: { _id: '$user', mood: { $first: '$mood' }, timestamp: { $first: '$timestamp' } } },
    ]),
    User.countDocuments({ is_bot: { $ne: true } }),
  ]);

  const moodByUser = new Map(latestMoods.map(m => [String(m._id), m]));
  const followers = new Map();
  const following = new Map();
  for (const e of edges) {
    following.set(String(e.follower), (following.get(String(e.follower)) || 0) + 1);
    followers.set(String(e.followed), (followers.get(String(e.followed)) || 0) + 1);
  }

  const nodes = users.map(u => {
    const last = moodByUser.get(String(u._id));
    return {
      id: u.id,
      ...publicUser(u),
      is_admin: Boolean(u.is_admin),
      is_blocked: Boolean(u.is_blocked),
      is_mood_private: Boolean(u.is_mood_private),
      followers: followers.get(String(u._id)) || 0,
      following: following.get(String(u._id)) || 0,
      mood: last ? { name: last.mood.name, code: last.mood.code, emoji: last.mood.emoji, timestamp: last.timestamp } : null,
    };
  });

  const byObjectId = new Map(users.map(u => [String(u._id), u.id]));
  res.json({
    nodes,
    edges: edges
      .map(e => ({ source: byObjectId.get(String(e.follower)), target: byObjectId.get(String(e.followed)) }))
      .filter(e => e.source !== undefined && e.target !== undefined),
    stats: {
      users_in_graph: nodes.length,
      total_users: totalUsers,
      total_shares: shares.length,
      truncated: degree.size > keep.size,
    },
  });
};

// GET /api/admin/traits — catalog for the filter UI
const listTraits = async (req, res) => {
  const traits = await PersonalityTrait.find({ enabled: true }).sort({ category: 1, name: 1 }).select('key name category').lean();
  res.json({ traits: traits.map(t => ({ key: t.key, name: t.name, category: t.category })) });
};

module.exports = { listUsers, userMoods, setFriend, setBlocked, userPersonality, listTraits, followGraph };
