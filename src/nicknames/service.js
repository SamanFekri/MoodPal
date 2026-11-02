// Nicknames: the name a person gives a friend. Used wherever that person sees the friend (mini app)
// and in bot messages they get about them. Admin views always show real names.
const Nickname = require('../models/nickname');
const User = require('../models/user');
const Share = require('../models/share');

const MAX_LENGTH = 32;

class NicknameError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const realName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || 'Unnamed';

// Map<String(targetId), name> of owner's nicknames for these people (all of them when targetIds is omitted)
async function mapFor(ownerId, targetIds) {
  if (!ownerId) return new Map();
  const filter = { owner: ownerId };
  if (targetIds) filter.target = { $in: targetIds };
  const rows = await Nickname.find(filter).select('target name').lean();
  return new Map(rows.map(r => [String(r.target), r.name]));
}

// what `owner` calls `target`: their nickname, or the real name
async function nameFor(ownerId, target, { first = false } = {}) {
  const row = ownerId && target?._id ? await Nickname.findOne({ owner: ownerId, target: target._id }).select('name').lean() : null;
  if (row) return row.name;
  return first ? (target?.first_name || target?.username || 'Your friend') : realName(target);
}

// set (or clear, with an empty name) owner's nickname for a friend they're connected to either way
async function set(ownerId, targetTelegramId, name) {
  const target = await User.findOne({ id: Number(targetTelegramId) }).select('_id').lean();
  if (!target || String(target._id) === String(ownerId)) throw new NicknameError('not_found');
  const linked = await Share.exists({ disabled: false, $or: [{ follower: ownerId, followed: target._id }, { follower: target._id, followed: ownerId }] });
  if (!linked) throw new NicknameError('not_connected');
  const clean = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  if (clean.length > MAX_LENGTH) throw new NicknameError('too_long');
  if (!clean) {
    await Nickname.deleteOne({ owner: ownerId, target: target._id });
    return null;
  }
  await Nickname.updateOne({ owner: ownerId, target: target._id }, { name: clean }, { upsert: true });
  return clean;
}

module.exports = { mapFor, nameFor, set, realName, NicknameError, MAX_LENGTH };
