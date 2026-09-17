// Express middlewares for the Telegram mini app API.
// The client sends Telegram's signed initData in the X-Telegram-Init-Data header;
// we verify it with the bot token and load the matching user into req.user.
const { isDataAuthenticated } = require('../controllers/auth');
const User = require('../models/user');

const requireWebAppUser = async (req, res, next) => {
  const initData = req.get('x-telegram-init-data') || req.body?.initData;
  if (!isDataAuthenticated(initData, process.env.BOT_TOKEN)) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  try {
    const params = new URLSearchParams(initData);
    const tgUser = JSON.parse(params.get('user'));
    const user = await User.findOne({ id: tgUser.id });
    if (!user) return res.status(401).json({ error: 'unknown_user' });
    req.user = user;
    next();
  } catch (error) {
    console.error('WebApp auth error:', error);
    res.status(400).json({ error: 'bad_init_data' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'forbidden' });
  next();
};

module.exports = { requireWebAppUser, requireAdmin };
