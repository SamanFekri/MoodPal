// Mini app API for personality profiles and sharing. All handlers except the public
// link sit behind requireWebAppUser (req.user is the signed-in Telegram user).
const crypto = require('crypto');
const User = require('../models/user');
const Share = require('../models/share');
const personalityService = require('../personality/service');
const { localizeTest, localizeQuestion, localizeProfileView } = require('../i18n/personality');

// tests, questions and profiles in the viewer's language (src/i18n); the stored data stays English
const testRow = (t, lang) => { const l = localizeTest(t, lang); return { key: l.key, name: l.name, description: l.description, question_count: t.question_count, completed: t.completed }; };

const publicUrl = (user) => user.personality_share_token
  ? `${require('../constants').server.SERVER_BASE_URL}/p/${user.personality_share_token}`
  : null;

// GET /api/me/personality
const getMine = async (req, res) => {
  const [profile, tests] = await Promise.all([
    personalityService.getProfileView(req.user._id, { withEvidence: true }),
    personalityService.listTests({ userId: req.user._id }),
  ]);
  res.json({
    profile: localizeProfileView(profile, req.user.language),
    tests: tests.map(t => testRow(t, req.user.language)),
    sharing: {
      enabled: Boolean(req.user.is_personality_shared),
      public_url: req.user.is_personality_shared ? publicUrl(req.user) : null,
    },
  });
};

// POST /api/me/personality/sharing { enabled: boolean }
const setSharing = async (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  const update = { is_personality_shared: enabled };
  if (enabled && !req.user.personality_share_token) {
    update.personality_share_token = crypto.randomBytes(12).toString('base64url');
  }
  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
  res.json({ enabled: user.is_personality_shared, public_url: user.is_personality_shared ? publicUrl(user) : null });
};

// GET /api/friends/:telegramId/personality — only for people I follow who share it
const getFriends = async (req, res) => {
  const friend = await User.findOne({ id: Number(req.params.telegramId) });
  if (!friend) return res.status(404).json({ error: 'not_found' });
  const share = await Share.findOne({ follower: req.user._id, followed: friend._id, disabled: false });
  if (!share) return res.status(403).json({ error: 'not_following' });
  // the Moodling has its own switch (is_mbti_shared), separate from sharing the whole personality
  const mbti = friend.is_mbti_shared !== false ? await personalityService.getMbti(friend._id) : null;
  const extra = mbti ? { mbti } : {};
  if (!friend.is_personality_shared) return res.json({ shared: false, profile: null, ...extra });
  const profile = localizeProfileView(await personalityService.getProfileView(friend._id), req.user.language);
  if (profile && friend.is_mbti_shared === false) profile.mbti = null;
  res.json({ shared: true, profile, ...extra });
};

// GET /api/public/personality/:token — no auth; what the share link shows
const getPublic = async (req, res) => {
  const user = await User.findOne({ personality_share_token: req.params.token, is_personality_shared: true });
  if (!user) return res.status(404).json({ error: 'not_found' });
  // ?lang=fa|ru: the visitor's language (the page sends it)
  const profile = localizeProfileView(await personalityService.getProfileView(user._id), req.query?.lang);
  if (profile && user.is_mbti_shared === false) profile.mbti = null;   // hidden Moodling stays hidden here too
  res.json({ first_name: user.first_name, bot_username: process.env.BOT_USERNAME || null, profile });
};

// ---- taking tests inside the mini app (same service the bot uses) ----

// what the client needs to run a session; questions carry no trait/reverse hints
const sessionView = (session, test, questions, lang = null) => {
  const t = localizeTest(test, lang);
  return {
  id: session._id,
  test: { key: test.key, name: t.name, description: t.description, intro: t.intro, scale: t.scale },
  questions: questions.map(q => ({ order: q.order, text: localizeQuestion(q, test.key, lang).text })),
  current_index: session.current_index,
  answered: session.answers.length,
  total: questions.length,
  };
};

// GET /api/me/personality/session — the unfinished test, if any
const getSession = async (req, res) => {
  const session = await personalityService.getActiveSession(req.user._id);
  if (!session) return res.json({ session: null });
  const loaded = await personalityService.getTest(session.test_key);
  if (!loaded) return res.json({ session: null });
  res.json({ session: sessionView(session, loaded.test, loaded.questions, req.user.language) });
};

// POST /api/me/personality/tests/:key/start — start (or restart) a test
const startTest = async (req, res) => {
  try {
    const { session, test, questions } = await personalityService.startTest(req.user._id, req.params.key);
    res.json({ session: sessionView(session, test, questions, req.user.language) });
  } catch (error) {
    res.status(404).json({ error: 'unknown_test' });
  }
};

// POST /api/me/personality/session/:id/answer { order, value }
const answer = async (req, res) => {
  const order = Number(req.body?.order), value = Number(req.body?.value);
  if (!Number.isFinite(order) || !Number.isFinite(value)) return res.status(400).json({ error: 'bad_answer' });
  try {
    const state = await personalityService.answerQuestion(req.user._id, req.params.id, order, value);
    if (!state.session) return res.status(410).json({ error: 'session_gone' });
    if (!state.done) return res.json({ done: false, session: sessionView(state.session, state.test, state.questions, req.user.language) });
    const [profile, tests] = await Promise.all([
      personalityService.getProfileView(req.user._id, { withEvidence: true }),
      personalityService.listTests({ userId: req.user._id }),
    ]);
    res.json({
      done: true,
      test: { key: state.test.key, name: localizeTest(state.test, req.user.language).name },
      scores: state.result.traits,
      profile: localizeProfileView(profile, req.user.language),
      tests: tests.map(t => testRow(t, req.user.language)),
    });
  } catch (error) {
    if (/outside/.test(error.message)) return res.status(400).json({ error: 'value_out_of_scale' });
    console.error('Answer failed:', error);
    res.status(500).json({ error: 'answer_failed' });
  }
};

// POST /api/me/personality/session/cancel
const cancel = async (req, res) => {
  const cancelled = await personalityService.cancelTest(req.user._id);
  res.json({ cancelled });
};

module.exports = { getMine, setSharing, getFriends, getPublic, getSession, startTest, answer, cancel };
