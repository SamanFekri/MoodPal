# MoodPal 🎭

MoodPal is your personal mood tracking companion on Telegram that helps you understand and monitor your emotional well-being over time. With an intuitive interface and powerful features, MoodPal makes emotional self-awareness simple and engaging.

<div align="center">
<h3 style="display: inline-block">Creator's Current Mood</h3>&nbsp;&nbsp;<img src="https://moodpal.samanfekri.me/user/82768138/mood/animated" width="64" height="64" alt="Creator's Mood" style="vertical-align: middle" />
</div>

## 🌟 Features

### Core Features
- **Mood Tracking**: Select your mood from a diverse range of emojis and descriptions
- **Daily Reminders**: Customizable notifications to help you maintain consistent tracking

### Embed Your Mood
Want to display your current mood on your website or blog? Use our animated mood display:
```html
<img src="https://moodpal.samanfekri.me/user/${id}/mood/animated" />
```
To get your personal embed code:
1. Open MoodPal bot on Telegram
2. Send the `/set_public` command
3. The bot will provide you with your personalized embed code ready to use

Simply paste the provided code into your website or blog to get a live, animated representation of your current mood state!

### Advanced Features
- **Mood Notes**: Add context to your mood entries with personal notes

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
