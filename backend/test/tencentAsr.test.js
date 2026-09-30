// 腾讯云一句话识别：全部使用 mock client，不使用真实凭证、不产生计费。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/server');
const { DataStore } = require('../src/storage/dataStore');
const { readConfig } = require('../src/config');
const { detectVoiceFormat, parseWav, validateAudio, base64Length } = require('../src/services/asr/audio');
const { classifyTencentError, transcribeWithTencent } = require('../src/services/asr/tencent');
const { visionCompletionsUrl, chatCompletionsUrl } = require('../src/services/assistant');

const FAKE_ID = 'AKIDtest-not-real';
const FAKE_KEY = 'test-secret-not-real';

function makeWav(seconds, { sampleRate = 16000, channels = 1, bits = 16, dataSizeField } = {}) {
  const byteRate = (sampleRate * channels * bits) / 8;
  const dataBytes = Math.round(seconds * byteRate);
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'latin1');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'latin1');
  buffer.write('fmt ', 12, 'latin1');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE((channels * bits) / 8, 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write('data', 36, 'latin1');
  buffer.writeUInt32LE(dataSizeField === undefined ? dataBytes : dataSizeField, 40);
  for (let i = 44; i + 1 < buffer.length; i += 2) buffer.writeInt16LE(((i * 37) % 2000) - 1000, i);
  return buffer;
}

function mockClient(handler) {
  const calls = [];
  return {
    calls,
    factory: (config) => ({
      async request(action, req, options) {
        calls.push({ action, req, options, config });
        return handler({ action, req, options, attempt: calls.length });
      }
    })
  };
}

function tcError(code, message = 'mock error') {
  const error = new Error(message);
  error.code = code;
  error.requestId = 'req-mock';
  return error;
}

const baseConfig = {
  speechToTextProvider: 'tencent',
  tencentSecretId: FAKE_ID,
  tencentSecretKey: FAKE_KEY,
  tencentAsrEngine: '16k_zh',
  asrTimeoutMs: 5000,
  asrMaxRetries: 1
};

test('config defaults ASR provider to tencent and reads Tencent env keys', () => {
  const config = readConfig({
    ENV_FILE: '/nonexistent/.env',
    TENCENTCLOUD_SECRET_ID: FAKE_ID,
    TENCENTCLOUD_SECRET_KEY: FAKE_KEY,
    HOST: '127.0.0.1',
    PORT: '13104'
  });
  assert.equal(config.speechToTextProvider, 'tencent');
  assert.equal(config.tencentSecretId, FAKE_ID);
  assert.equal(config.tencentAsrEngine, '16k_zh');
  assert.equal(config.tencentAsrEndpoint, 'asr.tencentcloudapi.com');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 13104);
  const rollback = readConfig({ ENV_FILE: '/nonexistent/.env', SPEECH_TO_TEXT_PROVIDER: 'openai-compatible' });
  assert.equal(rollback.speechToTextProvider, 'openai-compatible');
});

test('audio helpers detect formats and WAV duration from headers', () => {
  const wav = makeWav(2);
  assert.equal(detectVoiceFormat(wav), 'wav');
  assert.equal(detectVoiceFormat(Buffer.from('OggS0000000000000000')), 'ogg-opus');
  assert.equal(detectVoiceFormat(Buffer.from('ID3\u0003000000000000')), 'mp3');
  assert.equal(detectVoiceFormat(Buffer.from('#!AMR\n0000000000000')), 'amr');
  assert.equal(detectVoiceFormat(Buffer.from('hello world, not audio')), '');
  assert.equal(Math.round(parseWav(wav).durationSeconds), 2);
  // 录音中途产生的 data size=0 的 WAV 仍按实际字节计算
  assert.equal(Math.round(parseWav(makeWav(3, { dataSizeField: 0 })).durationSeconds), 3);
});

test('60s 16k mono wav fits the 3MB base64 limit; longer audio is rejected', () => {
  const sixty = makeWav(60);
  assert.ok(base64Length(sixty.length) <= 3 * 1024 * 1024);
  assert.equal(validateAudio(sixty).voiceFormat, 'wav');
  assert.throws(() => validateAudio(makeWav(62)), { code: 'ASR_TOO_LONG', status: 413 });
  assert.throws(() => validateAudio(makeWav(0)), { code: 'ASR_EMPTY_AUDIO' });
  assert.throws(() => validateAudio(Buffer.alloc(0)), { code: 'ASR_EMPTY_AUDIO' });
  assert.throws(() => validateAudio(Buffer.from('not-audio-content-here')), { code: 'ASR_UNSUPPORTED_FORMAT' });
  const bigMp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(2.4 * 1024 * 1024)]);
  assert.throws(() => validateAudio(bigMp3), { code: 'ASR_TOO_LARGE' });
});

test('transcribeWithTencent sends official SentenceRecognition parameters', async () => {
  const audio = makeWav(1.5);
  const client = mockClient(() => ({ Result: ' 故宫中轴线有什么意义？ ', AudioDuration: 1500, RequestId: 'r-1' }));
  const result = await transcribeWithTencent({ audio, config: baseConfig, createClient: client.factory });
  assert.deepEqual(result, {
    text: '故宫中轴线有什么意义？',
    provider: 'tencent',
    requestId: 'r-1',
    audioDurationMs: 1500
  });
  assert.equal(client.calls.length, 1);
  const { action, req, options } = client.calls[0];
  assert.equal(action, 'SentenceRecognition');
  assert.equal(req.EngSerViceType, '16k_zh');
  assert.equal(req.SourceType, 1);
  assert.equal(req.VoiceFormat, 'wav');
  assert.equal(req.DataLen, audio.length);
  assert.equal(req.Data, audio.toString('base64'));
  assert.doesNotMatch(req.Data, /\s/);
  assert.ok(options.signal instanceof AbortSignal);
});

test('empty recognition result returns empty text with ASR_EMPTY_RESULT code', async () => {
  const client = mockClient(() => ({ Result: '', RequestId: 'r-2' }));
  const result = await transcribeWithTencent({ audio: makeWav(1), config: baseConfig, createClient: client.factory });
  assert.equal(result.text, '');
  assert.equal(result.code, 'ASR_EMPTY_RESULT');
});

test('missing Tencent credentials fail fast without calling the SDK', async () => {
  const client = mockClient(() => ({ Result: 'x' }));
  await assert.rejects(
    transcribeWithTencent({ audio: makeWav(1), config: { ...baseConfig, tencentSecretKey: '' }, createClient: client.factory }),
    { code: 'ASR_NOT_CONFIGURED', status: 503 }
  );
  assert.equal(client.calls.length, 0);
});

test('Tencent error codes map to distinct user-facing errors', () => {
  const cases = [
    ['AuthFailure.SignatureFailure', 'ASR_AUTH_FAILED', 502],
    ['AuthFailure.SecretIdNotFound', 'ASR_AUTH_FAILED', 502],
    ['UnauthorizedOperation', 'ASR_AUTH_FAILED', 502],
    ['RequestLimitExceeded', 'ASR_RATE_LIMITED', 429],
    ['FailedOperation.ServiceIsolate', 'ASR_BALANCE', 503],
    ['FailedOperation.UserHasNoAmount', 'ASR_BALANCE', 503],
    ['FailedOperation.UserHasNoFreeAmount', 'ASR_BALANCE', 503],
    ['FailedOperation.UserNotRegistered', 'ASR_BALANCE', 503],
    ['InvalidParameterValue.ErrorVoicedataTooLong', 'ASR_TOO_LARGE', 413],
    ['InvalidParameter.ErrorContentlength', 'ASR_TOO_LARGE', 413],
    ['InvalidParameterValue.ErrorInvalidVoiceFormat', 'ASR_UNSUPPORTED_FORMAT', 415],
    ['InvalidParameterValue.ErrorInvalidVoicedata', 'ASR_BAD_AUDIO', 422],
    ['FailedOperation.ErrorRecognize', 'ASR_BAD_AUDIO', 422],
    ['InternalError.ErrorDownFile', 'ASR_UPSTREAM_ERROR', 502]
  ];
  for (const [code, expected, status] of cases) {
    const error = classifyTencentError(tcError(code, `upstream says ${FAKE_KEY}`));
    assert.equal(error.code, expected, code);
    assert.equal(error.status, status, code);
    assert.doesNotMatch(error.message, /upstream says|not-real/);
  }
  const timeout = new Error('network timeout at: https://asr.tencentcloudapi.com/');
  assert.equal(classifyTencentError(timeout).code, 'ASR_TIMEOUT');
  const abort = new Error('This operation was aborted');
  abort.name = 'AbortError';
  assert.equal(classifyTencentError(abort).code, 'ASR_TIMEOUT');
});

test('timeouts are retried a limited number of times; auth errors are not retried', async () => {
  const timeoutClient = mockClient(() => {
    throw new Error('network timeout at: https://asr.tencentcloudapi.com/');
  });
  await assert.rejects(
    transcribeWithTencent({ audio: makeWav(1), config: { ...baseConfig, asrMaxRetries: 1 }, createClient: timeoutClient.factory }),
    { code: 'ASR_TIMEOUT', status: 504 }
  );
  assert.equal(timeoutClient.calls.length, 2);

  const authClient = mockClient(() => {
    throw tcError('AuthFailure.SignatureFailure');
  });
  await assert.rejects(
    transcribeWithTencent({ audio: makeWav(1), config: { ...baseConfig, asrMaxRetries: 2 }, createClient: authClient.factory }),
    { code: 'ASR_AUTH_FAILED' }
  );
  assert.equal(authClient.calls.length, 1);

  const flaky = mockClient(({ attempt }) => {
    if (attempt === 1) throw tcError('InternalError');
    return { Result: '天坛', RequestId: 'r-3' };
  });
  const result = await transcribeWithTencent({ audio: makeWav(1), config: baseConfig, createClient: flaky.factory });
  assert.equal(result.text, '天坛');
  assert.equal(flaky.calls.length, 2);
});

test('retries are capped at 2 even if misconfigured', async () => {
  const client = mockClient(() => {
    throw new Error('network timeout');
  });
  await assert.rejects(
    transcribeWithTencent({ audio: makeWav(1), config: { ...baseConfig, asrMaxRetries: 99 }, createClient: client.factory })
  );
  assert.equal(client.calls.length, 3);
});

test('ASR logs contain metadata only (no audio, base64 or secrets)', async () => {
  const logs = [];
  const audio = makeWav(1);
  const client = mockClient(() => ({ Result: '颐和园', RequestId: 'r-4' }));
  await transcribeWithTencent({
    audio,
    config: baseConfig,
    createClient: client.factory,
    logger: (entry) => logs.push(JSON.stringify(entry))
  });
  assert.equal(logs.length, 1);
  const line = logs[0];
  assert.match(line, /"requestId":"r-4"/);
  assert.doesNotMatch(line, new RegExp(FAKE_ID));
  assert.doesNotMatch(line, new RegExp(FAKE_KEY));
  assert.doesNotMatch(line, /颐和园/);
  assert.ok(!line.includes(audio.toString('base64').slice(0, 40)));
});

test('vision URL uses OPENAI_* only and is not redirected by ASSISTANT_*', () => {
  const config = {
    assistantBaseUrl: 'https://tokenhub.tencentmaas.com',
    assistantChatCompletionsPath: '/v1/chat/completions',
    openaiBaseUrl: 'https://api.bkeel.com'
  };
  assert.equal(visionCompletionsUrl(config), 'https://api.bkeel.com/v1/chat/completions');
  assert.equal(chatCompletionsUrl(config), 'https://tokenhub.tencentmaas.com/v1/chat/completions');
});

// ---------- HTTP 层：/api/transcriptions 对外协议兼容 ----------

async function startServer({ config = {}, createAsrClient, logger = null, paidGuard } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dili-asr-'));
  const server = createApp({
    store: new DataStore(dir),
    createAsrClient,
    logger,
    ...(paidGuard ? { paidGuard } : {}),
    config: {
      dataDir: dir,
      assetDir: dir,
      openaiApiKey: '',
      openaiBaseUrl: 'https://api.bkeel.com',
      paidRateLimitPerMinute: 100,
      paidMaxConcurrency: 10,
      ...baseConfig,
      ...config
    },
    fetchImpl: async () => {
      throw new Error('fetch must not be called in tencent ASR mode');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

// 模拟小程序 wx.uploadFile：name=file，并附带旧 Qwen formData 字段
function miniProgramForm(audio, fileName = 'voice.wav') {
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/wav' }), fileName);
  form.append('model', 'Qwen/Qwen3-ASR-1.7B');
  form.append('language', 'Chinese');
  form.append('response_format', 'json');
  return form;
}

test('POST /api/transcriptions keeps {text} contract and ignores client model field', async (t) => {
  const client = mockClient(() => ({ Result: '故宫中轴线有什么意义？', RequestId: 'r-http' }));
  const server = await startServer({ createAsrClient: client.factory });
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: miniProgramForm(makeWav(2)) });
  const payload = await res.json();
  assert.equal(res.status, 200);
  assert.equal(payload.text, '故宫中轴线有什么意义？');
  assert.equal(payload.provider, 'tencent');
  assert.equal(client.calls[0].req.EngSerViceType, '16k_zh');
  assert.ok(!JSON.stringify(client.calls[0].req).includes('Qwen'));
  assert.ok(!('Response' in payload));
});

test('POST /api/transcriptions returns distinct JSON errors without upstream details', async (t) => {
  const client = mockClient(() => {
    throw tcError('FailedOperation.UserHasNoAmount', `balance leak ${FAKE_KEY}`);
  });
  const server = await startServer({ createAsrClient: client.factory });
  t.after(server.close);

  const cases = [
    [() => fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: 'raw', headers: { 'Content-Type': 'audio/wav' } }), 415, 'ASR_UPLOAD_NOT_MULTIPART'],
    [() => {
      const form = new FormData();
      form.append('model', 'Qwen/Qwen3-ASR-1.7B');
      return fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: form });
    }, 400, 'ASR_NO_FILE'],
    [() => fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: miniProgramForm(Buffer.from('plain text, not audio')) }), 415, 'ASR_UNSUPPORTED_FORMAT'],
    [() => fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: miniProgramForm(makeWav(0)) }), 400, 'ASR_EMPTY_AUDIO'],
    [() => fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: miniProgramForm(makeWav(1)) }), 503, 'ASR_BALANCE']
  ];
  for (const [send, status, code] of cases) {
    const res = await send();
    const payload = await res.json();
    assert.equal(res.status, status, code);
    assert.equal(payload.code, code);
    assert.equal(typeof payload.error, 'string');
    assert.doesNotMatch(JSON.stringify(payload), /balance leak|not-real|AKID/);
  }
});

test('POST /api/transcriptions returns 503 when Tencent credentials are missing', async (t) => {
  const client = mockClient(() => ({ Result: 'x' }));
  const server = await startServer({ createAsrClient: client.factory, config: { tencentSecretId: '', tencentSecretKey: '' } });
  t.after(server.close);
  const res = await fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: miniProgramForm(makeWav(1)) });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, 'ASR_NOT_CONFIGURED');
  assert.equal(client.calls.length, 0);
});

test('POST /api/transcriptions rejects oversized uploads with 413 before calling ASR', async (t) => {
  const client = mockClient(() => ({ Result: 'x' }));
  const server = await startServer({ createAsrClient: client.factory });
  t.after(server.close);
  const res = await fetch(`${server.baseUrl}/api/transcriptions`, {
    method: 'POST',
    body: miniProgramForm(makeWav(120))
  });
  assert.equal(res.status, 413);
  assert.equal(client.calls.length, 0);
});

test('paid endpoints are rate limited per client IP', async (t) => {
  const client = mockClient(() => ({ Result: '北海', RequestId: 'r' }));
  const server = await startServer({ createAsrClient: client.factory, config: { paidRateLimitPerMinute: 2 } });
  t.after(server.close);
  const statuses = [];
  for (let i = 0; i < 3; i += 1) {
    const res = await fetch(`${server.baseUrl}/api/transcriptions`, {
      method: 'POST',
      headers: { 'X-Real-IP': '203.0.113.9' },
      body: miniProgramForm(makeWav(1))
    });
    statuses.push(res.status);
    if (res.status === 429) {
      assert.ok(res.headers.get('retry-after'));
      assert.equal((await res.json()).code, 'RATE_LIMITED');
    } else {
      await res.json();
    }
  }
  assert.deepEqual(statuses, [200, 200, 429]);
  assert.equal(client.calls.length, 2);
});

test('paid endpoints reject when concurrency limit is reached', async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const client = mockClient(async () => {
    await gate;
    return { Result: '景山', RequestId: 'r' };
  });
  const server = await startServer({ createAsrClient: client.factory, config: { paidMaxConcurrency: 1 } });
  t.after(server.close);
  const first = fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: miniProgramForm(makeWav(1)) });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const second = await fetch(`${server.baseUrl}/api/transcriptions`, { method: 'POST', body: miniProgramForm(makeWav(1)) });
  assert.equal(second.status, 429);
  await second.json();
  release();
  const firstRes = await first;
  assert.equal(firstRes.status, 200);
  await firstRes.json();
});

test('/health stays cheap and /api/admin/check requires a strong admin token', async (t) => {
  const token = 'admin-token-for-tests-only-123456';
  const server = await startServer({ config: { adminToken: token } });
  t.after(server.close);

  const health = await fetch(`${server.baseUrl}/health`);
  assert.deepEqual(await health.json(), { ok: true });

  const denied = await fetch(`${server.baseUrl}/api/admin/check`);
  assert.equal(denied.status, 404);
  await denied.json();

  const res = await fetch(`${server.baseUrl}/api/admin/check`, { headers: { 'X-Admin-Token': token } });
  const payload = await res.json();
  assert.equal(res.status, 200);
  assert.equal(payload.config.asr.provider, 'tencent');
  assert.equal(payload.config.asr.configured, true);
  assert.equal(payload.data.writable, true);
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, new RegExp(FAKE_ID));
  assert.doesNotMatch(text, new RegExp(FAKE_KEY));
  assert.doesNotMatch(text, new RegExp(token));
});
