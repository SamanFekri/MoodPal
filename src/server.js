const express = require('express');
const path = require('path');
const cors = require('cors');

const Mood = require('./models/mood');
const User = require('./models/user');

const controllers = require('./controllers');

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

app.get('/user/:userId/mood/emoji', controllers.embed.emojiMood);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ui', 'index.html'));
});

app.post('/auth', controllers.auth.isAuthenticated);

app.get('/user/:userId/followings', controllers.user.getFollowings);

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