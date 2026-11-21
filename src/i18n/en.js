// English: the default language and the fallback for any key another language leaves out.
// Every other dictionary (fa.js, ru.js) has the same shape; a missing key falls back to this one.
// Keep wording changes here in sync with the other languages (test/i18n checks the keys match).
require('dotenv').config();
const { SERVER_BASE_URL } = require('../constants/server.constant');

const channel = () => process.env.MAIN_CHANNEL_USERNAME;
const botLink = () => `https://t.me/${process.env.BOT_USERNAME}`;
const formatBytes = (n) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const progressBar = (percent, width = 12) => { const n = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width); return '▓'.repeat(n) + '░'.repeat(width - n); };
const plural = (n, one, many) => (n === 1 ? one : many);

const en = {
  code: 'en',
  dir: 'ltr',
  // the language's own name (language picker) and its English name (told to the AI)
  nativeName: 'English',
  flag: '🇬🇧',
  aiLanguage: 'English',
  // "a, b and c"
  joinNames: (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || ''),
  listSep: ', ',
  someone: 'Someone',
  aFriend: 'a friend',
  them: 'them',
  they: 'they',
  their: 'Their',
  yourFriend: 'Your friend',

  // ---- reply keyboard ----
  menu: {
    SET_MOOD: '🤩 New mood',
    REPORT: '📊 Report',
    EXPORT: '📥 Export',
    SHARE: '🚀 Share',
    VISIBILITY_PUBLIC: '👀 Make Visibility Public',
    VISIBILITY_PRIVATE: '👻 Make Visibility Private',
    PERSONALITY_TEST: '🧠 Personality Test',
    MY_PERSONALITY: '🧠 My Personality',
    TALK: '💬 Talk',
    END_TALK: '🛑 End talk',
    BACKUP_NOW: '💾 Backup now',
    LANGUAGE: '🌐 Language',
  },
  menuUpdatedMsg: () => '🆕 Your menu has been updated.',

  // ---- Telegram's "Menu" button (setMyCommands) ----
  commands: {
    start: 'Start the bot',
    set_mood: 'Set your current mood',
    report: 'Mood report for the last days',
    export: 'Get all your moods and notes as a file',
    share: 'Share your mood with a friend',
    friends: 'Who you follow and who follows you, unfollow anyone',
    personality_test: 'Take a personality test',
    my_personality: 'See your personality profile',
    talk: 'Talk things through with the AI companion',
    end_talk: 'End the conversation',
    reminders: 'Mood check-in reminders on or off',
    timezone: 'Set your timezone (e.g. /timezone Berlin)',
    language: 'Change the bot language',
    set_public: 'Make your mood public (embed codes)',
    set_private: 'Make your mood private',
    set_openai_key: 'Add your OpenAI key for AI insights',
    remove_openai_key: 'Remove your OpenAI key',
    backup: 'Admins: send a database backup now',
    help: 'List all commands',
  },

  // ---- language picker ----
  languageChooseMsg: () => '🌐 Choose your language:',
  languageChangedMsg: () => '✅ Language set to English.',

  // ---- moods ----
  moods: {
    happy: 'Happy', relaxed: 'Relaxed', excited: 'Excited', motivated: 'Motivated', neutral: 'Neutral',
    confused: 'Confused', bored: 'Bored', uncertain: 'Uncertain', disappointed: 'Disappointed', anxious: 'Anxious',
    angry: 'Angry', sad: 'Sad', overwhelmed: 'Overwhelmed', overthinking: 'Overthinking', tired: 'Tired',
    nervous: 'Nervous', sick: 'Sick', naughty: 'Naughty',
  },
  // the six groups on the report radar chart
  moodGroups: { positive: 'Positive', motivated: 'Motivated', anxious: 'Anxious', negative: 'Negative', drained: 'Drained', calm: 'Calm' },
  moodSavedToast: () => 'Mood saved successfully!',

  chooseMoodMsg: () => `It's time to express yourself! Select the <b>mood</b> that best describes how you're feeling right now:`,
  notImplementedMsg: () => `This feature is not implemented yet. Stay tuned for updates!`,
  helpMsg: () => `
Here are some commands you can use:
/start - Start the bot and get a welcome message
/help - Get a list of available commands
/set_mood - Get a list of moods to choose from
/language - Change the bot language (English, فارسی, Русский)
/export - Get all your moods and notes (with day and hour) as a file
/friends - See who you follow and who follows you, and unfollow anyone
/reminders - Turn your mood check-in reminders on or off
/timezone - Set your timezone, e.g. /timezone Berlin or /timezone +3:30
/set_private - Set your mood to private
/set_public - Set your mood to public
/report - Get a report of your mood
/share - Share a link so your friends can see your moods
/personality_test - Take a personality test
/my_personality - See your personality profile
/talk - Talk things through with the AI companion (needs your OpenAI key)
/end_talk - End the conversation and go back to notes
/backup - (admins) send a database backup now
/set_openai_key - Add your own OpenAI key to get AI insights with your weekly report
/remove_openai_key - Remove your OpenAI key and turn off AI insights
`,
  welocmeMsg: (name) => `
Hi ${name},
Welcome to Mood Pal, your personal mood tracker.

Start tracking your <i>mood</i> and stay connected with your <i>feelings</i>.
Choose from a wide range of moods to reflect how you're feeling right now.

Mood Pal helps you visualize how your <i>mood</i> changes over time, giving you deeper insight into your <i>emotional well-being</i>.

Join our channel to get daily reminders to check in and track your mood
@${channel()}

${en.helpMsg()}
`,
  joinChannelMsg: () => '🤩 Please join the MoodPals channel so we can notify you to set your mood.',
  joinButton: () => '👉 Join',

  noMoodMsg: () => `😔 You haven't set a mood yet. Use /set_mood to set your mood. 🤩`,
  addNoteMsg: () => `📝 Now you can add a note to your mood. Please type your note below:`,
  noteSavedMsg: () => `✅ Your note for the mood has been saved successfully!`,

  moodPrivateMsg: () => `👻 Your mood is now on private`,
  moodPublicMsg: (id) => `
👀 Your mood is now on public.

👨🏻‍💻 You can add this to your website to share your mood.

✅ Animated WebP Mood:
<code>&lt;img src="${SERVER_BASE_URL}/user/${id}/mood/animated" /&gt;</code>

✅ Animated TGS Mood:
Load the script before using the mood-pal tag
<code>&lt;script src="${SERVER_BASE_URL}/public/lib/tgs-player.js"&gt;&lt;/script&gt;</code>

Add this to your HTML body to embed
<code>&lt;mood-pal src="${SERVER_BASE_URL}/user/${id}/mood/tgs" &gt;&lt;/mood-pal&gt;</code>

✅ Emoji Mood:
<code>${SERVER_BASE_URL}/user/${id}/mood/emoji</code>
`,

  // ---- report ----
  showReportMsg: (user, days) => `
👻 Hi ${user.first_name},
📊 Here is your mood report for the last ${days} days`,
  reportMsg: () => `
📆 Select from the following days to get your mood report:
`,
  reportDaysButton: (days) => `${days} days`,
  reportSentToast: () => '📊 Report sent successfully!',
  reportFailedToast: () => '❌ Failed to generate report. Please try again.',

  // ---- sharing ----
  createShareLinkMsg: (user) => `
👨🏻‍💻 You can pass this message to your friends to see your mood:

👀 Click here to see <a href="${botLink()}?start=sm-${user._id}">${user.first_name}'s mood</a>

🔗 <code>${botLink()}?start=sm-${user._id}</code>
`,
  askForShareMoodMsg: (follower) => `👀 ${follower.first_name} wants to see your mood.`,
  waitingForShareMsg: (follower) => `👀 Waiting for ${follower.first_name} to allow you to see their mood.`,
  shareAllowedMsg: (follower) => `👀 Now ${follower.first_name} can see your mood.`,
  sharePermissionGrantedMsg: (followed) => `✅ ${followed.first_name} has allowed you to see their mood.`,
  hasAlreadySharedMsg: (followed) => `🤩 ${followed.first_name} has already shared their mood with you.`,
  followBackAskMsg: (follower) => `Want to see ${follower.first_name}'s mood too?`,
  followBackGiveMsg: (followed) => `Let ${followed.first_name} see your mood too?`,
  alreadySeesYouMsg: (other) => `🤝 ${other.first_name} can already see your mood.`,
  sharedBackMsg: (followed) => `🤝 Done. ${followed.first_name} can see your mood now too.`,
  sharedBackNoticeMsg: (follower) => `🤝 ${follower.first_name} shared their mood with you too. You can see each other's moods now.`,
  rejectShareMsg: (follower) => `❌ You have rejected ${follower.first_name}'s request to see your mood.`,
  followBackAskButton: (name) => `👀 Ask to see ${name}'s mood`,
  followBackGiveButton: (name) => `🤝 Let ${name} see my mood too`,
  viewUserButton: (name) => `👤 View ${name}`,
  allowButton: () => '✅ Allow',
  rejectButton: () => '❌ Reject',

  // ---- /friends ----
  friendsNoneMsg: () => "🫂 You're not sharing moods with anyone yet.\nTap 🚀 Share and send your link to a friend.",
  friendsTitle: () => '🫂 <b>Your friends</b>',
  friendsYouSee: (list) => `👀 <b>You see the mood of:</b> ${list}`,
  friendsSeeYou: (list) => `🙋 <b>They see your mood:</b> ${list}`,
  nobody: () => 'nobody',
  friendsHint: () => 'Tap to change. Nobody gets notified.',
  friendsUnfollowButton: (name) => `🚫 Unfollow ${name}`,
  friendsBothButton: () => '💔 Both',
  friendsHideButton: (name) => `🙈 Hide my mood from ${name}`,
  friendsUnfollowedToast: (name) => `You no longer see ${name}'s mood`,
  friendsRemovedToast: (name) => `${name} no longer sees your mood`,
  friendsBothToast: (name) => `You and ${name} no longer see each other's moods`,

  // ---- export ----
  exportNoMoodsMsg: () => "You haven't logged any moods yet. Pick one with 🤩 New mood and it will show up in your export.",
  exportTooSoonMsg: (s) => `Your file is on its way. You can export again in ${s}s.`,
  exportFailedMsg: () => "Sorry, I couldn't make your export right now. Please try again in a minute.",
  exportCaption: (count, tz) => `📥 Your mood log: ${count} ${plural(count, 'mood', 'moods')} with notes, times in ${tz}. Opens in Excel, Numbers or Google Sheets.`,
  exportColumns: ['Date', 'Weekday', 'Time', 'Timezone', 'Mood', 'Note'],

  // ---- reminders and timezone ----
  reminderCheckInMsg: () => `⏰ <b>Mood check-in</b>\nHow are you feeling right now? Pick the mood that fits best:`,
  remindersPausedMsg: () => '⏰ Mood reminders are paused for everyone right now.',
  remindersOffMsg: () => '🔕 Mood reminders are <b>off</b>.',
  remindersOnMsg: (times, tz) => `⏰ Mood reminders are <b>on</b>: ${times} (${tz}).\nChange the times in the mini app → Settings, or your timezone with /timezone.`,
  remindersOffButton: () => '🔕 Turn off reminders',
  remindersOnButton: () => '⏰ Turn on reminders',
  remindersOnToast: () => 'Reminders are on',
  remindersOffToast: () => 'Reminders are off. Turn them back on with /reminders',
  tzStatusMsg: (tz, offset, localTime) => `🌍 Your timezone: <b>${tz}</b> (${offset}). It's ${localTime} there.`,
  tzDefaultHint: () => `That's the default; set your own so reminders arrive at your local time.`,
  tzRemindersLine: (times) => `⏰ Reminders: ${times} in this timezone.`,
  tzDoneMsg: () => '✅ Done.',
  tzHowToMsg: () => `To change it, send /timezone with a city or an offset, e.g.\n<code>/timezone Tehran</code>\n<code>/timezone New York</code>\n<code>/timezone +3:30</code>\nor pick it in the mini app → Settings.`,
  tzBackToDefaultButton: (def) => `↩︎ Back to default (${def})`,
  tzNotFoundMsg: (q) => `I couldn't find a timezone for “${q}”. Try a big city nearby (<code>/timezone Berlin</code>) or your UTC offset (<code>/timezone +2</code>).`,
  tzWhichOneMsg: () => 'Which one is yours?',
  tzUnknownToast: () => 'Unknown timezone',
  tzSetToast: (tz) => `Timezone: ${tz}`,
  tzResetToast: () => 'Back to the default timezone',

  // ---- OpenAI key (bring your own key) ----
  // keep "OpenAI" and "sk-" in every language: a reply to this prompt is recognised by them
  askOpenAIKeyMsg: () => `
🧠 <b>AI mood insights</b> use <i>your own</i> OpenAI key, so nobody else spends your credits.

🔑 Reply to this message with your OpenAI API key (it starts with <code>sk-</code>).
You can create one at https://platform.openai.com/api-keys

🔒 Your key is stored encrypted and is only used to analyze <b>your</b> weekly moods. Your message with the key will be deleted right after it is saved.

Use /remove_openai_key at any time to delete it.
`,
  openAIKeyInvalidFormatMsg: () => `❌ That doesn't look like an OpenAI key. It should start with <code>sk-</code>. Please try /set_openai_key again.`,
  openAIKeyVerifyingMsg: () => `⏳ Checking your key with OpenAI…`,
  openAIKeySavedMsg: () => `✅ Your OpenAI key is verified and saved. You'll get AI insights with your weekly mood report. 🧠`,
  openAIKeyRejectedMsg: () => `❌ OpenAI rejected this key. Please check it and try /set_openai_key again.`,
  openAIKeyErrorMsg: () => `⚠️ Couldn't reach OpenAI to verify your key right now. Please try again in a bit.`,
  openAIKeyRemovedMsg: () => `🗑 Your OpenAI key has been removed. AI insights are now off.`,
  openAIKeyNotSetMsg: () => `ℹ️ You don't have an OpenAI key saved. Use /set_openai_key to add one.`,
  openAIKeyStoppedWorkingMsg: () => `⚠️ OpenAI rejected your saved key, so your weekly AI insight was skipped. Update it with /set_openai_key.`,

  // ---- Talk mode ----
  TALK_DISCLAIMER: `🤖 <b>Please read first</b>
• You're talking to an <b>AI bot</b>, not a human and not a therapist. It tries to respond like a supportive psychologist, but it is <b>not accurate</b> and can be wrong.
• This is <b>not</b> therapy, medical advice or a diagnosis. If you're in danger or thinking about hurting yourself, contact your local emergency number or a crisis line right away.
• It runs on <b>your own OpenAI key</b> if you added one (/set_openai_key), otherwise on MoodPal's shared AI. Your messages are sent to that AI service and stored here so the conversation has context.`,
  talkIntroMsg: (name) => `
💬 <b>Let's talk${name ? `, ${name}` : ''}.</b>

${en.TALK_DISCLAIMER}

Whenever you're ready, tell me what's on your mind. Send 🛑 <b>End talk</b> (or /end_talk) at any time to stop. After that, your messages are saved as mood notes again, like before.
`,
  talkNeedsKeyMsg: () => `
💬 <b>Talk</b> uses your own OpenAI key, so nobody else pays for your conversations.

🔑 Add one with /set_openai_key, then press 💬 Talk again.

${en.TALK_DISCLAIMER}
`,
  talkEndedMsg: () => `🛑 Talk ended. Take care of yourself. 💛

Your messages are saved as mood notes again from now on.`,
  talkNotActiveMsg: () => `ℹ️ You're not in a conversation right now. Press 💬 Talk to start one.`,
  talkErrorMsg: () => `⚠️ I couldn't get a reply right now. Please try again in a moment, or /end_talk to stop.`,
  talkModelUnavailableMsg: (model) => `⚠️ Your OpenAI account can't use the model <b>${model}</b>. Pick another one in the mini app → Settings → Model, then press 💬 Talk again.`,
  talkKeyRejectedMsg: () => `❌ OpenAI rejected your key, so I can't reply. Update it with /set_openai_key and press 💬 Talk again.`,
  talkSafetyFooterMsg: () => `
🛟 <b>If you might be in danger, please don't wait on a bot.</b> Reach out to someone you trust, a local crisis line, or your emergency number right now. I'm an AI and I can't keep you safe. A real person can.`,
  talkAboutNoteMsg: () => `💬 Want to talk about it?`,
  talkAboutButton: () => '💬 Talk about it',
  // Talk on the admin's shared key (src/ai/access.js)
  talkSharedNoteMsg: (provider, left, limit) => `🎁 You're on MoodPal's free AI (${provider}): <b>${left} of ${limit}</b> messages left today. Your messages go to ${provider}. For unlimited Talk, add your own OpenAI key with /set_openai_key.`,
  talkLimitMsg: (limit) => `⏳ You've used today's ${limit} free AI messages. They reset at midnight, or add your own OpenAI key with /set_openai_key for unlimited Talk. 💛`,
  talkDailyCapMsg: () => `⏳ MoodPal's free AI is busy for today. Please try again tomorrow, or add your own OpenAI key with /set_openai_key. 💛`,
  talkSharedUnavailableMsg: () => `⚠️ MoodPal's free AI isn't working right now. Please try again later, or add your own OpenAI key with /set_openai_key.`,
  talkReminderMsg: () => `<i>🤖 Reminder: I'm an AI, not a therapist, and I can be wrong.</i>`,
  talkFallbackReply: () => "Tell me a bit more, what's going on?",
  insightFallback: () => "I'm sorry, I couldn't analyze your mood data at this time.",

  // ---- database backup (admins) ----
  backupStartedMsg: () => `💾 Building the backup and uploading it…`,
  backupDoneMsg: (r) => `
✅ <b>Backup sent.</b>

📦 ${r.total_parts} file${r.total_parts === 1 ? '' : 's'} · ${r.total_documents} documents
🗂 ${formatBytes(r.bytes)} uploaded
`,
  backupPartialMsg: (r) => `
⚠️ <b>Backup partly sent.</b>

${r.parts.filter(p => !p.error).length}/${r.total_parts} files went through. ${r.message}
`,
  backupFailedMsg: (message) => `❌ Backup failed: ${message}`,
  backupNotAdminMsg: () => `ℹ️ This command is for admins only.`,

  // ---- Emotional support network (src/support/service.js) ----
  supportNowMsg: (name, mood) => `💛 <b>${name}</b> is feeling <b>${String(mood.name || '').toLowerCase()}</b> ${mood.emoji || ''} right now.

A small message from you could mean a lot.`,
  supportRepeatedMsg: (name, count, hours) => `💛 <b>${name}</b> has had a rough time lately: ${count} hard moods in the last ${hours} hours.

Maybe check in and see how they're doing?`,
  supportDaysMsg: (name, days) => `💛 <b>${name}</b> has had ${days} hard days in a row.

A message from you could really help.`,
  supportSharedMsg: (name, mood) => `💛 <b>${name}</b> wanted you to know they're feeling <b>${String(mood.name || '').toLowerCase()}</b> ${mood.emoji || ''} right now.

A small message from you could mean a lot.`,
  supportMessageButton: (name) => `💬 Message ${name}`,
  supportHugButton: () => `🤗 Send a hug`,
  supportHugMsg: (name) => `🤗 <b>${name}</b> sent you a hug. They're thinking of you.`,
  supportHugSentMsg: () => `Hug sent 💛`,
  supportHugNotAllowedMsg: () => `You can't send them a hug anymore.`,
  supportInviteMsg: (name) => `🤝 <b>${name}</b> would like you to be a support friend.

If ${name} is having a hard time, MoodPal will send you a short message so you can check in. You can stop anytime in the mini app → Settings.`,
  supportAcceptButton: () => `💛 Yes, I'm in`,
  supportDeclineButton: () => `Not now`,
  supportInviteAcceptedMsg: (name) => `💛 Thank you. You'll hear from MoodPal if ${name} is having a hard time.`,
  supportInviteDeclinedMsg: () => `👍 No problem. Nothing changes between you two.`,
  supportInviteGoneMsg: () => `This invitation isn't open anymore.`,
  supportAcceptedMsg: (name) => `💛 <b>${name}</b> agreed to be your support friend.`,
  supportDeclinedMsg: (name) => `<b>${name}</b> can't be a support friend right now. You can pick someone else in the mini app → Settings.`,
  supportStoppedMsg: (name) => `<b>${name}</b> is no longer your support friend.`,
  supportPromptMsg: () => `💛 Would you like to tell some friends how you're feeling?
Tick the friends you want, then tap Notify.`,
  supportNotifyButton: (n) => `💛 Notify ${n} ${n === 1 ? 'friend' : 'friends'}`,
  supportSelectAllButton: (all) => (all ? 'Clear all' : 'Select all'),
  supportNotifiedMsg: (names) => `💛 Notified ${names}. Take care of yourself.`,
  supportTickFirstMsg: () => `Tick at least one friend first`,
  supportShareAllButton: (n) => `💛 Share with everyone (${n})`,
  supportSharedAllMsg: (names) => `💛 Shared with ${names}. Take care of yourself.`,
  supportSkipButton: () => `Skip`,
  supportSharedWithMsg: (names) => `💛 Shared with ${names}. Want to tell anyone else?`,
  supportPromptDoneMsg: () => `💛 OK. Take care of yourself.`,
  supportTooOldToast: () => 'That mood is too old to share now',
  supportCouldntShareToast: () => "Couldn't share that",
  supportCouldntReachToast: () => "Couldn't reach them right now",
  supportCouldntReachAnyoneToast: () => "Couldn't reach anyone right now",
  supportReceiveOffToast: () => "They've turned off support messages",
  supportAlreadySharedToast: () => 'Already shared with them',
  supportNotifiedToast: (n) => `Notified ${n} ${n === 1 ? 'friend' : 'friends'} 💛`,
  supportSharedCountToast: (n) => `Shared with ${n} ${n === 1 ? 'friend' : 'friends'} 💛`,
  supportSharedWithToast: (name) => `Shared with ${name} 💛`,

  // ---- Year in Moods video (src/yearly): English for everyone, by choice; not in fa.js / ru.js ----
  yearlyCaption: (year, bot) => `✨ <b>Your ${year} in moods is here!</b>

📲 Save the video and share it to your Instagram story. Let your friends see your year!${bot ? `\n\nFriends can make theirs at t.me/${bot}` : ''}`,
  yearlyAdminCaption: (name, year) => `🔍 ${name}'s ${year} in moods (admin preview, only you got this)`,
  yearlyMakingMsg: (year, percent, ahead) => (ahead
    ? `✨ Your ${year} in moods is in line\n⏳ ${ahead} ahead of you, yours starts soon`
    : `✨ Making your ${year} in moods\n${progressBar(percent)} ${Math.round(percent)}%`),
  yearlyReadyMsg: () => `✅ Ready! Here it is 👇`,
  yearlyInLineMsg: (place) => (place ? `⏳ You're already in line (${place} ahead of you). Your video comes here as soon as it's made.` : `✨ Your video is being made right now. It comes here in a moment.`),
  yearlyNotEnoughMsg: (year, min, n) => `Your ${year} in moods needs at least ${min} moods this year, and you have ${n} so far. Log how you feel and try again soon 💛`,
  yearlyNotYetMsg: () => `✨ Your Year in Moods isn't open yet. We'll tell you when it's ready!`,
  yearlyFailedMsg: () => `⚠️ Something went wrong while making your video. Please try again in a bit.`,
  yearlyAnnounceMsg: (year) => `✨ Your ${year} in moods is ready!

A short video of your year: your top mood, your best month, your streak and more. Made for your Instagram story 📲

Tap ✨ ${year} in the menu (or the button below) to get yours, then share it!`,
  yearlyGetMineButton: (year) => `✨ Get my ${year}`,

  // ---- personality (src/commands/personality.js, src/personality/context.js) ----
  personality: {
    disclaimer: '⚠️ <i>This is an approximate personality profile, not a clinical or medical diagnosis.</i>',
    chooseTestTitle: '🧠 <b>Personality Tests</b>',
    chooseTestIntro: "Pick a test to start. You'll answer one question at a time, and you can cancel anytime.",
    testLine: (name, count, minutes) => `<b>${name}</b>: ${count} questions (~${minutes} min)`,
    noTestsMsg: () => `🧠 No personality tests are available right now.`,
    resumeOrRestartMsg: (name, answered, total) => `
🧠 You have an unfinished <b>${name}</b> (${answered}/${total} answered).

Continue where you left off, or start over?
`,
    questionHeader: (name, n, total) => `🧠 <b>${name}</b> · question ${n}/${total}`,
    cancelledMsg: () => `❌ Test cancelled. You can start again anytime from 🧠 Personality Test.`,
    cancelledToast: () => 'Cancelled',
    nothingToCancelMsg: () => `ℹ️ You don't have a test in progress.`,
    sessionExpiredMsg: () => `ℹ️ That test is no longer active. Start a new one from 🧠 Personality Test.`,
    somethingWrongToast: () => '❌ Something went wrong. Please try again.',
    doneToast: () => '✅ Done!',
    mbtiResultMsg: (type, c, url) => `<b>You're ${type}: ${c.name}, ${c.title}!</b>
<i>${c.tagline}</i>

${c.description}

See your character and share it: ${url}
<i>Just for fun, inspired by MBTI. Not a scientific or clinical assessment.</i>`,
    testCompletedMsg: (name) => `✅ <b>${name} completed!</b> Here is your profile.\n\n💡 Take another test from 🧠 Personality Test to fill in more of it.`,
    profileResetConfirmMsg: () => `
🗑 <b>Reset your personality profile?</b>

This deletes your test results, learned preferences and observation history. It cannot be undone.
`,
    profileResetDoneMsg: () => `🗑 Your personality profile has been reset.`,
    profileResetCancelledMsg: () => `👍 Your profile was kept.`,
    continueButton: '▶️ Continue',
    startOverButton: '🔄 Start over',
    cancelButton: '❌ Cancel',
    cancelTestButton: '❌ Cancel test',
    takeTestButton: '📝 Take a test',
    retakeTestButton: '📝 Take / retake a test',
    resetProfileButton: '🗑 Reset profile',
    resetYesButton: '✅ Yes, reset',
    keepItButton: '↩️ Keep it',
    // profile summary
    profileTitle: '🧠 <b>My Personality</b>',
    profileEmpty: 'No personality data yet. Take the 🧠 Personality Test to build your profile.',
    profileTraitLine: (bar, name, level, pct, conf) => `${bar} ${name}: <i>${level}</i> (${pct}%, confidence ${conf}%)`,
    profileMoreTraits: (n) => `<i>${n} more traits will fill in as you take other tests and from your conversations.</i>`,
    profileDisclaimer: '⚠️ <i>This is an approximate personality profile based on a short self-report questionnaire and conversation patterns. It is not a clinical or medical diagnosis.</i>',
    levels: { 'very low': 'very low', low: 'low', 'medium-low': 'medium-low', medium: 'medium', 'medium-high': 'medium-high', high: 'high', 'very high': 'very high', concise: 'concise', balanced: 'balanced', detailed: 'detailed' },
  },
};

module.exports = en;
