const test = require('node:test');
const assert = require('node:assert/strict');
const {
  askAssistant,
  buildAssistantMessages,
  chatCompletionsUrl,
  contextText,
  normalizeAssistantAnswer
} = require('../src/services/assistant');

test('chatCompletionsUrl uses Bkeel OpenAI-compatible v1 path by default', () => {
  assert.equal(
    chatCompletionsUrl({ openaiBaseUrl: 'https://api.bkeel.com' }),
    'https://api.bkeel.com/v1/chat/completions'
  );
});

test('chatCompletionsUrl keeps existing /v1 base URLs compatible', () => {
  assert.equal(
    chatCompletionsUrl({ openaiBaseUrl: 'https://api.openai.com/v1' }),
    'https://api.openai.com/v1/chat/completions'
  );
});

test('chatCompletionsUrl supports explicit path override', () => {
  assert.equal(
    chatCompletionsUrl({
      openaiBaseUrl: 'https://api.bkeel.com',
      openaiChatCompletionsPath: '/chat/completions'
    }),
    'https://api.bkeel.com/chat/completions'
  );
});

test('chatCompletionsUrl supports an independent TokenHub assistant endpoint', () => {
  assert.equal(
    chatCompletionsUrl({
      assistantBaseUrl: 'https://tokenhub.tencentmaas.com',
      assistantChatCompletionsPath: '/v1/chat/completions',
      openaiBaseUrl: 'https://api.bkeel.com'
    }),
    'https://tokenhub.tencentmaas.com/v1/chat/completions'
  );
});

test('place context includes the selected attraction and structured visit facts', () => {
  const context = contextText({ type: 'place', id: 'beijing-palace-museum', mode: 'mobility' });
  assert.match(context, /当前景点：北京故宫/);
  assert.match(context, /现场看点/);
  assert.match(context, /预计步行时间/);
  assert.match(context, /无障碍情况/);
});

test('assistant prompt limits spoken answers and avoids unsupported live accessibility claims', () => {
  const messages = buildAssistantMessages({
    question: '轮椅从哪个入口进？',
    context: { type: 'place', id: 'beijing-palace-museum', mode: 'mobility' }
  });
  assert.match(messages[0].content, /600个汉字以内/);
  assert.match(messages[0].content, /严禁补充上下文未出现的具体入口名称/);
  assert.match(messages[0].content, /不使用Markdown/);
  assert.match(messages[0].content, /景区官方或现场工作人员核实/);
});

test('assistant answers are plain text and end on a complete sentence within 600 characters', () => {
  const longAnswer = `**重点**：${'这是一段适合现场播报的介绍。'.repeat(60)}最后一句不应被截断在中间。`;
  const answer = normalizeAssistantAnswer(longAnswer);
  assert.ok(Array.from(answer).length <= 600);
  assert.doesNotMatch(answer, /\*\*/);
  assert.match(answer, /。$/);
});

test('askAssistant calls configured external model and returns AI answer', async () => {
  let capturedUrl = '';
  let capturedOptions = null;
  const result = await askAssistant({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.bkeel.com',
      openaiModel: 'gpt-5.4-mini',
      openaiTimeoutMs: 4000
    },
    question: '故宫有什么建筑特色？',
    context: { type: 'city', city: '北京' },
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '故宫建筑可以从中轴线、院落层级和屋顶色彩观察。'
              }
            }
          ]
        })
      };
    }
  });

  assert.equal(capturedUrl, 'https://api.bkeel.com/v1/chat/completions');
  assert.equal(capturedOptions.method, 'POST');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(capturedOptions.body);
  assert.equal(body.model, 'gpt-5.4-mini');
  assert.equal(body.max_tokens, 600);
  assert.equal(body.messages[0].role, 'system');
  assert.equal(result.source, 'ai');
  assert.match(result.answer, /故宫建筑/);
});

test('askAssistant uses its own provider without changing the vision provider config', async () => {
  let capturedUrl = '';
  let capturedOptions = null;
  const result = await askAssistant({
    config: {
      assistantApiKey: 'tokenhub-test-key',
      assistantBaseUrl: 'https://tokenhub.tencentmaas.com',
      assistantChatCompletionsPath: '/v1/chat/completions',
      assistantModel: 'deepseek-v4-pro',
      assistantTimeoutMs: 30000,
      assistantMaxTokens: 2000,
      openaiApiKey: 'vision-provider-key',
      openaiBaseUrl: 'https://api.bkeel.com',
      openaiVisionModel: 'gpt-5.6-terra'
    },
    question: '故宫最值得关注什么？',
    context: { type: 'place', id: 'beijing-palace-museum' },
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '重点关注中轴线和建筑等级。' } }] })
      };
    }
  });

  const body = JSON.parse(capturedOptions.body);
  assert.equal(capturedUrl, 'https://tokenhub.tencentmaas.com/v1/chat/completions');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer tokenhub-test-key');
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.equal(body.max_tokens, 2000);
  assert.equal(result.source, 'ai');
});

test('askAssistant falls back to template answer when external model fails', async () => {
  const result = await askAssistant({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.bkeel.com',
      openaiModel: 'gpt-5.4-mini',
      openaiTimeoutMs: 4000
    },
    question: '推荐一条路线',
    context: { type: 'city', city: '北京' },
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      json: async () => ({})
    })
  });

  assert.equal(result.source, 'template-fallback');
  assert.match(result.answer, /天安门|故宫|路线/);
});

test('askAssistant uses local template when API key is not configured', async () => {
  const result = await askAssistant({
    config: {
      openaiApiKey: '',
      openaiBaseUrl: 'https://api.bkeel.com',
      openaiModel: 'gpt-5.4-mini'
    },
    question: '天坛的建筑有什么特点？',
    fetchImpl: async () => {
      throw new Error('fetch should not be called without API key');
    }
  });

  assert.equal(result.source, 'template');
  assert.match(result.answer, /建筑|空间|轴线/);
});
