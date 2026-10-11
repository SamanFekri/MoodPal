// Translates a mood note to English for an admin reading someone's notes. Runs only when the admin
// taps Translate. Provider: Google Cloud Translation when GOOGLE_TRANSLATE_API_KEY is set (free up to
// 500k characters a month, needs a Google Cloud project with billing on), otherwise OpenAI on the
// same key the admin characteristics use (OPENAI_API_KEY, else the admin's own key).
const characteristicsService = require('../characteristics/service');

const CACHE_MAX = 500;
const GOOGLE_URL = 'https://translation.googleapis.com/language/translate/v2';

class TranslateError extends Error {
  constructor(code) { super(code); this.code = code; }
}

class TranslateService {
  constructor({ llm = null, fetchImpl = null } = {}) {
    this._llm = llm;
    this._fetch = fetchImpl;
    this.cache = new Map(); // `${moodId}:${note}` -> result; a note edited later is a new entry
  }

  get llm() {
    if (!this._llm) this._llm = require('../utils/llm');
    return this._llm;
  }

  get fetch() { return this._fetch || globalThis.fetch; }

  // what the admin's Translate button can use right now (no key is ever returned)
  async provider(adminId) {
    if (process.env.GOOGLE_TRANSLATE_API_KEY) return { name: 'google' };
    const key = await characteristicsService.resolveKey(adminId);
    return key ? { name: 'openai', ...key } : null;
  }

  async translate(adminId, moodId, note) {
    const text = String(note || '').trim();
    if (!text) throw new TranslateError('empty');
    const cacheKey = `${moodId}:${text}`;
    if (this.cache.has(cacheKey)) return { ...this.cache.get(cacheKey), cached: true };

    const provider = await this.provider(adminId);
    if (!provider) throw new TranslateError('no_provider');
    const result = provider.name === 'google' ? await this.google(text) : await this.openai(text, provider);
    const out = { text: result.english, language: result.language, provider: provider.name, same: result.language === 'en' };

    this.cache.set(cacheKey, out);
    if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value);
    return out;
  }

  async google(text) {
    let res;
    try {
      res = await this.fetch(`${GOOGLE_URL}?key=${encodeURIComponent(process.env.GOOGLE_TRANSLATE_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: 'en', format: 'text' }),
      });
    } catch (error) {
      console.error('Google Translate unreachable:', error.message);
      throw new TranslateError('failed');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('Google Translate error:', res.status, data?.error?.message);
      throw new TranslateError(res.status === 400 || res.status === 403 ? 'bad_key' : 'failed');
    }
    const t = data?.data?.translations?.[0];
    if (!t?.translatedText) throw new TranslateError('failed');
    return { english: t.translatedText, language: t.detectedSourceLanguage || null };
  }

  async openai(text, { apiKey, model }) {
    try {
      return await this.llm.translateToEnglish(text, apiKey, { model });
    } catch (error) {
      console.error('OpenAI translation failed:', error.message);
      if (this.llm.isAuthError?.(error)) throw new TranslateError('bad_key');
      if (this.llm.isModelError?.(error)) throw new TranslateError('model_unavailable');
      throw new TranslateError('failed');
    }
  }
}

module.exports = new TranslateService();
module.exports.TranslateService = TranslateService;
module.exports.TranslateError = TranslateError;
