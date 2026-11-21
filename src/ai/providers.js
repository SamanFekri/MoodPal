// AI providers MoodPal can talk to. Every feature (Talk, insights, memory, personality, admin tools)
// calls `client.chat.completions.create(params)` in the OpenAI shape (src/utils/llm.js); this file
// builds that client for a credential:
//   - a plain string             -> the user's own OpenAI key (as before)
//   - { provider, apiKey, model } -> the admin's shared key: 'gemini' (default), 'openai' or 'claude'
// Gemini uses Google's OpenAI-compatible endpoint. Claude goes through Anthropic's official SDK, behind
// a small adapter that takes the same request and returns the same response shape.
const OpenAI = require('openai').default || require('openai');

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-3.8-flash',
    // free on Google AI Studio's free tier (checked 2026-11-21); the bigger Gemini 4 models are paid
    models: [
      { id: 'gemini-3.8-flash', note: 'Free tier. Newest Flash, the default.' },
      { id: 'gemini-3.6-flash', note: 'Free tier.' },
      { id: 'gemini-3.5-flash-lite', note: 'Free tier. Lightest and fastest.' },
      { id: 'gemini-4-hydrogen', note: 'Free tier.' },
    ],
  },
  openai: {
    name: 'OpenAI',
    baseURL: null,
    defaultModel: 'gpt-5.6',
    models: [
      { id: 'gpt-5.6', note: 'Best overall.' },
      { id: 'gpt-5-mini', note: 'Faster and cheaper.' },
      { id: 'gpt-4o-mini', note: 'Cheapest option.' },
    ],
  },
  claude: {
    name: 'Anthropic Claude',
    baseURL: null,
    defaultModel: 'claude-opus-5-5',
    models: [
      { id: 'claude-opus-5-5', note: 'Most capable ($4 / $20 per million tokens).' },
      { id: 'claude-sonnet-5-5', note: 'Balanced ($2 / $10).' },
      { id: 'claude-haiku-5-5', note: 'Cheapest ($0.10 / $0.50), fine for short replies.' },
    ],
  },
};
const PROVIDER_IDS = Object.keys(PROVIDERS);
const DEFAULT_PROVIDER = 'gemini';

// ---------- Claude adapter (official @anthropic-ai/sdk) ----------

// Claude models that support server-side refusal fallbacks (a declined request is re-run on another model)
const FALLBACK_MODELS = /^claude-(fable-5|opus-5-5|opus-5$|sonnet-5-5)/;

const stripFences = (s) => String(s || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

function claudeClient(apiKey, { Anthropic = null } = {}) {
  const SDK = Anthropic || (require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk'));
  const client = new SDK({ apiKey });
  return {
    _anthropic: client,
    models: { list: () => client.models.list({ limit: 1 }) },
    chat: {
      completions: {
        // OpenAI-shaped request in, OpenAI-shaped response out
        async create(params) {
          const system = params.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
          const json = params.response_format && params.response_format.type !== 'text';
          const messages = params.messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));
          const wanted = params.max_completion_tokens || params.max_tokens || 1000;
          const request = {
            model: params.model,
            // thinking counts against max_tokens on current Claude models: leave room for the answer
            max_tokens: Math.min(16000, Math.max(4000, wanted * 4)),
            system: json ? `${system}\n\nRespond with only the JSON object: no prose and no code fences.` : system,
            messages,
            // short, everyday replies: keep thinking light
            output_config: { effort: 'low' },
          };
          const response = FALLBACK_MODELS.test(params.model)
            ? await client.beta.messages.create({ ...request, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
            : await client.messages.create(request);
          // a refusal (the whole fallback chain declined) reads as an empty answer; callers fall back
          const text = response.stop_reason === 'refusal'
            ? ''
            : response.content.filter(b => b.type === 'text').map(b => b.text).join('');
          return { choices: [{ message: { content: json ? stripFences(text) : text } }], model: response.model, usage: response.usage };
        },
      },
    },
  };
}

// ---------- clients ----------

let factory = null;   // tests swap this
function clientFor(cred) {
  if (factory) return factory(cred);
  if (typeof cred === 'string') return new OpenAI({ apiKey: cred });
  const p = PROVIDERS[cred?.provider];
  if (!p) throw new Error(`Unknown AI provider: ${cred?.provider}`);
  if (cred.provider === 'claude') return claudeClient(cred.apiKey);
  return new OpenAI({ apiKey: cred.apiKey, ...(p.baseURL ? { baseURL: p.baseURL } : {}) });
}
function _setFactory(f) { factory = f || null; }

// the model a request should use: the shared key's own model, else what the caller asked for
const modelFor = (cred, fallback) => (cred && typeof cred === 'object' && cred.model) || fallback;
const providerOf = (cred) => (cred && typeof cred === 'object' ? cred.provider : 'openai');

// Checks a key without spending tokens (lists models). Throws on a bad key or network error.
async function verify(provider, apiKey) {
  const client = clientFor({ provider, apiKey });
  await client.models.list();
}

// a rejected key, from any of the three providers
const isAuthError = (error) => Boolean(error) && (error.status === 401 || error.status === 403 || error.code === 'invalid_api_key'
  || /API key not valid|invalid x-api-key|invalid api key/i.test(error.message || ''));

module.exports = { PROVIDERS, PROVIDER_IDS, DEFAULT_PROVIDER, clientFor, modelFor, providerOf, verify, isAuthError, claudeClient, stripFences, _setFactory };
