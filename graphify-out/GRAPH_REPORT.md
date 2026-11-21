# Graph Report - MoodPal  (2026-11-21)

## Corpus Check
- 165 files · ~771,027 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1763 nodes · 2917 edges · 118 communities (96 shown, 22 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 356 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b2fafc92`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- chat/talk.test.js
- dependencies
- report.js
- miniapp.test.js
- time.js
- bot.js
- llm.js
- personality.constant.js
- evolution.test.js
- settings.js
- service.test.js
- reminders.test.js
- translate.test.js
- reminders/service.js
- mbti.js
- PersonalityService
- mbti.test.js
- resilience.test.js
- context.js
- characteristics.test.js
- Personality Profile
- webapp/talk.test.js
- personality/service.js
- MoodPal Mini App (Vue root)
- backup.test.js
- fetchFriends
- nextFor
- migrate.js
- Bot Environment Configuration
- mountStickers
- command.test.js
- commands/share.js
- TgsElement
- api.test.js
- friend-moods.test.js
- models/user.js
- fetchAdmin
- commands/mood.js
- characteristics/service.js
- api (fetch helper)
- showToast
- backup/service.js
- support/service.js
- Personality Tests
- broadcast/service.js
- MoodPal Logo (Smiley Brand Mark)
- src/db.js
- controllers/backup.js
- yearly/render.js
- admin.js
- memory.test.js
- talk-learnings.test.js
- formatWhen
- closeSheet
- i18n.test.js
- models/share.js
- ChatService
- support.test.js
- commands/reminders.js
- moods.js
- build-icons.js
- controllers/index.js
- yearly/service.js
- CharacteristicsService
- export.test.js
- characteristic_analysis.js
- devDependencies
- nicknames.test.js
- language.js
- telegram.js
- package.json
- widget.js
- scripts
- controllers/mood.js
- controllers/support.js
- miniapp.js
- server.js
- catalog.seed.js
- scheduler.js
- app_config.js
- chart.js
- chartjs-node-canvas
- crypto
- dotenv
- ffmpeg-static
- mongoose
- openai
- sharp
- telegraf
- yearly.test.js
- stats.js
- GotYouBroClient
- olaf.middleware.js
- widget.test.js
- yearly.js
- join.middleware.js
- models/mood.js
- controllers/talk.js
- helpers/db.js
- catalog.js
- mood.constant.js
- controllers/broadcast.js
- openai_key.js
- controllers/user.js
- menu.test.js
- constants/index.js
- embed.js
- support_alert.js
- yearly_video.js
- support_contact.js
- user_memory.js
- i18n/index.js
- commands/talk.js
- chat/service.js
- common.constant.js

## God Nodes (most connected - your core abstractions)
1. `PersonalityService` - 25 edges
2. `api (fetch helper)` - 19 edges
3. `app` - 15 edges
4. `MoodPal Mini App (Vue root)` - 14 edges
5. `SupportContact` - 12 edges
6. `MemoryService` - 12 edges
7. `view()` - 11 edges
8. `SupportAlert` - 11 edges
9. `CharacteristicsService` - 11 edges
10. `ChatService` - 10 edges

## Surprising Connections (you probably didn't know these)
- `radar (computed)` --semantically_similar_to--> `Mood Radar`  [INFERRED] [semantically similar]
  src/public/ui/index.html → README.md
- `External shared-network` --conceptually_related_to--> `MongoDB Persistence`  [AMBIGUOUS]
  docker-compose.yml → README.md
- `destroyStickers` --conceptually_related_to--> `Docker Deployment`  [AMBIGUOUS]
  src/public/ui/index.html → README.md
- `fetchLogs` --implements--> `Mood Tracking`  [INFERRED]
  src/public/ui/index.html → README.md
- `updateMood` --implements--> `Mood Tracking`  [INFERRED]
  src/public/ui/index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Staleness-gated tab data loading** — src_public_ui_index_settab, src_public_ui_index_isstale, src_public_ui_index_watchactivation, src_public_ui_index_ensureloaded, src_public_ui_index_fetchfriends, src_public_ui_index_fetchpersonality, src_public_ui_index_fetchadmin, src_public_ui_index_fetchlogs, src_public_ui_index_fetchsettings [EXTRACTED 1.00]
- **In-app personality test session flow** — src_public_ui_index_fetchquizsession, src_public_ui_index_starttest, src_public_ui_index_openquiz, src_public_ui_index_answer, src_public_ui_index_cancelquiz, src_public_ui_index_closequiz, readme_personality_tests [EXTRACTED 1.00]
- **TGS sticker rendering pipeline** — readme_tgs_embed, src_public_ui_index_self_hosted_libs, src_public_ui_index_waitfortgsplayer, src_public_ui_index_mountstickers, src_public_ui_index_destroystickers [INFERRED 0.95]
- **MoodPal Brand Identity System** — src_public_logo_brand_mark, src_public_logo_smiley_face_motif, src_public_logo_flat_minimal_style, src_public_logo_mood_visual_identity [INFERRED 0.75]

## Communities (118 total, 22 thin omitted)

### Community 0 - "chat/talk.test.js"
Cohesion: 0.12
Nodes (15): assert, { CHAT_IDLE_MINUTES }, chatService, ChatSession, db, { ensurePersonalityCatalog }, handleTextMessage, last() (+7 more)

### Community 1 - "dependencies"
Cohesion: 0.15
Nodes (13): adm-zip, canvas, cors, crypto-js, express, node-cron, dependencies, adm-zip (+5 more)

### Community 2 - "report.js"
Cohesion: 0.08
Nodes (39): buildVideoFromFrames(), crypto, ensureDirSync(), ffmpegPath, formatDateRangeLabel(), fs, generateMorphFrames(), generateReport() (+31 more)

### Community 3 - "miniapp.test.js"
Cohesion: 0.12
Nodes (13): { app }, assert, { CHARACTERS }, cryptoJs, db, { ensurePersonalityCatalog }, fs, miniapp (+5 more)

### Community 4 - "time.js"
Cohesion: 0.12
Nodes (26): AppConfig, clearQueue(), getReminders(), intIn(), reminders, saveSettings(), sendTest(), time (+18 more)

### Community 5 - "bot.js"
Cohesion: 0.05
Nodes (42): { backupNowCommand }, backupScheduler, blockMiddleware, bot, broadcastService, connectDB, { createShareLinkCommand, shareCallback, followBackCallback }, cron (+34 more)

### Community 6 - "llm.js"
Cohesion: 0.14
Nodes (18): analyzeCharacteristics(), analyzeMoodWeek(), chatParams(), chatReply(), createChat(), extractMemories(), humanizeReply(), inferPersonalityUpdates() (+10 more)

### Community 7 - "personality.constant.js"
Cohesion: 0.05
Nodes (23): CALLBACK, chooseTestMsg(), en, estimatedMinutes(), P(), profileKeyboard(), progressBar(), questionKeyboard() (+15 more)

### Community 8 - "evolution.test.js"
Cohesion: 0.09
Nodes (22): applyUpdates(), blendObservation(), { clamp }, LIMITS, validateLLMUpdates(), clamp(), itemScore(), LEVELS (+14 more)

### Community 9 - "settings.js"
Cohesion: 0.07
Nodes (28): getSettings(), i18n, listMemories(), llm, memory, memoryView(), PRIVACY_FIELDS, reminders (+20 more)

### Community 10 - "service.test.js"
Cohesion: 0.09
Nodes (18): mongoose, personalityProfileSchema, mongoose, personalityTestQuestionSchema, assert, db, { ensurePersonalityCatalog }, mongoose (+10 more)

### Community 11 - "reminders.test.js"
Cohesion: 0.10
Nodes (15): mongoose, reminderJobSchema, { app }, AppConfig, assert, cryptoJs, db, Mood (+7 more)

### Community 12 - "translate.test.js"
Cohesion: 0.15
Nodes (13): api(), { app }, assert, cryptoJs, db, googleCalls, googleNext, llmStub (+5 more)

### Community 13 - "reminders/service.js"
Cohesion: 0.12
Nodes (23): AppConfig, clearQueue(), drain(), enqueueTest(), errorCode(), getSettings(), { getTelegram }, i18n (+15 more)

### Community 14 - "mbti.js"
Cohesion: 0.23
Nodes (9): arms(), brows(), eyes(), head(), limb(), mouth(), neck(), prop() (+1 more)

### Community 15 - "PersonalityService"
Cohesion: 0.14
Nodes (7): PersonalityObservation, PersonalityProfile, PersonalityService, PersonalityTest, PersonalityTestQuestion, PersonalityTestSession, PersonalityTrait

### Community 16 - "mbti.test.js"
Cohesion: 0.15
Nodes (10): { app }, assert, cryptoJs, db, { ensurePersonalityCatalog }, MBTI, personalityService, seed (+2 more)

### Community 17 - "resilience.test.js"
Cohesion: 0.05
Nodes (33): answer(), data(), hugCallback(), i18n, inviteAnswerCallback(), { logTelegramError }, shareCallback(), support (+25 more)

### Community 18 - "context.js"
Cohesion: 0.18
Nodes (13): bar(), buildPersonalityContext(), { CATEGORY_NAMES }, CONTEXT_SECTIONS, describe(), formatProfileSummary(), { levelLabel }, SPECIAL_LABELS (+5 more)

### Community 19 - "characteristics.test.js"
Cohesion: 0.12
Nodes (14): { app }, assert, CharacteristicAnalysis, characteristics, cryptoJs, db, { ensurePersonalityCatalog }, MBTI (+6 more)

### Community 20 - "Personality Profile"
Cohesion: 0.23
Nodes (12): Gradual Profile Evolution, Mood Tracking, MoodPal, Compact Personality Context for AI Replies, Personality Profile, Risk Screening and Crisis Footer, Settings Tab, Talk AI Companion (+4 more)

### Community 21 - "webapp/talk.test.js"
Cohesion: 0.12
Nodes (14): api(), { app }, assert, chatService, ChatSession, cryptoJs, db, { ensurePersonalityCatalog } (+6 more)

### Community 22 - "personality/service.js"
Cohesion: 0.13
Nodes (11): mongoose, personalityObservationSchema, mongoose, personalityTestSchema, mongoose, personalityTraitSchema, { buildPersonalityContext, formatProfileSummary }, Cache (+3 more)

### Community 23 - "MoodPal Mini App (Vue root)"
Cohesion: 0.24
Nodes (11): Mood Categories, Mood Radar, hideSplash, loadPublic, MoodPal Mini App (Vue root), MOOD_HUES / CATEGORY_HUES, PersonalityView component, radar (computed) (+3 more)

### Community 24 - "backup.test.js"
Cohesion: 0.12
Nodes (12): GotYouBroError, AdmZip, AppConfig, assert, backup, db, { GotYouBroClient, GotYouBroError }, mongoose (+4 more)

### Community 25 - "fetchFriends"
Cohesion: 0.29
Nodes (11): destroyStickers, ensureLoaded, fetchFriends, fetchMe, fetchSettings, haptic, isStale, refresh (+3 more)

### Community 26 - "nextFor"
Cohesion: 0.32
Nodes (8): effectiveFor(), enqueueDue(), initPending(), nextFor(), setTimezone(), tick(), updateForUser(), viewFor()

### Community 27 - "migrate.js"
Cohesion: 0.10
Nodes (16): mongoose, personalityTestSessionSchema, ensurePersonalityCatalog(), PersonalityTest, PersonalityTestQuestion, PersonalityTrait, seed, upsertVersioned() (+8 more)

### Community 28 - "Bot Environment Configuration"
Cohesion: 0.29
Nodes (10): bot service (docker-compose), Bot Environment Configuration, Host 8080 Port Mapping, External shared-network, Cron Scheduling, Docker Deployment, MongoDB Persistence, Technical Stack (+2 more)

### Community 29 - "mountStickers"
Cohesion: 0.29
Nodes (10): mood-pal Custom Element, Public/Private Mood Visibility, TGS Telegram Sticker Embed, Animated WebP Mood Embed, fetchLogs, loadMoreMoods, mountStickers, openAdminUser (+2 more)

### Community 30 - "command.test.js"
Cohesion: 0.14
Nodes (12): backupNowCommand(), backupService, i18n, AppConfig, assert, { backupNowCommand }, backupService, { common } (+4 more)

### Community 31 - "commands/share.js"
Cohesion: 0.13
Nodes (17): allowShareCallback(), createShareLinkCommand(), followBackCallback(), i18n, isSharing(), { logTelegramError }, rejectShareCallback(), requestToFollow() (+9 more)

### Community 33 - "api.test.js"
Cohesion: 0.12
Nodes (13): api(), { app }, assert, cryptoJs, db, { ensurePersonalityCatalog }, Mood, personalityService (+5 more)

### Community 34 - "friend-moods.test.js"
Cohesion: 0.18
Nodes (9): app, { app }, assert, cryptoJs, db, Mood, Share, { test, describe, before, after, beforeEach } (+1 more)

### Community 35 - "models/user.js"
Cohesion: 0.14
Nodes (11): crypto, isAuthenticated(), isDataAuthenticated(), Mood, User, { isDataAuthenticated }, User, { encrypt, decrypt } (+3 more)

### Community 36 - "fetchAdmin"
Cohesion: 0.33
Nodes (7): Admin Tab, Follow System, addFriend, fetchAdmin, searchAdmin, setupMainButton, TRAIT_LEVELS filter buckets

### Community 37 - "commands/mood.js"
Cohesion: 0.22
Nodes (8): i18n, { keyboard }, { logTelegramError }, Mood, { MOOD_MAP }, { moodKeyboard, common }, saveMood(), support

### Community 38 - "characteristics/service.js"
Cohesion: 0.20
Nodes (10): CharacteristicAnalysis, { CHARACTERISTICS, BY_KEY }, CharacteristicsError, list(), Mood, personalityService, scrub(), text() (+2 more)

### Community 39 - "api (fetch helper)"
Cohesion: 0.52
Nodes (7): answer, api (fetch helper), cancelQuiz, closeQuiz, fetchPersonality, fetchQuizSession, removeKey

### Community 40 - "showToast"
Cohesion: 0.40
Nodes (6): Public Personality Link (/p/<token>), copyLink, sharePersonality, shareUrl, showToast, toggleSharing

### Community 41 - "backup/service.js"
Cohesion: 0.27
Nodes (12): AdmZip, AppConfig, buildParts(), crypto, { EJSON }, EXCLUDED_COLLECTIONS, { GotYouBroClient }, listBackupCollections() (+4 more)

### Community 42 - "support/service.js"
Cohesion: 0.09
Nodes (53): adminView(), afterMood(), alertKeyboard(), alertText(), BOOLEANS, cancelOpen(), canReceive(), CB (+45 more)

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

### Community 48 - "yearly/render.js"
Cohesion: 0.15
Nodes (34): backOut(), clamp(), clip(), easeOut(), esc(), ffmpegPath, frameCache, hueOf() (+26 more)

### Community 49 - "admin.js"
Cohesion: 0.07
Nodes (22): CHARACTERISTICS_ERRORS, characteristicsService, escapeRegex(), followGraph(), listTraits(), listUsers(), mongoose, Mood (+14 more)

### Community 50 - "memory.test.js"
Cohesion: 0.14
Nodes (12): { app }, assert, chatService, cryptoJs, db, { ensurePersonalityCatalog }, memory, Mood (+4 more)

### Community 51 - "talk-learnings.test.js"
Cohesion: 0.11
Nodes (15): { app }, assert, chatService, ChatSession, cryptoJs, db, { ensurePersonalityCatalog }, MBTI (+7 more)

### Community 54 - "i18n.test.js"
Cohesion: 0.07
Nodes (55): answerCallback(), continueTest(), i18n, langOf(), { localizeTest, localizeQuestion, localizeCharacter }, myPersonalityCommand(), { personality: msgs }, personalityService (+47 more)

### Community 55 - "models/share.js"
Cohesion: 0.11
Nodes (18): friendsCallback(), friendsCommand(), i18n, nameOf(), Share, User, view(), mongoose (+10 more)

### Community 57 - "support.test.js"
Cohesion: 0.09
Nodes (18): api(), { app }, assert, cryptoJs, db, fakeTelegram, Mood, { MOOD_MAP } (+10 more)

### Community 58 - "commands/reminders.js"
Cohesion: 0.27
Nodes (12): buttons(), fmt(), i18n, reminders, remindersCommand(), setAndConfirm(), time, timezoneCallback() (+4 more)

### Community 59 - "moods.js"
Cohesion: 0.19
Nodes (10): buildCsv(), cell(), ExportError, { getTelegram }, i18n, lastExport, Mood, sendToChat() (+2 more)

### Community 60 - "build-icons.js"
Cohesion: 0.25
Nodes (6): file, fs, icons, lucide, NAMES, path

### Community 61 - "controllers/index.js"
Cohesion: 0.13
Nodes (14): admin, auth, backup, broadcast, embed, mood, personality, reminders (+6 more)

### Community 62 - "yearly/service.js"
Cohesion: 0.10
Nodes (31): adminView(), AppConfig, available(), bot(), deliver(), fs, { getTelegram }, isFresh() (+23 more)

### Community 64 - "export.test.js"
Cohesion: 0.14
Nodes (11): { app }, assert, { common }, cryptoJs, db, { exportCommand }, Mood, moodExport (+3 more)

### Community 65 - "characteristic_analysis.js"
Cohesion: 0.50
Nodes (3): characteristicAnalysisSchema, characteristicSchema, mongoose

### Community 66 - "devDependencies"
Cohesion: 0.29
Nodes (7): lucide, mongodb-memory-server, nodemon, devDependencies, lucide, mongodb-memory-server, nodemon

### Community 67 - "nicknames.test.js"
Cohesion: 0.14
Nodes (14): api(), { app }, assert, cryptoJs, db, Mood, { MOOD_MAP }, nick() (+6 more)

### Community 68 - "language.js"
Cohesion: 0.26
Nodes (11): botCommands(), CALLBACK_RE, COMMAND_ORDER, { common }, i18n, languageCallback(), languageCommand(), pickerKeyboard() (+3 more)

### Community 69 - "telegram.js"
Cohesion: 0.25
Nodes (8): getTelegram(), { harden }, DELAYS_MS, harden(), health, RETRYABLE, sleep(), { Telegram }

### Community 70 - "package.json"
Cohesion: 0.33
Nodes (5): description, main, name, packageManager, version

### Community 71 - "widget.js"
Cohesion: 0.09
Nodes (38): baseUrl(), crypto, disableWidget(), enableWidget(), friendCells(), friendImage(), friendsImage(), fullname() (+30 more)

### Community 72 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, dev, icons, migrate:personality, start, test

### Community 73 - "controllers/mood.js"
Cohesion: 0.18
Nodes (8): { getTelegram }, i18n, Mood, moodExport, { moodKeyboard, common }, { MOODS, MOOD_MAP }, postToChat(), setMine()

### Community 74 - "controllers/support.js"
Cohesion: 0.17
Nodes (9): addContact, answerInvitation, ERRORS, getSupport, removeContact, saveSettings, shareMood, stopSupporting (+1 more)

### Community 75 - "miniapp.js"
Cohesion: 0.18
Nodes (7): MOODS, cache, characterLists, i18n, LOCALES, { MOODS }, TABLES

### Community 76 - "server.js"
Cohesion: 0.20
Nodes (8): controllers, cors, express, listenServer(), Mood, path, { requireWebAppUser, requireAdmin }, User

### Community 77 - "catalog.seed.js"
Cohesion: 0.22
Nodes (8): CATEGORY_DEFAULTS, CATEGORY_NAMES, LIKERT_5, QUESTIONS, TEST_DEFINITIONS, TESTS, TRAIT_ROWS, TRAITS

### Community 78 - "scheduler.js"
Cohesion: 0.33
Nodes (8): AppConfig, cron, reschedule(), { runBackup, sendHeartbeat }, stop(), timeToCron(), runBackup(), sendHeartbeat()

### Community 79 - "app_config.js"
Cohesion: 0.28
Nodes (7): appConfigSchema, { encrypt, decrypt }, mongoose, crypto, decrypt(), encrypt(), getKey()

### Community 90 - "yearly.test.js"
Cohesion: 0.10
Nodes (18): api(), { app }, AppConfig, assert, Broadcast, { common }, cryptoJs, db (+10 more)

### Community 91 - "stats.js"
Cohesion: 0.18
Nodes (15): dayNumber(), GOOD, groupOf, GROUPS, HARD, localParts(), MONTHS, Mood (+7 more)

### Community 93 - "olaf.middleware.js"
Cohesion: 0.60
Nodes (5): Cache, moodsLink(), olafButtons(), olafCaption(), olafMiddleware()

### Community 94 - "widget.test.js"
Cohesion: 0.18
Nodes (12): api(), { app }, assert, cryptoJs, db, image(), Mood, Share (+4 more)

### Community 95 - "yearly.js"
Cohesion: 0.22
Nodes (5): background(), previewFor(), requestMine(), User, yearly

### Community 96 - "join.middleware.js"
Cohesion: 0.17
Nodes (5): askToJoin(), Cache, i18n, joinMiddleware(), Cache

### Community 97 - "models/mood.js"
Cohesion: 0.14
Nodes (13): mongoose, moodSchema, api(), { app }, assert, cryptoJs, db, Mood (+5 more)

### Community 98 - "controllers/talk.js"
Cohesion: 0.31
Nodes (9): chatService, endTalk(), getTalk(), llm, messageView(), sendMessage(), startTalk(), User (+1 more)

### Community 101 - "mood.constant.js"
Cohesion: 0.22
Nodes (8): setMoodCommand(), MOOD_CODES, MOOD_EMOJIS, MOOD_INLINE_KEYBOARD, MOOD_MAP, MOOD_NAMES, moodKeyboard(), requestMoodPicker()

### Community 102 - "controllers/broadcast.js"
Cohesion: 0.29
Nodes (8): AppConfig, broadcast, cancel(), create(), fail(), resend(), test(), upload()

### Community 103 - "openai_key.js"
Cohesion: 0.32
Nodes (7): deleteUserMessage(), i18n, llm, removeOpenAIKeyCommand(), saveOpenAIKey(), setOpenAIKeyCommand(), User

### Community 104 - "controllers/user.js"
Cohesion: 0.10
Nodes (18): Mood, nicknames, personalityService, removeFollower(), Share, unfollow(), User, userByTelegramId() (+10 more)

### Community 105 - "menu.test.js"
Cohesion: 0.17
Nodes (9): chatSessionSchema, mongoose, assert, ChatSession, { common }, db, menuMiddleware, { test, describe, before, after, beforeEach } (+1 more)

### Community 106 - "constants/index.js"
Cohesion: 0.10
Nodes (14): { common }, i18n, i18n, { moodKeyboard, share, common }, Share, User, commonConstant, moodConstants (+6 more)

### Community 107 - "embed.js"
Cohesion: 0.36
Nodes (7): animatedMood(), emojiMood(), getMoodOfUser(), Mood, path, tgsMood(), User

### Community 113 - "i18n/index.js"
Cohesion: 0.14
Nodes (11): i18n, dicts, en, forCtx(), forLang(), forUser(), isSupported(), LANGS (+3 more)

### Community 116 - "commands/talk.js"
Cohesion: 0.15
Nodes (21): { handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }, handleTextMessage(), i18n, { looksLikeOpenAIKey, saveOpenAIKey }, Mood, looksLikeOpenAIKey(), chatService, { common } (+13 more)

### Community 119 - "chat/service.js"
Cohesion: 0.18
Nodes (8): memoryService, personalityService, RISK_ORDER, User, chatService, { common }, i18n, User

### Community 121 - "common.constant.js"
Cohesion: 0.36
Nodes (7): i18n, makeKeyboardMenu(), MENU_BUTTONS, MENU_SIGNATURE, menuSignature(), yearButton(), yearly()

## Ambiguous Edges - Review These
- `MongoDB Persistence` → `External shared-network`  [AMBIGUOUS]
  docker-compose.yml · relation: conceptually_related_to
- `Docker Deployment` → `destroyStickers`  [AMBIGUOUS]
  src/public/ui/index.html · relation: conceptually_related_to

## Knowledge Gaps
- **770 isolated node(s):** `i18n`, `Mood`, `{ looksLikeOpenAIKey, saveOpenAIKey }`, `{ handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }`, `fs` (+765 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `MongoDB Persistence` and `External shared-network`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Docker Deployment` and `destroyStickers`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `PersonalityService` connect `PersonalityService` to `service.test.js`, `personality/service.js`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `ChatService` connect `ChatService` to `chat/service.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `GotYouBroClient` connect `GotYouBroClient` to `backup.test.js`, `controllers/backup.js`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `i18n`, `Mood`, `{ looksLikeOpenAIKey, saveOpenAIKey }` to the rest of the system?**
  _770 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `chat/talk.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._