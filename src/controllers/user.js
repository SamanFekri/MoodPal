const Share = require('../models/share');
const Mood = require('../models/mood');

// get followings of a user
const getFollowings = async (req, res) => {
  const userId = req.params.userId;
  const followings = await Share.getFollowings(userId);
  // for all followings, get their last moods and return the last mood of each following
  const followingsWithLastMood = await Promise.all(followings.map(async (following) => {
    let lastMood = await Mood.getLastMood(following.followed._id);
    let temp = {
      fullname: `${following.followed.first_name} ${following.followed.last_name}`.trim(),
      img: `/public/moods/${lastMood.mood.code}.webp`,
      ...lastMood._doc
    }
    return temp;
  }));

  res.json(followingsWithLastMood);
}

module.exports = {
  getFollowings
}
