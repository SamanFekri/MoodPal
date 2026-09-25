# Graph Report - MoodPal  (2026-09-24)

## Corpus Check
- 92 files · ~642,536 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 795 nodes · 1165 edges · 60 communities (48 shown, 12 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 126 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8cf85b10`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- talk.test.js
- dependencies
- report.js
- msg.constant.js
- talk.js
- bot.js
- models/user.js
- personality.constant.js
- context.js
- llm.js
- service.test.js
- constants/index.js
- Cache
- controllers/personality.js
- scoring.test.js
- PersonalityService
- commands/mood.js
- admin.js
- migrate.js
- evolution.test.js
- Personality Profile
- commands/personality.js
- personality/service.js
- MoodPal Mini App (Vue root)
- backup.test.js
- fetchFriends
- api.test.js
- handlers.test.js
- Bot Environment Configuration
- mountStickers
- command.test.js
- backup/service.js
- TgsElement
- controllers/backup.js
- controllers/mood.js
- server.js
- fetchAdmin
- start.js
- scheduler.js
- api (fetch helper)
- showToast
- common.constant.js
- helpers/db.js
- Personality Tests
- set_visibility.js
- MoodPal Logo (Smiley Brand Mark)
- src/db.js
- controllers/index.js
- embed.js
- catalog.seed.js
- personality_test_session.js
- personality_trait.js
- formatWhen
- closeSheet
- GotYouBroClient
- models/mood.js
- menu.middleware.js
- app_config.js
- personality_test.js
- personality_test_question.js

## God Nodes (most connected - your core abstractions)
1. `PersonalityService` - 22 edges
2. `api (fetch helper)` - 19 edges
3. `MoodPal Mini App (Vue root)` - 14 edges
4. `GotYouBroClient` - 10 edges
5. `show()` - 9 edges
6. `ChatService` - 8 edges
7. `generateWeeklyImagesForYear()` - 8 edges
8. `setTab` - 8 edges
9. `fetchFriends` - 8 edges
10. `mountStickers` - 8 edges

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

## Communities (60 total, 12 thin omitted)

### Community 0 - "talk.test.js"
Cohesion: 0.05
Nodes (28): ChatService, ChatSession, personalityService, RISK_ORDER, chatSessionSchema, mongoose, assert, ChatSession (+20 more)

### Community 1 - "dependencies"
Cohesion: 0.04
Nodes (46): adm-zip, canvas, chart.js, chartjs-node-canvas, cors, crypto, crypto-js, dotenv (+38 more)

### Community 2 - "report.js"
Cohesion: 0.09
Nodes (36): buildVideoFromFrames(), crypto, ensureDirSync(), ffmpegPath, formatDateRangeLabel(), fs, generateMorphFrames(), generateReport() (+28 more)

### Community 3 - "msg.constant.js"
Cohesion: 0.05
Nodes (5): backupDoneMsg(), formatBytes(), helpMsg(), welocmeMsg(), SERVER_BASE_URL

### Community 4 - "talk.js"
Cohesion: 0.11
Nodes (27): { handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }, handleTextMessage(), { looksLikeOpenAIKey, saveOpenAIKey }, Mood, { msgs }, deleteUserMessage(), llm, looksLikeOpenAIKey() (+19 more)

### Community 5 - "bot.js"
Cohesion: 0.07
Nodes (28): { backupNowCommand }, backupScheduler, blockMiddleware, bot, BOT_COMMANDS, connectDB, { createShareLinkCommand, shareCallback }, cron (+20 more)

### Community 6 - "models/user.js"
Cohesion: 0.11
Nodes (16): crypto, isAuthenticated(), isDataAuthenticated(), Mood, User, User, { isDataAuthenticated }, User (+8 more)

### Community 7 - "personality.constant.js"
Cohesion: 0.10
Nodes (7): CALLBACK, chooseTestMsg(), estimatedMinutes(), progressBar(), questionKeyboard(), questionMsg(), scaleEmoji()

### Community 8 - "context.js"
Cohesion: 0.14
Nodes (15): CATEGORY_NAMES, bar(), buildPersonalityContext(), { CATEGORY_NAMES }, CONTEXT_SECTIONS, describe(), formatProfileSummary(), { levelLabel } (+7 more)

### Community 9 - "llm.js"
Cohesion: 0.15
Nodes (12): getSettings(), llm, removeKey(), setKey(), setModel(), User, verify(), view() (+4 more)

### Community 10 - "service.test.js"
Cohesion: 0.12
Nodes (14): assert, db, { ensurePersonalityCatalog }, mongoose, PersonalityObservation, PersonalityProfile, { PersonalityService }, PersonalityTest (+6 more)

### Community 11 - "constants/index.js"
Cohesion: 0.12
Nodes (10): { msgs }, commonConstant, moodConstants, msgConstants, personalityConstant, reportConstants, serverConstant, shareConstants (+2 more)

### Community 12 - "Cache"
Cohesion: 0.13
Nodes (6): Cache, joinButton, Cache, olafCaption(), olafMiddleware(), Cache

### Community 13 - "controllers/personality.js"
Cohesion: 0.10
Nodes (19): allowShareCallback(), { msgs }, rejectShareCallback(), Share, shareCallback(), User, answer(), crypto (+11 more)

### Community 14 - "scoring.test.js"
Cohesion: 0.16
Nodes (10): itemScore(), LEVELS, likertMean(), METHODS, assert, bigFive, questions, { scoreTest, itemScore, levelLabel } (+2 more)

### Community 15 - "PersonalityService"
Cohesion: 0.15
Nodes (3): validateLLMUpdates(), scoreTest(), PersonalityService

### Community 16 - "commands/mood.js"
Cohesion: 0.15
Nodes (10): { keyboard }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, { MOOD_MAP }, MOOD_CODES, MOOD_EMOJIS, MOOD_INLINE_KEYBOARD, MOOD_MAP (+2 more)

### Community 17 - "admin.js"
Cohesion: 0.20
Nodes (11): escapeRegex(), listTraits(), listUsers(), Mood, personalityService, PersonalityTrait, publicUser(), Share (+3 more)

### Community 18 - "migrate.js"
Cohesion: 0.33
Nodes (6): ensurePersonalityCatalog(), PersonalityTest, PersonalityTestQuestion, PersonalityTrait, seed, upsertVersioned()

### Community 19 - "evolution.test.js"
Cohesion: 0.22
Nodes (11): applyUpdates(), blendObservation(), { clamp }, LIMITS, clamp(), assert, seed, { test, describe } (+3 more)

### Community 20 - "Personality Profile"
Cohesion: 0.23
Nodes (12): Gradual Profile Evolution, Mood Tracking, MoodPal, Compact Personality Context for AI Replies, Personality Profile, Risk Screening and Crisis Footer, Settings Tab, Talk AI Companion (+4 more)

### Community 21 - "commands/personality.js"
Cohesion: 0.39
Nodes (11): answerCallback(), continueTest(), myPersonalityCommand(), { personality: msgs }, personalityService, personalityTestCommand(), profileCallback(), renderQuestion() (+3 more)

### Community 22 - "personality/service.js"
Cohesion: 0.11
Nodes (15): mongoose, personalityObservationSchema, mongoose, personalityProfileSchema, { buildPersonalityContext, formatProfileSummary }, Cache, catalogCache, PersonalityObservation (+7 more)

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
Cohesion: 0.18
Nodes (8): assert, db, { ensurePersonalityCatalog }, handlers, personalityService, PersonalityTestSession, { test, describe, before, after, beforeEach }, User

### Community 28 - "Bot Environment Configuration"
Cohesion: 0.29
Nodes (10): bot service (docker-compose), Bot Environment Configuration, Host 8080 Port Mapping, External shared-network, Cron Scheduling, Docker Deployment, MongoDB Persistence, Technical Stack (+2 more)

### Community 29 - "mountStickers"
Cohesion: 0.29
Nodes (10): mood-pal Custom Element, Public/Private Mood Visibility, TGS Telegram Sticker Embed, Animated WebP Mood Embed, fetchLogs, loadMoreMoods, mountStickers, openAdminUser (+2 more)

### Community 30 - "command.test.js"
Cohesion: 0.14
Nodes (12): backupNowCommand(), backupService, { msgs, common }, AppConfig, assert, { backupNowCommand }, backupService, { common } (+4 more)

### Community 31 - "backup/service.js"
Cohesion: 0.24
Nodes (12): AdmZip, AppConfig, buildParts(), crypto, { EJSON }, EXCLUDED_COLLECTIONS, { GotYouBroClient }, listBackupCollections() (+4 more)

### Community 33 - "controllers/backup.js"
Cohesion: 0.20
Nodes (7): AppConfig, backupService, getSettings(), { GotYouBroClient }, saveSettings(), scheduler, view()

### Community 34 - "controllers/mood.js"
Cohesion: 0.24
Nodes (6): { getTelegram }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, requestMoodPicker(), getTelegram(), { Telegram }

### Community 35 - "server.js"
Cohesion: 0.18
Nodes (9): app, controllers, cors, express, listenServer(), Mood, path, { requireWebAppUser, requireAdmin } (+1 more)

### Community 36 - "fetchAdmin"
Cohesion: 0.33
Nodes (7): Admin Tab, Follow System, addFriend, fetchAdmin, searchAdmin, setupMainButton, TRAIT_LEVELS filter buckets

### Community 37 - "start.js"
Cohesion: 0.50
Nodes (3): { MOOD_INLINE_KEYBOARD, msgs, share, common }, Share, User

### Community 38 - "scheduler.js"
Cohesion: 0.33
Nodes (8): AppConfig, cron, reschedule(), { runBackup, sendHeartbeat }, stop(), timeToCron(), runBackup(), sendHeartbeat()

### Community 39 - "api (fetch helper)"
Cohesion: 0.52
Nodes (7): answer, api (fetch helper), cancelQuiz, closeQuiz, fetchPersonality, fetchQuizSession, removeKey

### Community 40 - "showToast"
Cohesion: 0.40
Nodes (6): Public Personality Link (/p/<token>), copyLink, sharePersonality, shareUrl, showToast, toggleSharing

### Community 43 - "Personality Tests"
Cohesion: 0.50
Nodes (4): Personality Catalog Seeding, Personality Tests, openQuiz, startTest

### Community 45 - "MoodPal Logo (Smiley Brand Mark)"
Cohesion: 0.83
Nodes (4): MoodPal Logo (Smiley Brand Mark), Flat Minimal Icon Style (White Disc on Blue Field), Mood-Centred Visual Identity, Smiley Face Motif

### Community 47 - "controllers/index.js"
Cohesion: 0.22
Nodes (8): admin, auth, backup, embed, mood, personality, settings, user

### Community 48 - "embed.js"
Cohesion: 0.36
Nodes (7): animatedMood(), emojiMood(), getMoodOfUser(), Mood, path, tgsMood(), User

### Community 49 - "catalog.seed.js"
Cohesion: 0.25
Nodes (7): CATEGORY_DEFAULTS, LIKERT_5, QUESTIONS, TEST_DEFINITIONS, TESTS, TRAIT_ROWS, TRAITS

### Community 55 - "models/mood.js"
Cohesion: 0.29
Nodes (4): Mood, Share, mongoose, moodSchema

### Community 56 - "menu.middleware.js"
Cohesion: 0.40
Nodes (3): chatService, { common }, User

### Community 57 - "app_config.js"
Cohesion: 0.50
Nodes (3): appConfigSchema, { encrypt, decrypt }, mongoose

## Ambiguous Edges - Review These
- `MongoDB Persistence` → `External shared-network`  [AMBIGUOUS]
  docker-compose.yml · relation: conceptually_related_to
- `Docker Deployment` → `destroyStickers`  [AMBIGUOUS]
  src/public/ui/index.html · relation: conceptually_related_to

## Knowledge Gaps
- **333 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+328 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `MongoDB Persistence` and `External shared-network`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Docker Deployment` and `destroyStickers`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `PersonalityService` connect `PersonalityService` to `context.js`, `service.test.js`, `personality/service.js`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `GotYouBroClient` connect `GotYouBroClient` to `backup.test.js`, `controllers/backup.js`, `backup/service.js`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _333 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `talk.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0524390243902439 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._