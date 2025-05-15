const crypto = require('crypto-js');

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

const isAuthenticated = (req, res) => {
  // request body is a json object with a key initData
  console.log(req);
  const initData = req.body.initData;
  const botToken = process.env.BOT_TOKEN;
  const isAuthenticated = isDataAuthenticated(initData, botToken);
  // as a response send isAuthenticated
  res.json({ authenticated: isAuthenticated });
}
module.exports = {
  isAuthenticated
};