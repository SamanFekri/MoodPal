# MoodPal

## What is `MoodPal` Project?
The purpose of the `MoodPal` project is to provide a Telegram bot that helps users track their moods over time. The bot allows users to select their current mood from a predefined list of moods and stores this information in a MongoDB database. The project is designed to run in a Docker environment.

* The bot is built using the Telegraf library for Telegram bot development.
* It connects to a MongoDB database to store user mood data.
* Users can interact with the bot to set their mood, get help, and receive daily reminders to track their mood.
* The bot includes middleware to save user data and handle specific tasks.
* The project uses cron jobs to send daily reminders to users to track their mood.
* The bot provides a range of moods for users to choose from, each represented by an emoji and a name.

The main files involved in the project are:
* `src/bot.js`: The main bot file that sets up the bot, connects to the database, and defines commands and callbacks.
* `src/commands/start.js`, `src/commands/set_mood.js`, `src/commands/help.js`: Command handlers for the bot.
* `src/callbacks/saveMood.js`: Callback handler for saving user moods.
* `src/constants/mood.constant.js`, `src/constants/msg.constant.js`: Constants used in the bot.
* `src/middlewares/user.middleware.js`, `src/middlewares/olaf.middleware.js`: Middleware for handling user data and specific tasks.
* `src/models/mood.js`, `src/models/user.js`: Mongoose models for mood and user data.
* `src/db.js`: Database connection setup.