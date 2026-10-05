// follow-back buttons (fb_ask_<userId>: ask to see their mood, fb_give_<userId>: let them see mine)
export const FOLLOW_BACK_ASK_KEYBOARD = (other) => [[{ text: `👀 Ask to see ${other.first_name}'s mood`, callback_data: `fb_ask_${other._id}` }]]
export const FOLLOW_BACK_GIVE_KEYBOARD = (other) => [[{ text: `🤝 Let ${other.first_name} see my mood too`, callback_data: `fb_give_${other._id}` }]]

export const ALLOW_SHARE_MOOD_INLINE_KEYBOARD = (follower) => [
  [
    {
      text: `👤 View ${follower.first_name}`,
      url: `tg://user?id=${follower.id}`
    }
  ],
  [
    {
      text: '✅ Allow',
      callback_data: `share_allow_${follower._id}`
    },
    {
      text: '❌ Reject',
      callback_data: `share_reject_${follower._id}`
    }
  ]
]