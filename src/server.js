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

// mini app data must never be served from a WebView cache
app.use(['/auth', '/api'], (req, res, next) => { res.set('Cache-Control', 'no-store, max-age=0'); res.set('Pragma', 'no-cache'); next(); });

app.post('/auth', controllers.auth.isAuthenticated);

// ---- mini app API (signed Telegram initData in X-Telegram-Init-Data) ----
app.get('/api/friends', requireWebAppUser, controllers.user.getFollowings);
app.get('/api/friends/:telegramId/personality', requireWebAppUser, controllers.personality.getFriends);
app.post('/api/me/mood/picker', requireWebAppUser, controllers.mood.requestMoodPicker);
app.get('/api/me/moods', requireWebAppUser, controllers.mood.myMoods);
app.get('/api/me/settings', requireWebAppUser, controllers.settings.getSettings);
app.post('/api/me/settings/openai-key', requireWebAppUser, controllers.settings.setKey);
app.delete('/api/me/settings/openai-key', requireWebAppUser, controllers.settings.removeKey);
app.post('/api/me/settings/model', requireWebAppUser, controllers.settings.setModel);
app.get('/api/me/personality', requireWebAppUser, controllers.personality.getMine);
app.post('/api/me/personality/sharing', requireWebAppUser, controllers.personality.setSharing);
app.get('/api/me/personality/session', requireWebAppUser, controllers.personality.getSession);
app.post('/api/me/personality/tests/:key/start', requireWebAppUser, controllers.personality.startTest);
app.post('/api/me/personality/session/:id/answer', requireWebAppUser, controllers.personality.answer);
app.post('/api/me/personality/session/cancel', requireWebAppUser, controllers.personality.cancel);
app.get('/api/public/personality/:token', controllers.personality.getPublic);
app.get('/api/admin/users', requireWebAppUser, requireAdmin, controllers.admin.listUsers);
app.get('/api/admin/users/:telegramId/moods', requireWebAppUser, requireAdmin, controllers.admin.userMoods);
app.get('/api/admin/users/:telegramId/personality', requireWebAppUser, requireAdmin, controllers.admin.userPersonality);
app.get('/api/admin/traits', requireWebAppUser, requireAdmin, controllers.admin.listTraits);
// backup / restore / health (GotYouBro)
app.get('/api/admin/backup', requireWebAppUser, requireAdmin, controllers.backup.getSettings);
app.post('/api/admin/backup/settings', requireWebAppUser, requireAdmin, controllers.backup.saveSettings);
app.post('/api/admin/backup/test', requireWebAppUser, requireAdmin, controllers.backup.testConnection);
app.post('/api/admin/backup/run', requireWebAppUser, requireAdmin, controllers.backup.runNow);
app.post('/api/admin/backup/heartbeat', requireWebAppUser, requireAdmin, controllers.backup.heartbeatNow);
// one zip part per request; the body is the raw file
app.post('/api/admin/backup/restore', express.raw({ type: ['application/zip', 'application/octet-stream'], limit: '50mb' }), requireWebAppUser, requireAdmin, controllers.backup.restore);
app.post('/api/admin/users/:telegramId/friend', requireWebAppUser, requireAdmin, controllers.admin.setFriend);
app.delete('/api/admin/users/:telegramId/friend', requireWebAppUser, requireAdmin, controllers.admin.setFriend);
app.post('/api/admin/users/:telegramId/block', requireWebAppUser, requireAdmin, controllers.admin.setBlocked);
app.delete('/api/admin/users/:telegramId/block', requireWebAppUser, requireAdmin, controllers.admin.setBlocked);

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