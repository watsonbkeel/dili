const path = require('node:path');
const fs = require('node:fs');

function parseDotEnv(content) {
  const values = {};
  String(content || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index < 0) return;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) values[key] = value;
    });
  return values;
}

function readEnvFile(env) {
  const envPath = env.ENV_FILE || path.join(process.cwd(), '.env');
  try {
    return parseDotEnv(fs.readFileSync(envPath, 'utf8'));
  } catch {
    return {};
  }
}

function readConfig(env = process.env) {
  const fileEnv = readEnvFile(env);
  const mergedEnv = {
    ...fileEnv,
    ...env
  };

  return {
    host: mergedEnv.HOST || '127.0.0.1',
    port: Number(mergedEnv.PORT || 3000),
    dataDir: mergedEnv.DATA_DIR || path.join(process.cwd(), 'backend', 'data'),
    assetDir: mergedEnv.ASSET_DIR || path.join(process.cwd(), 'backend', 'public', 'assets'),
    tencentMapKey: mergedEnv.TENCENT_MAP_KEY || '',
    openaiBaseUrl: (mergedEnv.OPENAI_BASE_URL || 'https://tokenhub.tencentmaas.com').replace(/\/$/, ''),
    openaiApiKey: mergedEnv.OPENAI_API_KEY || '',
    openaiModel: mergedEnv.OPENAI_MODEL || 'deepseek/deepseek-flash',
    openaiVisionModel: mergedEnv.OPENAI_VISION_MODEL || 'deepseek/deepseek-flash',
    openaiChatCompletionsPath: mergedEnv.OPENAI_CHAT_COMPLETIONS_PATH || '',
    openaiTimeoutMs: Number(mergedEnv.OPENAI_TIMEOUT_MS || 4000),
    openaiMaxTokens: Number(mergedEnv.OPENAI_MAX_TOKENS || 600),
    assistantBaseUrl: (mergedEnv.ASSISTANT_BASE_URL || mergedEnv.OPENAI_BASE_URL || 'https://tokenhub.tencentmaas.com').replace(/\/$/, ''),
    assistantApiKey: mergedEnv.ASSISTANT_API_KEY || mergedEnv.OPENAI_API_KEY || '',
    assistantModel: mergedEnv.ASSISTANT_MODEL || mergedEnv.OPENAI_MODEL || 'deepseek/deepseek-flash',
    assistantChatCompletionsPath:
      mergedEnv.ASSISTANT_CHAT_COMPLETIONS_PATH || mergedEnv.OPENAI_CHAT_COMPLETIONS_PATH || '',
    assistantTimeoutMs: Number(mergedEnv.ASSISTANT_TIMEOUT_MS || mergedEnv.OPENAI_TIMEOUT_MS || 30000),
    assistantMaxTokens: Number(mergedEnv.ASSISTANT_MAX_TOKENS || mergedEnv.OPENAI_MAX_TOKENS || 600),
    speechToTextUrl: mergedEnv.SPEECH_TO_TEXT_URL || 'http://127.0.0.1:3102/v1/audio/transcriptions',
    speechToTextTimeoutMs: Number(mergedEnv.SPEECH_TO_TEXT_TIMEOUT_MS || 60000),
    speechToTextProvider: (mergedEnv.SPEECH_TO_TEXT_PROVIDER || 'tencent').trim().toLowerCase(),
    tencentSecretId: mergedEnv.TENCENTCLOUD_SECRET_ID || '',
    tencentSecretKey: mergedEnv.TENCENTCLOUD_SECRET_KEY || '',
    tencentSessionToken: mergedEnv.TENCENTCLOUD_SESSION_TOKEN || '',
    tencentAsrEndpoint: mergedEnv.TENCENT_ASR_ENDPOINT || 'asr.tencentcloudapi.com',
    tencentAsrRegion: mergedEnv.TENCENT_ASR_REGION || '',
    tencentAsrEngine: mergedEnv.TENCENT_ASR_ENGINE || '16k_zh',
    asrTimeoutMs: Number(mergedEnv.ASR_TIMEOUT_MS || 15000),
    asrMaxRetries: Number(mergedEnv.ASR_MAX_RETRIES ?? 1),
    paidRateLimitPerMinute: Number(mergedEnv.PAID_RATE_LIMIT_PER_MINUTE || 20),
    paidMaxConcurrency: Number(mergedEnv.PAID_MAX_CONCURRENCY || 4),
    trustProxy: String(mergedEnv.TRUST_PROXY || '1') === '1',
    adminToken: mergedEnv.ADMIN_TOKEN || '',
    // DeepSeek V4 系列在 TokenHub 默认开启深度思考，导游问答/识图不需要，关闭以降低延迟和 token。
    // disabled（默认）/ enabled：随请求发送 thinking.type；none：不发送该字段（兼容不认识该字段的模型）。
    llmThinking: String(mergedEnv.LLM_THINKING ?? 'disabled').trim().toLowerCase(),
    promptVersion: 'local-history-v1'
  };
}

module.exports = { parseDotEnv, readConfig };
