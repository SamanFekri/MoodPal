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
