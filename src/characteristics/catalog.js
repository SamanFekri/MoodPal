// The characteristics an analysis may assign. The model must pick from this list (by key), which
// keeps the labels understandable and consistent between runs, and keeps clinical labels out.
const CHARACTERISTICS = [
  { key: 'straight_shooter', name: 'Straight Shooter', description: 'Prefers direct and honest communication.' },
  { key: 'soft_landing', name: 'Needs a Soft Landing', description: 'Responds better when emotions are acknowledged first.' },
  { key: 'deep_thinker', name: 'Deep Thinker', description: 'Tends to analyze before acting.' },
  { key: 'action_taker', name: 'Action Taker', description: 'Prefers practical solutions.' },
  { key: 'challenge_seeker', name: 'Challenge Seeker', description: 'Responds well to challenges and accountability.' },
  { key: 'independent', name: 'Independent', description: 'Prefers making their own decisions.' },
  { key: 'people_powered', name: 'People-Powered', description: 'Benefits from talking things through with others.' },
  { key: 'planner', name: 'Planner', description: 'Prefers structure and preparation.' },
  { key: 'go_with_the_flow', name: 'Go-With-the-Flow', description: 'Prefers flexibility.' },
  { key: 'stability_seeker', name: 'Stability Seeker', description: 'Prefers predictability and gradual change.' },
  { key: 'encouragement_driven', name: 'Encouragement Driven', description: 'Responds well to positive reinforcement.' },
  { key: 'talk_it_out', name: 'Talk-It-Out', description: 'Processes emotions by expressing them.' },
  { key: 'process_it_alone', name: 'Process-It-Alone', description: 'Prefers private reflection.' },
  { key: 'future_focused', name: 'Future Focused', description: 'Naturally thinks about future outcomes.' },
  { key: 'present_focused', name: 'Present Focused', description: 'Focuses on what is happening now.' },
  { key: 'peace_keeper', name: 'Peace Keeper', description: 'Tends to avoid or reduce conflict.' },
];
const BY_KEY = new Map(CHARACTERISTICS.map(c => [c.key, c]));

module.exports = { CHARACTERISTICS, BY_KEY };
