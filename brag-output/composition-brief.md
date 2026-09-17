# Hyperframes Composition Brief: MoodPal

## Objective
Create a short launch-style brag video for MoodPal, a Telegram bot and mini app where your mood is an animated sticker.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape, 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: /Users/saman/Documents/MoodPal
- Primary files read: src/public/ui/index.html (mini app), src/constants/msg.constant.js and mood.constant.js (bot copy and the 18 moods), src/constants/common.constant.js (menu), README.md, package.json
- Product name: MoodPal
- Tagline / strongest claim: Your mood. As a sticker.
- Key UI or visual moment to recreate: the bot's 18-button mood picker, the mini app friends grid with animated stickers and coloured glows, the Big Five radar with the OVR badge, a Talk chat bubble
- Copy that must appear verbatim:
  - "I'm fine."
  - Say it with a sticker instead.
  - It's time to express yourself! Select the mood that best describes how you're feeling right now:
  - See how your friends really are.
  - 6 tests. 57 traits. One radar.
  - Rough day. Can we talk?
  - That sounds heavy. What happened today?
  - an AI, not a therapist
  - Your mood. As a sticker.

## Creative Direction
- Tone preset: default
- Creative direction: a mood ring for your group chat. Playful, warm, emoji first, zero SaaS talk.
- Interpretation: 5 scenes, 3.5 to 4.5s each. Fast entrances, long enough holds. Motion comes from stickers popping and cards arriving on the beat.
- Angle: "I'm fine." is the biggest lie in every group chat. MoodPal swaps it for a sticker that actually moves, then builds a picture of you around that one honest tap.
- Hook: `"I'm fine."` types out, gets struck through, the 😩 Overwhelmed sticker slams in. "Say it with a sticker instead."
- Outro / punchline: MoodPal wordmark and logo, "Your mood. As a sticker.", "Telegram · t.me/MoodPals", the 🤩 sticker looping beside it.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Em dashes in any on-screen copy

## Visual Identity
- Background: #0f1115, cards #1b1e25
- Text: #f2f3f5, hint #8b919c
- Accent: #3390ec; per-mood glows in hsl (motivated 25, happy 45, tired 230, anxious 280, excited 330, relaxed 160)
- Display font: system UI stack (-apple-system, "SF Pro Text", Roboto, Segoe UI), weight 800
- Body font: same stack, 500 to 600
- Visual references from the project: mini app cards (20px radius, soft shadow, radial glow behind the sticker), freshness pill with a green dot, Telegram-blue buttons, radar with amber/orange OVR gradient text

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. "I'm fine." (4s): typed hook, strike-through, 😩 sticker slam, "Say it with a sticker instead."
2. The picker (4.5s): Telegram chat frame, bot message, 18 buttons in 6 rows arriving on the beat, cursor taps 🤩 Motivated, big sticker pops.
3. Friends' moods (4.5s): phone frame with the mini app, your mood card, 5 friend cards one by one, caption "See how your friends really are."
4. The radar (4.5s): Big Five pentagon springs open, OVR counts to 48, three trait bars fill, caption "6 tests. 57 traits. One radar."
5. Talk and outro (3.5s): typed user bubble, companion reply on the cue with the "an AI, not a therapist" tag, crossfade to logo, wordmark, tagline.

## Audio
- Audio role: warm upbeat bed with motion-matched UI accents
- Audio arc: quiet typed hook, then the beat opens up at the sticker slam, accents ride the grid through picker, cards and radar, the Talk reply lands on a strong cue, the bed fades under the logo
- Music: assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
- Music treatment: start at 0, volume 0.32, fade in 0.4s, fade out over the last 0.8s
- Music cue guidance: bundled preset `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json` (114.84 BPM, beat about 0.52s). Strong cue locks: 1.60s (sticker slam), 8.96s (first friend card), 12.65s (radar). Beat grid for picker rows (4.23, 4.75, 5.28, 5.80, 6.34, 6.86) and friend cards on every other beat (8.96, 10.01, 11.06, 12.12) with the 5th at 12.65 sharing the radar cue only if it stays readable, otherwise 13.18 is fine. The Talk reply near 17.91s.
- Audio-reactive treatment: subtle. Card glows and the hook background warmth breathe with bass RMS. No waveform visuals.
- Audio-coupled moments:
  - Scene 1 typing: randomized keypress files, one impact on the sticker slam
  - Scene 2 rows: light card place per row, click on the tap, soft pop on the sticker
  - Scene 3 cards: card slide per card
  - Scene 4 radar: soft tick on vertices, counter ticks on OVR
  - Scene 5: keypresses on typing, message pop on the reply, one clean hit on the logo
- SFX selection guidance: prefer low HF-risk files for repeated ticks (interface/click_002/003/005, impact/impactSoft_medium_*), card-slide-1 for cards, impactBell_heavy_000 once at most
- SFX analysis guidance: /Users/saman/.claude/plugins/cache/brag/brag/0.2.2/skills/brag/assets/sfx/sfx-analysis.md
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density and volume based on the implemented animation.
- Audio files: copied into `brag-output/composition/assets/`

## Hyperframes Instructions
Load `hyperframes-core`, `hyperframes-animation` (GSAP and Lottie adapters), `hyperframes-creative` (audio-reactive), `hyperframes-keyframes`, `hyperframes-cli`. This is the /brag workflow, not the generic promo workflow.

Requirements:
- Stickers are the project's own TGS files converted to Lottie JSON under assets/stickers/, played with lottie-web, `loop: true`, `autoplay: false`, registered on `window.__hfLottie`.
- Show at least one real UI element from the project (the picker, the friend cards, the radar).
- Keep all text readable: short labels hold 0.8s+, sentences 0.3s per word.
- 21 seconds total, root data-duration 21.
- Include music and SFX; music cue data is guidance, not a fixed sheet.
- Use local assets only. No network fetches at render time apart from the pinned GSAP and lottie-web CDN scripts.
- Run `hyperframes check` before render.
