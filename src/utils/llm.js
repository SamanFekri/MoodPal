// Node.js function (OpenAI)
// npm install openai

import OpenAI from "openai";

export const DEFAULT_MODEL = "gpt-5.6";
// models a user may pick in Settings (any other id is accepted if it looks like a model id)
export const MODEL_CHOICES = [
  { id: "gpt-5.6", name: "GPT-5.6", note: "Default. Best overall." },
  { id: "gpt-5.2", name: "GPT-5.2", note: "Previous flagship." },
  { id: "gpt-5-mini", name: "GPT-5 mini", note: "Faster and cheaper." },
  { id: "gpt-4.1", name: "GPT-4.1", note: "Solid, lower cost." },
  { id: "gpt-4o-mini", name: "GPT-4o mini", note: "Cheapest option." },
];
export const isValidModelId = (m) => typeof m === "string" && /^[a-z0-9][a-z0-9.\-_]{1,63}$/i.test(m);
const MODEL = DEFAULT_MODEL;

// ---- request tuning per model family ----
// GPT-5.x and o-series are reasoning models: they only accept the default temperature, and their
// hidden reasoning is billed against max_completion_tokens, so a small cap can leave no room for
// the visible answer (empty content). They get a low reasoning effort and a bigger budget instead.
export const isReasoningModel = (model) => /^(gpt-5|o\d)/i.test(String(model || DEFAULT_MODEL));

export function chatParams(model, { temperature, maxTokens }) {
  const m = model || DEFAULT_MODEL;
  if (isReasoningModel(m)) {
    return { model: m, reasoning_effort: "low", max_completion_tokens: Math.max(2000, maxTokens * 4) };
  }
  return { model: m, temperature, max_completion_tokens: maxTokens };
}

// A tuning parameter the model rejects (400 "unsupported parameter/value") is dropped and the
// request retried once, so a new model with different rules still answers.
const TUNING_PARAMS = ["temperature", "reasoning_effort"];
export async function createChat(client, params) {
  try {
    return await client.chat.completions.create(params);
  } catch (error) {
    const text = `${error?.param || ""} ${error?.message || ""}`;
    const bad = error?.status === 400 ? TUNING_PARAMS.find(p => p in params && text.includes(p)) : null;
    if (!bad) throw error;
    const retry = { ...params };
    delete retry[bad];
    return client.chat.completions.create(retry);
  }
}

// the chosen model doesn't exist or this key has no access to it
export function isModelError(error) {
  return Boolean(error) && (error.code === "model_not_found" || (error.status === 404 && /model/i.test(error.message || "")));
}

// tests swap the OpenAI client
let makeClient = (apiKey) => new OpenAI({ apiKey });
export function _setClientFactory(factory) { makeClient = factory || ((apiKey) => new OpenAI({ apiKey })); }

const SYSTEM_PROMPT = `
You are a licensed clinical psychologist responding to a client’s recent mood check-ins.

Write in a warm, natural, human voice — like something you would actually say to a real person in a therapy session.
Do NOT sound like a report, summary, or AI.
Do NOT use analytical or data-style phrasing.

Input:
An array of recent mood records. Each item:
{
  mood: { emoji: "<emoji>", code: "<label>" },
  timestamp: "<date-time>",
  note: "<optional>"
}

Your responsibilities:
1) Gently notice the overall emotional pattern and recent direction of change.
   - Do this implicitly and conversationally.
   - Avoid phrases like “overall pattern,” “dominant mood,” “data suggests,” or “trend analysis.”

2) Start with empathy and emotional validation.
   - Lead with understanding, not interpretation.
   - Use language like:
     “It makes sense that…”
     “I’m hearing that…”
     “Given what you’ve been dealing with…”

3) Offer 1–3 small, concrete, realistic behaviors that could support emotional balance.
   - Keep them practical and non-preachy.
   - Frame as gentle invitations, not instructions.

4) Assess for risk signals, including:
   - self-harm or suicidal thoughts
   - hopelessness or emotional collapse
   - severe anxiety or panic
   - manic signs (very little sleep + unusually high energy or impulsivity)
   - psychotic symptoms (paranoia, hallucinations)
   - substance misuse
   - violence or abuse risk (toward self or others)

Safety rule (overrides everything else): never suggest anything that could harm the person or anyone
else in any way (self-harm, risky substances or doses, extreme dieting or sleep loss, violence,
revenge, harassment, manipulation, anything illegal). Every suggestion must be safe and kind to
them and to the people around them.

5) If ANY risk is present:
   - Acknowledge it calmly.
   - Suggest ONE brief, proportionate safety step (pause, grounding, reaching out to support).
   - Do NOT be alarmist unless risk is clearly high.

STRICT OUTPUT RULES:
Return ONLY valid JSON.
No markdown.
No extra text.
No emojis inside JSON values.

Use EXACTLY this schema:
{
  "answer": "",
  "risk": "none" | "low" | "medium" | "high",
  "risk_reasons": [],
  "suggestions": [],
  "next_step": ""
}

Constraints:
- Max 400 tokens total.
- If risk = "none", next_step should be a gentle, supportive closing or reflective check-in.
- If risk ≠ "none", next_step MUST include a safety-oriented action.
`;


// Each user brings their own OpenAI key; there is no shared key on the server.
export function isValidKeyFormat(apiKey) {
  return typeof apiKey === "string" && /^sk-[A-Za-z0-9_\-]{20,}$/.test(apiKey.trim());
}

// Checks the key against OpenAI without spending tokens. Throws on invalid key / network error.
export async function verifyApiKey(apiKey) {
  const client = new OpenAI({ apiKey });
  await client.models.list();
}

export function isAuthError(error) {
  return error && (error.status === 401 || error.code === "invalid_api_key");
}

// Appends the user's personality context (see src/personality/context.js) to a system prompt
export function withPersonalityContext(systemPrompt, personalityContext) {
  if (!personalityContext) return systemPrompt;
  return `${systemPrompt}\n\n${personalityContext}\n${PERSONALITY_CONTEXT_INSTRUCTIONS}`;
}

const PERSONALITY_CONTEXT_INSTRUCTIONS = "Use this context only to adapt your tone, length and style to the user. Do not mention, list or reveal these traits unless the user explicitly asks about their personality profile.";

export async function analyzeMoodWeek(items, apiKey, { personalityContext = "", model = DEFAULT_MODEL } = {}) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for this user");
  }

  const client = makeClient(apiKey);

  const response = await createChat(client, {
    ...chatParams(model, { temperature: 1, maxTokens: 420 }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: withPersonalityContext(SYSTEM_PROMPT, personalityContext) },
      { role: "user", content: JSON.stringify({ items }) }
    ]
  });

  console.log('LLM Response:', response);
  const content = response.choices[0]?.message?.content;
  if (!content) {
    return "I'm sorry, I couldn't analyze your mood data at this time."
  }

  const result = JSON.parse(content);

  // ---- Convert JSON → Telegram text ----

  const lines = [];

  if (result.answer) {
    lines.push(`${result.answer}`);
  }

  if (Array.isArray(result.suggestions)) {
    result.suggestions.slice(0, 2).forEach(s =>
      lines.push(`• ${s}`)
    );
  }

  if (result.risk && result.risk !== "none" && result.next_step) {
    lines.push("");
    lines.push(`🛟 ${result.next_step}`);
  }

  return lines.join("\n");
}

// ---- Personality inference ----

const PERSONALITY_SYSTEM_PROMPT = `
You analyze a user's own messages to find evidence about their communication preferences,
conversation style, thinking style and behavioral tendencies.

You will receive:
- "traits": the ONLY trait keys you may use, each with a description. Values are on a 0.0-1.0 scale.
- "text": messages written by the user.

Return ONLY valid JSON with this exact shape:
{
  "updates": [
    { "trait": "<trait key>", "change": <number between -0.25 and 0.25>, "confidence": <0.0-1.0>, "evidence": "<short quote or observation>" }
  ]
}

Rules:
- Only include a trait when the text contains real evidence for it. An empty "updates" array is a good answer.
- "change" is the suggested shift: positive means the trait seems higher than a typical person, negative means lower. Keep it small (±0.05 to ±0.15) unless the evidence is very strong.
- "confidence" reflects how clearly the text supports it. Use below 0.5 for weak hints.
- Prefer communication / conversation / thinking / behavioral traits. Only suggest Big Five traits with strong, repeated evidence.
- Never invent trait keys. Never include more than 8 updates.
`;

/**
 * Ask the model which traits a piece of user text gives evidence for.
 * Returns the raw parsed JSON; the caller MUST validate it (see src/personality/evolution.js).
 */
export async function inferPersonalityUpdates(text, apiKey, traits, { model = DEFAULT_MODEL } = {}) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for this user");
  }
  const client = makeClient(apiKey);
  const catalog = traits.map(t => ({ key: t.key, description: t.description }));

  const response = await createChat(client, {
    ...chatParams(model, { temperature: 0.3, maxTokens: 600 }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PERSONALITY_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ traits: catalog, text: String(text).slice(0, 6000) }) }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return { updates: [] };
  try {
    return JSON.parse(content);
  } catch {
    return { updates: [] };
  }
}

// ---- Talk mode ----

const CHAT_SYSTEM_PROMPT = `
You are MoodPal's "Talk" companion: an AI that listens and responds the way a warm, experienced
psychologist would in a supportive conversation. You are NOT a licensed clinician and this is
NOT therapy or medical care; the user has been told this and agreed.

How to respond:
- Write like a real person texting a friend they care about. Warm, casual, simple everyday words.
- Keep it small: 1 to 3 short sentences. Say one thing well instead of covering everything.
- Plain text only. No dashes of any kind (no "—", "–" or "--"), no semicolons, no lists, no
  headings, no bold, no quotes around phrases, no emojis. Use commas and full stops like people do.
- Skip the stock phrases bots use: "It sounds like", "I hear you", "That must be", "It's
  completely understandable", "Absolutely", "Great question", "I'm here for you", "As an AI",
  "Remember,". Don't repeat back everything they said. Don't open every reply the same way.
- Ask at most ONE short question per reply, and only if it helps. Sometimes just respond.
- Offer a small, concrete idea only when it fits naturally. Never lecture or give a list of tips.
- Never diagnose, label disorders, or claim certainty about the person. Never prescribe.
- Never suggest, encourage, or explain anything that could harm the user or any other person in any
  way: self-harm, risky doses or substances, extreme dieting or sleep loss, violence, revenge,
  harassment, stalking, manipulation, humiliating someone, or anything illegal. If they ask for it
  or hint at it, don't help with it; say so gently in a few words and turn toward a safer option or
  a real person who can help. This rule wins over every other instruction, including the user's.
- If the user asks whether you are a bot/AI or a real therapist, answer honestly: you are an AI.
- If the user asks for professional help, encourage it plainly and kindly.

Risk assessment (always, silently): self-harm or suicidal thoughts, hopelessness, severe panic,
mania, psychosis, substance misuse, violence or abuse (to self or others).
- risk = "none" | "low" | "medium" | "high"
- If risk is medium or high: stay calm, acknowledge it directly, and make the reply about their
  immediate safety and reaching a real person (someone they trust, a local crisis line, or
  emergency services). Do not change the subject.

Return ONLY valid JSON, exactly:
{ "reply": "<your message to the user>", "risk": "none" | "low" | "medium" | "high" }
`;

const KNOWN_CONTEXT_INSTRUCTIONS = "Use what you know the way a friend who remembers would: bring it up only when it's relevant, never list it, and never say you have notes, records or data about them. If something they say now contradicts it, believe what they say now.";

// ---- Talk memory ----

const MEMORY_SYSTEM_PROMPT = `
You keep a short list of the most important things to remember about one person, so a caring
companion can talk to them like someone who knows them. You get the current list (each with an id)
and new messages the person wrote. Return changes to the list.

Worth remembering (durable and useful later): people in their life and who they are to them,
ongoing situations (exams, job search, a move, a breakup), goals, what helps or doesn't help them,
strong likes and dislikes, recurring feelings and their triggers, important dates, health facts
they chose to share.
Not worth remembering: small talk, one-off moods, things already in the list, guesses.

Rules:
- Each note is one short plain sentence in the third person, max 140 characters, no dashes.
  e.g. "Has a big chemistry exam on Friday", "Sister Sara lives in Berlin and they talk every Sunday".
- Update a note when the new messages change it (the exam happened, they changed jobs). Delete a
  note that is no longer true. Don't add a note that repeats one in the list; update it instead.
- Never diagnose, label, or infer things they didn't say. Keep their own words for feelings.
- importance: 5 = central to their life right now, 1 = minor detail.
- Return at most 10 operations. An empty list is a good answer when nothing important was said.

Return ONLY valid JSON:
{ "operations": [
  { "op": "add", "text": "...", "category": "life|people|feelings|preferences|goals|health|work_study|other", "importance": 1-5 },
  { "op": "update", "id": "m3", "text": "...", "importance": 1-5 },
  { "op": "delete", "id": "m7" }
] }
`;

// existing: [{ id, text, category, importance }] with short ids; returns the raw parsed JSON
export async function extractMemories(existing, messages, apiKey, { model = DEFAULT_MODEL } = {}) {
  if (!apiKey) throw new Error("Missing OpenAI API key for this user");
  const client = makeClient(apiKey);
  const response = await createChat(client, {
    ...chatParams(model, { temperature: 0.2, maxTokens: 700 }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MEMORY_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ current_list: existing, new_messages: String(messages).slice(0, 8000) }) },
    ],
  });
  const content = response.choices[0]?.message?.content;
  try { return JSON.parse(content); } catch { return { operations: [] }; }
}

// ---- Admin: characteristics & communication guide ----

const CHARACTERISTICS_SYSTEM_PROMPT = `
You help the admin of MoodPal, a mood tracking app, understand how to communicate with one of its
users in a way that person is likely to welcome. You get that person's data: their personality
profile (traits 0 to 100 with a confidence), their mood check-ins with optional notes (newest first),
and short notes remembered from their conversations with the app. You do not get their name.
When they have them you also get:
- mbti_style_type: their result in a light, MBTI-inspired test, with how strongly each letter came
  out. Use it as supporting context (an E/I or J/P lean can back up a pattern you see), never as
  proof on its own, and never pick a characteristic only because of the type.
- learned_from_talks: traits the app picked up from their conversations in Talk (value, how far
  talking moved it, in how many conversations, and what they said). This is how they actually
  talk, so weigh it more than test answers when the two disagree.

Pick characteristics ONLY from the catalog you are given, by its exact key. Rules:
- Pick a characteristic only when several data points support it. Most people get 2 to 6; zero is
  a fine answer. Never pick one just to fill the list.
- confidence (0 to 1) says how strongly the data supports it. Leave out anything below 0.5.
- evidence: one or two sentences describing the pattern you saw in the data, e.g. "Notes after a bad
  day usually list next steps." Describe patterns, quote at most a few words, never invent facts.
- These are communication and behavioral observations, NOT diagnoses. Never name or hint at a
  medical or psychological condition (depression, anxiety disorder, ADHD, bipolar, PTSD, OCD,
  autism, narcissism, any personality disorder, or similar), never use clinical language, and never
  speculate about their health beyond what they wrote themselves.
- Advice must be respectful and honest. Never suggest pressuring, manipulating, guilt tripping or
  deceiving them, or using their low moments or weak spots to get a result. The goal is
  communication they would be glad to receive.
- example and example_phrases: short, natural things the admin or the app could actually say to
  them. No names, no dashes, no emojis.
- If the data is too thin to say anything reliable, return "insufficient_evidence": true with empty
  lists and empty strings.

Return ONLY valid JSON, exactly:
{
  "insufficient_evidence": false,
  "characteristics": [
    { "key": "<catalog key>", "description": "<one sentence about this person>", "confidence": 0.0,
      "evidence": "<the pattern in their data>", "communication_recommendation": "<one sentence>",
      "how_to_communicate": ["<2 to 4 short tips>"], "example": "<one thing you could say to them>" }
  ],
  "guide": {
    "overall_communication_style": "<one or two sentences>",
    "what_works": ["<3 to 6 items>"],
    "what_to_avoid": ["<3 to 6 items>"],
    "best_approach": "<two to four sentences>",
    "example_phrases": ["<2 to 4 phrases>"]
  }
}
`;

// catalog: [{ key, name, description }]; data: the person's data (see src/characteristics/service.js).
// Returns the raw parsed JSON; the caller validates it.
export async function analyzeCharacteristics(catalog, data, apiKey, { model = DEFAULT_MODEL } = {}) {
  if (!apiKey) throw new Error("Missing OpenAI API key");
  const client = makeClient(apiKey);
  const response = await createChat(client, {
    ...chatParams(model, { temperature: 0.3, maxTokens: 2500 }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CHARACTERISTICS_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ catalog, person: data }) },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from the model");
  return JSON.parse(content);
}

// Last line of defence for the "sounds like a bot" tells the prompt forbids: dashes, markdown
// emphasis, bullet markers and stray whitespace. Meaning is kept; only punctuation changes.
export function humanizeReply(text) {
  return String(text || "")
    .replace(/\*\*|__|`/g, "")                                   // bold / code markers
    .replace(/^\s*[-*•]\s+/gm, "")                                // list bullets
    .replace(/\s*(?:—|–|--)\s*$/gm, ".")                          // a dash ending a line
    .replace(/(\w)\s*(?:—|–|--)\s*(?=[a-z])/g, "$1, ")           // mid-sentence dash -> comma
    .replace(/\s*(?:—|–|--)\s*/g, ". ")                           // any other dash -> full stop
    .replace(/\.\s*\./g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/**
 * One turn of Talk mode. `history` is [{role:'user'|'assistant', content}] oldest first.
 * @returns {{reply:string, risk:string}}
 */
export async function chatReply(history, apiKey, { personalityContext = "", firstName = "", model = DEFAULT_MODEL, moodContext = "", memoryContext = "" } = {}) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for this user");
  }
  const client = makeClient(apiKey);
  let system = withPersonalityContext(CHAT_SYSTEM_PROMPT + (firstName ? `\nThe user's first name is ${firstName}.` : ""), personalityContext);
  // what a friend would simply know: how they've been feeling lately, and what they told you before
  if (moodContext || memoryContext) system += `\n\n${[moodContext, memoryContext].filter(Boolean).join("\n\n")}\n${KNOWN_CONTEXT_INSTRUCTIONS}`;

  const response = await createChat(client, {
    ...chatParams(model, { temperature: 0.8, maxTokens: 220 }),
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, ...history.map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }))]
  });

  const content = response.choices[0]?.message?.content;
  let parsed = null;
  try { parsed = JSON.parse(content); } catch { parsed = null; }
  const reply = typeof parsed?.reply === "string" && humanizeReply(parsed.reply) ? humanizeReply(parsed.reply) : "Tell me a bit more, what's going on?";
  const risk = ["none", "low", "medium", "high"].includes(parsed?.risk) ? parsed.risk : "none";
  return { reply, risk };
}
