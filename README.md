# MoodPal 🎭

MoodPal is your personal mood tracking companion on Telegram that helps you understand and monitor your emotional well-being over time. With an intuitive interface and powerful features, MoodPal makes emotional self-awareness simple and engaging.

<div align="center">
<h3 style="display: inline-block">Creator's Current Mood</h3>&nbsp;&nbsp;<img src="https://moodpal.samanfekri.me/user/82768138/mood/animated" width="64" height="64" alt="Creator's Mood" style="vertical-align: middle" />
</div>

## 🌟 Features

### Core Features
- **Mood Tracking**: Select your mood from a diverse range of emojis (18 different moods) and descriptions
- **Daily Reminders**: notifications to help you maintain consistent tracking
- **Mood Notes**: Add personal context to each mood entry
- **Privacy Controls**: Toggle between public and private mood visibility

### Analytics & Insights
- **Mood Radar**: Visual representation of your emotional patterns using radar charts
- **Time-based Reports**: Analyze your mood patterns over different time periods
- **Mood Categories**: Smart categorization of moods into 6 main categories:
  - Positive (Happy, Relaxed, Excited)
  - Motivated (Motivated, Naughty, Confused)
  - Anxious (Anxious, Overthinking, Nervous)
  - Negative (Disappointed, Sad, Overwhelmed)
  - Drained (Tired, Sick, Angry)
  - Calm (Neutral, Uncertain, Bored)

### Social Features
- **Mood Sharing**: Share your mood updates with friends
- **Follow System**: Connect with and follow other users' mood journeys
- **Community Channel**: Join the MoodPals community for support and interaction

### Embed Your Mood
Want to display your current mood on your website or blog? Use our animated mood display:
#### Webp
This method returns a webp file which could be heavy
```html
<img src="https://moodpal.samanfekri.me/user/${id}/mood/animated" />
```
#### Telegram animated sticker
```html
<!-- First, include the tgs-player.js script -->
<script src="https://moodpal.samanfekri.me/public/lib/tgs-player.js"></script>

<!-- Then use the mood-pal tag to display your TGS animation -->
<mood-pal src="https://moodpal.samanfekri.me/user/${id}/mood/tgs" class="yourclasses"></mood-pal>
```

The mood-pal element supports the following attributes:
- `src`: Path to your TGS animation file
- `class`: CSS class for styling the container

TGS (Telegram Sticker) format is a lightweight and faster alternative to WebP animations. It uses Lottie animations compressed with gzip, making it:
- Smaller file size compared to WebP
- Faster loading times
- Better performance on mobile devices
- Smoother animations
- Lower bandwidth usage

---
To get your personal embed code:
1. Open MoodPal bot on Telegram
2. Send the `/set_public` command
3. The bot will provide you with your personalized embed code ready to use

Available embed options:
- **Animated Mood**: Dynamic (WebP, TGS) animation of your current mood
  - WebP: Traditional animated image format
  - TGS: Lightweight Telegram sticker format (recommended)
- **Emoji Display**: Simple emoji representation of your mood state

Simply paste the provided code into your website or blog to get a live representation of your current mood state!

### 🧠 Personality Profile
- **Personality Tests** (`🧠 Personality Test` / `/personality_test`): six interactive one-question-at-a-time tests. Big Five (Mini-IPIP), Communication style, Thinking & decision style, Conversation & emotional style, Behavioral preferences, and Big Five facets (in depth). Progress is saved; you can cancel, continue or start over, and completed tests are marked ✅.
- **My Personality** (`🧠 My Personality` / `/my_personality`): view your profile, retake the test or reset the profile.
- **Evolves over time**: with your own OpenAI key set, your weekly mood notes are analysed and the profile is adjusted *gradually* (small, validated, bounded updates). Big Five traits are slow-changing; communication preferences adapt faster.
- AI replies use a compact personality context to adapt tone and length. It is never revealed unless you ask for your profile.
- ⚠️ This is an approximate self-report profile, **not a clinical or medical diagnosis**.

- **In the mini app**: a *Personality* tab shows your profile as an animated radar and trait bars, lists the tests, and lets you **share** it. Friends who follow your mood can tap your card to see it, and a public link (`/p/<token>`) shows a standalone card to anyone. Sharing is off by default.

### 💬 Talk
`💬 Talk` / `/talk` starts a supportive conversation with the AI companion, which responds the way a warm, experienced psychologist would: reflecting, asking one gentle question at a time, offering small realistic ideas. It also quietly screens every message for risk (self-harm, panic, hopelessness, …). On medium/high risk the reply focuses on immediate safety and adds a crisis footer.

Important, and stated to the user before every conversation:
- it is an **AI bot**, not a human and **not a therapist**; it can be **wrong** and is not accurate;
- it is **not** therapy, medical advice or a diagnosis;
- it runs on the **user's own OpenAI key** (`/set_openai_key`); messages are sent to OpenAI and stored so the chat has context.

Mood notes keep working exactly as before: outside a conversation, text is saved as a note (with a *💬 Talk about it* button). `🛑 End talk` / `/end_talk` ends the conversation (it also ends after 2 idle hours). What the user said is then used to gradually refine their personality profile.

### 🛡️ Admin
An admin can see every user in the mini app's *Admin* tab, most recently active first and paginated, with their latest mood and note, a search box, and a personality filter (any trait × low/mid/high). Tapping a user shows their personality radar (regardless of their sharing setting), their paginated mood/notes history, and lets the admin add or remove them as a friend. Admins are chosen by hand in the database:
```js
db.users.updateOne({ id: <telegram user id> }, { $set: { is_admin: true } })
```

The trait catalog, tests and questions live in the database (`personality_traits`, `personality_tests`, `personality_test_questions`) and are seeded automatically at start-up or with:
```bash
yarn migrate:personality
```
New traits or tests can be added by inserting documents into those collections (or extending `src/personality/catalog.seed.js` and bumping `version`).

## 🛠 Technical Stack
- **Bot Framework**: Built with Telegraf.js for reliable Telegram integration
- **Database**: MongoDB for robust data persistence
- **Containerization**: Docker for easy deployment and scaling
- **Security**: Implements best practices for data protection
- **Scheduling**: Cron jobs for automated reminders and analytics

## 📁 Project Structure
```
src/
├── bot.js                 # Main bot initialization
├── commands/             # Command handlers
│   ├── start.js
│   ├── set_mood.js
│   ├── help.js
│   └── analytics.js
├── callbacks/           # Callback handlers
│   ├── saveMood.js
│   └── moodAnalytics.js
├── constants/          # Application constants
├── middlewares/        # Custom middlewares
├── models/            # Database models
└── db.js              # Database configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Docker (optional)
- Telegram Bot Token

### Installation
1. Clone the repository
```bash
git clone https://github.com/yourusername/moodpal.git
cd moodpal
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the bot
```bash
npm start
```

### Docker Deployment
```bash
docker-compose up -d
```

### Tests
```bash
yarn test
```
Uses Node's built-in test runner and an in-memory MongoDB (set `MONGODB_TEST_URI` to use a real server instead).

## 🤝 Contributing
We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📱 Community
Join our [MoodPals Community](https://t.me/MoodPals) on Telegram to:
- Share your experience
- Get support
- Suggest new features
- Connect with other users

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments
- Thanks to all contributors who have helped shape MoodPal
- Special thanks to the Telegraf.js team for their excellent framework
- Our amazing community of users for their feedback and support
