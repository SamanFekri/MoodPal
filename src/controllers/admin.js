// Admin-only mini app API (req.user.is_admin, set by hand in the database).
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

// GET /api/admin/users?q=&page=&trait=<key>&min=&max= — every user, most recently active first, with their
// latest mood. With `trait`, only users whose personality profile has that trait within [min,max] (0..1).
const listUsers = async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(0, parseInt(req.query.page, 10) || 0);

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

  const countPipeline = [{ $match: filter }, ...profileStages, { $count: 'n' }];

  const [rows, countRows, moodCount] = await Promise.all([
    User.aggregate([
      { $match: filter },
      ...profileStages,
      // users from before last_active_at existed fall back to their last write
      { $addFields: { active_at: { $ifNull: ['$last_active_at', { $ifNull: ['$updatedAt', '$createdAt'] }] } } },
      { $sort: { active_at: -1, _id: -1 } },
      { $skip: page * USERS_PAGE_SIZE },
      { $limit: USERS_PAGE_SIZE },
      // latest mood only (uses the { user, timestamp } index)
      { $lookup: {
        from: 'moods', let: { uid: '$_id' },
        pipeline: [{ $match: { $expr: { $eq: ['$user', '$$uid'] } } }, { $sort: { timestamp: -1 } }, { $limit: 1 }, { $project: { mood: 1, note: 1, timestamp: 1 } }],
        as: 'last_mood',
      } },
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
      { $project: { id: 1, first_name: 1, last_name: 1, username: 1, is_mood_private: 1, last_active_at: '$active_at', last_mood: { $arrayElemAt: ['$last_mood', 0] }, mood_count: { $ifNull: [{ $arrayElemAt: ['$mood_count.n', 0] }, 0] }, is_friend: { $gt: [{ $size: '$friend' }, 0] }, trait_value: traitKey ? `$profile.traits.${traitKey}` : null } },
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
    filter: traitKey ? { trait: traitKey, min, max } : null,
    users: rows.map(u => ({
      ...publicUser(u),
      is_mood_private: Boolean(u.is_mood_private),
      is_friend: Boolean(u.is_friend),
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

// GET /api/admin/users/:telegramId/personality — anyone's profile, regardless of their sharing setting
const userPersonality = async (req, res) => {
  const user = await User.findOne({ id: Number(req.params.telegramId) });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user: publicUser(user), shared: Boolean(user.is_personality_shared), profile: await personalityService.getProfileView(user._id) });
};

// GET /api/admin/traits — catalog for the filter UI
const listTraits = async (req, res) => {
  const traits = await PersonalityTrait.find({ enabled: true }).sort({ category: 1, name: 1 }).select('key name category').lean();
  res.json({ traits: traits.map(t => ({ key: t.key, name: t.name, category: t.category })) });
};

module.exports = { listUsers, userMoods, setFriend, userPersonality, listTraits };
