# Graph Report - .  (2026-09-23)

## Corpus Check
- Corpus is ~42,542 words - fits in a single context window. You may not need a graph.

## Summary
- 703 nodes · 1037 edges · 54 communities (41 shown, 13 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.61)
- Token cost: 127,454 input · 0 output

## Community Hubs (Navigation)
- Talk Chat Sessions
- NPM Dependencies
- Mood Report & Video Rendering
- Bot Message Copy
- Note & OpenAI Key Text Handling
- Bot Entry Point & Wiring
- Mood API & Telegram Bridge
- Personality Bot UI Copy
- Trait Catalog & Profile Formatting
- LLM Client & Settings API
- Personality Service Tests
- Constants Barrel & Help
- Channel Join & Cache Middleware
- Personality Web API
- Scoring Logic & Tests
- Personality Test Session Flow
- Mood Picker & Mood Catalog
- Admin Web API
- Personality Catalog Migration
- Trait Evolution & Validation
- Personality Product Concepts
- Personality Bot Handlers
- Personality Service Dependencies
- Mini App Radar & Splash
- WebApp Auth & Guards
- Mini App Data Freshness
- Express Server Routes
- Personality Handler Tests
- Docker Deployment Config
- Mood Embeds & Sticker Mounting
- User Model & Key Encryption
- Personality Profile Access
- TGS Sticker Player
- Mood Sharing Commands
- Public Mood Embed Endpoints
- Controllers Barrel
- Admin Tab & Friend Adding
- Start Command & Share Model
- Followings & Mood Model
- Mini App Quiz & Fetch Helper
- Personality Link Sharing
- Keyboard Menu Definitions
- Test Database Helper
- Personality Test Entry Points
- Mood Visibility Commands
- MoodPal Brand Identity
- MongoDB Connection
- User Save Middleware
- Observation Model
- Profile Model
- Test Session Model
- Trait Model
- Time Formatting Helpers
- Sheet Close Handler

## God Nodes (most connected - your core abstractions)
1. `PersonalityService` - 22 edges
2. `api (fetch helper)` - 19 edges
3. `MoodPal Mini App (Vue root)` - 14 edges
4. `show()` - 9 edges
5. `ChatService` - 8 edges
6. `generateWeeklyImagesForYear()` - 8 edges
7. `setTab` - 8 edges
8. `fetchFriends` - 8 edges
9. `mountStickers` - 8 edges
10. `fetchAdmin` - 8 edges

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

## Communities (54 total, 13 thin omitted)

### Community 0 - "Talk Chat Sessions"
Cohesion: 0.05
Nodes (31): ChatService, ChatSession, personalityService, RISK_ORDER, chatService, { common }, User, chatSessionSchema (+23 more)

### Community 1 - "NPM Dependencies"
Cohesion: 0.04
Nodes (44): canvas, chart.js, chartjs-node-canvas, cors, crypto, crypto-js, dotenv, express (+36 more)

### Community 2 - "Mood Report & Video Rendering"
Cohesion: 0.09
Nodes (37): buildVideoFromFrames(), crypto, ensureDirSync(), ffmpegPath, formatDateRangeLabel(), fs, generateMorphFrames(), generateReport() (+29 more)

### Community 3 - "Bot Message Copy"
Cohesion: 0.05
Nodes (3): helpMsg(), welocmeMsg(), SERVER_BASE_URL

### Community 4 - "Note & OpenAI Key Text Handling"
Cohesion: 0.11
Nodes (28): { handleTalkMessage, TALK_ABOUT_NOTE_KEYBOARD }, handleTextMessage(), { looksLikeOpenAIKey, saveOpenAIKey }, Mood, { msgs }, deleteUserMessage(), llm, looksLikeOpenAIKey() (+20 more)

### Community 5 - "Bot Entry Point & Wiring"
Cohesion: 0.08
Nodes (25): bot, BOT_COMMANDS, connectDB, { createShareLinkCommand, shareCallback }, cron, { ensurePersonalityCatalog }, fs, handleTextMessage (+17 more)

### Community 6 - "Mood API & Telegram Bridge"
Cohesion: 0.09
Nodes (20): { getTelegram }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, requestMoodPicker(), getTelegram(), setTelegram(), { Telegram }, api() (+12 more)

### Community 7 - "Personality Bot UI Copy"
Cohesion: 0.10
Nodes (7): CALLBACK, chooseTestMsg(), estimatedMinutes(), progressBar(), questionKeyboard(), questionMsg(), scaleEmoji()

### Community 8 - "Trait Catalog & Profile Formatting"
Cohesion: 0.11
Nodes (19): CATEGORY_DEFAULTS, CATEGORY_NAMES, LIKERT_5, QUESTIONS, TEST_DEFINITIONS, TESTS, TRAIT_ROWS, TRAITS (+11 more)

### Community 9 - "LLM Client & Settings API"
Cohesion: 0.15
Nodes (12): getSettings(), llm, removeKey(), setKey(), setModel(), User, verify(), view() (+4 more)

### Community 10 - "Personality Service Tests"
Cohesion: 0.12
Nodes (14): assert, db, { ensurePersonalityCatalog }, mongoose, PersonalityObservation, PersonalityProfile, { PersonalityService }, PersonalityTest (+6 more)

### Community 11 - "Constants Barrel & Help"
Cohesion: 0.12
Nodes (10): { msgs }, commonConstant, moodConstants, msgConstants, personalityConstant, reportConstants, serverConstant, shareConstants (+2 more)

### Community 12 - "Channel Join & Cache Middleware"
Cohesion: 0.13
Nodes (6): Cache, joinButton, Cache, olafCaption(), olafMiddleware(), Cache

### Community 13 - "Personality Web API"
Cohesion: 0.18
Nodes (11): answer(), crypto, getMine(), getSession(), personalityService, publicUrl(), sessionView(), setSharing() (+3 more)

### Community 14 - "Scoring Logic & Tests"
Cohesion: 0.16
Nodes (11): clamp(), itemScore(), LEVELS, likertMean(), METHODS, assert, bigFive, questions (+3 more)

### Community 16 - "Mood Picker & Mood Catalog"
Cohesion: 0.15
Nodes (12): { keyboard }, Mood, { MOOD_INLINE_KEYBOARD, msgs, common }, { MOOD_MAP }, saveMood(), setMoodCommand(), MOOD_CODES, MOOD_EMOJIS (+4 more)

### Community 17 - "Admin Web API"
Cohesion: 0.21
Nodes (10): escapeRegex(), listUsers(), Mood, personalityService, PersonalityTrait, publicUser(), Share, User (+2 more)

### Community 18 - "Personality Catalog Migration"
Cohesion: 0.17
Nodes (10): mongoose, personalityTestSchema, mongoose, personalityTestQuestionSchema, ensurePersonalityCatalog(), PersonalityTest, PersonalityTestQuestion, PersonalityTrait (+2 more)

### Community 19 - "Trait Evolution & Validation"
Cohesion: 0.22
Nodes (11): applyUpdates(), blendObservation(), { clamp }, LIMITS, validateLLMUpdates(), assert, seed, { test, describe } (+3 more)

### Community 20 - "Personality Product Concepts"
Cohesion: 0.23
Nodes (12): Gradual Profile Evolution, Mood Tracking, MoodPal, Compact Personality Context for AI Replies, Personality Profile, Risk Screening and Crisis Footer, Settings Tab, Talk AI Companion (+4 more)

### Community 21 - "Personality Bot Handlers"
Cohesion: 0.39
Nodes (11): answerCallback(), continueTest(), myPersonalityCommand(), { personality: msgs }, personalityService, personalityTestCommand(), profileCallback(), renderQuestion() (+3 more)

### Community 22 - "Personality Service Dependencies"
Cohesion: 0.17
Nodes (11): { buildPersonalityContext, formatProfileSummary }, Cache, catalogCache, PersonalityObservation, PersonalityProfile, PersonalityTest, PersonalityTestQuestion, PersonalityTestSession (+3 more)

### Community 23 - "Mini App Radar & Splash"
Cohesion: 0.24
Nodes (11): Mood Categories, Mood Radar, hideSplash, loadPublic, MoodPal Mini App (Vue root), MOOD_HUES / CATEGORY_HUES, PersonalityView component, radar (computed) (+3 more)

### Community 24 - "WebApp Auth & Guards"
Cohesion: 0.24
Nodes (9): crypto, isAuthenticated(), isDataAuthenticated(), Mood, User, { isDataAuthenticated }, requireAdmin(), requireWebAppUser() (+1 more)

### Community 25 - "Mini App Data Freshness"
Cohesion: 0.29
Nodes (11): destroyStickers, ensureLoaded, fetchFriends, fetchMe, fetchSettings, haptic, isStale, refresh (+3 more)

### Community 26 - "Express Server Routes"
Cohesion: 0.18
Nodes (9): app, controllers, cors, express, listenServer(), Mood, path, { requireWebAppUser, requireAdmin } (+1 more)

### Community 27 - "Personality Handler Tests"
Cohesion: 0.18
Nodes (8): assert, db, { ensurePersonalityCatalog }, handlers, personalityService, PersonalityTestSession, { test, describe, before, after, beforeEach }, User

### Community 28 - "Docker Deployment Config"
Cohesion: 0.29
Nodes (10): bot service (docker-compose), Bot Environment Configuration, Host 8080 Port Mapping, External shared-network, Cron Scheduling, Docker Deployment, MongoDB Persistence, Technical Stack (+2 more)

### Community 29 - "Mood Embeds & Sticker Mounting"
Cohesion: 0.29
Nodes (10): mood-pal Custom Element, Public/Private Mood Visibility, TGS Telegram Sticker Embed, Animated WebP Mood Embed, fetchLogs, loadMoreMoods, mountStickers, openAdminUser (+2 more)

### Community 30 - "User Model & Key Encryption"
Cohesion: 0.29
Nodes (8): { encrypt, decrypt }, mongoose, User, userSchema, crypto, decrypt(), encrypt(), getKey()

### Community 31 - "Personality Profile Access"
Cohesion: 0.31
Nodes (3): buildPersonalityContext(), describe(), levelLabel()

### Community 33 - "Mood Sharing Commands"
Cohesion: 0.32
Nodes (7): allowShareCallback(), createShareLinkCommand(), { msgs }, rejectShareCallback(), Share, shareCallback(), User

### Community 34 - "Public Mood Embed Endpoints"
Cohesion: 0.36
Nodes (7): animatedMood(), emojiMood(), getMoodOfUser(), Mood, path, tgsMood(), User

### Community 35 - "Controllers Barrel"
Cohesion: 0.25
Nodes (7): admin, auth, embed, mood, personality, settings, user

### Community 36 - "Admin Tab & Friend Adding"
Cohesion: 0.33
Nodes (7): Admin Tab, Follow System, addFriend, fetchAdmin, searchAdmin, setupMainButton, TRAIT_LEVELS filter buckets

### Community 37 - "Start Command & Share Model"
Cohesion: 0.29
Nodes (5): { MOOD_INLINE_KEYBOARD, msgs, share, common }, Share, User, mongoose, shareSchema

### Community 38 - "Followings & Mood Model"
Cohesion: 0.29
Nodes (4): Mood, Share, mongoose, moodSchema

### Community 39 - "Mini App Quiz & Fetch Helper"
Cohesion: 0.52
Nodes (7): answer, api (fetch helper), cancelQuiz, closeQuiz, fetchPersonality, fetchQuizSession, removeKey

### Community 40 - "Personality Link Sharing"
Cohesion: 0.40
Nodes (6): Public Personality Link (/p/<token>), copyLink, sharePersonality, shareUrl, showToast, toggleSharing

### Community 43 - "Personality Test Entry Points"
Cohesion: 0.50
Nodes (4): Personality Catalog Seeding, Personality Tests, openQuiz, startTest

### Community 45 - "MoodPal Brand Identity"
Cohesion: 0.83
Nodes (4): MoodPal Logo (Smiley Brand Mark), Flat Minimal Icon Style (White Disc on Blue Field), Mood-Centred Visual Identity, Smiley Face Motif

## Ambiguous Edges - Review These
- `MongoDB Persistence` → `External shared-network`  [AMBIGUOUS]
  docker-compose.yml · relation: conceptually_related_to
- `Docker Deployment` → `destroyStickers`  [AMBIGUOUS]
  src/public/ui/index.html · relation: conceptually_related_to

## Knowledge Gaps
- **292 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+287 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `MongoDB Persistence` and `External shared-network`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Docker Deployment` and `destroyStickers`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `PersonalityService` connect `Personality Test Session Flow` to `Personality Service Tests`, `Personality Service Dependencies`, `Personality Profile Access`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _292 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Talk Chat Sessions` be split into smaller, more focused modules?**
  _Cohesion score 0.04734299516908213 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Mood Report & Video Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.08636977058029689 - nodes in this community are weakly interconnected._