# Graph Report - MoodPal  (2026-10-08)

## Corpus Check
- 128 files · ~706,376 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1289 nodes · 1968 edges · 98 communities (76 shown, 22 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 242 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `264969c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- talk.test.js
- dependencies
- report.js
- api.test.js
- bot.js
- llm.js
- personality.constant.js
- catalog.seed.js
- settings.js
- service.test.js
- constants/index.js
- Cache
- reminders/service.js
- mbti.js
- PersonalityService
- mbti.test.js
- resilience.test.js
- migrate.js
- characteristics.test.js
- Personality Profile
- on_text.js
- personality/service.js
- MoodPal Mini App (Vue root)
- backup.test.js
- fetchFriends
- memory/service.js
- handlers.test.js
- Bot Environment Configuration
- mountStickers
- command.test.js
- mood.constant.js
- TgsElement
- talk.js
- friend-moods.test.js
- server.js
- fetchAdmin
- commands/mood.js
- commands/personality.js
- api (fetch helper)
- showToast
- backup/service.js
- helpers/db.js
- Personality Tests
- broadcast/service.js
- MoodPal Logo (Smiley Brand Mark)
- src/db.js
- controllers/backup.js
- reminders.test.js
- admin.js
- memory.test.js
- talk-learnings.test.js
- formatWhen
- closeSheet
- controllers/personality.js
- commands/share.js
- ChatService
- health.js
- menu.test.js
- chat/service.js
- build-icons.js
- controllers/index.js
- unfollow.test.js
- start.js
- export.test.js
- time.js
- devDependencies
- menu.middleware.js
- controllers/user.js
- error
- package.json
- auth.js
- scripts
- controllers/broadcast.js
- supervisor.js
- backupDoneMsg
- helpMsg
- server.constant.js
- scheduler.js
- models/user.js
- chart.js
- chartjs-node-canvas
- crypto
- dotenv
- ffmpeg-static
- mongoose
- openai
- sharp
- telegraf
- secret.js
- embed.js
- GotYouBroClient
- followback.test.js
- common.constant.js
- join.middleware.js
- app_config.js

## God Nodes (most connected - your core abstractions)
1. `PersonalityService` - 25 edges
2. `api (fetch helper)` - 19 edges
3. `MoodPal Mini App (Vue root)` - 14 edges
4. `MemoryService` - 12 edges
5. `CharacteristicsService` - 11 edges
6. `ChatService` - 10 edges
7. `error()` - 10 edges
8. `view()` - 10 edges
9. `drain()` - 9 edges
10. `app` - 9 edges

## Surprising Connections (you probably didn't know these)
- `radar (computed)` --semantically_similar_to--> `Mood Radar`  [INFERRED] [semantically similar]
  src/public/ui/index.html → README.md
- `External shared-network` --conceptually_related_to--> `MongoDB Persistence`  [AMBIGUOUS]
  docker-compose.yml → README.md
- `destroyStickers` --conceptually_related_to--> `Docker Deployment`  [AMBIGUOUS]
  src/public/ui/index.html → README.md
- `saveMood()` --indirect_call--> `error()`  [INFERRED]
  src/commands/mood.js → test/runtime/resilience.test.js
- `setMoodCommand()` --indirect_call--> `error()`  [INFERRED]
  src/commands/mood.js → test/runtime/resilience.test.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Staleness-gated tab data loading** — src_public_ui_index_settab, src_public_ui_index_isstale, src_public_ui_index_watchactivation, src_public_ui_index_ensureloaded, src_public_ui_index_fetchfriends, src_public_ui_index_fetchpersonality, src_public_ui_index_fetchadmin, src_public_ui_index_fetchlogs, src_public_ui_index_fetchsettings [EXTRACTED 1.00]
- **In-app personality test session flow** — src_public_ui_index_fetchquizsession, src_public_ui_index_starttest, src_public_ui_index_openquiz, src_public_ui_index_answer, src_public_ui_index_cancelquiz, src_public_ui_index_closequiz, readme_personality_tests [EXTRACTED 1.00]
- **TGS sticker rendering pipeline** — readme_tgs_embed, src_public_ui_index_self_hosted_libs, src_public_ui_index_waitfortgsplayer, src_public_ui_index_mountstickers, src_public_ui_index_destroystickers [INFERRED 0.95]
- **MoodPal Brand Identity System** — src_public_logo_brand_mark, src_public_logo_smiley_face_motif, src_public_logo_flat_minimal_style, src_public_logo_mood_visual_identity [INFERRED 0.75]

## Communities (98 total, 22 thin omitted)

### Community 0 - "talk.test.js"
Cohesion: 0.12
Nodes (15): assert, { CHAT_IDLE_MINUTES }, chatService, ChatSession, db, { ensurePersonalityCatalog }, handleTextMessage, last() (+7 more)

### Community 1 - "dependencies"
Cohesion: 0.15
Nodes (13): adm-zip, canvas, cors, crypto-js, express, node-cron, dependencies, adm-zip (+5 more)

### Community 2 - "report.js"
Cohesion: 0.08
Nodes (36): buildVideoFromFrames(), crypto, ensureDirSync(), ffmpegPath, formatDateRangeLabel(), fs, generateMorphFrames(), generateReport() (+28 more)

### Community 4 - "api.test.js"
Cohesion: 0.12
Nodes (13): api(), { app }, assert, cryptoJs, db, { ensurePersonalityCatalog }, Mood, personalityService (+5 more)

### Community 5 - "bot.js"
Cohesion: 0.05
Nodes (36): { backupNowCommand }, backupScheduler, blockMiddleware, bot, BOT_COMMANDS, broadcastService, connectDB, { createShareLinkCommand, shareCallback, followBackCallback } (+28 more)

### Community 6 - "llm.js"
Cohesion: 0.15
Nodes (16): analyzeCharacteristics(), analyzeMoodWeek(), chatParams(), chatReply(), createChat(), extractMemories(), humanizeReply(), inferPersonalityUpdates() (+8 more)

### Community 7 - "personality.constant.js"
Cohesion: 0.10
Nodes (7): CALLBACK, chooseTestMsg(), estimatedMinutes(), progressBar(), questionKeyboard(), questionMsg(), scaleEmoji()

### Community 8 - "catalog.seed.js"
Cohesion: 0.05
Nodes (44): CATEGORY_DEFAULTS, CATEGORY_NAMES, LIKERT_5, QUESTIONS, TEST_DEFINITIONS, TESTS, TRAIT_ROWS, TRAITS (+36 more)

### Community 9 - "settings.js"
Cohesion: 0.15
Nodes (18): getSettings(), listMemories(), llm, memory, memoryView(), PRIVACY_FIELDS, reminders, removeKey() (+10 more)

### Community 10 - "service.test.js"
Cohesion: 0.10
Nodes (16): mongoose, personalityProfileSchema, assert, db, { ensurePersonalityCatalog }, mongoose, PersonalityObservation, PersonalityProfile (+8 more)

### Community 11 - "constants/index.js"
Cohesion: 0.14
Nodes (10): { msgs }, commonConstant, moodConstants, msgConstants, personalityConstant, reportConstants, serverConstant, shareConstants (+2 more)

### Community 12 - "Cache"
Cohesion: 0.18
Nodes (4): Cache, olafCaption(), olafMiddleware(), Cache

### Community 13 - "reminders/service.js"
Cohesion: 0.10
Nodes (27): AppConfig, drain(), effectiveFor(), enqueueDue(), errorCode(), getSettings(), { getTelegram }, initPending() (+19 more)

### Community 14 - "mbti.js"
Cohesion: 0.23
Nodes (9): arms(), brows(), eyes(), head(), limb(), mouth(), neck(), prop() (+1 more)

### Community 15 - "PersonalityService"
Cohesion: 0.18
Nodes (4): PersonalityObservation, PersonalityProfile, PersonalityService, PersonalityTestSession

### Community 16 - "mbti.test.js"
Cohesion: 0.15
Nodes (10): { app }, assert, cryptoJs, db, { ensurePersonalityCatalog }, MBTI, personalityService, seed (+2 more)

### Community 17 - "resilience.test.js"
Cohesion: 0.12
Nodes (12): AppConfig, assert, backup, db, { harden }, health, launch(), netErr() (+4 more)

### Community 18 - "migrate.js"
Cohesion: 0.13
Nodes (12): mongoose, personalityTestSchema, mongoose, personalityTestQuestionSchema, mongoose, personalityTraitSchema, ensurePersonalityCatalog(), PersonalityTest (+4 more)

### Community 19 - "characteristics.test.js"
Cohesion: 0.05
Nodes (31): BY_KEY, CHARACTERISTICS, CharacteristicAnalysis, { CHARACTERISTICS, BY_KEY }, CharacteristicsError, CharacteristicsService, list(), Mood (+23 more)

### Community 20 - "Personality Profile"
Cohesion: 0.23
Nodes (12): Gradual Profile Evolution, Mood Tracking, MoodPal, Compact Personality Context for AI Replies, Personality Profile, Risk Screening and Crisis Footer, Settings Tab, Talk AI Companion (+4 more)

### Community 21 - "on_text.js"
Cohesion: 0.21
Nodes (12): { handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }, handleTextMessage(), { looksLikeOpenAIKey, saveOpenAIKey }, Mood, { msgs }, deleteUserMessage(), llm, looksLikeOpenAIKey() (+4 more)

### Community 22 - "personality/service.js"
Cohesion: 0.15
Nodes (10): mongoose, personalityObservationSchema, { buildPersonalityContext, formatProfileSummary }, Cache, catalogCache, PersonalityTest, PersonalityTestQuestion, PersonalityTrait (+2 more)

### Community 23 - "MoodPal Mini App (Vue root)"
Cohesion: 0.24
Nodes (11): Mood Categories, Mood Radar, hideSplash, loadPublic, MoodPal Mini App (Vue root), MOOD_HUES / CATEGORY_HUES, PersonalityView component, radar (computed) (+3 more)

### Community 24 - "backup.test.js"
Cohesion: 0.12
Nodes (12): GotYouBroError, AdmZip, AppConfig, assert, backup, db, { GotYouBroClient, GotYouBroError }, mongoose (+4 more)

### Community 25 - "fetchFriends"
Cohesion: 0.29
Nodes (11): destroyStickers, ensureLoaded, fetchFriends, fetchMe, fetchSettings, haptic, isStale, refresh (+3 more)

### Community 26 - "memory/service.js"
Cohesion: 0.15
Nodes (8): CATEGORIES, clampImportance(), clean(), MemoryService, Mood, same(), User, UserMemory

### Community 27 - "handlers.test.js"
Cohesion: 0.14
Nodes (10): mongoose, personalityTestSessionSchema, assert, db, { ensurePersonalityCatalog }, handlers, personalityService, PersonalityTestSession (+2 more)

### Community 28 - "Bot Environment Configuration"
Cohesion: 0.29
Nodes (10): bot service (docker-compose), Bot Environment Configuration, Host 8080 Port Mapping, External shared-network, Cron Scheduling, Docker Deployment, MongoDB Persistence, Technical Stack (+2 more)

### Community 29 - "mountStickers"
Cohesion: 0.29
Nodes (10): mood-pal Custom Element, Public/Private Mood Visibility, TGS Telegram Sticker Embed, Animated WebP Mood Embed, fetchLogs, loadMoreMoods, mountStickers, openAdminUser (+2 more)

### Community 30 - "command.test.js"
Cohesion: 0.14
Nodes (12): backupNowCommand(), backupService, { msgs, common }, AppConfig, assert, { backupNowCommand }, backupService, { common } (+4 more)

### Community 31 - "mood.constant.js"
Cohesion: 0.29
Nodes (6): MOOD_CODES, MOOD_EMOJIS, MOOD_INLINE_KEYBOARD, MOOD_MAP, MOOD_NAMES, MOODS

### Community 33 - "talk.js"
Cohesion: 0.24
Nodes (14): chatService, endTalkCommand(), handleTalkMessage(), learnFromSession(), llm, mainKeyboard(), { msgs, common }, respond() (+6 more)

### Community 34 - "friend-moods.test.js"
Cohesion: 0.18
Nodes (9): app, { app }, assert, cryptoJs, db, Mood, Share, { test, describe, before, after, beforeEach } (+1 more)

### Community 35 - "server.js"
Cohesion: 0.14
Nodes (11): mongoose, moodSchema, controllers, cors, express, listenServer(), mbti, Mood (+3 more)

### Community 36 - "fetchAdmin"
Cohesion: 0.33
Nodes (7): Admin Tab, Follow System, addFriend, fetchAdmin, searchAdmin, setupMainButton, TRAIT_LEVELS filter buckets

### Community 37 - "commands/mood.js"
Cohesion: 0.24
Nodes (8): { keyboard }, { logTelegramError }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, { MOOD_MAP }, saveMood(), { describe }, logTelegramError()

### Community 38 - "commands/personality.js"
Cohesion: 0.36
Nodes (12): answerCallback(), continueTest(), myPersonalityCommand(), { personality: msgs }, personalityService, personalityTestCommand(), profileCallback(), renderQuestion() (+4 more)

### Community 39 - "api (fetch helper)"
Cohesion: 0.52
Nodes (7): answer, api (fetch helper), cancelQuiz, closeQuiz, fetchPersonality, fetchQuizSession, removeKey

### Community 40 - "showToast"
Cohesion: 0.40
Nodes (6): Public Personality Link (/p/<token>), copyLink, sharePersonality, shareUrl, showToast, toggleSharing

### Community 41 - "backup/service.js"
Cohesion: 0.27
Nodes (12): AdmZip, AppConfig, buildParts(), crypto, { EJSON }, EXCLUDED_COLLECTIONS, { GotYouBroClient }, listBackupCollections() (+4 more)

### Community 43 - "Personality Tests"
Cohesion: 0.50
Nodes (4): Personality Catalog Seeding, Personality Tests, openQuiz, startTest

### Community 44 - "broadcast/service.js"
Cohesion: 0.05
Nodes (45): AppConfig, audienceCount(), audienceFilter(), Broadcast, BroadcastDelivery, BroadcastInputError, create(), drain() (+37 more)

### Community 45 - "MoodPal Logo (Smiley Brand Mark)"
Cohesion: 0.83
Nodes (4): MoodPal Logo (Smiley Brand Mark), Flat Minimal Icon Style (White Disc on Blue Field), Mood-Centred Visual Identity, Smiley Face Motif

### Community 47 - "controllers/backup.js"
Cohesion: 0.20
Nodes (7): AppConfig, backupService, getSettings(), { GotYouBroClient }, saveSettings(), scheduler, view()

### Community 48 - "reminders.test.js"
Cohesion: 0.08
Nodes (26): buttons(), fmt(), reminders, remindersCommand(), setAndConfirm(), time, timezoneCallback(), timezoneCommand() (+18 more)

### Community 49 - "admin.js"
Cohesion: 0.11
Nodes (17): CHARACTERISTICS_ERRORS, characteristicsService, escapeRegex(), followGraph(), listTraits(), listUsers(), mongoose, Mood (+9 more)

### Community 50 - "memory.test.js"
Cohesion: 0.14
Nodes (12): { app }, assert, chatService, cryptoJs, db, { ensurePersonalityCatalog }, memory, Mood (+4 more)

### Community 51 - "talk-learnings.test.js"
Cohesion: 0.11
Nodes (15): { app }, assert, chatService, ChatSession, cryptoJs, db, { ensurePersonalityCatalog }, MBTI (+7 more)

### Community 54 - "controllers/personality.js"
Cohesion: 0.18
Nodes (11): answer(), crypto, getMine(), getSession(), personalityService, publicUrl(), sessionView(), setSharing() (+3 more)

### Community 55 - "commands/share.js"
Cohesion: 0.26
Nodes (11): allowShareCallback(), createShareLinkCommand(), followBackCallback(), isSharing(), { logTelegramError }, { msgs, share }, rejectShareCallback(), requestToFollow() (+3 more)

### Community 57 - "health.js"
Cohesion: 0.20
Nodes (10): check(), describe(), isNetworkError(), markError(), markOk(), NETWORK_CODES, redact(), state (+2 more)

### Community 58 - "menu.test.js"
Cohesion: 0.22
Nodes (7): assert, ChatSession, { common }, db, menuMiddleware, { test, describe, before, after, beforeEach }, User

### Community 59 - "chat/service.js"
Cohesion: 0.22
Nodes (7): ChatSession, memoryService, personalityService, RISK_ORDER, User, chatSessionSchema, mongoose

### Community 60 - "build-icons.js"
Cohesion: 0.25
Nodes (6): file, fs, icons, lucide, NAMES, path

### Community 61 - "controllers/index.js"
Cohesion: 0.18
Nodes (10): admin, auth, backup, broadcast, embed, mood, personality, reminders (+2 more)

### Community 62 - "unfollow.test.js"
Cohesion: 0.12
Nodes (17): friendsCallback(), friendsCommand(), nameOf(), Share, User, view(), mongoose, shareSchema (+9 more)

### Community 63 - "start.js"
Cohesion: 0.50
Nodes (3): { MOOD_INLINE_KEYBOARD, msgs, share, common }, Share, User

### Community 64 - "export.test.js"
Cohesion: 0.05
Nodes (34): exportCommand(), moodExport, { getTelegram }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, moodExport, buildCsv(), cell() (+26 more)

### Community 65 - "time.js"
Cohesion: 0.12
Nodes (26): AppConfig, clearQueue(), getReminders(), intIn(), reminders, saveSettings(), sendTest(), time (+18 more)

### Community 66 - "devDependencies"
Cohesion: 0.29
Nodes (7): lucide, mongodb-memory-server, nodemon, devDependencies, lucide, mongodb-memory-server, nodemon

### Community 67 - "menu.middleware.js"
Cohesion: 0.40
Nodes (3): chatService, { common }, User

### Community 68 - "controllers/user.js"
Cohesion: 0.22
Nodes (7): Mood, personalityService, removeFollower(), Share, unfollow(), User, userByTelegramId()

### Community 69 - "error"
Cohesion: 0.33
Nodes (6): setMoodCommand(), removeOpenAIKeyCommand(), { msgs, common }, setMoodPrivate(), setMoodPublic(), error()

### Community 70 - "package.json"
Cohesion: 0.33
Nodes (5): description, main, name, packageManager, version

### Community 71 - "auth.js"
Cohesion: 0.20
Nodes (7): crypto, isAuthenticated(), isDataAuthenticated(), Mood, User, { isDataAuthenticated }, User

### Community 72 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, dev, icons, migrate:personality, start, test

### Community 73 - "controllers/broadcast.js"
Cohesion: 0.29
Nodes (8): AppConfig, broadcast, cancel(), create(), fail(), resend(), test(), upload()

### Community 78 - "scheduler.js"
Cohesion: 0.33
Nodes (8): AppConfig, cron, reschedule(), { runBackup, sendHeartbeat }, stop(), timeToCron(), runBackup(), sendHeartbeat()

### Community 79 - "models/user.js"
Cohesion: 0.25
Nodes (5): User, { encrypt, decrypt }, mongoose, User, userSchema

### Community 90 - "secret.js"
Cohesion: 0.60
Nodes (4): crypto, decrypt(), encrypt(), getKey()

### Community 91 - "embed.js"
Cohesion: 0.36
Nodes (7): animatedMood(), emojiMood(), getMoodOfUser(), Mood, path, tgsMood(), User

### Community 93 - "followback.test.js"
Cohesion: 0.22
Nodes (6): assert, db, Share, { shareCallback, followBackCallback }, { test, describe, before, after, beforeEach }, User

### Community 97 - "app_config.js"
Cohesion: 0.50
Nodes (3): appConfigSchema, { encrypt, decrypt }, mongoose

## Ambiguous Edges - Review These
- `MongoDB Persistence` → `External shared-network`  [AMBIGUOUS]
  docker-compose.yml · relation: conceptually_related_to
- `Docker Deployment` → `destroyStickers`  [AMBIGUOUS]
  src/public/ui/index.html · relation: conceptually_related_to

## Knowledge Gaps
- **539 isolated node(s):** `AppConfig`, `User`, `Broadcast`, `BroadcastDelivery`, `{ getTelegram }` (+534 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `MongoDB Persistence` and `External shared-network`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Docker Deployment` and `destroyStickers`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `PersonalityService` connect `PersonalityService` to `service.test.js`, `personality/service.js`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `ChatService` connect `ChatService` to `chat/service.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `AppConfig`, `User`, `Broadcast` to the rest of the system?**
  _539 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `talk.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `report.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08097165991902834 - nodes in this community are weakly interconnected._