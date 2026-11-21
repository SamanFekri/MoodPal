const User = require('../models/user'); // Assuming you have a User model
const i18n = require('../i18n');

const saveUserMiddleware = async (ctx, next) => {
  try {
    const user  = ctx.from; // Telegram user data comes from ctx.from
    if (!user) {
      console.error('User data not found in context');
      return 
    }

    // Log the user data for debugging
    console.log('=====================');
    console.log('User:');
    console.log(user);
    console.log('=====================');

    let existingUser = await User.findOne({ id: user.id });

    if (!existingUser) {
      // a new user starts in their Telegram app's language when MoodPal speaks it (English otherwise)
      existingUser = new User({ ...ctx.from, language: i18n.detect(ctx.from.language_code) });
      await existingUser.save();
    }
    // get existing user from db and mark them active
    existingUser = await User.findOneAndUpdate({ id: user.id }, { last_active_at: new Date() }, { new: true });
    // reminders stopped because Telegram said we couldn't reach them; a private message means we can again
    if (existingUser.reminder?.bot_blocked && ctx.chat?.type === 'private') {
      await require('../reminders/service').markReachable(existingUser._id).catch(() => {});
    }
    // handlers that send the menu keyboard themselves mark it current (see common.markMenuSent)
    ctx.user = existingUser;

    next();
  } catch (error) {
    console.error('Error saving user:', error);
  }
};

module.exports = saveUserMiddleware;