const Share = require('../models/share');
const Mood = require('../models/mood');

// get followings of a user
const getFollowings = async (req, res) => {
  const userId = req.params.userId;
  const followings = await Share.getFollowings(userId);
  // for all followings, get their last moods and return the last mood of each following
  const followingsWithLastMood = await Promise.all(followings.map(async (following) => {
    let lastMood = await Mood.getLastMood(following.followed._id);
    if (!lastMood) return null;

    let temp = {
      fullname: [following.followed.first_name, following.followed.last_name].filter(Boolean).join(' '),
      link: `tg://user?id=${following.followed.id}`,
      image: `/public/moods/${lastMood.mood.code}.webp`,
      tgs: `/public/tgs/${lastMood.mood.code}.tgs`,
      ...lastMood._doc
    }
    return temp;
  }));

  // Filter out null values from the array
  const filteredFollowings = followingsWithLastMood.filter(following => following !== null);

  res.json(filteredFollowings);
}

module.exports = {
  getFollowings
}
