const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const llm = require('../../src/utils/llm');

// a fake OpenAI client that behaves like a GPT-5 reasoning model: it rejects any temperature
// other than the default and bills reasoning against max_completion_tokens
function reasoningClient({ reasoningTokens = 800, rejectReasoningEffort = false } = {}) {
  const calls = [];
  const client = {
    calls,
    chat: { completions: { create: async (params) => {
      calls.push(params);
      if ('temperature' in params && params.temperature !== 1) {
        throw Object.assign(new Error(`Unsupported value: 'temperature' does not support ${params.temperature} with this model. Only the default (1) value is supported.`), { status: 400, param: 'temperature' });
      }
      if (rejectReasoningEffort && 'reasoning_effort' in params) {
        throw Object.assign(new Error("Unsupported parameter: 'reasoning_effort' is not supported with this model."), { status: 400, param: 'reasoning_effort' });
      }
      const room = (params.max_completion_tokens || 0) - reasoningTokens;
      const content = room > 50 ? JSON.stringify({ reply: 'That sounds really hard. What happened?', risk: 'none', updates: [], answer: 'It makes sense you feel tired.', suggestions: ['Take a short walk'] }) : '';
      return { choices: [{ message: { content }, finish_reason: content ? 'stop' : 'length' }] };
    } } },
  };
  return client;
}

describe('OpenAI requests', () => {
  afterEach(() => llm._setClientFactory(null));

  test('GPT-5.x and o-series get reasoning settings; older models keep their temperature', () => {
    assert.equal(llm.isReasoningModel('gpt-5.6'), true);
    assert.equal(llm.isReasoningModel('gpt-5-mini'), true);
    assert.equal(llm.isReasoningModel('o4-mini'), true);
    assert.equal(llm.isReasoningModel('gpt-4.1'), false);
    assert.equal(llm.isReasoningModel(undefined), true, 'the default is gpt-5.6');

    const r = llm.chatParams('gpt-5.6', { temperature: 0.8, maxTokens: 350 });
    assert.equal(r.temperature, undefined, 'no custom temperature for reasoning models');
    assert.equal(r.reasoning_effort, 'low');
    assert.ok(r.max_completion_tokens >= 2000, 'room for hidden reasoning plus the answer');

    assert.deepEqual(llm.chatParams('gpt-4o-mini', { temperature: 0.8, maxTokens: 350 }), { model: 'gpt-4o-mini', temperature: 0.8, max_completion_tokens: 350 });
  });

  test('Talk answers on gpt-5.6 instead of failing on temperature or running out of tokens', async () => {
    const client = reasoningClient();
    llm._setClientFactory(() => client);
    const out = await llm.chatReply([{ role: 'user', content: 'Rough day.' }], 'sk-test', { model: 'gpt-5.6' });
    assert.equal(out.reply, 'That sounds really hard. What happened?');
    assert.equal(client.calls.length, 1, 'no failed first attempt');
  });

  test('the weekly insight and personality inference work on gpt-5.6 too', async () => {
    llm._setClientFactory(() => reasoningClient());
    const text = await llm.analyzeMoodWeek([{ mood: { code: 'tired' } }], 'sk-test', { model: 'gpt-5.6' });
    assert.match(text, /It makes sense you feel tired/);
    const updates = await llm.inferPersonalityUpdates('I like short answers', 'sk-test', [{ key: 'preferred_response_length', description: 'x' }], { model: 'gpt-5.6' });
    assert.deepEqual(updates, { reply: 'That sounds really hard. What happened?', risk: 'none', updates: [], answer: 'It makes sense you feel tired.', suggestions: ['Take a short walk'] });
  });

  test('a model that rejects a tuning parameter is retried once without it', async () => {
    const client = reasoningClient({ rejectReasoningEffort: true });
    llm._setClientFactory(() => client);
    const out = await llm.chatReply([{ role: 'user', content: 'hi' }], 'sk-test', { model: 'gpt-5.6' });
    assert.equal(out.reply, 'That sounds really hard. What happened?');
    assert.equal(client.calls.length, 2);
    assert.ok(!('reasoning_effort' in client.calls[1]));

    // other errors are not swallowed
    llm._setClientFactory(() => ({ chat: { completions: { create: async () => { throw Object.assign(new Error('Incorrect API key'), { status: 401, code: 'invalid_api_key' }); } } } }));
    await assert.rejects(llm.chatReply([{ role: 'user', content: 'hi' }], 'sk-test'), (e) => llm.isAuthError(e));
  });

  test('a model the account cannot use is recognised', () => {
    assert.equal(llm.isModelError(Object.assign(new Error('The model `gpt-5.6` does not exist or you do not have access to it.'), { status: 404, code: 'model_not_found' })), true);
    assert.equal(llm.isModelError(Object.assign(new Error('Rate limit'), { status: 429 })), false);
  });
});
