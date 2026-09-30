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
// shareable MBTI-style result (/result/ENFP): the same page, with a link preview for that character
const mbti = require('./public/ui/mbti');
let miniAppHtml = null;
app.get('/result/:type', (req, res) => {
  const type = String(req.params.type || '').toUpperCase();
  if (!mbti.isType(type)) return miniApp(req, res);
  miniAppHtml ||= require('fs').readFileSync(path.join(__dirname, 'public', 'ui', 'index.html'), 'utf8');
  const c = mbti.CHARACTERS[type];
  const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const title = `${type} — ${c.title} · MoodPal`;
  const description = `${c.name}: ${c.tagline} Which MBTI character are you?`;
  const meta = [
    `<meta name="description" content="${attr(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(description)}">`,
    `<meta name="moodpal-bot" content="${attr(process.env.BOT_USERNAME || '')}">`,
  ].join('\n  ');
  res.type('html').send(miniAppHtml.replace('<title>Mood Pal</title>', `<title>${attr(title)}</title>\n  ${meta}`));
});

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
app.post('/api/me/settings/reminders', requireWebAppUser, controllers.settings.setReminders);
app.post('/api/me/settings/timezone', requireWebAppUser, controllers.settings.setTimezone);
app.post('/api/me/settings/privacy', requireWebAppUser, controllers.settings.setPrivacy);
app.post('/api/me/settings/memory', requireWebAppUser, controllers.settings.setMemory);
app.get('/api/me/memories', requireWebAppUser, controllers.settings.listMemories);
app.delete('/api/me/memories/:id', requireWebAppUser, controllers.settings.forgetMemory);
app.delete('/api/me/memories', requireWebAppUser, controllers.settings.forgetAllMemories);
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
app.get('/api/admin/users/:telegramId/connections', requireWebAppUser, requireAdmin, controllers.admin.userConnections);
app.get('/api/admin/traits', requireWebAppUser, requireAdmin, controllers.admin.listTraits);
app.get('/api/admin/graph', requireWebAppUser, requireAdmin, controllers.admin.followGraph);
// mood reminders
app.get('/api/admin/reminders', requireWebAppUser, requireAdmin, controllers.reminders.getReminders);
app.post('/api/admin/reminders/settings', requireWebAppUser, requireAdmin, controllers.reminders.saveSettings);
app.post('/api/admin/reminders/test', requireWebAppUser, requireAdmin, controllers.reminders.sendTest);
app.post('/api/admin/reminders/clear', requireWebAppUser, requireAdmin, controllers.reminders.clearQueue);
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