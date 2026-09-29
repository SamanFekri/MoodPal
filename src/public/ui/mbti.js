// The MoodPal "Moodlings": 16 cartoon characters for the MBTI-style test, plus the pure
// helpers around them. One file, used by the mini app (window.MBTI) and by the server
// (require) so the bot, share links and the app always agree.
//
// Every character is drawn by the same small SVG renderer from a few named parts (body
// shape, eyes, mouth, headwear, prop, pose), which keeps the cast in one art style:
// thick ink outline, soft belly patch, blush, a glossy highlight and a ground shadow.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MBTI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // value of each trait = share of the RIGHT letter (0 = all left, 1 = all right)
  const DIMENSIONS = [
    { key: 'mbti_extraversion', left: { letter: 'I', name: 'Introversion', hint: 'recharges alone' }, right: { letter: 'E', name: 'Extraversion', hint: 'recharges with people' } },
    { key: 'mbti_intuition', left: { letter: 'S', name: 'Sensing', hint: 'facts and details' }, right: { letter: 'N', name: 'Intuition', hint: 'patterns and ideas' } },
    { key: 'mbti_feeling', left: { letter: 'T', name: 'Thinking', hint: 'decides with logic' }, right: { letter: 'F', name: 'Feeling', hint: 'decides with values' } },
    { key: 'mbti_perceiving', left: { letter: 'J', name: 'Judging', hint: 'plans ahead' }, right: { letter: 'P', name: 'Perceiving', hint: 'goes with the flow' } },
  ];

  const TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];

  const GROUPS = {
    NT: { name: 'Thinkers' },
    NF: { name: 'Dreamers' },
    SJ: { name: 'Keepers' },
    SP: { name: 'Adventurers' },
  };
  const groupOf = (type) => (type[1] === 'N' ? (type[2] === 'T' ? 'NT' : 'NF') : (type[3] === 'J' ? 'SJ' : 'SP'));

  // ---------------------------------------------------------------- the cast
  const CHARACTERS = {
    INTJ: {
      name: 'Strat', title: 'The Mastermind',
      tagline: 'Already three moves ahead. Of you. Of everyone.',
      description: 'A wizard-hatted planner who treats life like a chess match against the universe, and is quietly winning. Strat has a ten-year plan, a backup plan, and a plan for when the backup plan gets bored.',
      strengths: ['Sees the long game', 'Independent and decisive', 'Turns chaos into a strategy', 'Loves a hard problem'],
      tendencies: ['Prefers competence over small talk', 'Trusts their own analysis first', 'Gets impatient with inefficiency'],
      funTraits: ['Has opinions about how you load the dishwasher', 'Rehearses arguments in the shower and wins them', 'Says "interesting" when they mean "wrong"'],
      behaviors: ['Researches a toaster for three weeks before buying it', 'Leaves a party early to work on a side project', 'Makes a spreadsheet for a vacation'],
      colors: { body: '#7b5cd6', belly: '#c9b8ff', accent: '#ffd166', bg: ['#2e2159', '#6f4fd0'] },
      art: { shape: 'bean', eyes: 'monocle', brows: 'sly', mouth: 'smirk', head: 'wizard', prop: 'chess', pose: 'hold' },
    },
    INTP: {
      name: 'Quark', title: 'The Idea Machine',
      tagline: 'Wait, but what if gravity was optional?',
      description: 'A curious little inventor with a lightbulb antenna that never switches off. Quark opens 47 browser tabs to answer one question and ends up with a new theory of everything (and still no answer).',
      strengths: ['Endlessly curious', 'Spots flaws in any logic', 'Original, inventive thinker', 'Calm under intellectual pressure'],
      tendencies: ['Thinks before speaking (for a while)', 'Loves ideas more than deadlines', 'Questions every rule, politely'],
      funTraits: ['Forgets to eat while reading about octopuses', 'Answers "it depends" to everything', 'Has a folder of unfinished genius projects'],
      behaviors: ['Replies to a text three days later with an essay', 'Takes apart the remote to see how it works', 'Debates a movie plot hole for an hour'],
      colors: { body: '#23b5a6', belly: '#aef0e6', accent: '#ffe066', bg: ['#0f4a47', '#1fa596'] },
      art: { shape: 'round', eyes: 'glasses', brows: 'raised', mouth: 'o', head: 'antenna', prop: 'question', pose: 'think' },
    },
    ENTJ: {
      name: 'Blaze', title: 'The Commander',
      tagline: 'I made us a plan. And a plan for the plan.',
      description: 'A crowned, megaphone-wielding leader who can turn a group chat into a well-run company by lunchtime. Blaze does not wait for opportunities. Blaze schedules them.',
      strengths: ['Natural leader', 'Confident and decisive', 'Great at big goals', 'Brings out ambition in others'],
      tendencies: ['Takes charge by default', 'Values results over feelings in the moment', 'Plans the week on Sunday night'],
      funTraits: ['Turns board game night into a tournament', 'Has a five-year plan for their houseplant', 'Says "let\'s circle back" at dinner'],
      behaviors: ['Organizes the group trip nobody asked them to', 'Gives a pep talk to a vending machine', 'Finishes your sentence, correctly'],
      colors: { body: '#ef4d56', belly: '#ffc1c4', accent: '#ffcc33', bg: ['#5b1119', '#e2424d'] },
      art: { shape: 'square', eyes: 'determined', brows: 'determined', mouth: 'grin', head: 'crown', prop: 'megaphone', pose: 'point' },
    },
    ENTP: {
      name: 'Zig', title: 'The Debater',
      tagline: 'I don\'t even believe this, I just want to argue.',
      description: 'A zigzag-haired trickster powered by pure mischief and lightning. Zig will argue either side of anything, invent three startups before breakfast, and abandon all of them by lunch.',
      strengths: ['Quick, witty thinker', 'Fearless with new ideas', 'Brilliant brainstormer', 'Sees every side of an issue'],
      tendencies: ['Plays devil\'s advocate for fun', 'Bored by routine', 'Starts many things, finishes the exciting ones'],
      funTraits: ['Argues with the GPS', 'Has a hot take on sandwiches', 'Treats rules like suggestions'],
      behaviors: ['Changes the topic to something wilder mid-sentence', 'Pitches a business idea at a funeral (almost)', 'Learns the rules of a game to break them'],
      colors: { body: '#ff8a33', belly: '#ffd2ad', accent: '#ffe14d', bg: ['#5a2508', '#f07b24'] },
      art: { shape: 'tri', eyes: 'wink', brows: 'raised', mouth: 'grin', head: 'zigzag', prop: 'bolt', pose: 'shrug' },
    },
    INFJ: {
      name: 'Luma', title: 'The Quiet Oracle',
      tagline: 'I had a feeling you\'d say that.',
      description: 'A moonlit, soft-spoken soul who reads the room before entering it. Luma sees what you really mean, keeps your secrets forever, and has a gentle master plan to make the world kinder.',
      strengths: ['Deeply insightful', 'Caring and principled', 'Great listener', 'Quietly determined'],
      tendencies: ['Needs alone time to recharge', 'Looks for meaning in everything', 'Holds high standards for themselves'],
      funTraits: ['Predicts plot twists in the first five minutes', 'Has a playlist for every emotion', 'Rehearses phone calls in their head'],
      behaviors: ['Writes a heartfelt card for a minor birthday', 'Leaves the party to have one deep talk on the balcony', 'Knows you are sad before you do'],
      colors: { body: '#5a67e0', belly: '#c3c9ff', accent: '#ffe9a8', bg: ['#1b1f55', '#4a55d1'] },
      art: { shape: 'drop', eyes: 'closed', brows: 'soft', mouth: 'smile', head: 'moon', prop: 'stars', pose: 'down' },
    },
    INFP: {
      name: 'Moss', title: 'The Daydreamer',
      tagline: 'Sorry, I was imagining a whole other life.',
      description: 'A cloud-soft dreamer with a flower on top and a heart balloon that never lets go. Moss feels everything at full volume, writes poems about clouds, and cries at dog food commercials.',
      strengths: ['Kind and empathetic', 'Wildly imaginative', 'Loyal to their values', 'Creative storyteller'],
      tendencies: ['Lives half in daydreams', 'Avoids conflict, then journals about it', 'Needs things to feel meaningful'],
      funTraits: ['Names every plant they own', 'Has 12 unfinished novels', 'Gets attached to fictional characters'],
      behaviors: ['Apologizes to furniture after bumping into it', 'Takes the long way home to see the sunset', 'Makes a mixtape for a friend\'s bad day'],
      colors: { body: '#79c77f', belly: '#d6f5d2', accent: '#ff8fb5', bg: ['#1f4a2a', '#5fb567'] },
      art: { shape: 'cloud', eyes: 'dreamy', brows: 'soft', mouth: 'small', head: 'flower', prop: 'balloon', pose: 'hold' },
    },
    ENFJ: {
      name: 'Sunny', title: 'The Cheerleader',
      tagline: 'You can do it! I made you a snack!',
      description: 'A glowing, arms-wide ray of sunshine who remembers your birthday, your dog\'s birthday and your big presentation. Sunny believes in you so hard it is honestly a little intense.',
      strengths: ['Inspiring and warm', 'Brings people together', 'Reads group moods perfectly', 'Loves helping others grow'],
      tendencies: ['Puts others first (sometimes too much)', 'Takes criticism to heart', 'Plans gatherings for fun'],
      funTraits: ['Hypes up strangers at the gym', 'Has a group chat for every group', 'Cries at graduations of people they barely know'],
      behaviors: ['Organizes a surprise party in 24 hours', 'Gives advice before you ask (it\'s good advice)', 'Turns a stranger into a friend in the queue'],
      colors: { body: '#ffb224', belly: '#ffe3a3', accent: '#ff6b6b', bg: ['#6b3b00', '#ffa31a'] },
      art: { shape: 'round', eyes: 'happy', brows: 'none', mouth: 'big', head: 'rays', prop: 'heart', pose: 'wide' },
    },
    ENFP: {
      name: 'Pip', title: 'The Spark',
      tagline: 'New idea! New friend! New hobby! All at once!',
      description: 'A bouncy, sparkly bundle of enthusiasm with star-shaped tufts and confetti in every pocket. Pip befriends everyone, starts ten adventures a week, and makes Mondays feel like a festival.',
      strengths: ['Contagious enthusiasm', 'Creative and open-minded', 'Sees potential in everyone', 'Makes friends anywhere'],
      tendencies: ['Chases new ideas', 'Struggles with boring tasks', 'Feels deeply, shows it loudly'],
      funTraits: ['Has 14 hobbies and counting', 'Adopts every stray idea (and cat)', 'Uses three exclamation marks minimum!!!'],
      behaviors: ['Plans a road trip at 2am', 'Makes friends with the barista', 'Starts learning Japanese, pottery and guitar in one week'],
      colors: { body: '#ff5fa2', belly: '#ffc7de', accent: '#ffe14d', bg: ['#5c0f35', '#ff4f97'] },
      art: { shape: 'pear', eyes: 'sparkle', brows: 'none', mouth: 'big', head: 'tufts', prop: 'confetti', pose: 'up' },
    },
    ISTJ: {
      name: 'Ledger', title: 'The Rock',
      tagline: 'I read the terms and conditions. All of them.',
      description: 'A tidy, bow-tied block of reliability with a clipboard and a perfect side parting. Ledger shows up early, keeps receipts (literally), and is the reason the group project actually got handed in.',
      strengths: ['Dependable to the core', 'Organized and thorough', 'Honest and direct', 'Calm in a crisis'],
      tendencies: ['Likes proven methods', 'Keeps promises, expects the same', 'Prefers facts over speculation'],
      funTraits: ['Alphabetizes the spice rack', 'Has a favorite pen, and a backup favorite pen', 'Reads the manual first'],
      behaviors: ['Arrives ten minutes early and calls it on time', 'Keeps a spreadsheet of birthdays', 'Checks the stove twice before leaving'],
      colors: { body: '#3f66a8', belly: '#bcd2f5', accent: '#e84855', bg: ['#14264a', '#355c9f'] },
      art: { shape: 'block', eyes: 'dot', brows: 'flat', mouth: 'flat', head: 'part', prop: 'clipboard', pose: 'hold', neck: 'bowtie' },
    },
    ISFJ: {
      name: 'Cozy', title: 'The Protector',
      tagline: 'Did you eat? I brought soup. And a blanket.',
      description: 'A warm, scarf-wrapped homebody who always has a cup of tea ready for you. Cozy remembers how you take your coffee, notices when you seem off, and would fight a bear for their friends (politely).',
      strengths: ['Caring and attentive', 'Reliable and hardworking', 'Remembers the little things', 'Creates calm and comfort'],
      tendencies: ['Helps quietly, behind the scenes', 'Loves traditions', 'Finds it hard to say no'],
      funTraits: ['Owns 30 mugs and uses one', 'Keeps snacks for everyone in their bag', 'Remembers what you wore in 2014'],
      behaviors: ['Sends "home safe?" texts', 'Knits you something without being asked', 'Rewatches the same comfort show for the 9th time'],
      colors: { body: '#f4a066', belly: '#ffe0c7', accent: '#d9534f', bg: ['#5c2c0c', '#ea8f52'] },
      art: { shape: 'dome', eyes: 'happy', brows: 'soft', mouth: 'smile', head: 'none', prop: 'mug', pose: 'hold', neck: 'scarf' },
    },
    ESTJ: {
      name: 'Chief', title: 'The Organizer',
      tagline: 'Okay team, hydrate, stretch, win.',
      description: 'A whistle-blowing, cap-wearing coach of everyday life. Chief runs a tight ship, loves a good checklist, and will absolutely time how long your "quick break" was.',
      strengths: ['Gets things done', 'Clear and direct', 'Great at running things', 'Loyal and responsible'],
      tendencies: ['Likes rules that make sense', 'Says what they think', 'Keeps everyone on schedule'],
      funTraits: ['Has a laminated chore chart', 'Blows an imaginary whistle at slow walkers', 'Refers to the family as "the team"'],
      behaviors: ['Takes charge when the restaurant order goes wrong', 'Sets three alarms, wakes before all of them', 'Brings a first-aid kit to a picnic'],
      colors: { body: '#2fa35f', belly: '#b6ecc9', accent: '#ffcc33', bg: ['#0e3d22', '#27944f'] },
      art: { shape: 'square', eyes: 'dot', brows: 'determined', mouth: 'open', head: 'cap', prop: 'stopwatch', pose: 'point', neck: 'whistle' },
    },
    ESFJ: {
      name: 'Bubbles', title: 'The Host',
      tagline: 'Everyone\'s invited! There are cupcakes!',
      description: 'A bow-topped social butterfly who throws the best parties and remembers everyone\'s allergies. Bubbles keeps the friend group together with snacks, hugs and a very active group chat.',
      strengths: ['Warm and welcoming', 'Brings people together', 'Practical helper', 'Great at making people feel seen'],
      tendencies: ['Loves harmony', 'Cares what others think', 'Thrives on appreciation'],
      funTraits: ['Hosts a party for their cat\'s birthday', 'Has matching outfits for group photos', 'Knows all the gossip (for care purposes)'],
      behaviors: ['Brings homemade treats to the office', 'Introduces everyone to everyone', 'Remembers your mum\'s name and asks about her'],
      colors: { body: '#ff7b6e', belly: '#ffd0ca', accent: '#7ad3ff', bg: ['#5c1a14', '#f46a5c'] },
      art: { shape: 'wide', eyes: 'round', brows: 'soft', mouth: 'big', head: 'bow', prop: 'cupcake', pose: 'wave' },
    },
    ISTP: {
      name: 'Bolt', title: 'The Tinkerer',
      tagline: 'Hold my wrench. I got this.',
      description: 'A cool, goggle-wearing fixer of all things. Bolt says little, fixes a lot, and can turn a paperclip and some tape into a working drone. Hates meetings. Loves engines.',
      strengths: ['Hands-on problem solver', 'Cool under pressure', 'Practical and resourceful', 'Learns by doing'],
      tendencies: ['Keeps feelings close to the chest', 'Needs freedom and space', 'Lives in the moment'],
      funTraits: ['Fixes things that weren\'t broken', 'Communicates mostly in nods', 'Owns a suspicious number of tools'],
      behaviors: ['Disappears into the garage for six hours', 'Takes up rock climbing on a whim', 'Solves the crisis, then leaves without a word'],
      colors: { body: '#7d8ea3', belly: '#d7e0ea', accent: '#ff8a33', bg: ['#1f2833', '#63768c'] },
      art: { shape: 'capsule', eyes: 'half', brows: 'flat', mouth: 'smirk', head: 'goggles', prop: 'wrench', pose: 'hold' },
    },
    ISFP: {
      name: 'Petal', title: 'The Artist',
      tagline: 'I\'m not quiet, I\'m composing.',
      description: 'A beret-wearing, paint-splattered free spirit who notices the color of every sunset. Petal expresses feelings in art instead of words, and their room is basically a gallery.',
      strengths: ['Artistic and sensory', 'Gentle and open-minded', 'Lives in the moment', 'Quietly adventurous'],
      tendencies: ['Shows love through actions', 'Avoids rigid plans', 'Needs personal space to create'],
      funTraits: ['Rearranges their room every month', 'Has strong opinions about fonts', 'Collects pretty rocks'],
      behaviors: ['Stops mid-walk to photograph a leaf', 'Paints their sneakers', 'Goes on a spontaneous solo trip'],
      colors: { body: '#b58be6', belly: '#e9d9ff', accent: '#ff7eb3', bg: ['#3a2159', '#a277dd'] },
      art: { shape: 'round', eyes: 'shy', brows: 'soft', mouth: 'small', head: 'beret', prop: 'brush', pose: 'hold' },
    },
    ESTP: {
      name: 'Dash', title: 'The Daredevil',
      tagline: 'Rules? I read "suggestions".',
      description: 'A sunglasses-on, skateboard-riding thrill seeker who lives at full speed. Dash says yes first and figures it out on the way down. Somehow always lands on their feet.',
      strengths: ['Bold and energetic', 'Quick on their feet', 'Charming and fun', 'Great in a crisis'],
      tendencies: ['Acts first, thinks mid-air', 'Loves competition', 'Gets restless when things slow down'],
      funTraits: ['Turns grocery shopping into a race', 'Has a story for every scar', 'Can\'t sit still in meetings'],
      behaviors: ['Tries the spiciest thing on the menu', 'Signs up for skydiving on a Tuesday', 'Talks their way into the VIP section'],
      colors: { body: '#2f8cff', belly: '#b8d8ff', accent: '#ff4d4d', bg: ['#08244f', '#1f7cf0'] },
      art: { shape: 'bean', eyes: 'sunglasses', brows: 'none', mouth: 'grin', head: 'swoosh', prop: 'skateboard', pose: 'thumbs', lean: true },
    },
    ESFP: {
      name: 'Disco', title: 'The Showstopper',
      tagline: 'Life is a party and I\'m the DJ.',
      description: 'A star-glasses, microphone-holding entertainer who turns any room into a dance floor. Disco lives for the moment, the spotlight and your laugh, and has never met a karaoke machine they didn\'t love.',
      strengths: ['Fun and spontaneous', 'Warm and generous', 'Lights up any room', 'Practical in the moment'],
      tendencies: ['Craves excitement and people', 'Dislikes long-term planning', 'Feels things in real time'],
      funTraits: ['Has a dance for every song', 'Dresses up for grocery runs', 'Hypes up the bus driver'],
      behaviors: ['Starts the conga line', 'Books the trip, then checks the bank balance', 'Sings in the shower with full choreography'],
      colors: { body: '#ff4fd1', belly: '#ffc6f1', accent: '#ffd23f', bg: ['#4f0b44', '#e93fc0'] },
      art: { shape: 'wide', eyes: 'stars', brows: 'none', mouth: 'big', head: 'puff', prop: 'mic', pose: 'up' },
    },
  };

  // ---------------------------------------------------------------- scoring helpers
  const isType = (t) => typeof t === 'string' && TYPES.includes(t.toUpperCase());

  // traits { mbti_extraversion: 0..1, ... } -> dimensions + four-letter type (null if any is missing)
  function fromTraits(traits) {
    if (!traits) return null;
    const dims = [];
    for (const d of DIMENSIONS) {
      const v = traits[d.key];
      if (typeof v !== 'number' || !isFinite(v)) return null;
      // a perfect 50/50 tie leans right (E, N, F, P)
      const right = v >= 0.5;
      dims.push({
        key: d.key,
        value: Math.round(v * 1000) / 1000,
        letter: right ? d.right.letter : d.left.letter,
        percent: Math.round((right ? v : 1 - v) * 100),
        left: d.left,
        right: d.right,
      });
    }
    return { type: dims.map(d => d.letter).join(''), dimensions: dims };
  }

  // dimensions for a bare type (e.g. an /result/ENFP link, where the answers aren't known)
  function dimensionsForType(type) {
    const t = String(type).toUpperCase();
    return DIMENSIONS.map((d, i) => {
      const right = t[i] === d.right.letter;
      return { key: d.key, value: right ? 1 : 0, letter: t[i], percent: null, left: d.left, right: d.right };
    });
  }

  function shareText(type) {
    const c = CHARACTERS[type];
    return `I got ${type} — ${c.title}!\nWhich MBTI character are you?`;
  }

  // ---------------------------------------------------------------- art
  const INK = '#2a2140';

  // body outlines on a 200 x 220 canvas, feet at y ≈ 200.
  // top: where headwear sits; face: eye line; sides: [left x, right x, shoulder y] for arms
  const SHAPES = {
    round: { d: 'M100 64 C151 64 168 102 166 142 C164 184 138 202 100 202 C62 202 36 184 34 142 C32 102 49 64 100 64 Z', top: 64, face: 124, sides: [38, 162, 146] },
    bean: { d: 'M100 46 C141 46 153 82 153 122 C153 172 140 202 100 202 C60 202 47 172 47 122 C47 82 59 46 100 46 Z', top: 46, face: 108, sides: [50, 150, 140] },
    square: { d: 'M60 62 Q48 62 48 76 L50 186 Q50 202 66 202 L134 202 Q150 202 150 186 L152 76 Q152 62 140 62 Z', top: 62, face: 116, sides: [50, 150, 144] },
    tri: { d: 'M100 52 C114 52 168 164 164 186 C161 201 142 202 100 202 C58 202 39 201 36 186 C32 164 86 52 100 52 Z', top: 52, face: 128, sides: [52, 148, 150] },
    drop: { d: 'M100 40 C118 74 160 104 160 148 C160 184 132 202 100 202 C68 202 40 184 40 148 C40 104 82 74 100 40 Z', top: 58, face: 128, sides: [44, 156, 152] },
    cloud: { d: 'M60 118 C40 116 38 90 60 88 C58 66 86 58 98 74 C108 56 138 60 140 82 C162 78 172 102 156 116 C170 128 166 150 160 160 C158 188 134 202 100 202 C66 202 42 188 40 160 C32 146 40 122 60 118 Z', top: 68, face: 124, sides: [42, 158, 150] },
    pear: { d: 'M100 60 C128 60 136 84 140 102 C164 120 170 150 162 174 C154 197 130 203 100 203 C70 203 46 197 38 174 C30 150 36 120 60 102 C64 84 72 60 100 60 Z', top: 60, face: 112, sides: [40, 160, 146] },
    block: { d: 'M62 44 Q58 38 66 38 L134 38 Q142 38 140 46 L144 190 Q144 202 132 202 L68 202 Q56 202 56 190 Z', top: 38, face: 96, sides: [58, 142, 136] },
    dome: { d: 'M100 66 C148 66 164 104 164 144 L164 188 Q164 202 150 202 L50 202 Q36 202 36 188 L36 144 C36 104 52 66 100 66 Z', top: 66, face: 122, sides: [36, 164, 150] },
    wide: { d: 'M100 80 C152 80 178 112 178 152 C178 192 146 203 100 203 C54 203 22 192 22 152 C22 112 48 80 100 80 Z', top: 80, face: 132, sides: [24, 176, 156] },
    capsule: { d: 'M58 104 Q58 70 100 70 Q142 70 142 104 L142 176 Q142 202 100 202 Q58 202 58 176 Z', top: 70, face: 122, sides: [58, 142, 150] },
  };

  const esc = (s) => String(s);
  const stroke = (w = 5) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

  // ---- eyes (cx = left/right eye centers, y = eye line)
  function eyes(kind, y, c) {
    const L = 78, R = 122;
    const white = (x, r = 12) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 1}" fill="#fff" ${stroke(4)}/>`;
    const pupil = (x, dx = 0, dy = 1, r = 6.5) => `<circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="${INK}"/><circle cx="${x + dx - 2.2}" cy="${y + dy - 2.6}" r="2.2" fill="#fff"/>`;
    const dot = (x) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="7.5" fill="${INK}"/><circle cx="${x - 1.8}" cy="${y - 3}" r="2" fill="#fff"/>`;
    const arc = (x, up = true) => up
      ? `<path d="M${x - 10} ${y + 4} Q${x} ${y - 8} ${x + 10} ${y + 4}" fill="none" ${stroke(4.5)}/>`
      : `<path d="M${x - 10} ${y - 2} Q${x} ${y + 8} ${x + 10} ${y - 2}" fill="none" ${stroke(4.5)}/>`;
    switch (kind) {
      case 'dot': return dot(L) + dot(R);
      case 'happy': return arc(L) + arc(R);
      case 'closed': return arc(L, false) + arc(R, false) + `<path d="M${L - 11} ${y - 1} l-4 -3 M${R + 11} ${y - 1} l4 -3" ${stroke(3)}/>`;
      case 'wink': return arc(L) + white(R) + pupil(R, 1);
      case 'sparkle': {
        const star = (x) => `<path d="M${x + 2} ${y - 7} l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 Z" fill="#fff"/>`;
        return [L, R].map(x => `${white(x, 13)}<circle cx="${x}" cy="${y + 1}" r="9" fill="${INK}"/>${star(x - 2)}<circle cx="${x + 4}" cy="${y + 5}" r="1.8" fill="#fff"/>`).join('');
      }
      case 'dreamy': return [L, R].map(x => `${white(x, 13)}<circle cx="${x + 1}" cy="${y - 2}" r="8" fill="${INK}"/><circle cx="${x - 2}" cy="${y - 5}" r="3" fill="#fff"/><circle cx="${x + 4}" cy="${y + 1}" r="1.5" fill="#fff"/>`).join('');
      case 'shy': return white(L) + pupil(L, 4, 2) + white(R) + pupil(R, 4, 2);
      case 'half': return [L, R].map(x => `${white(x)}${pupil(x, 0, 3)}<path d="M${x - 13} ${y - 1} Q${x} ${y - 4} ${x + 13} ${y - 1} L${x + 13} ${y - 14} L${x - 13} ${y - 14} Z" fill="${c.body}"/><path d="M${x - 13} ${y - 1} Q${x} ${y - 4} ${x + 13} ${y - 1}" fill="none" ${stroke(4)}/>`).join('');
      case 'determined': return white(L) + pupil(L, 1, 2) + white(R) + pupil(R, -1, 2);
      case 'glasses': return white(L, 11) + pupil(L, 0, 1, 5.5) + white(R, 11) + pupil(R, 0, 1, 5.5)
        + `<circle cx="${L}" cy="${y}" r="17" fill="rgba(255,255,255,.25)" ${stroke(4.5)}/><circle cx="${R}" cy="${y}" r="17" fill="rgba(255,255,255,.25)" ${stroke(4.5)}/><path d="M${L + 17} ${y - 2} Q100 ${y - 8} ${R - 17} ${y - 2}" fill="none" ${stroke(4)}/>`;
      case 'monocle': return `${white(L)}${pupil(L, 1, 3)}<path d="M${L - 13} ${y - 1} L${L + 13} ${y - 3} L${L + 13} ${y - 14} L${L - 13} ${y - 14} Z" fill="${c.body}"/><path d="M${L - 13} ${y - 1} L${L + 13} ${y - 3}" ${stroke(4)}/>`
        + `${white(R)}${pupil(R, -1, 1)}<circle cx="${R}" cy="${y}" r="16" fill="rgba(255,255,255,.2)" stroke="${c.accent}" stroke-width="5"/><circle cx="${R}" cy="${y}" r="16" fill="none" ${stroke(2)}/><path d="M${R + 12} ${y + 11} Q${R + 22} ${y + 40} ${R + 10} ${y + 58}" fill="none" stroke="${c.accent}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
      case 'sunglasses': return `<path d="M${L - 20} ${y - 8} L${R + 20} ${y - 8} L${R + 18} ${y + 3} Q${R + 14} ${y + 14} ${R} ${y + 13} Q${R - 12} ${y + 12} ${R - 14} ${y + 2} L${L + 14} ${y + 2} Q${L + 12} ${y + 12} ${L} ${y + 13} Q${L - 14} ${y + 14} ${L - 18} ${y + 3} Z" fill="${INK}" ${stroke(3)}/><path d="M${L - 12} ${y - 3} l8 0 M${R - 12} ${y - 3} l8 0" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
      case 'stars': {
        const star = (x) => {
          const pts = [];
          for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 19; pts.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + 1 + r * Math.sin(a)).toFixed(1)}`); }
          return `<polygon points="${pts.join(' ')}" fill="${c.accent}" ${stroke(4)}/><circle cx="${x}" cy="${y + 2}" r="6" fill="${INK}"/><circle cx="${x - 2}" cy="${y}" r="2" fill="#fff"/>`;
        };
        return star(L) + star(R) + `<path d="M${L + 16} ${y - 2} Q100 ${y - 8} ${R - 16} ${y - 2}" fill="none" ${stroke(4)}/>`;
      }
      default: return white(L) + pupil(L) + white(R) + pupil(R);
    }
  }

  function brows(kind, y) {
    const L = 78, R = 122, by = y - 20;
    switch (kind) {
      case 'determined': return `<path d="M${L - 12} ${by - 4} L${L + 10} ${by + 3} M${R + 12} ${by - 4} L${R - 10} ${by + 3}" ${stroke(5)}/>`;
      case 'raised': return `<path d="M${L - 10} ${by} Q${L} ${by - 5} ${L + 10} ${by}" fill="none" ${stroke(4.5)}/><path d="M${R - 10} ${by - 6} Q${R} ${by - 13} ${R + 10} ${by - 6}" fill="none" ${stroke(4.5)}/>`;
      case 'sly': return `<path d="M${L - 11} ${by + 2} L${L + 10} ${by - 1}" ${stroke(4.5)}/><path d="M${R - 10} ${by - 5} Q${R} ${by - 10} ${R + 12} ${by - 3}" fill="none" ${stroke(4.5)}/>`;
      case 'soft': return `<path d="M${L - 9} ${by + 1} Q${L} ${by - 4} ${L + 9} ${by + 1} M${R - 9} ${by + 1} Q${R} ${by - 4} ${R + 9} ${by + 1}" fill="none" ${stroke(4)}/>`;
      case 'flat': return `<path d="M${L - 9} ${by} L${L + 9} ${by} M${R - 9} ${by} L${R + 9} ${by}" ${stroke(4.5)}/>`;
      default: return '';
    }
  }

  function mouth(kind, y, c) {
    const m = y + 28;
    switch (kind) {
      case 'big': return `<path d="M84 ${m - 3} Q100 ${m - 1} 116 ${m - 3} Q114 ${m + 17} 100 ${m + 17} Q86 ${m + 17} 84 ${m - 3} Z" fill="${INK}" ${stroke(4)}/><path d="M91 ${m + 11} Q100 ${m + 5} 109 ${m + 11} Q100 ${m + 16} 91 ${m + 11} Z" fill="#ff7a8a"/>`;
      case 'grin': return `<path d="M82 ${m - 2} Q100 ${m + 2} 118 ${m - 2} Q116 ${m + 13} 100 ${m + 13} Q84 ${m + 13} 82 ${m - 2} Z" fill="#fff" ${stroke(4)}/><path d="M84 ${m + 3} Q100 ${m + 6} 116 ${m + 3}" fill="none" ${stroke(2.5)}/>`;
      case 'smirk': return `<path d="M88 ${m + 3} Q104 ${m + 7} 115 ${m - 3}" fill="none" ${stroke(4.5)}/>`;
      case 'flat': return `<path d="M91 ${m + 3} L109 ${m + 3}" ${stroke(4.5)}/>`;
      case 'o': return `<ellipse cx="100" cy="${m + 4}" rx="6" ry="7" fill="${INK}"/>`;
      case 'open': return `<path d="M88 ${m - 1} Q100 ${m - 4} 112 ${m - 1} Q112 ${m + 16} 100 ${m + 16} Q88 ${m + 16} 88 ${m - 1} Z" fill="${INK}" ${stroke(4)}/><ellipse cx="100" cy="${m + 11}" rx="6" ry="3.5" fill="#ff7a8a"/>`;
      case 'small': return `<path d="M93 ${m + 1} Q100 ${m + 7} 107 ${m + 1}" fill="none" ${stroke(4)}/>`;
      default: return `<path d="M87 ${m} Q100 ${m + 12} 113 ${m}" fill="none" ${stroke(4.5)}/>`;
    }
  }

  // ---- headwear, drawn relative to the shape's top
  function head(kind, s, c) {
    const t = s.top;
    switch (kind) {
      case 'wizard': return `<path d="M58 ${t + 14} Q100 ${t + 2} 142 ${t + 14} Q104 ${t - 4} 112 ${t - 42} Q88 ${t - 18} 58 ${t + 14} Z" fill="#3b2a7a" ${stroke(5)}/><path d="M50 ${t + 14} Q100 ${t + 2} 150 ${t + 14} Q100 ${t + 24} 50 ${t + 14} Z" fill="#3b2a7a" ${stroke(5)}/><path d="M96 ${t - 14} l2.5 5 5.5 .8 -4 3.8 1 5.4 -5 -2.6 -5 2.6 1 -5.4 -4 -3.8 5.5 -.8 Z" fill="${c.accent}"/><circle cx="112" cy="${t - 42}" r="5" fill="${c.accent}" ${stroke(3)}/>`;
      case 'antenna': return `<path d="M100 ${t + 2} Q96 ${t - 16} 104 ${t - 26}" fill="none" ${stroke(5)}/><circle cx="105" cy="${t - 36}" r="12" fill="${c.accent}" ${stroke(4.5)}/><path d="M101 ${t - 38} q4 -6 8 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M84 ${t - 44} l-6 -6 M126 ${t - 44} l6 -6 M105 ${t - 55} l0 -8" ${stroke(3.5)}/>`;
      case 'crown': return `<path d="M72 ${t + 6} L70 ${t - 24} L86 ${t - 8} L100 ${t - 30} L114 ${t - 8} L130 ${t - 24} L128 ${t + 6} Z" fill="${c.accent}" ${stroke(5)}/><circle cx="100" cy="${t - 8}" r="4.5" fill="#ff5d73" ${stroke(2.5)}/><circle cx="84" cy="${t - 2}" r="3" fill="#5ad1ff"/><circle cx="116" cy="${t - 2}" r="3" fill="#5ad1ff"/>`;
      case 'zigzag': return `<path d="M62 ${t + 62} L58 ${t + 30} L74 ${t + 40} L76 ${t + 6} L90 ${t + 22} L100 ${t - 16} L110 ${t + 22} L124 ${t + 6} L126 ${t + 40} L142 ${t + 30} L138 ${t + 62}" fill="${c.accent}" ${stroke(5)}/>`;
      case 'moon': return `<path d="M112 ${t - 40} A22 22 0 1 0 128 ${t - 4} A17 17 0 1 1 112 ${t - 40} Z" fill="${c.accent}" ${stroke(4.5)}/><circle cx="72" cy="${t - 18}" r="3" fill="${c.accent}"/><circle cx="60" cy="${t - 34}" r="2" fill="${c.accent}"/>`;
      case 'flower': {
        const cx = 118, cy = t - 12;
        const petals = [0, 72, 144, 216, 288].map(a => { const r = a * Math.PI / 180; return `<ellipse cx="${(cx + 10 * Math.cos(r)).toFixed(1)}" cy="${(cy + 10 * Math.sin(r)).toFixed(1)}" rx="8" ry="8" fill="${c.accent}" ${stroke(3.5)}/>`; }).join('');
        return `<path d="M${cx - 8} ${t + 16} Q${cx - 4} ${t + 4} ${cx} ${cy + 6}" fill="none" ${stroke(4)}/>${petals}<circle cx="${cx}" cy="${cy}" r="6.5" fill="#ffe066" ${stroke(3)}/>`;
      }
      case 'rays': {
        const cy = s.face + 8;
        return Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + Math.PI / 12;
          const x1 = 100 + 74 * Math.cos(a), y1 = cy + 74 * Math.sin(a), x2 = 100 + 94 * Math.cos(a), y2 = cy + 94 * Math.sin(a);
          return y2 > 196 ? '' : `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c.accent}" stroke-width="9" stroke-linecap="round"/><path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#ffe066" stroke-width="3.5" stroke-linecap="round"/>`;
        }).join('');
      }
      case 'tufts': {
        const tuft = (x, y, r, rot) => {
          const pts = [];
          for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5 + rot, rr = i % 2 ? r * 0.45 : r; pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`); }
          return `<polygon points="${pts.join(' ')}" fill="${c.accent}" ${stroke(4)}/>`;
        };
        return tuft(78, t - 2, 13, -0.3) + tuft(100, t - 14, 16, 0) + tuft(122, t - 2, 13, 0.3);
      }
      case 'part': return `<path d="M60 ${t + 30} Q58 ${t - 6} 100 ${t - 6} Q142 ${t - 6} 140 ${t + 30} Q124 ${t + 12} 88 ${t + 16} Q74 ${t + 18} 60 ${t + 30} Z" fill="#2c3552" ${stroke(4.5)}/><path d="M86 ${t - 4} Q84 ${t + 8} 88 ${t + 16}" fill="none" stroke="#56628a" stroke-width="3" stroke-linecap="round"/>`;
      case 'cap': return `<path d="M56 ${t + 14} Q56 ${t - 18} 100 ${t - 18} Q144 ${t - 18} 144 ${t + 14} Z" fill="${c.accent}" ${stroke(5)}/><path d="M100 ${t + 12} Q146 ${t + 6} 170 ${t + 18} Q146 ${t + 26} 100 ${t + 20} Z" fill="${c.accent}" ${stroke(5)}/><circle cx="100" cy="${t - 18}" r="4" fill="${INK}"/><path d="M100 ${t - 14} L100 ${t + 12}" stroke="${INK}" stroke-width="2.5" opacity=".5"/>`;
      case 'bow': return `<path d="M100 ${t + 2} L74 ${t - 16} Q66 ${t + 4} 74 ${t + 20} Z M100 ${t + 2} L126 ${t - 16} Q134 ${t + 4} 126 ${t + 20} Z" fill="${c.accent}" ${stroke(4.5)}/><circle cx="100" cy="${t + 2}" r="8" fill="${c.accent}" ${stroke(4.5)}/>`;
      case 'goggles': return `<path d="M${s.sides[0] + 2} ${t + 26} Q100 ${t + 12} ${s.sides[1] - 2} ${t + 26}" fill="none" stroke="#3a3f47" stroke-width="7" stroke-linecap="round"/><circle cx="82" cy="${t + 20}" r="13" fill="#9fe3ff" ${stroke(4.5)}/><circle cx="118" cy="${t + 20}" r="13" fill="#9fe3ff" ${stroke(4.5)}/><path d="M76 ${t + 15} l6 -3 M112 ${t + 15} l6 -3" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
      case 'beret': return `<path d="M62 ${t + 12} Q54 ${t - 16} 96 ${t - 18} Q142 ${t - 18} 140 ${t + 4} Q126 ${t + 16} 62 ${t + 12} Z" fill="#e2445c" ${stroke(5)}/><path d="M98 ${t - 18} q2 -9 8 -10" fill="none" ${stroke(4)}/>`;
      case 'swoosh': return `<path d="M60 ${t + 24} Q54 ${t - 8} 96 ${t - 6} Q132 ${t - 6} 150 ${t - 24} Q150 ${t + 6} 140 ${t + 24} Q116 ${t + 8} 60 ${t + 24} Z" fill="#1b2a4a" ${stroke(4.5)}/>`;
      case 'puff': return `<path d="M44 ${t + 34} C26 ${t + 10} 48 ${t - 22} 70 ${t - 12} C74 ${t - 36} 110 ${t - 40} 118 ${t - 16} C140 ${t - 30} 170 ${t - 4} 156 ${t + 34} Q100 ${t + 8} 44 ${t + 34} Z" fill="#6b2bd9" ${stroke(5)}/><circle cx="84" cy="${t - 12}" r="3.5" fill="${c.accent}"/><circle cx="130" cy="${t - 2}" r="3" fill="${c.accent}"/>`;
      default: return '';
    }
  }

  function neck(kind, s, c) {
    const y = s.face + 50;
    switch (kind) {
      case 'bowtie': return `<path d="M100 ${y} L84 ${y - 9} L84 ${y + 9} Z M100 ${y} L116 ${y - 9} L116 ${y + 9} Z" fill="${c.accent}" ${stroke(4)}/><circle cx="100" cy="${y}" r="4.5" fill="${c.accent}" ${stroke(3)}/>`;
      case 'scarf': return `<path d="M${s.sides[0] + 6} ${y - 6} Q100 ${y + 12} ${s.sides[1] - 6} ${y - 6} L${s.sides[1] - 4} ${y + 8} Q100 ${y + 26} ${s.sides[0] + 4} ${y + 8} Z" fill="${c.accent}" ${stroke(4.5)}/><path d="M122 ${y + 10} L128 ${y + 38} L114 ${y + 38} L112 ${y + 14}" fill="${c.accent}" ${stroke(4.5)}/><path d="M${s.sides[0] + 14} ${y + 2} l0 8 M${s.sides[0] + 30} ${y + 7} l0 8 M${s.sides[1] - 14} ${y + 2} l0 8" stroke="#fff" stroke-width="2.5" opacity=".6" stroke-linecap="round"/>`;
      case 'whistle': return `<path d="M82 ${y - 12} Q100 ${y + 4} 118 ${y - 12}" fill="none" stroke="${c.accent}" stroke-width="3" /><rect x="94" y="${y - 6}" width="18" height="11" rx="5" fill="#c9d2dc" ${stroke(3.5)}/>`;
      default: return '';
    }
  }

  // ---- arms: an ink-outlined rounded limb ending in a mitten hand
  function limb(x1, y1, x2, y2, c, bend = 0) {
    const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2 - Math.abs(bend) * 0.4;
    const d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="17" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c.body}" stroke-width="9" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="9.5" fill="${c.body}" ${stroke(4.5)}/>`;
  }

  // returns { l, r, hand, pivots }: each arm on its own so it can sway from the shoulder,
  // hand = where the right hand is (held props are drawn there, inside the right arm)
  function arms(pose, s, c) {
    const [lx, rx, y] = s.sides;
    const L = (x2, y2, bend = 0) => limb(lx + 4, y, x2, y2, c, bend);
    const R = (x2, y2, bend = 0) => limb(rx - 4, y, x2, y2, c, bend);
    const out = (l, r, hand) => ({ l, r, hand, pivots: [[lx + 4, y], [rx - 4, y]] });
    switch (pose) {
      case 'up': return out(L(lx - 26, y - 52, -6), R(rx + 26, y - 52, 6), [rx + 26, y - 52]);
      case 'wide': return out(L(lx - 34, y - 18), R(rx + 34, y - 18), [rx + 34, y - 18]);
      case 'wave': return out(L(lx - 16, y + 30), R(rx + 30, y - 40, 8), [rx + 30, y - 40]);
      case 'point': return out(L(lx - 16, y + 30), R(rx + 38, y - 14), [rx + 38, y - 14]);
      case 'shrug': return out(L(lx - 30, y - 22, 8), R(rx + 30, y - 22, -8), [rx + 30, y - 22]);
      case 'think': return out(L(lx - 16, y + 30), R(rx + 6, s.top + 20, 22), [rx + 6, s.top + 20]);
      case 'thumbs': return out(L(lx - 18, y + 28), R(rx + 28, y - 26, 6) + `<path d="M${rx + 28} ${y - 34} l0 -12" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M${rx + 28} ${y - 34} l0 -12" stroke="${c.body}" stroke-width="4.5" stroke-linecap="round"/>`, [rx + 28, y - 26]);
      case 'down': return out(L(lx - 12, y + 32, -4), R(rx + 12, y + 32, 4), [rx + 12, y + 32]);
      default: return out(L(lx - 16, y + 30), R(rx + 22, y + 18), [rx + 22, y + 18]); // hold
    }
  }

  // props that float around the character instead of sitting in the hand
  const FLOATING_PROPS = new Set(['question', 'bolt', 'stars', 'confetti']);

  // ---- props held in (or floating near) the right hand
  function prop(kind, hand, s, c) {
    const [hx, hy] = hand;
    switch (kind) {
      case 'chess': return `<g transform="translate(${hx - 2} ${hy - 44})"><path d="M-12 40 L14 40 L11 30 L-9 30 Z" fill="#f4f0ff" ${stroke(4)}/><path d="M-7 30 Q-10 12 -2 4 Q-8 -2 0 -10 Q12 -12 14 4 Q12 16 9 30 Z" fill="#f4f0ff" ${stroke(4)}/><circle cx="3" cy="-2" r="2" fill="${INK}"/></g>`;
      case 'question': return `<text x="${146}" y="${s.top - 4}" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="900" font-size="34" fill="${c.accent}" stroke="${INK}" stroke-width="3.5" paint-order="stroke">?</text><text x="${170}" y="${s.top - 26}" font-family="Arial, sans-serif" font-weight="900" font-size="20" fill="${c.accent}" stroke="${INK}" stroke-width="3" paint-order="stroke">?</text>`;
      case 'megaphone': return `<g transform="translate(${hx} ${hy}) rotate(-18)"><path d="M-2 -6 L30 -20 L30 20 L-2 6 Z" fill="${c.accent}" ${stroke(4)}/><rect x="-10" y="-7" width="10" height="14" rx="3" fill="#fff" ${stroke(4)}/><path d="M38 -12 q8 12 0 24 M46 -18 q12 18 0 36" fill="none" ${stroke(3.5)}/></g>`;
      case 'bolt': return `<path d="M${hx + 4} ${hy - 70} L${hx - 12} ${hy - 38} L${hx} ${hy - 38} L${hx - 8} ${hy - 12} L${hx + 16} ${hy - 48} L${hx + 4} ${hy - 48} Z" fill="${c.accent}" ${stroke(4)}/>`;
      case 'stars': return [[34, s.top + 18, 9], [168, s.top + 36, 7], [158, s.top - 4, 5]].map(([x, y, r]) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${c.accent}" ${stroke(2.5)}/>`).join('');
      case 'balloon': return `<path d="M${hx} ${hy} Q${hx + 8} ${hy - 30} ${hx + 4} ${hy - 58}" fill="none" ${stroke(2.5)}/><path d="M${hx + 4} ${hy - 58} C${hx - 20} ${hy - 76} ${hx - 14} ${hy - 104} ${hx + 4} ${hy - 90} C${hx + 22} ${hy - 104} ${hx + 28} ${hy - 76} ${hx + 4} ${hy - 58} Z" fill="${c.accent}" ${stroke(4)}/><path d="M${hx - 6} ${hy - 90} q3 -5 8 -4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
      case 'heart': return `<path d="M${hx} ${hy - 12} C${hx - 20} ${hy - 30} ${hx - 14} ${hy - 50} ${hx} ${hy - 38} C${hx + 14} ${hy - 50} ${hx + 20} ${hy - 30} ${hx} ${hy - 12} Z" fill="${c.accent}" ${stroke(4)}/>`;
      case 'confetti': {
        const bits = [[26, 40, '#ffe14d', 20], [170, 30, '#5ad1ff', -30], [40, 12, '#7cf29c', 50], [156, 6, '#ff9f43', 10], [184, 70, '#ffe14d', -15], [14, 84, '#b18cff', 35]];
        return bits.map(([x, y, col, r]) => `<rect x="${x}" y="${y}" width="10" height="5" rx="2" fill="${col}" transform="rotate(${r} ${x} ${y})" ${stroke(2)}/>`).join('');
      }
      case 'clipboard': return `<g transform="translate(${hx - 4} ${hy - 30}) rotate(8)"><rect x="-4" y="0" width="34" height="42" rx="5" fill="#c98f53" ${stroke(4)}/><rect x="2" y="7" width="22" height="30" rx="2" fill="#fff"/><rect x="7" y="-4" width="12" height="8" rx="2" fill="#cfd6df" ${stroke(3)}/><path d="M6 16 l3 3 5 -6 M6 27 l3 3 5 -6" fill="none" stroke="#2fa35f" stroke-width="2.5" stroke-linecap="round"/><path d="M17 17 h6 M17 28 h6" stroke="#9aa3ad" stroke-width="2.5" stroke-linecap="round"/></g>`;
      case 'mug': return `<g transform="translate(${hx - 6} ${hy - 22})"><path d="M-4 0 L26 0 L24 28 Q23 34 16 34 L6 34 Q-1 34 -2 28 Z" fill="#fff6ea" ${stroke(4)}/><path d="M25 7 Q36 7 35 16 Q34 24 24 23" fill="none" ${stroke(4)}/><path d="M6 -8 q-4 -6 0 -12 M15 -8 q-4 -6 0 -12" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".55"/><path d="M3 12 h16" stroke="${c.accent}" stroke-width="4" stroke-linecap="round"/></g>`;
      case 'stopwatch': return `<g transform="translate(${hx + 10} ${hy - 6})"><circle r="15" fill="#fff" ${stroke(4)}/><rect x="-4" y="-24" width="8" height="7" rx="2" fill="${c.accent}" ${stroke(3)}/><path d="M0 0 L0 -9 M0 0 L6 4" ${stroke(3)}/></g>`;
      case 'cupcake': return `<g transform="translate(${hx + 2} ${hy - 26})"><path d="M-14 12 L14 12 L10 32 L-10 32 Z" fill="#7ad3ff" ${stroke(4)}/><path d="M-17 12 Q-18 -4 -4 -4 Q0 -14 8 -6 Q20 -6 17 12 Z" fill="#fff0f6" ${stroke(4)}/><circle cx="2" cy="-12" r="5" fill="#ff4d6d" ${stroke(3)}/><path d="M-8 4 l2 -2 M4 2 l2 2 M10 6 l-2 1" stroke="#ffb703" stroke-width="2.5" stroke-linecap="round"/></g>`;
      case 'wrench': return `<g transform="translate(${hx} ${hy}) rotate(35)"><rect x="-4" y="-44" width="9" height="40" rx="4" fill="#c9d2dc" ${stroke(4)}/><path d="M-12 -48 Q-12 -62 0 -62 Q12 -62 12 -48 L6 -44 L6 -54 L-5 -54 L-5 -44 Z" fill="#c9d2dc" ${stroke(4)}/></g>`;
      case 'brush': return `<g transform="translate(${hx} ${hy}) rotate(30)"><rect x="-3" y="-46" width="7" height="40" rx="3" fill="#c98f53" ${stroke(3.5)}/><path d="M-5 -46 Q0 -64 6 -46 Z" fill="${c.accent}" ${stroke(3.5)}/></g><circle cx="${hx - 24}" cy="${hy - 60}" r="5" fill="#ffd23f" ${stroke(2.5)}/><circle cx="${hx - 12}" cy="${hy - 74}" r="4" fill="#5ad1ff" ${stroke(2.5)}/>`;
      case 'mic': return `<g transform="translate(${hx} ${hy}) rotate(-25)"><rect x="-4" y="-2" width="9" height="30" rx="4" fill="#3a3f47" ${stroke(3.5)}/><circle cx="0" cy="-10" r="11" fill="#c9d2dc" ${stroke(4)}/><path d="M-6 -14 h12 M-7 -8 h14" stroke="${INK}" stroke-width="2" opacity=".5"/></g><path d="M${hx + 26} ${hy - 30} q4 -8 10 -4 M${hx + 20} ${hy - 44} q2 -8 10 -6" fill="none" ${stroke(3)}/><g transform="translate(${hx - 40} ${hy - 76})"><path d="M8 0 L8 18" ${stroke(3)}/><path d="M8 0 Q14 2 16 8" fill="none" ${stroke(3)}/><ellipse cx="4" cy="19" rx="5.5" ry="4.5" fill="${c.accent}" ${stroke(3)}/></g>`;
      default: return '';
    }
  }

  // Full character as an SVG string (no ids or <defs>, so any number can share a page)
  function svg(type, { title = true } = {}) {
    const t = String(type || '').toUpperCase();
    const ch = CHARACTERS[t];
    if (!ch) return '';
    const c = ch.colors, a = ch.art, s = SHAPES[a.shape] || SHAPES.round;
    const faceY = s.face;
    const armParts = arms(a.pose, s, c);
    const board = a.prop === 'skateboard';
    const ground = board
      ? `<path d="M40 204 Q100 214 160 204" fill="none" stroke="#ffcf3f" stroke-width="10" stroke-linecap="round"/><path d="M40 204 Q100 214 160 204" fill="none" ${stroke(3)} opacity=".9"/><circle cx="62" cy="214" r="6" fill="#fff" ${stroke(3.5)}/><circle cx="138" cy="214" r="6" fill="#fff" ${stroke(3.5)}/>`
      : `<ellipse cx="100" cy="207" rx="58" ry="8" fill="rgba(0,0,0,.18)"/>`;
    const body = `<path d="${s.d}" fill="${c.body}" ${stroke(5.5)}/>`;
    // belly patch + gloss, clipped to the body by staying well inside it
    const belly = `<ellipse cx="100" cy="${Math.round((faceY + 202) / 2 + 22)}" rx="${a.shape === 'block' || a.shape === 'capsule' ? 28 : 36}" ry="${Math.round((202 - faceY) / 3.4)}" fill="${c.belly}" opacity=".85"/>`;
    const gloss = `<ellipse cx="${(s.sides[0] + 100) / 2 - 4}" cy="${s.top + 26}" rx="11" ry="6" transform="rotate(-30 ${(s.sides[0] + 100) / 2 - 4} ${s.top + 26})" fill="#fff" opacity=".45"/>`;
    const cheeks = `<ellipse cx="60" cy="${faceY + 22}" rx="9" ry="5.5" fill="#ff6f91" opacity=".45"/><ellipse cx="140" cy="${faceY + 22}" rx="9" ry="5.5" fill="#ff6f91" opacity=".45"/>`;
    const behindHead = a.head === 'rays' ? head('rays', s, c) : '';
    const frontHead = a.head !== 'rays' ? head(a.head, s, c) : '';
    const feet = board ? '' : `<ellipse cx="76" cy="201" rx="15" ry="7" fill="${c.body}" ${stroke(4.5)}/><ellipse cx="124" cy="201" rx="15" ry="7" fill="${c.body}" ${stroke(4.5)}/>`;
    // idle animation hooks (styled by the page): mb-breathe, mb-eyes (blink), mb-arm (sway),
    // mb-bits (bob), mb-shadow. A per-type delay keeps a grid of characters out of lockstep.
    const pivot = (x, y) => `style="transform-origin:${x}px ${y}px"`;
    const floats = FLOATING_PROPS.has(a.prop);
    const held = floats ? '' : prop(a.prop, armParts.hand, s, c);
    const floating = floats ? `<g class="mb-bits">${prop(a.prop, armParts.hand, s, c)}</g>` : '';
    const armL = `<g class="mb-arm mb-arm-l" ${pivot(...armParts.pivots[0])}>${armParts.l}</g>`;
    const armR = `<g class="mb-arm mb-arm-r" ${pivot(...armParts.pivots[1])}>${armParts.r}${held}</g>`;
    const figure = [
      behindHead, armL, feet, body, belly, gloss, cheeks,
      `<g class="mb-eyes" ${pivot(100, faceY)}>${eyes(a.eyes, faceY, c)}</g>`, brows(a.brows, faceY), mouth(a.mouth, faceY, c),
      neck(a.neck, s, c), frontHead, armR,
    ].join('');
    const breathing = `<g class="mb-breathe" ${pivot(100, 204)}>${figure}</g>${floating}`;
    const lean = a.lean ? `<g transform="rotate(-8 100 205)">${breathing}</g>` : breathing;
    const delay = -([...t].reduce((n, ch2) => n * 7 + ch2.charCodeAt(0), 0) % 40) / 10;
    const shadow = board ? ground : `<g class="mb-shadow" ${pivot(100, 207)}>${ground}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -40 224 266" role="img" aria-label="${esc(ch.name)}, ${esc(ch.title)}" style="--mb-delay:${delay}s">${title ? `<title>${esc(ch.name)} · ${esc(ch.title)} (${t})</title>` : ''}${shadow}${lean}</svg>`;
  }

  // ---------------------------------------------------------------- little icon characters
  // Tiny Moodlings used instead of emoji: one per letter (I E S N T F J P), per group
  // (NT NF SJ SP) and per result section. Same ink outline, blush and blink as the cast.
  const ICONS = {
    I: { color: '#7b8cde', eyes: 'closed', mouth: 'small', extra: 'headphones' },
    E: { color: '#ff8a5c', eyes: 'happy', mouth: 'open', extra: 'partyhat' },
    S: { color: '#3fb5a3', eyes: 'dot', mouth: 'small', extra: 'magnifier' },
    N: { color: '#9b6bff', eyes: 'up', mouth: 'o', extra: 'sparkle' },
    T: { color: '#4a90e2', eyes: 'dot', mouth: 'flat', extra: 'specs' },
    F: { color: '#ff5f8f', eyes: 'happy', mouth: 'smile', extra: 'heart' },
    J: { color: '#2fa35f', eyes: 'dot', mouth: 'smile', extra: 'check' },
    P: { color: '#ffb224', eyes: 'wink', mouth: 'grin', extra: 'balloon' },
    NT: { color: '#4a90e2', eyes: 'dot', mouth: 'smile', extra: 'bulb' },
    NF: { color: '#ff5f8f', eyes: 'up', mouth: 'smile', extra: 'rainbow' },
    SJ: { color: '#2fa35f', eyes: 'dot', mouth: 'smile', extra: 'shield' },
    SP: { color: '#ff8a5c', eyes: 'wink', mouth: 'grin', extra: 'zoom' },
    strengths: { eyes: 'dot', mouth: 'grin', extra: 'flex' },
    tendencies: { eyes: 'side', mouth: 'small', extra: 'arrow' },
    fun: { eyes: 'happy', mouth: 'open', extra: 'tears' },
    behaviors: { eyes: 'side', mouth: 'o', extra: 'peek' },
  };

  function icon(kind, color) {
    const d = ICONS[kind];
    if (!d) return '';
    const fill = color || d.color || '#9b6bff';
    const k = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
    const ey = 25;
    const eyeSet = {
      dot: `<circle cx="18" cy="${ey}" r="2.6" fill="${INK}"/><circle cx="30" cy="${ey}" r="2.6" fill="${INK}"/>`,
      happy: `<path d="M15 ${ey + 1} q3 -4 6 0 M27 ${ey + 1} q3 -4 6 0" fill="none" ${k(2.5)}/>`,
      closed: `<path d="M15 ${ey - 1} q3 4 6 0 M27 ${ey - 1} q3 4 6 0" fill="none" ${k(2.5)}/>`,
      up: `<circle cx="18" cy="${ey}" r="3.4" fill="#fff" ${k(2)}/><circle cx="18.6" cy="${ey - 1.2}" r="1.7" fill="${INK}"/><circle cx="30" cy="${ey}" r="3.4" fill="#fff" ${k(2)}/><circle cx="30.6" cy="${ey - 1.2}" r="1.7" fill="${INK}"/>`,
      wink: `<path d="M15 ${ey + 1} q3 -4 6 0" fill="none" ${k(2.5)}/><circle cx="30" cy="${ey}" r="2.6" fill="${INK}"/>`,
      side: `<circle cx="19.5" cy="${ey}" r="2.6" fill="${INK}"/><circle cx="31.5" cy="${ey}" r="2.6" fill="${INK}"/>`,
    }[d.eyes];
    const mouthSet = {
      small: `<path d="M21 32 q3 2.5 6 0" fill="none" ${k(2.2)}/>`,
      smile: `<path d="M19 31 q5 5 10 0" fill="none" ${k(2.4)}/>`,
      open: `<path d="M19 30 q5 1 10 0 q-1 7 -5 7 q-4 0 -5 -7 Z" fill="${INK}"/>`,
      o: `<ellipse cx="24" cy="33" rx="2.6" ry="3" fill="${INK}"/>`,
      flat: `<path d="M20 33 h8" ${k(2.4)}/>`,
      grin: `<path d="M18 30 q6 2 12 0 q-1 6 -6 6 q-5 0 -6 -6 Z" fill="#fff" ${k(2)}/>`,
    }[d.mouth];
    const extras = {
      headphones: `<path d="M7 26 Q7 5 24 5 Q41 5 41 26" fill="none" ${k(3)}/><rect x="3" y="22" width="8" height="12" rx="3" fill="${INK}"/><rect x="37" y="22" width="8" height="12" rx="3" fill="${INK}"/>`,
      partyhat: `<path d="M16 12 L24 -8 L32 12 Z" fill="#ffe14d" ${k(2.5)}/><path d="M19 5 L29 5 M21 -1 L27 -1" stroke="#ff5f8f" stroke-width="2.5"/><circle cx="24" cy="-9" r="3" fill="#ff5f8f" ${k(2)}/>`,
      magnifier: `<circle cx="31" cy="25" r="7" fill="rgba(255,255,255,.35)" ${k(2.6)}/><path d="M36 30 L43 37" ${k(3.5)}/>`,
      sparkle: `<path d="M36 -4 Q36 4 44 4 Q36 4 36 12 Q36 4 28 4 Q36 4 36 -4 Z" fill="#ffe14d" ${k(2)}/>`,
      specs: `<rect x="12" y="20" width="12" height="10" rx="2" fill="rgba(255,255,255,.3)" ${k(2.4)}/><rect x="24" y="20" width="12" height="10" rx="2" fill="rgba(255,255,255,.3)" ${k(2.4)}/>`,
      heart: `<path d="M24 44 C14 37 16 30 24 34 C32 30 34 37 24 44 Z" fill="#fff" ${k(2.2)}/>`,
      check: `<rect x="32" y="30" width="14" height="16" rx="3" fill="#fff" ${k(2.4)}/><path d="M35 38 l3 3 5 -6" fill="none" stroke="#2fa35f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      balloon: `<path d="M41 34 Q43 24 42 14" fill="none" ${k(1.6)}/><ellipse cx="42" cy="7" rx="6" ry="7.5" fill="#ff5f8f" ${k(2.2)}/>`,
      bulb: `<circle cx="24" cy="-4" r="6" fill="#ffe14d" ${k(2.2)}/><path d="M24 2 L24 8" ${k(2.2)}/><path d="M14 -8 l-3 -3 M34 -8 l3 -3" ${k(2)}/>`,
      rainbow: `<path d="M8 12 Q24 -12 40 12" fill="none" stroke="#ff6b6b" stroke-width="3.5"/><path d="M12 13 Q24 -6 36 13" fill="none" stroke="#ffd23f" stroke-width="3.5"/><path d="M16 14 Q24 0 32 14" fill="none" stroke="#5ad1ff" stroke-width="3.5"/>`,
      shield: `<path d="M34 28 L44 31 Q44 42 39 46 Q34 42 34 31 Z" fill="#ffe14d" ${k(2.2)}/>`,
      zoom: `<path d="M-2 22 h7 M-4 29 h8 M-2 36 h7" ${k(2.4)}/>`,
      flex: `<path d="M40 30 Q48 22 42 14" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M40 30 Q48 22 42 14" fill="none" stroke="${fill}" stroke-width="3.5" stroke-linecap="round"/><circle cx="42" cy="12" r="4" fill="${fill}" ${k(2.2)}/>`,
      arrow: `<path d="M34 6 L44 6 L44 16 M44 6 L34 16" fill="none" ${k(2.6)}/>`,
      tears: `<path d="M11 29 q-2 4 0 6 q2 -2 0 -6 Z M37 29 q-2 4 0 6 q2 -2 0 -6 Z" fill="#5ad1ff" ${k(1.4)}/>`,
      peek: `<path d="M40 16 l4 -4 M42 22 l5 -1" ${k(2.2)}/>`,
    }[d.extra] || '';
    const behind = d.extra === 'headphones' || d.extra === 'rainbow';
    const body = `<path d="M24 9 C36 9 42 17 42 28 C42 39 34 44 24 44 C14 44 6 39 6 28 C6 17 12 9 24 9 Z" fill="${fill}" ${k(3)}/>`;
    const blush = `<ellipse cx="12.5" cy="31" rx="3" ry="2" fill="#ff6f91" opacity=".5"/><ellipse cx="35.5" cy="31" rx="3" ry="2" fill="#ff6f91" opacity=".5"/>`;
    const gloss = `<ellipse cx="15" cy="16" rx="4" ry="2.4" transform="rotate(-30 15 16)" fill="#fff" opacity=".45"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -14 58 62" aria-hidden="true">${behind ? extras : ''}${body}${gloss}${blush}<g class="mb-eyes" style="transform-origin:24px ${ey}px">${eyeSet}</g>${mouthSet}${behind ? '' : extras}</svg>`;
  }

  return { DIMENSIONS, TYPES, GROUPS, CHARACTERS, groupOf, isType, fromTraits, dimensionsForType, shareText, svg, icon };
});
