# Brag Plan: MoodPal

## What is this app?
MoodPal is a Telegram bot and mini app where your mood is an animated sticker. Pick one of 18, add a note, let friends see it live, take six personality tests that turn into a FIFA-style radar, and talk it through with an AI companion that runs on your own OpenAI key and says up front that it is a bot, not a therapist.

## The angle
"I'm fine." is the biggest lie in every group chat. MoodPal swaps it for a sticker that actually moves, and then quietly builds a whole picture of you around that one honest tap: your friends, your radar, a place to talk. The video is a mood ring for your group chat. Emoji first, warm, specific. Every frame uses MoodPal's real stickers, cards and copy.

## Hook (first 2-3 seconds)
Dark screen. The words `"I'm fine."` type out in big quotes with a blinking cursor. The beat hits, the line gets struck through, and the 😩 Overwhelmed sticker slams in over it, animated. Line: **Say it with a sticker instead.**

## Key moments (the middle)
- The bot's real mood picker: 18 sticker buttons (😊 Happy through 😈 Naughty) arriving row by row on the beat. A cursor taps 🤩 Motivated and the sticker pops up big.
- The mini app's Friends' moods grid: five friend cards (Ada · Happy, Bob · Tired, Charlie · Anxious, Dana · Excited, Eve · Relaxed) sliding in one by one with their coloured glow, a "Today · 12:30 PM" pill and a note like "exam tomorrow".
- The personality radar: a Big Five pentagon springs open, the vertices pop, the **48 OVR** badge counts up, then trait bars fill in (Openness, Directness, Humor). Caption: *6 tests. 57 traits. One radar.*
- Talk: a chat bubble types "Rough day. Can we talk?" and the companion answers "That sounds heavy. What happened today?" with the honest tag *an AI, not a therapist*.

## Outro / punchline
Logo and wordmark **MoodPal**, tagline **Your mood. As a sticker.**, and the small line *Telegram · t.me/MoodPals*. Last frame: the 🤩 sticker keeps looping next to the wordmark.

## User flow worth showing
1. Entry: tap 🤩 New mood in the bot and the picker with 18 stickers appears.
2. Key action: pick a sticker (🤩 Motivated). It is saved and shows up on friends' screens.
3. Result: the mini app, with your mood card on top and friends' moods below. Deeper in, the personality radar and Talk.

## Tone
- Preset: default
- Creative direction: a mood ring for your group chat. Playful, warm, emoji first, zero SaaS talk.
- Interpretation: a comfortable 4 to 5 scene rhythm. Short punchy lines that hold long enough to read. Motion comes from stickers popping and cards arriving on the beat, never from flashing text. The product's own soft card UI (rounded 20px cards, pastel glows) is the visual language.

## Format: landscape, 1920x1080
## Duration: 21 seconds

## Visual identity (from the project)
- Background: #0f1115 (mini app dark background) with cards #1b1e25. Light variant #f2f3f7 / #ffffff available for contrast scenes.
- Accent: #3390ec (Telegram blue, buttons and radar). Mood glows are per-mood hues: motivated 25°, happy 45°, tired 230°, anxious 280°, excited 330°, relaxed 160° (hsl, about 22% alpha radial).
- Text: #f2f3f5 on dark, #111318 on light. Hint #8b919c.
- Display font: system UI stack (-apple-system, "SF Pro Text", Roboto, Segoe UI), weight 800, letter-spacing -0.02em.
- Body font: same stack, 500 to 600.
- Strongest visual element: the 18 animated TGS mood stickers (src/public/tgs/*.tgs, gzipped Lottie JSON), the friend cards with radial glows, and the radar with the gradient OVR badge (amber to orange gradient text).
- Assets: src/public/logo.jpeg (640×640), src/public/tgs/*.tgs (Lottie, gzip), src/public/moods/*.webp.

## Share copy (draft)
MoodPal: a Telegram bot where your mood is an animated sticker, your friends can see it, and a Big Five radar tells you why you're like this. 🧠 t.me/MoodPals

## Audio direction
- Role: warm upbeat bed with motion-matched UI accents
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (114.84 BPM, bright, kicks in early, which suits a 21s cut)
- Music treatment: start at 0s at about -14 dB, quick 0.4s fade in, hold, 0.8s fade out over the outro
- Music cue guidance: preset read (`cues/…vol-11…music-cues.md`). Strong cues to target: **1.60s** (hook sticker slam), **8.96s** (friends grid starts), **12.65s** (radar springs open), **17.91s** (Talk reply lands). The 22.65s cue is past the end (the video is 21s), so the outro logo uses the 20.02/20.54 beats. Beat grid is about 0.52s. For the 18-button picker use every beat for row arrivals (accent only). For the 5 friend cards use every other beat (about 1.05s) so each card's text is readable. Trait bars fill in sequence on beats.
- Audio-reactive treatment: subtle. Music energy may make the card glows breathe and lift the radar fill opacity a little. No waveform bars.
- SFX posture: moderate, motion matched, professional restraint
- Audio-coupled moments: hook text typed with soft key ticks; sticker slam is one impact; picker rows are light card places; friend cards are card slides one by one; radar vertices are soft UI ticks; OVR count-up ticks; Talk bubble typing is key ticks then a soft message pop; outro logo is one clean interface hit
- Restraint rule: never more than one SFX per beat, no cheesy whooshes, SFX sit under the music, the sticker slam is the only loud hit

## Storyboard

### Scene 1: "I'm fine." (4s, 0.0 to 4.0)
Dark background. `"I'm fine."` types out in large white display type, quotes included, with a blinking cursor, about 1.4s. On the 1.60s strong cue the line gets a strike-through and the 😩 Overwhelmed sticker (Lottie) slams in over it with a scale overshoot, playing. At about 2.4s the line **Say it with a sticker instead.** fades up below and holds to the cut.
Sequential/interaction: yes. Typed text, then a sticker slam.
Audio intent: quiet tension, then release
Audio-coupled idea: key ticks on the typing, one impact on the sticker, music fades in underneath
Music: bed starts at 0, low
Transition mood: hard, into Scene 2

### Scene 2: The picker (4.5s, 4.0 to 8.5)
Telegram-style chat frame, dark. Bot message "It's time to express yourself! Select the **mood** that best describes how you're feeling right now:" then the real inline keyboard: 6 rows of 3 buttons (😊 Happy · 😌 Relaxed · 😁 Excited / 🤩 Motivated · 😐 Neutral · 🤔 Confused / … / 🤒 Sick · 😈 Naughty) arriving row by row on the beat (4.23, 4.75, 5.28, 5.80, 6.34, 6.86). A cursor moves to **🤩 Motivated** and taps at about 7.4s. The button flashes blue and the big animated 🤩 sticker pops in on the right and plays. Small caption top left: the MoodPal logo and name.
Sequential/interaction: yes. Six button rows arrive one by one, then a simulated cursor tap.
Audio intent: playful build to a satisfying tap
Audio-coupled idea: a light card place per row (accent only, rows are short labels), a UI click on the tap, a soft pop on the sticker
Music: upbeat
Transition mood: clean, into Scene 3

### Scene 3: Friends' moods (4.5s, 8.5 to 13.0)
The mini app in a phone frame, dark theme. Header "Hi, Saman 👋 / Friends' moods", the Your mood card (🤩 Motivated · Today · 12:30 PM · "shipped it 🚀") already on top. Five friend cards slide in one by one on every other beat from 8.96s: **Ada Lovelace · Happy** (glow 45°), **Bob · Tired**, **Charlie · Anxious** with the note "exam tomorrow", **Dana · Excited**, **Eve · Relaxed**. Each card has an animated sticker, name, mood and freshness pill. Caption to the right of the phone: **See how your friends really are.** It holds at least 2s.
Sequential/interaction: yes. Five cards one by one, about 1.05s apart, all stay on screen.
Audio intent: warm, social, satisfying arrivals
Audio-coupled idea: card slide per card, glows breathe subtly with the music
Music: upbeat
Transition mood: clean, into Scene 4

### Scene 4: The radar (4.5s, 13.0 to 17.5)
Light card on the dark background. On the 12.65s to 13.0 cue the Big Five pentagon radar springs open with a scale overshoot, the five vertices pop and the labels fade in (Openness 38%, Conscientiousness 50%, Extraversion 50%, Agreeableness 50%, Neuroticism 50%). The **48 / OVR** badge counts up from 0 to 48 with ticks. Then three trait bars fill left to right in sequence: Openness · Medium-Low 38%, Directness · High 80%, Humor · High 74%. Caption: **6 tests. 57 traits. One radar.** It holds at least 2s.
Sequential/interaction: yes. Radar, then OVR count-up, then three bars in sequence.
Audio intent: a small "whoa", the product knows you
Audio-coupled idea: soft ticks on vertices, counter ticks on OVR, a subtle sweep per bar
Music: upbeat, slightly lifted
Transition mood: soft, into Scene 5

### Scene 5: Talk and outro (3.5s, 17.5 to 21.0)
Chat frame. A user bubble types **Rough day. Can we talk?** (key ticks, about 0.9s). On the 17.91s cue the companion bubble pops: **That sounds heavy. What happened today?** with a tiny grey tag *🤖 an AI, not a therapist*. It holds 1.3s. Then a quick crossfade to the outro: logo.jpeg (rounded), wordmark **MoodPal**, tagline **Your mood. As a sticker.**, small line *Telegram · t.me/MoodPals*, and the 🤩 sticker looping beside the wordmark. Music fades out over the last 0.8s.
Sequential/interaction: yes. Typed user message, then the reply pops, then the logo reveal.
Audio intent: gentle landing, then a clean confident sign-off
Audio-coupled idea: key ticks on typing, a message pop on the reply, one interface hit on the logo
Music: upbeat, then fade out
Transition mood: soft crossfade, then end

**Music mood for this video:** upbeat
**Audio summary:** a quiet typed hook releases into a bright beat, UI accents ride the grid through picker, cards and radar, the talk bubble lands on a strong cue and the bed fades under the logo.
