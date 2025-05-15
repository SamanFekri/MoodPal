import 'dotenv/config';



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
`;

export const welocmeMsg = (name) => `
Hi ${name},
Welcome to Mood Pal — your personal mood tracker.

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

✅ Animated Mood:
<code>&lt;img src="${process.env.SERVER_BASE_URL}/user/${id}/mood/animated" /&gt;</code>

✅ Emoji Mood:
<code>${process.env.SERVER_BASE_URL}/user/${id}/mood/emoji</code>
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
export const askForShareMoodMsg = (follower) => `👀 ${follower.first_name}  wants to see your mood.`
export const waitingForShareMsg = (follower) => `👀 Waiting for ${follower.first_name} to allow you to see their mood.`
export const shareAllowedMsg = (follower) => `👀 Now ${follower.first_name} can see your mood.`
export const sharePermissionGrantedMsg = (followed) => `✅ ${followed.first_name} has allowed you to see their mood.`
export const rejectShareMsg = (follower) => `❌ You have rejected ${follower.first_name}'s request to see your mood.`