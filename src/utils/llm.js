// Node.js function (OpenAI)
// npm install openai

import OpenAI from "openai";

const MODEL = "gpt-5.2";

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

export async function analyzeMoodWeek(items, apiKey, { personalityContext = "" } = {}) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for this user");
  }

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 1,
    max_completion_tokens: 420,
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
export async function inferPersonalityUpdates(text, apiKey, traits) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for this user");
  }
  const client = new OpenAI({ apiKey });
  const catalog = traits.map(t => ({ key: t.key, description: t.description }));

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_completion_tokens: 600,
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
