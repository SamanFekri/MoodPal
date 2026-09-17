// Admin-only mini app API (req.user.is_admin, set by hand in the database).
const User = require('../models/user');
const Mood = require('../models/mood');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PAGE_SIZE = 30;

// GET /api/admin/users?q=&page= — everyone, newest mood first, with their latest mood + note
const listUsers = async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(0, parseInt(req.query.page, 10) || 0);

  // same filter twice: once on users (count), once on the joined user inside the aggregate
  const userFilter = { is_bot: { $ne: true } };
  const joinedFilter = { 'user.is_bot': { $ne: true } };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const fields = ['first_name', 'last_name', 'username'];
    userFilter.$or = fields.map(f => ({ [f]: rx }));
    joinedFilter.$or = fields.map(f => ({ [`user.${f}`]: rx }));
    if (/^\d+$/.test(q)) {
      userFilter.$or.push({ id: Number(q) });
      joinedFilter.$or.push({ 'user.id': Number(q) });
    }
  }

  const [rows, total, moodCount] = await Promise.all([
    Mood.aggregate([
      { $sort: { user: 1, timestamp: -1 } },
      { $group: { _id: '$user', mood: { $first: '$mood' }, note: { $first: '$note' }, timestamp: { $first: '$timestamp' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: joinedFilter },
      { $sort: { timestamp: -1 } },
      { $skip: page * PAGE_SIZE },
      { $limit: PAGE_SIZE },
    ]),
    User.countDocuments(userFilter),
    Mood.estimatedDocumentCount(),
  ]);

  res.json({
    page,
    page_size: PAGE_SIZE,
    total_users: total,
    total_moods: moodCount,
    users: rows.map(r => ({
      id: r.user.id,
      _id: r.user._id,
      fullname: [r.user.first_name, r.user.last_name].filter(Boolean).join(' '),
      username: r.user.username || null,
      is_mood_private: Boolean(r.user.is_mood_private),
      mood_count: r.count,
      last_mood: { mood: r.mood, note: r.note || '', timestamp: r.timestamp, tgs: `/public/tgs/${r.mood.code}.tgs` },
    })),
  });
};

// GET /api/admin/users/:telegramId/moods?limit= — full history with notes
const userMoods = async (req, res) => {
  const user = await User.findOne({ id: Number(req.params.telegramId) });
  if (!user) return res.status(404).json({ error: 'not_found' });
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 60));
  const moods = await Mood.find({ user: user._id }).sort({ timestamp: -1 }).limit(limit).select('mood note timestamp').lean();
  res.json({
    user: { id: user.id, fullname: [user.first_name, user.last_name].filter(Boolean).join(' '), username: user.username || null },
    moods: moods.map(m => ({ mood: m.mood, note: m.note || '', timestamp: m.timestamp })),
  });
};

module.exports = { listUsers, userMoods };
