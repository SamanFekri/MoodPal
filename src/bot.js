require('dotenv').config();
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const connectDB = require('./db');
const User = require('./models/user');

// Import middlewares
const saveUserMiddleware = require('./middlewares/user.middleware');

// Import commands
const startCommand = require('./commands/start');


// Connect to MongoDB
connectDB();

// Create bot instance
const bot = new Telegraf(process.env.BOT_TOKEN);

// Middlewares
// Middleware to save user data
bot.use(saveUserMiddleware);


// Set up commands
bot.command('start', startCommand);

// Handle text messages
bot.on(message('text'), async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'unknown';
    
    // Log message to database
    await User.findOneAndUpdate(
      { userId },
      { 
        userId,
        username,
        lastMessage: ctx.message.text,
        lastActivity: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Reply to the message
    ctx.reply(`Received your message: ${ctx.message.text}`);
  } catch (error) {
    console.error('Error handling message:', error);
    ctx.reply('Sorry, something went wrong');
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// Start the bot
bot.launch().then(() => {
  console.log('Bot started successfully!');
}).catch(err => {
  console.error('Failed to start bot:', err);
});