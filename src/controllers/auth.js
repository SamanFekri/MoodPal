const crypto = require('crypto-js');
const User = require('../models/user');
const Mood = require('../models/mood');

// initData older than this is refused so a captured payload can't be replayed forever
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

/**
 * Validates if Telegram WebApp data is authentic (Node.js version)
 *
 * @param {string} initData - The initData string from Telegram WebApp
 * @param {string} botToken - Your bot's token
 * @returns {boolean} - true if data is authentic, false otherwise
 */
function isDataAuthenticated(initData, botToken) {
  try {
    if (!initData || !botToken) {
      return false;
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return false;
    }

    const dataCheckObj = {};
    for (const [key, value] of urlParams.entries()) {
      if (key !== 'hash') {
        dataCheckObj[key] = value;
      }
    }

    const sortedKeys = Object.keys(dataCheckObj).sort();
    const dataCheckArr = sortedKeys.map(key => `${key}=${dataCheckObj[key]}`);
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto.HmacSHA256(botToken, "WebAppData");

    const expectedHash = crypto.HmacSHA256(dataCheckString, secretKey).toString(crypto.enc.Hex);

    if (hash !== expectedHash) {
      return false;
    }

    const authDate = parseInt(urlParams.get('auth_date'), 10);
    if (!authDate || (Date.now() / 1000) - authDate > MAX_INIT_DATA_AGE_SECONDS) {
      return false;
    }

    return true;

  } catch (error) {
    console.error("Authentication error:", error);
    return false;
  }
}

const isAuthenticated = async (req, res) => {
  // request body is a json object with a key initData
  const initData = req.body.initData;
  const botToken = process.env.BOT_TOKEN;

  if (!isDataAuthenticated(initData, botToken)) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const userParamsObj = JSON.parse(urlParams.get('user'));
    const user = await User.findOne({ id: userParamsObj.id });
    if (!user) {
      // the user has never talked to the bot, so there is nothing to show yet
      return res.status(401).json({ authenticated: false, reason: 'unknown_user' });
    }

    const lastMood = await Mood.getLastMood(user._id);

    res.json({
      authenticated: true,
      userId: user._id,
      firstName: user.first_name,
      isAdmin: Boolean(user.is_admin),
      // the user's own latest mood (null until they set one in the bot)
      myMood: lastMood ? {
        mood: lastMood.mood,
        note: lastMood.note || '',
        timestamp: lastMood.timestamp,
        image: `/public/moods/${lastMood.mood.code}.webp`,
        tgs: `/public/tgs/${lastMood.mood.code}.tgs`,
      } : null,
      // same link the /share command gives, used by the "add a friend" button
      shareLink: `https://t.me/${process.env.BOT_USERNAME}?start=sm-${user._id}`
    });
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(400).json({ authenticated: false });
  }
}
module.exports = {
  isAuthenticated,
  isDataAuthenticated
};
