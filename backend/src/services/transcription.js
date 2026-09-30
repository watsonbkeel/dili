const { audioFromMultipart } = require('./asr/audio');
const { transcribeWithTencent } = require('./asr/tencent');

function transcriptionText(payload) {
  return String(
    (payload && payload.text) ||
      (payload && payload.data && payload.data.text) ||
      ''
  ).trim();
}

function speechProvider(config) {
  const provider = String(config.speechToTextProvider || 'tencent').trim().toLowerCase();
  return provider === 'openai-compatible' ? 'openai-compatible' : 'tencent';
}

// 回滚路径：原样转发 multipart 到 OpenAI 兼容的 /v1/audio/transcriptions（旧 Qwen3-ASR 服务）。
async function transcribeWithOpenAICompatible({ body, contentType, config, fetchImpl = fetch }) {
  if (!String(contentType || '').toLowerCase().startsWith('multipart/form-data')) {
    const error = new Error('Audio upload must use multipart/form-data');
    error.status = 415;
    throw error;
  }
  if (!body || !body.length) {
    const error = new Error('Audio file is required');
    error.status = 400;
    throw error;
  }

  let response;
  try {
    response = await fetchImpl(config.speechToTextUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(Number(config.speechToTextTimeoutMs || 60000)),
      headers: {
        'Content-Type': contentType,
        Accept: 'application/json'
      },
      body
    });
  } catch {
    const error = new Error('Local speech recognition service is unavailable');
    error.status = 502;
    throw error;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error('Speech recognition failed');
    error.status = 502;
    throw error;
  }

  // 只返回 text，不透传上游原始响应
  return { text: transcriptionText(payload), provider: 'openai-compatible' };
}

async function transcribeAudio({ body, contentType, config, fetchImpl = fetch, createAsrClient, logger }) {
  if (speechProvider(config) === 'openai-compatible') {
    return transcribeWithOpenAICompatible({ body, contentType, config, fetchImpl });
  }
  const { audio } = await audioFromMultipart(body, contentType);
  return transcribeWithTencent({ audio, config, createClient: createAsrClient, logger });
}

module.exports = {
  speechProvider,
  transcribeAudio,
  transcribeWithOpenAICompatible,
  transcriptionText
};
