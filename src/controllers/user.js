const Share = require('../models/share');
const Mood = require('../models/mood');

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
      personality_shared: Boolean(following.followed.is_personality_shared)
    };
  }));

  // Filter out null values, newest mood first
  const filteredFollowings = followingsWithLastMood
    .filter(following => following !== null)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json(filteredFollowings);
}

module.exports = {
  getFollowings
}
