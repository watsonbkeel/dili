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
    port: Number(mergedEnv.PORT || 3000),
    dataDir: mergedEnv.DATA_DIR || path.join(process.cwd(), 'backend', 'data'),
    assetDir: mergedEnv.ASSET_DIR || path.join(process.cwd(), 'backend', 'public', 'assets'),
    tencentMapKey: mergedEnv.TENCENT_MAP_KEY || '',
    openaiBaseUrl: (mergedEnv.OPENAI_BASE_URL || 'https://api.bkeel.com').replace(/\/$/, ''),
    openaiApiKey: mergedEnv.OPENAI_API_KEY || '',
    openaiModel: mergedEnv.OPENAI_MODEL || 'gpt-5.4-mini',
    openaiVisionModel: mergedEnv.OPENAI_VISION_MODEL || 'gpt-5.6-terra',
    openaiChatCompletionsPath: mergedEnv.OPENAI_CHAT_COMPLETIONS_PATH || '',
    openaiTimeoutMs: Number(mergedEnv.OPENAI_TIMEOUT_MS || 4000),
    openaiMaxTokens: Number(mergedEnv.OPENAI_MAX_TOKENS || 600),
    assistantBaseUrl: (mergedEnv.ASSISTANT_BASE_URL || mergedEnv.OPENAI_BASE_URL || 'https://api.bkeel.com').replace(/\/$/, ''),
    assistantApiKey: mergedEnv.ASSISTANT_API_KEY || mergedEnv.OPENAI_API_KEY || '',
    assistantModel: mergedEnv.ASSISTANT_MODEL || mergedEnv.OPENAI_MODEL || 'gpt-5.4-mini',
    assistantChatCompletionsPath:
      mergedEnv.ASSISTANT_CHAT_COMPLETIONS_PATH || mergedEnv.OPENAI_CHAT_COMPLETIONS_PATH || '',
    assistantTimeoutMs: Number(mergedEnv.ASSISTANT_TIMEOUT_MS || mergedEnv.OPENAI_TIMEOUT_MS || 30000),
    assistantMaxTokens: Number(mergedEnv.ASSISTANT_MAX_TOKENS || mergedEnv.OPENAI_MAX_TOKENS || 600),
    speechToTextUrl: mergedEnv.SPEECH_TO_TEXT_URL || 'http://127.0.0.1:3102/v1/audio/transcriptions',
    speechToTextTimeoutMs: Number(mergedEnv.SPEECH_TO_TEXT_TIMEOUT_MS || 60000),
    promptVersion: 'local-history-v1'
  };
}

module.exports = { parseDotEnv, readConfig };
