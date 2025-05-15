const crypto = require('crypto-js');
const User = require('../models/user');

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

    return hash === expectedHash;

  } catch (error) {
    console.error("Authentication error:", error);
    return false;
  }
}

const isAuthenticated = async (req, res) => {
  // request body is a json object with a key initData
  const initData = req.body.initData;
  const botToken = process.env.BOT_TOKEN;
  const isAuthenticated = isDataAuthenticated(initData, botToken);
  // parse initData url params
  const urlParams = new URLSearchParams(initData);
  
  // get user id from url params
  const userParams = urlParams.get('user');
  
  const userParamsObj = JSON.parse(userParams);
  
  // get user id from userParamsObj
  const USER_ID = userParamsObj.id;
  let user = await User.findOne({ id: USER_ID });

  // as a response send isAuthenticated
  res.json({ authenticated: isAuthenticated, userId: user._id });
}
module.exports = {
  isAuthenticated
};