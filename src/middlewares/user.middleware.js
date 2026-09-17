const User = require('../models/user'); // Assuming you have a User model

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
      existingUser = new User(ctx.from);
      u = await existingUser.save();
    }
    // get existing user from db and mark them active
    existingUser = await User.findOneAndUpdate({ id: user.id }, { last_active_at: new Date() }, { new: true });
    ctx.user = existingUser;

    next();
  } catch (error) {
    console.error('Error saving user:', error);
  }
};

module.exports = saveUserMiddleware;