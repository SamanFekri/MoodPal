# Graph Report - MoodPal  (2026-10-04)

## Corpus Check
- 118 files · ~689,470 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1159 nodes · 1770 edges · 70 communities (59 shown, 11 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 228 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7b0e0870`
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
- join.middleware.js
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
- mood.constant.js
- TgsElement
- commands/personality.js
- friend-moods.test.js
- server.js
- fetchAdmin
- commands/mood.js
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
- export.test.js
- formatWhen
- closeSheet
- controllers/index.js
- commands/share.js
- ChatService
- on_text.js
- menu.test.js
- chat/service.js
- Cache
- models/mood.js
- common.constant.js
- app_config.js
- moods.js
- controllers/reminders.js
- .getTest
- menu.middleware.js
- export.js
- controllers/user.js

## God Nodes (most connected - your core abstractions)
1. `PersonalityService` - 24 edges
2. `api (fetch helper)` - 19 edges
3. `MoodPal Mini App (Vue root)` - 14 edges
4. `MemoryService` - 12 edges
5. `error()` - 10 edges
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
- `removeOpenAIKeyCommand()` --indirect_call--> `error()`  [INFERRED]
  src/commands/openai_key.js → test/runtime/resilience.test.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Staleness-gated tab data loading** — src_public_ui_index_settab, src_public_ui_index_isstale, src_public_ui_index_watchactivation, src_public_ui_index_ensureloaded, src_public_ui_index_fetchfriends, src_public_ui_index_fetchpersonality, src_public_ui_index_fetchadmin, src_public_ui_index_fetchlogs, src_public_ui_index_fetchsettings [EXTRACTED 1.00]
- **In-app personality test session flow** — src_public_ui_index_fetchquizsession, src_public_ui_index_starttest, src_public_ui_index_openquiz, src_public_ui_index_answer, src_public_ui_index_cancelquiz, src_public_ui_index_closequiz, readme_personality_tests [EXTRACTED 1.00]
- **TGS sticker rendering pipeline** — readme_tgs_embed, src_public_ui_index_self_hosted_libs, src_public_ui_index_waitfortgsplayer, src_public_ui_index_mountstickers, src_public_ui_index_destroystickers [INFERRED 0.95]
- **MoodPal Brand Identity System** — src_public_logo_brand_mark, src_public_logo_smiley_face_motif, src_public_logo_flat_minimal_style, src_public_logo_mood_visual_identity [INFERRED 0.75]

## Communities (70 total, 11 thin omitted)

### Community 0 - "talk.test.js"
Cohesion: 0.12
Nodes (15): assert, { CHAT_IDLE_MINUTES }, chatService, ChatSession, db, { ensurePersonalityCatalog }, handleTextMessage, last() (+7 more)

### Community 1 - "dependencies"
Cohesion: 0.04
Nodes (46): adm-zip, canvas, chart.js, chartjs-node-canvas, cors, crypto, crypto-js, dotenv (+38 more)

### Community 2 - "report.js"
Cohesion: 0.08
Nodes (36): buildVideoFromFrames(), crypto, ensureDirSync(), ffmpegPath, formatDateRangeLabel(), fs, generateMorphFrames(), generateReport() (+28 more)

### Community 3 - "msg.constant.js"
Cohesion: 0.05
Nodes (5): backupDoneMsg(), formatBytes(), helpMsg(), welocmeMsg(), SERVER_BASE_URL

### Community 4 - "talk.js"
Cohesion: 0.22
Nodes (15): chatService, endTalkCommand(), handleTalkMessage(), learnFromSession(), llm, mainKeyboard(), { msgs, common }, personalityService (+7 more)

### Community 5 - "bot.js"
Cohesion: 0.06
Nodes (35): { backupNowCommand }, backupScheduler, blockMiddleware, bot, BOT_COMMANDS, broadcastService, connectDB, { createShareLinkCommand, shareCallback } (+27 more)

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
Cohesion: 0.12
Nodes (14): assert, db, { ensurePersonalityCatalog }, mongoose, PersonalityObservation, PersonalityProfile, { PersonalityService }, PersonalityTest (+6 more)

### Community 11 - "constants/index.js"
Cohesion: 0.12
Nodes (10): { msgs }, commonConstant, moodConstants, msgConstants, personalityConstant, reportConstants, serverConstant, shareConstants (+2 more)

### Community 12 - "join.middleware.js"
Cohesion: 0.25
Nodes (5): Cache, joinButton, Cache, olafCaption(), olafMiddleware()

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
Cohesion: 0.07
Nodes (23): check(), describe(), isNetworkError(), markError(), markOk(), NETWORK_CODES, redact(), state (+15 more)

### Community 18 - "migrate.js"
Cohesion: 0.17
Nodes (10): mongoose, personalityTestSchema, mongoose, personalityTestQuestionSchema, ensurePersonalityCatalog(), PersonalityTest, PersonalityTestQuestion, PersonalityTrait (+2 more)

### Community 19 - "backup/service.js"
Cohesion: 0.27
Nodes (12): AdmZip, AppConfig, buildParts(), crypto, { EJSON }, EXCLUDED_COLLECTIONS, { GotYouBroClient }, listBackupCollections() (+4 more)

### Community 20 - "Personality Profile"
Cohesion: 0.23
Nodes (12): Gradual Profile Evolution, Mood Tracking, MoodPal, Compact Personality Context for AI Replies, Personality Profile, Risk Screening and Crisis Footer, Settings Tab, Talk AI Companion (+4 more)

### Community 21 - "models/user.js"
Cohesion: 0.15
Nodes (7): User, { isDataAuthenticated }, User, { encrypt, decrypt }, mongoose, User, userSchema

### Community 22 - "personality/service.js"
Cohesion: 0.14
Nodes (10): mongoose, personalityObservationSchema, mongoose, personalityProfileSchema, { buildPersonalityContext, formatProfileSummary }, Cache, catalogCache, PersonalityTrait (+2 more)

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

### Community 31 - "mood.constant.js"
Cohesion: 0.29
Nodes (6): MOOD_CODES, MOOD_EMOJIS, MOOD_INLINE_KEYBOARD, MOOD_MAP, MOOD_NAMES, MOODS

### Community 33 - "commands/personality.js"
Cohesion: 0.36
Nodes (12): answerCallback(), continueTest(), myPersonalityCommand(), { personality: msgs }, personalityService, personalityTestCommand(), profileCallback(), renderQuestion() (+4 more)

### Community 34 - "friend-moods.test.js"
Cohesion: 0.18
Nodes (9): app, { app }, assert, cryptoJs, db, Mood, Share, { test, describe, before, after, beforeEach } (+1 more)

### Community 35 - "server.js"
Cohesion: 0.18
Nodes (9): controllers, cors, express, listenServer(), mbti, Mood, path, { requireWebAppUser, requireAdmin } (+1 more)

### Community 36 - "fetchAdmin"
Cohesion: 0.33
Nodes (7): Admin Tab, Follow System, addFriend, fetchAdmin, searchAdmin, setupMainButton, TRAIT_LEVELS filter buckets

### Community 37 - "commands/mood.js"
Cohesion: 0.16
Nodes (12): { keyboard }, { logTelegramError }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, { MOOD_MAP }, saveMood(), setMoodCommand(), removeOpenAIKeyCommand() (+4 more)

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
Cohesion: 0.14
Nodes (16): escapeRegex(), followGraph(), listTraits(), listUsers(), mongoose, Mood, personalityService, PersonalityTrait (+8 more)

### Community 50 - "memory.test.js"
Cohesion: 0.14
Nodes (12): { app }, assert, chatService, cryptoJs, db, { ensurePersonalityCatalog }, memory, Mood (+4 more)

### Community 51 - "export.test.js"
Cohesion: 0.14
Nodes (11): { app }, assert, { common }, cryptoJs, db, { exportCommand }, Mood, moodExport (+3 more)

### Community 54 - "controllers/index.js"
Cohesion: 0.06
Nodes (35): AppConfig, broadcast, cancel(), create(), fail(), test(), upload(), animatedMood() (+27 more)

### Community 55 - "commands/share.js"
Cohesion: 0.24
Nodes (9): allowShareCallback(), { logTelegramError }, { msgs }, rejectShareCallback(), Share, shareCallback(), User, { describe } (+1 more)

### Community 57 - "on_text.js"
Cohesion: 0.21
Nodes (12): { handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }, handleTextMessage(), { looksLikeOpenAIKey, saveOpenAIKey }, Mood, { msgs }, deleteUserMessage(), llm, looksLikeOpenAIKey() (+4 more)

### Community 58 - "menu.test.js"
Cohesion: 0.22
Nodes (7): assert, ChatSession, { common }, db, menuMiddleware, { test, describe, before, after, beforeEach }, User

### Community 59 - "chat/service.js"
Cohesion: 0.25
Nodes (6): ChatSession, memoryService, personalityService, RISK_ORDER, chatSessionSchema, mongoose

### Community 61 - "models/mood.js"
Cohesion: 0.25
Nodes (7): crypto, isAuthenticated(), isDataAuthenticated(), Mood, User, mongoose, moodSchema

### Community 63 - "app_config.js"
Cohesion: 0.28
Nodes (7): appConfigSchema, { encrypt, decrypt }, mongoose, crypto, decrypt(), encrypt(), getKey()

### Community 64 - "moods.js"
Cohesion: 0.08
Nodes (21): { getTelegram }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, moodExport, buildCsv(), cell(), ExportError, { getTelegram } (+13 more)

### Community 65 - "controllers/reminders.js"
Cohesion: 0.31
Nodes (9): AppConfig, clearQueue(), getReminders(), intIn(), reminders, saveSettings(), sendTest(), time (+1 more)

### Community 67 - "menu.middleware.js"
Cohesion: 0.40
Nodes (3): chatService, { common }, User

### Community 71 - "controllers/user.js"
Cohesion: 0.14
Nodes (9): { MOOD_INLINE_KEYBOARD, msgs, share, common }, Share, User, Mood, personalityService, Share, User, mongoose (+1 more)

## Ambiguous Edges - Review These
- `MongoDB Persistence` → `External shared-network`  [AMBIGUOUS]
  docker-compose.yml · relation: conceptually_related_to
- `Docker Deployment` → `destroyStickers`  [AMBIGUOUS]
  src/public/ui/index.html · relation: conceptually_related_to

## Knowledge Gaps
- **471 isolated node(s):** `fs`, `{ Telegraf }`, `health`, `{ harden }`, `connectDB` (+466 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `MongoDB Persistence` and `External shared-network`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Docker Deployment` and `destroyStickers`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `PersonalityService` connect `PersonalityService` to `.getTest`, `service.test.js`, `personality/service.js`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `fs`, `{ Telegraf }`, `health` to the rest of the system?**
  _471 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `talk.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `report.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08097165991902834 - nodes in this community are weakly interconnected._