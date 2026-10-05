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

- **In the mini app**: you can take every test right there (one question at a time, resume later, cancel anytime), and a *Personality* tab shows your profile as an animated radar and trait bars, lists the tests, and lets you **share** it. Friends who follow your mood can tap your card to see it, and a public link (`/p/<token>`) shows a standalone card to anyone. Sharing is off by default.

### 💬 Talk
`💬 Talk` / `/talk` starts a supportive conversation with the AI companion, which responds the way a warm, experienced psychologist would: reflecting, asking one gentle question at a time, offering small realistic ideas. It also quietly screens every message for risk (self-harm, panic, hopelessness, …). On medium/high risk the reply focuses on immediate safety and adds a crisis footer.

Important, and stated to the user before every conversation:
- it is an **AI bot**, not a human and **not a therapist**; it can be **wrong** and is not accurate;
- it is **not** therapy, medical advice or a diagnosis;
- it runs on the **user's own OpenAI key** (`/set_openai_key`); messages are sent to OpenAI and stored so the chat has context.

Mood notes keep working exactly as before: outside a conversation, text is saved as a note (with a *💬 Talk about it* button). `🛑 End talk` / `/end_talk` ends the conversation (it also ends after 2 idle hours). What the user said is then used to gradually refine their personality profile. This also happens when a conversation ends by going quiet. *Personality → Learned from your talks* lists the traits conversations have moved: each trait's current %, the total change from talks (+/−), how many talks touched it, and (only for you) the line that prompted the latest change.

### ⚙️ Settings (mini app)
A *Settings* tab lets each user add their own OpenAI key (verified once, stored encrypted, shown masked) and pick the model Talk and the weekly insights use. The default is `gpt-5.6`; any model id can be typed in.

### 🕸 Follow graph
*Admin → Graph* draws who can see whose mood: one node per person (their latest mood as the emoji on a mood-tinted circle, size by how many connections they have, a dashed red ring if blocked) and an arrow from a follower to the person they watch; two-way links curve apart and are tinted purple. It's interactive: drag the background (or pinch / scroll) to pan and zoom, drag people to untangle them, find someone by name, and toggle ⇄ to keep only two-way links. Tapping someone focuses them: outgoing links turn blue, incoming green, both animate in the direction they point, everyone else dims, and a card lists both sides (tap a name to jump to them). Double-tap opens their profile. The layout is a small deterministic force simulation drawn as inline SVG, so the same data always produces the same picture and no charting library is needed. Large graphs are capped to the busiest 400 people.

**Profiles (admin).** A profile opened from *Admin* has three tabs: *Moods* (the full history with notes), *Personality*, and *Connections*. *Connections* is admin only: a small graph with the person in the middle, the people whose mood they can see on one side, the people who can see theirs on the other, and mutual links on top, followed by both lists with since-when. Tapping anyone opens their profile (with a *Back* link to retrace your steps), and *Show in the full graph* jumps to them in *Admin → Graph*. It is served by `GET /api/admin/users/:telegramId/connections`, which only admins can call; mood notes are never included.

**Characteristics (admin).** A fourth profile tab, *Insights*, has a *Calculate characteristics* button (*Recalculate* once there is one). After a confirmation, the server sends that person's personality profile, their last 150 mood check-ins with notes (in their timezone), and their Talk memory notes to OpenAI. Their name, username and ids are left out. The answer is a few characteristics picked from a fixed list of 16 (*Straight Shooter*, *Needs a Soft Landing*, *Independent*, *Planner*…), each with a confidence, the evidence behind it, how to communicate with them and an example line. It also includes an overall guide: best approach, do, avoid, and things you could say. The server keeps only catalog characteristics with evidence and at least 50% confidence, and removes any sentence with a clinical label (depression, ADHD, anxiety disorder, personality disorder…). With too little data the result is *Insufficient evidence*. A person with no data at all never reaches OpenAI. Every run is saved (`characteristic_analyses`) and earlier ones can be reopened. OpenAI is called only when an admin clicks, never when moods or notes are added. The key is `OPENAI_API_KEY` from `.env` if set, otherwise the requesting admin's own saved key; the model is `OPENAI_MODEL`, else the admin's chosen model. The key never leaves the server. Endpoints: `GET /api/admin/users/:telegramId/characteristics`, `GET …/characteristics/:analysisId`, `POST /api/admin/users/:telegramId/calculate-characteristics`.

### ⏰ Mood reminders
The bot sends each person a mood picker in their own chat with the bot, twice a day by default. The two default times come from `CRON_JOB_TIME` in `.env` (`* 7,21 * * *` → 07:00 and 21:00), in `REMINDER_TIMEZONE` / `TZ` (else UTC). In *Settings → Mood reminders* people can turn reminders off, move them, or add more (up to 5 a day unless the admin lowers the cap). Reminders fire in the person's own timezone. In the bot, `/reminders` and the 🔕 button under a reminder turn them off. A reminder is skipped if the person logged a mood in the last couple of hours.

Delivery goes through a queue (`reminder_jobs`), so a lot of people with the same time never floods Telegram. Every 30s the scheduler queues whoever is due (at most once per person and time slot). Every second the worker sends at most *send speed* messages (10/s by default). A `429` from Telegram pauses the whole queue for the time Telegram asks. A person who blocked the bot is marked *can't be reached* and isn't retried until they message the bot again. A reminder that couldn't go out within the grace window (2h) is dropped instead of arriving at an odd hour. The queue is left out of backups, and its entries expire after 14 days.

*Admin → Reminders* holds the master switch, the default times and timezone, the per-person cap (1–5), the send speed, the grace window and the "just logged" window. It also shows live queue numbers (waiting, sent, skipped with reasons, failed), the last failures, and buttons to send yourself a test reminder or drop everything waiting.

### 📥 Export my moods
Anyone can get their whole mood log as a CSV (opens in Excel, Numbers or Google Sheets): one row per mood with Date, Weekday, Time (in their own timezone), Timezone, Mood and Note, oldest first. From the bot: `/export` or the *📥 Export* keyboard button. From the mini app: *Logs → Export*. Either way the file arrives in their chat with the bot (`POST /api/me/export`). One export per minute per person.

### 🤝 Following, follow back and unfollow
When someone allows a friend to see their mood, both get a one-tap offer to share the other way (*Let Ada see my mood too* shares right away; *Ask to see Sam's mood* sends the usual Allow / Reject). Unfollowing is quiet (nobody is notified): on a friend's profile in the mini app, *Unfollow* (stop seeing their mood), *Hide my mood from …* (stop them seeing yours) and *Unfollow each other*; *Settings → Who can see my mood* lists everyone who sees yours, each with *Remove*; in the bot, `/friends` shows both lists with the same buttons. API: `DELETE /api/friends/:telegramId`, `GET /api/me/followers`, `DELETE /api/me/followers/:telegramId`.

### 📜 Friends' mood history
Opening a friend from the Friends page shows two tabs: *Mood log* (their past moods, newest first, 30 at a time) and *Personality*. Only people who follow you can see your log (`GET /api/friends/:telegramId/moods`). *Settings → Friends can see my mood history* (`is_mood_log_shared`, on by default) hides it; *Include my notes* (`is_mood_notes_shared`, off by default) decides whether your notes show with it.

### 🧠 Talk memory
Talk knows what a friend would: your personality profile, your last mood check-ins (up to 8 from the past 14 days, with their notes, in your timezone), and short notes about what matters to you. Every 6 messages, and when a conversation ends, the model reads your new messages next to the current notes and adds, updates or removes notes (on your own OpenAI key). At most 100 notes are kept (`user_memories`); when full, the least important and stalest go first. *Settings → What MoodPal remembers* shows them, lets you forget one or everything, and turns memory off (`memory_enabled`), which also stops Talk from using the notes. Talk replies are short and human, and the bot never suggests anything that could harm the user or anyone else.

### 🌍 Timezones
Everyone can set their own timezone (stored as `user.timezone`; unset means the admin's default). In *Settings → Timezone* you search by city or UTC offset (`Tehran`, `new york`, `+3:30`) and see each zone's offset and current local time, or tap *Use this device*. The mini app also fills in the device's zone the first time someone sets up reminders. In the bot, `/timezone Berlin` sets it right away; `/timezone +2` offers the matching zones as buttons, and `/timezone` alone shows the current one. Reminder times in the app read in that timezone, and admins see each person's timezone and local time on their profile.

### Which Moodling are you? (MBTI-style test)
A fun, 24-statement personality test inspired by the MBTI framework (not a scientific or clinical assessment). It is one more test in the personality catalog (`mbti`), so it runs in the mini app and in the bot like the others, and progress is saved as you go. Four traits (`mbti_extraversion`, `mbti_intuition`, `mbti_feeling`, `mbti_perceiving`, 0..1 towards E / N / F / P) give the four letters; a perfect tie leans E, N, F or P. Only the test sets them: conversations never move them.

Each of the 16 types has a cartoon character, the *Moodlings* (e.g. ENFP is Pip, The Spark). All of their data (name, title, tagline, description, strengths, tendencies, fun traits, example behaviors, colors) and their art live in `src/public/ui/mbti.js`, which the app, the server and the bot all load. The art is drawn as SVG from shared parts (body shape, eyes, mouth, headwear, prop, pose), so the cast shares one style; each character breathes, blinks and sways in a slow idle loop. Small icon characters stand in for emoji on the letters, the four groups and the result sections.

After the test the app reveals the character with confetti: the four letters with a bar per pair, strengths, tendencies, fun traits and "you, probably" behaviors, the whole cast to browse, and *Retake test*. *Share my result* uses Telegram's share sheet in the mini app and the Web Share API in a browser (else it copies the text and link); *Copy link* and *Save card* (a 1080×1350 image) are there too. The link is `/result/<TYPE>` (e.g. `/result/ENFP`): anyone can open it, it has link-preview tags for that character, and *Take the test* opens the bot with `?start=mbti`, which starts the test. The bot also sends the result and the link when someone finishes the test in chat.

*Personality → Meet the Moodlings* shows all 16 characters; tapping one opens its full card. Friends who follow your mood see your character: a type chip on your card in their Friends grid and a character card on your profile (even if the rest of your personality stays private). *Settings → Show my Moodling to friends* (`is_mbti_shared`, on by default, `POST /api/me/settings/privacy`) hides it from friends and from your public personality link; you and admins still see it. On short phones the test screen scrolls, and Telegram's swipe-to-close is paused while the test is open.

### 📣 Broadcast
*Admin → Broadcast* sends one message to every user: text, a photo, video, GIF, audio or any file (up to 50 MB), with an optional caption and link button. A file is uploaded to Telegram once, into the admin's own chat (which doubles as the preview), and everyone gets it by `file_id`. *Send test to me* delivers the exact message only to the admin. *Who gets it first* picks the send order: most recently active (default), least recently active, newest users or oldest users. Delivery goes through a queue (`broadcast_deliveries`) at a capped speed (15/s by default, set on the same screen); reminders run at 10/s beside it, and a 429 from Telegram pauses both. People who blocked the bot are skipped and marked unreachable. The screen shows live progress (sent, failed, skipped, waiting) and can stop a broadcast mid-way. The queue is left out of backups so a restore can never re-send anything.

### 💾 Backup, restore and health checks
The *Admin → Backup* sub-tab talks to [GotYouBro](https://gotyoubro.samanfekri.me/api/docs), which forwards files and alerts to Telegram.

- **Daily backup**: paste the service token (stored encrypted), pick a time of day and a timezone, and the bot uploads a backup every day. "Back up now" runs one immediately.
- **Format**: one zip per part, containing a `manifest.json` plus one NDJSON file per collection, written as MongoDB Extended JSON so ObjectIds and Dates round-trip exactly. A backup larger than 45 MB is split into several zips, each uploaded separately with its own idempotency key, and every part records `part`/`total_parts`.
- **`app_config` is never backed up**, so restoring an old dump cannot overwrite the token or the schedule.
- **Restore**: pick one or more backup zips in the same tab. *Preview* reports what would be written without touching the database; *Merge* upserts by `_id` and leaves everything else alone; *Replace* empties each collection in the backup first. A malformed file is rejected before anything is written.
- **Health check**: an on/off toggle with an interval. The bot pings the service on that schedule, and GotYouBro alerts you on Telegram if a ping is missed.

A backup contains every user's moods, notes and personality data, so treat the files and the token as sensitive.

Icons in the mini app are [Lucide](https://lucide.dev) line icons, served by the app itself: `scripts/build-icons.js` copies only the ones in use into `src/public/lib/vendor/icons.js`. To use a new one, add its name there and run `yarn icons`, then write `<ui-icon name="…">`.

### 🛡️ Admin
An admin can see every user in the mini app's *Admin* tab, paginated, with their latest mood and note and a Moodling type chip on each row. Next to the search box, *Filters* opens a sheet: status (everyone, people you follow, blocked, admins), latest mood (with or without a note), Moodling (one of the 16 characters, or anyone who took the test) and a personality trait (searchable, any/low/mid/high), with a live "Show N people" count. Active filters show as chips under the search box (tap to remove), beside a sort menu: recently active, latest mood, newest members or name A–Z. The choice is remembered on that device. API: `GET /api/admin/users?sort=&status=&notes=&mbti=&trait=&min=&max=` (`count=1` returns only the total). Tapping a user shows their personality radar (regardless of their sharing setting), their paginated mood/notes history, and lets the admin add or remove them as a friend, or **block** them. A blocked user is ignored by the bot (no handler runs for their messages) and refused by every mini app endpoint; admins cannot be blocked. Admins are chosen by hand in the database:
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
