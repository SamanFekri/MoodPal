// Checks the AI keys saved in the database against the real provider (shared key + admins' test keys).
// Run on the server: node scripts/check-ai.js   It prints only the last 4 characters of each key.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const AppConfig = require('../src/models/app_config');
const User = require('../src/models/user');
const providers = require('../src/ai/providers');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  const c = await AppConfig.get();
  const keys = [];
  const shared = await AppConfig.getAiKey();
  if (shared) keys.push({ from: 'shared', provider: c.ai_provider, model: c.ai_model, apiKey: shared });
  for (const u of await User.find({ is_admin: true, ai_test_provider: { $ne: null } }).lean()) {
    const k = await User.getAiTestKey(u._id); if (k) keys.push({ from: 'test ' + u.id, provider: u.ai_test_provider, model: u.ai_test_model, apiKey: k });
  }
  console.log('keys:', keys.map(k => `${k.from} ${k.provider} ${k.model || '(default)'} …${k.apiKey.slice(-4)}`));
  for (const k of keys.filter(k => k.provider === 'gemini')) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + k.apiKey);
    const j = await r.json();
    console.log('list models', r.status, j.error?.message || (j.models || []).map(m => m.name.replace('models/', '')).filter(n => /gemini/.test(n)).join(' '));
    const model = k.model || providers.PROVIDERS.gemini.defaultModel;
    const client = providers.clientFor({ provider: 'gemini', apiKey: k.apiKey, model });
    for (const params of [
      { model, reasoning_effort: 'low', max_tokens: 2000, messages: [{ role: 'user', content: 'Say hi in 3 words' }] },
      { model, max_tokens: 2000, messages: [{ role: 'user', content: 'Say hi in 3 words' }] },
      { model, reasoning_effort: 'low', max_tokens: 2000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Reply as JSON {"reply": string}' }, { role: 'user', content: 'hi' }] },
    ]) {
      try { const out = await client.chat.completions.create(params); console.log('OK', Object.keys(params).join(','), JSON.stringify(out.choices[0].message.content).slice(0, 120)); }
      catch (e) { console.log('ERR', Object.keys(params).join(','), e.status, String(e.message).slice(0, 400)); }
    }
  }
  await mongoose.disconnect();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
