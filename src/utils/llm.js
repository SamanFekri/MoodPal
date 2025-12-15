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


export async function analyzeMoodWeek(items) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 1,
    max_completion_tokens: 420,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
