const path = require('node:path');

function readConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    dataDir: env.DATA_DIR || path.join(process.cwd(), 'backend', 'data'),
    tencentMapKey: env.TENCENT_MAP_KEY || '',
    openaiBaseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiApiKey: env.OPENAI_API_KEY || '',
    openaiModel: env.OPENAI_MODEL || 'gpt-4o-mini',
    openaiTimeoutMs: Number(env.OPENAI_TIMEOUT_MS || 4000),
    promptVersion: 'local-history-v1'
  };
}

module.exports = { readConfig };
