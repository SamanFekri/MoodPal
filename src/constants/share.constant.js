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