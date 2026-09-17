import 'dotenv/config';
import { SERVER_BASE_URL } from './server.constant.js';

export const chooseMoodMsg = () => `It's time to express yourself! Select the <b>mood</b> that best describes how you're feeling right now:`;

export const notImplementedMsg = () => `This feature is not implemented yet. Stay tuned for updates!`;

export const helpMsg = () => `
Here are some commands you can use:
/start - Start the bot and get a welcome message
/help - Get a list of available commands
/set_mood - Get a list of moods to choose from
/set_private - Set your mood to private
/set_public - Set your mood to public
/report - Get a report of your mood
/share - Share a link so your friends can see your moods
/personality_test - Take a personality test
/my_personality - See your personality profile
/talk - Talk things through with the AI companion (needs your OpenAI key)
/end_talk - End the conversation and go back to notes
/set_openai_key - Add your own OpenAI key to get AI insights with your weekly report
/remove_openai_key - Remove your OpenAI key and turn off AI insights
`;

export const welocmeMsg = (name) => `
Hi ${name},
Welcome to Mood Pal, your personal mood tracker.

Start tracking your <i>mood</i> and stay connected with your <i>feelings</i>.
Choose from a wide range of moods to reflect how you're feeling right now.

Mood Pal helps you visualize how your <i>mood</i> changes over time, giving you deeper insight into your <i>emotional well-being</i>.

Join our channel to get daily reminders to check in and track your mood
@${process.env.MAIN_CHANNEL_USERNAME}

${helpMsg()}
`;


export const noMoodMsg = () => `😔 You haven't set a mood yet. Use /set_mood to set your mood. 🤩`;
export const addNoteMsg = () => `📝 Now you can add a note to your mood. Please type your note below:`
export const noteSavedMsg = () => `✅ Your note for the mood has been saved successfully!`;

export const moodPrivateMsg = () => `👻 Your mood is now on private`

export const moodPublicMsg = (id) => `
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
`

export const showReportMsg = (user, days) => `
👻 Hi ${user.first_name},
📊 Here is your mood report for the last ${days} days`

export const reportMsg = (user, days) => `
📆 Select from the following days to get your mood report:
`

export const createShareLinkMsg = (user) => `
👨🏻‍💻 You can pass this message to your friends to see your mood:

👀 Click here to see <a href="https://t.me/${process.env.BOT_USERNAME}?start=sm-${user._id}">${user.first_name}'s mood</a>

🔗 <code>https://t.me/${process.env.BOT_USERNAME}?start=sm-${user._id}</code>
`
export const askForShareMoodMsg = (follower) => `👀 ${follower.first_name} wants to see your mood.`
export const waitingForShareMsg = (follower) => `👀 Waiting for ${follower.first_name} to allow you to see their mood.`
export const shareAllowedMsg = (follower) => `👀 Now ${follower.first_name} can see your mood.`
export const sharePermissionGrantedMsg = (followed) => `✅ ${followed.first_name} has allowed you to see their mood.`
export const hasAlreadySharedMsg = (followed) => `🤩 ${followed.first_name} has already shared their mood with you.`
export const rejectShareMsg = (follower) => `❌ You have rejected ${follower.first_name}'s request to see your mood.`

// ---- OpenAI key (bring your own key) ----
export const askOpenAIKeyMsg = () => `
🧠 <b>AI mood insights</b> use <i>your own</i> OpenAI key, so nobody else spends your credits.

🔑 Reply to this message with your OpenAI API key (it starts with <code>sk-</code>).
You can create one at https://platform.openai.com/api-keys

🔒 Your key is stored encrypted and is only used to analyze <b>your</b> weekly moods. Your message with the key will be deleted right after it is saved.

Use /remove_openai_key at any time to delete it.
`
export const openAIKeyInvalidFormatMsg = () => `❌ That doesn't look like an OpenAI key. It should start with <code>sk-</code>. Please try /set_openai_key again.`
export const openAIKeyVerifyingMsg = () => `⏳ Checking your key with OpenAI…`
export const openAIKeySavedMsg = () => `✅ Your OpenAI key is verified and saved. You'll get AI insights with your weekly mood report. 🧠`
export const openAIKeyRejectedMsg = () => `❌ OpenAI rejected this key. Please check it and try /set_openai_key again.`
export const openAIKeyErrorMsg = () => `⚠️ Couldn't reach OpenAI to verify your key right now. Please try again in a bit.`
export const openAIKeyRemovedMsg = () => `🗑 Your OpenAI key has been removed. AI insights are now off.`
export const openAIKeyNotSetMsg = () => `ℹ️ You don't have an OpenAI key saved. Use /set_openai_key to add one.`
export const openAIKeyStoppedWorkingMsg = () => `⚠️ OpenAI rejected your saved key, so your weekly AI insight was skipped. Update it with /set_openai_key.`

// ---- Talk mode ----
export const TALK_DISCLAIMER = `🤖 <b>Please read first</b>
• You're talking to an <b>AI bot</b>, not a human and not a therapist. It tries to respond like a supportive psychologist, but it is <b>not accurate</b> and can be wrong.
• This is <b>not</b> therapy, medical advice or a diagnosis. If you're in danger or thinking about hurting yourself, contact your local emergency number or a crisis line right away.
• It runs on <b>your own OpenAI key</b> (/set_openai_key). Your messages are sent to OpenAI and stored here so the conversation has context.`

export const talkIntroMsg = (name) => `
💬 <b>Let's talk${name ? `, ${name}` : ''}.</b>

${TALK_DISCLAIMER}

Whenever you're ready, tell me what's on your mind. Send 🛑 <b>End talk</b> (or /end_talk) at any time to stop. After that, your messages are saved as mood notes again, like before.
`
export const talkNeedsKeyMsg = () => `
💬 <b>Talk</b> uses your own OpenAI key, so nobody else pays for your conversations.

🔑 Add one with /set_openai_key, then press 💬 Talk again.

${TALK_DISCLAIMER}
`
export const talkEndedMsg = () => `🛑 Talk ended. Take care of yourself. 💛

Your messages are saved as mood notes again from now on.`
export const talkNotActiveMsg = () => `ℹ️ You're not in a conversation right now. Press 💬 Talk to start one.`
export const talkErrorMsg = () => `⚠️ I couldn't get a reply right now. Please try again in a moment, or /end_talk to stop.`
export const talkKeyRejectedMsg = () => `❌ OpenAI rejected your key, so I can't reply. Update it with /set_openai_key and press 💬 Talk again.`
export const talkSafetyFooterMsg = () => `
🛟 <b>If you might be in danger, please don't wait on a bot.</b> Reach out to someone you trust, a local crisis line, or your emergency number right now. I'm an AI and I can't keep you safe. A real person can.`
export const talkAboutNoteMsg = () => `💬 Want to talk about it?`
export const talkReminderMsg = () => `<i>🤖 Reminder: I'm an AI, not a therapist, and I can be wrong.</i>`
