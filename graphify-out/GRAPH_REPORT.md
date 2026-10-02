# Graph Report - MoodPal  (2026-10-02)

## Corpus Check
- 115 files · ~687,692 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1126 nodes · 1737 edges · 66 communities (57 shown, 9 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 223 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `73b3c57b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- talk.test.js
- dependencies
- report.js
- msg.constant.js
- talk.js
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
- backup/service.js
- Personality Profile
- models/user.js
- personality/service.js
- MoodPal Mini App (Vue root)
- backup.test.js
- fetchFriends
- api.test.js
- handlers.test.js
- Bot Environment Configuration
- mountStickers
- command.test.js
- commands/mood.js
- TgsElement
- commands/personality.js
- friend-moods.test.js
- server.js
- fetchAdmin
- controllers/broadcast.js
- controllers/backup.js
- api (fetch helper)
- showToast
- scheduler.js
- helpers/db.js
- Personality Tests
- broadcast/service.js
- MoodPal Logo (Smiley Brand Mark)
- src/db.js
- GotYouBroClient
- reminders.test.js
- admin.js
- memory.test.js
- common.constant.js
- formatWhen
- closeSheet
- controllers/index.js
- commands/share.js
- ChatService
- on_text.js
- menu.test.js
- chat/service.js
- embed.js
- user.middleware.js
- app_config.js
- menu.middleware.js
- models/share.js
- models/mood.js

## God Nodes (most connected - your core abstractions)
1. `PersonalityService` - 24 edges
2. `api (fetch helper)` - 19 edges
3. `MoodPal Mini App (Vue root)` - 14 edges
4. `MemoryService` - 12 edges
5. `error()` - 11 edges
6. `view()` - 10 edges
7. `drain()` - 9 edges
8. `ChatService` - 9 edges
9. `show()` - 9 edges
10. `GotYouBroClient` - 9 edges

## Surprising Connections (you probably didn't know these)
- `radar (computed)` --semantically_similar_to--> `Mood Radar`  [INFERRED] [semantically similar]
  src/public/ui/index.html → README.md
- `External shared-network` --conceptually_related_to--> `MongoDB Persistence`  [AMBIGUOUS]
  docker-compose.yml → README.md
- `destroyStickers` --conceptually_related_to--> `Docker Deployment`  [AMBIGUOUS]
  src/public/ui/index.html → README.md
- `setMoodCommand()` --indirect_call--> `error()`  [INFERRED]
  src/commands/mood.js → test/runtime/resilience.test.js
- `saveMood()` --indirect_call--> `error()`  [INFERRED]
  src/commands/mood.js → test/runtime/resilience.test.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Staleness-gated tab data loading** — src_public_ui_index_settab, src_public_ui_index_isstale, src_public_ui_index_watchactivation, src_public_ui_index_ensureloaded, src_public_ui_index_fetchfriends, src_public_ui_index_fetchpersonality, src_public_ui_index_fetchadmin, src_public_ui_index_fetchlogs, src_public_ui_index_fetchsettings [EXTRACTED 1.00]
- **In-app personality test session flow** — src_public_ui_index_fetchquizsession, src_public_ui_index_starttest, src_public_ui_index_openquiz, src_public_ui_index_answer, src_public_ui_index_cancelquiz, src_public_ui_index_closequiz, readme_personality_tests [EXTRACTED 1.00]
- **TGS sticker rendering pipeline** — readme_tgs_embed, src_public_ui_index_self_hosted_libs, src_public_ui_index_waitfortgsplayer, src_public_ui_index_mountstickers, src_public_ui_index_destroystickers [INFERRED 0.95]
- **MoodPal Brand Identity System** — src_public_logo_brand_mark, src_public_logo_smiley_face_motif, src_public_logo_flat_minimal_style, src_public_logo_mood_visual_identity [INFERRED 0.75]

## Communities (66 total, 9 thin omitted)

### Community 0 - "talk.test.js"
Cohesion: 0.12
Nodes (15): assert, { CHAT_IDLE_MINUTES }, chatService, ChatSession, db, { ensurePersonalityCatalog }, handleTextMessage, last() (+7 more)

### Community 1 - "dependencies"
Cohesion: 0.04
Nodes (46): adm-zip, canvas, chart.js, chartjs-node-canvas, cors, crypto, crypto-js, dotenv (+38 more)

### Community 2 - "report.js"
Cohesion: 0.08
Nodes (37): buildVideoFromFrames(), crypto, ensureDirSync(), ffmpegPath, formatDateRangeLabel(), fs, generateMorphFrames(), generateReport() (+29 more)

### Community 3 - "msg.constant.js"
Cohesion: 0.05
Nodes (5): backupDoneMsg(), formatBytes(), helpMsg(), welocmeMsg(), SERVER_BASE_URL

### Community 4 - "talk.js"
Cohesion: 0.22
Nodes (15): chatService, endTalkCommand(), handleTalkMessage(), learnFromSession(), llm, mainKeyboard(), { msgs, common }, personalityService (+7 more)

### Community 5 - "bot.js"
Cohesion: 0.06
Nodes (34): { backupNowCommand }, backupScheduler, blockMiddleware, bot, BOT_COMMANDS, broadcastService, connectDB, { createShareLinkCommand, shareCallback } (+26 more)

### Community 6 - "llm.js"
Cohesion: 0.14
Nodes (15): analyzeMoodWeek(), chatParams(), chatReply(), createChat(), extractMemories(), humanizeReply(), inferPersonalityUpdates(), isReasoningModel() (+7 more)

### Community 7 - "personality.constant.js"
Cohesion: 0.10
Nodes (7): CALLBACK, chooseTestMsg(), estimatedMinutes(), progressBar(), questionKeyboard(), questionMsg(), scaleEmoji()

### Community 8 - "catalog.seed.js"
Cohesion: 0.05
Nodes (44): CATEGORY_DEFAULTS, CATEGORY_NAMES, LIKERT_5, QUESTIONS, TEST_DEFINITIONS, TESTS, TRAIT_ROWS, TRAITS (+36 more)

### Community 9 - "settings.js"
Cohesion: 0.07
Nodes (28): getSettings(), listMemories(), llm, memory, memoryView(), PRIVACY_FIELDS, reminders, removeKey() (+20 more)

### Community 10 - "service.test.js"
Cohesion: 0.10
Nodes (16): mongoose, personalityObservationSchema, assert, db, { ensurePersonalityCatalog }, mongoose, PersonalityObservation, PersonalityProfile (+8 more)

### Community 11 - "constants/index.js"
Cohesion: 0.12
Nodes (10): { msgs }, commonConstant, moodConstants, msgConstants, personalityConstant, reportConstants, serverConstant, shareConstants (+2 more)

### Community 12 - "Cache"
Cohesion: 0.13
Nodes (6): Cache, joinButton, Cache, olafCaption(), olafMiddleware(), Cache

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
Cohesion: 0.05
Nodes (35): { getTelegram }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, requestMoodPicker(), check(), describe(), isNetworkError(), markError() (+27 more)

### Community 18 - "migrate.js"
Cohesion: 0.13
Nodes (12): mongoose, personalityTestSchema, mongoose, personalityTestQuestionSchema, mongoose, personalityTraitSchema, ensurePersonalityCatalog(), PersonalityTest (+4 more)

### Community 19 - "backup/service.js"
Cohesion: 0.27
Nodes (12): AdmZip, AppConfig, buildParts(), crypto, { EJSON }, EXCLUDED_COLLECTIONS, { GotYouBroClient }, listBackupCollections() (+4 more)

### Community 20 - "Personality Profile"
Cohesion: 0.23
Nodes (12): Gradual Profile Evolution, Mood Tracking, MoodPal, Compact Personality Context for AI Replies, Personality Profile, Risk Screening and Crisis Footer, Settings Tab, Talk AI Companion (+4 more)

### Community 21 - "models/user.js"
Cohesion: 0.20
Nodes (6): { isDataAuthenticated }, User, { encrypt, decrypt }, mongoose, User, userSchema

### Community 22 - "personality/service.js"
Cohesion: 0.15
Nodes (10): mongoose, personalityProfileSchema, { buildPersonalityContext, formatProfileSummary }, Cache, catalogCache, PersonalityTest, PersonalityTestQuestion, PersonalityTrait (+2 more)

### Community 23 - "MoodPal Mini App (Vue root)"
Cohesion: 0.24
Nodes (11): Mood Categories, Mood Radar, hideSplash, loadPublic, MoodPal Mini App (Vue root), MOOD_HUES / CATEGORY_HUES, PersonalityView component, radar (computed) (+3 more)

### Community 24 - "backup.test.js"
Cohesion: 0.12
Nodes (12): GotYouBroError, AdmZip, AppConfig, assert, backup, db, { GotYouBroClient, GotYouBroError }, mongoose (+4 more)

### Community 25 - "fetchFriends"
Cohesion: 0.29
Nodes (11): destroyStickers, ensureLoaded, fetchFriends, fetchMe, fetchSettings, haptic, isStale, refresh (+3 more)

### Community 26 - "api.test.js"
Cohesion: 0.12
Nodes (13): api(), { app }, assert, cryptoJs, db, { ensurePersonalityCatalog }, Mood, personalityService (+5 more)

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

### Community 31 - "commands/mood.js"
Cohesion: 0.14
Nodes (12): { keyboard }, { logTelegramError }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, { MOOD_MAP }, setMoodCommand(), MOOD_CODES, MOOD_EMOJIS (+4 more)

### Community 33 - "commands/personality.js"
Cohesion: 0.36
Nodes (12): answerCallback(), continueTest(), myPersonalityCommand(), { personality: msgs }, personalityService, personalityTestCommand(), profileCallback(), renderQuestion() (+4 more)

### Community 34 - "friend-moods.test.js"
Cohesion: 0.18
Nodes (9): app, { app }, assert, cryptoJs, db, Mood, Share, { test, describe, before, after, beforeEach } (+1 more)

### Community 35 - "server.js"
Cohesion: 0.20
Nodes (8): controllers, cors, express, mbti, Mood, path, { requireWebAppUser, requireAdmin }, User

### Community 36 - "fetchAdmin"
Cohesion: 0.33
Nodes (7): Admin Tab, Follow System, addFriend, fetchAdmin, searchAdmin, setupMainButton, TRAIT_LEVELS filter buckets

### Community 37 - "controllers/broadcast.js"
Cohesion: 0.29
Nodes (7): AppConfig, broadcast, cancel(), create(), fail(), test(), upload()

### Community 38 - "controllers/backup.js"
Cohesion: 0.20
Nodes (7): AppConfig, backupService, getSettings(), { GotYouBroClient }, saveSettings(), scheduler, view()

### Community 39 - "api (fetch helper)"
Cohesion: 0.52
Nodes (7): answer, api (fetch helper), cancelQuiz, closeQuiz, fetchPersonality, fetchQuizSession, removeKey

### Community 40 - "showToast"
Cohesion: 0.40
Nodes (6): Public Personality Link (/p/<token>), copyLink, sharePersonality, shareUrl, showToast, toggleSharing

### Community 41 - "scheduler.js"
Cohesion: 0.33
Nodes (8): AppConfig, cron, reschedule(), { runBackup, sendHeartbeat }, stop(), timeToCron(), runBackup(), sendHeartbeat()

### Community 43 - "Personality Tests"
Cohesion: 0.50
Nodes (4): Personality Catalog Seeding, Personality Tests, openQuiz, startTest

### Community 44 - "broadcast/service.js"
Cohesion: 0.05
Nodes (44): AppConfig, audienceCount(), audienceFilter(), Broadcast, BroadcastDelivery, BroadcastInputError, create(), drain() (+36 more)

### Community 45 - "MoodPal Logo (Smiley Brand Mark)"
Cohesion: 0.83
Nodes (4): MoodPal Logo (Smiley Brand Mark), Flat Minimal Icon Style (White Disc on Blue Field), Mood-Centred Visual Identity, Smiley Face Motif

### Community 48 - "reminders.test.js"
Cohesion: 0.06
Nodes (43): buttons(), fmt(), reminders, remindersCommand(), setAndConfirm(), time, timezoneCallback(), timezoneCommand() (+35 more)

### Community 49 - "admin.js"
Cohesion: 0.17
Nodes (14): escapeRegex(), followGraph(), listTraits(), listUsers(), mongoose, Mood, personalityService, PersonalityTrait (+6 more)

### Community 50 - "memory.test.js"
Cohesion: 0.14
Nodes (12): { app }, assert, chatService, cryptoJs, db, { ensurePersonalityCatalog }, memory, Mood (+4 more)

### Community 54 - "controllers/index.js"
Cohesion: 0.06
Nodes (35): crypto, isAuthenticated(), isDataAuthenticated(), Mood, User, admin, auth, backup (+27 more)

### Community 55 - "commands/share.js"
Cohesion: 0.22
Nodes (11): saveMood(), allowShareCallback(), createShareLinkCommand(), { logTelegramError }, { msgs }, rejectShareCallback(), Share, shareCallback() (+3 more)

### Community 57 - "on_text.js"
Cohesion: 0.14
Nodes (18): { handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }, handleTextMessage(), { looksLikeOpenAIKey, saveOpenAIKey }, Mood, { msgs }, deleteUserMessage(), llm, looksLikeOpenAIKey() (+10 more)

### Community 58 - "menu.test.js"
Cohesion: 0.22
Nodes (7): assert, ChatSession, { common }, db, menuMiddleware, { test, describe, before, after, beforeEach }, User

### Community 59 - "chat/service.js"
Cohesion: 0.25
Nodes (6): ChatSession, memoryService, personalityService, RISK_ORDER, chatSessionSchema, mongoose

### Community 60 - "embed.js"
Cohesion: 0.36
Nodes (7): animatedMood(), emojiMood(), getMoodOfUser(), Mood, path, tgsMood(), User

### Community 63 - "app_config.js"
Cohesion: 0.28
Nodes (7): appConfigSchema, { encrypt, decrypt }, mongoose, crypto, decrypt(), encrypt(), getKey()

### Community 67 - "menu.middleware.js"
Cohesion: 0.40
Nodes (3): chatService, { common }, User

### Community 68 - "models/share.js"
Cohesion: 0.29
Nodes (5): { MOOD_INLINE_KEYBOARD, msgs, share, common }, Share, User, mongoose, shareSchema

### Community 71 - "models/mood.js"
Cohesion: 0.20
Nodes (6): Mood, personalityService, Share, User, mongoose, moodSchema

## Ambiguous Edges - Review These
- `MongoDB Persistence` → `External shared-network`  [AMBIGUOUS]
  docker-compose.yml · relation: conceptually_related_to
- `Docker Deployment` → `destroyStickers`  [AMBIGUOUS]
  src/public/ui/index.html · relation: conceptually_related_to

## Knowledge Gaps
- **453 isolated node(s):** `{ msgs }`, `Mood`, `{ looksLikeOpenAIKey, saveOpenAIKey }`, `{ handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }`, `mongoose` (+448 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `MongoDB Persistence` and `External shared-network`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Docker Deployment` and `destroyStickers`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `ChatService` connect `ChatService` to `chat/service.js`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `PersonalityService` connect `PersonalityService` to `service.test.js`, `personality/service.js`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `{ msgs }`, `Mood`, `{ looksLikeOpenAIKey, saveOpenAIKey }` to the rest of the system?**
  _453 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `talk.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._