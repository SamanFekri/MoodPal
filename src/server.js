const express = require('express');
const path = require('path');
const cors = require('cors');

const Mood = require('./models/mood');
const User = require('./models/user');

const controllers = require('./controllers');
const { requireWebAppUser, requireAdmin } = require('./middlewares/webapp.middleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Read port and IP from environment variables, with defaults
const PORT = process.env.SERVER_PORT || 3000;
const HOST = process.env.SERVER_HOST || 'localhost';


// Route to handle /user/<user-id>/mood/animated
app.get('/user/:userId/mood/animated', controllers.embed.animatedMood);
app.get('/user/:userId/mood/tgs', controllers.embed.tgsMood);

app.get('/user/:userId/mood/emoji', controllers.embed.emojiMood);

const miniApp = (req, res) => res.sendFile(path.join(__dirname, 'public', 'ui', 'index.html'));
app.get('/', miniApp);
// public personality card (share link); the page reads the token from the URL
app.get('/p/:token', miniApp);

app.post('/auth', controllers.auth.isAuthenticated);

// ---- mini app API (signed Telegram initData in X-Telegram-Init-Data) ----
app.get('/api/friends', requireWebAppUser, controllers.user.getFollowings);
app.get('/api/friends/:telegramId/personality', requireWebAppUser, controllers.personality.getFriends);
app.get('/api/me/personality', requireWebAppUser, controllers.personality.getMine);
app.post('/api/me/personality/sharing', requireWebAppUser, controllers.personality.setSharing);
app.get('/api/public/personality/:token', controllers.personality.getPublic);
app.get('/api/admin/users', requireWebAppUser, requireAdmin, controllers.admin.listUsers);
app.get('/api/admin/users/:telegramId/moods', requireWebAppUser, requireAdmin, controllers.admin.userMoods);

// allow all requests to /public
app.use('/public', express.static(path.join(__dirname, 'public')));

// make a function listen server so bot can use it
const listenServer = async () => {
  try {
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

// Export the server and listen function
module.exports = {
  app,
  listenServer,
};