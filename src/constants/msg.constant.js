import 'dotenv/config';

export const welocmeMsg = (name) => `
Hi ${name},
Welcome to Mood Pal — your personal mood tracker.

Start tracking your <i>mood</i> and stay connected with your <i>feelings</i>.
Choose from a wide range of moods to reflect how you're feeling right now.

Mood Pal helps you visualize how your <i>mood</i> changes over time, giving you deeper insight into your <i>emotional well-being</i>.

Join our channel to get daily reminders to check in and track your mood
@${process.env.MAIN_CHANNEL_USERNAME}
`;


export const chooseMoodMsg = () => `It's time to express yourself! Select the <b>mood</b> that best describes how you're feeling right now:`;

export const notImplementedMsg = () => `This feature is not implemented yet. Stay tuned for updates!`;

export const helpMsg = () => `
Here are some commands you can use:
start - Start the bot and get a welcome message
help - Get a list of available commands
set_mood - Get a list of moods to choose from
set_private - Set your mood to private
set_public - Set your mood to public
report - Get a report of your mood for the last 7 days
`;

export const noMoodMsg = () => `😔 You haven't set a mood yet. Use /set_mood to set your mood. 🤩`;
export const addNoteMsg = () => `📝 Now you can add a note to your mood. Please type your note below:`
export const noteSavedMsg = () => `✅ Your note for the mood has been saved successfully!`;

export const moodPrivateMsg = () => `👻 Your mood is now on private`

export const moodPublicMsg = (id) => `
👀 Your mood is now on public.

👨🏻‍💻 You can add this to your website to share your mood.

✅ Animated Mood:
<code>&lt;img src="${process.env.SERVER_BASE_URL}/user/${id}/mood/animated" /&gt;</code>

✅ Emoji Mood:
<code>${process.env.SERVER_BASE_URL}/user/${id}/mood/emoji</code>
`

export const sevenDaysReportMsg = (user) => `
👻 Hi ${user.first_name},
📊 Here is your mood report for the last 7 days:`


