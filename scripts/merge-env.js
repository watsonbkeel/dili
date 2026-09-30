#!/usr/bin/env node
// 按白名单合并多个 env 文件（后者覆盖前者），生成新服务器 /etc/dili/dili.env。
// 只打印键名和"已设置/为空"，不打印任何值。
// 用法：node scripts/merge-env.js --out /etc/dili/dili.env old-prod.env ~/.config/dili/migration.env
const fs = require('node:fs');
const { parseDotEnv } = require('../backend/src/config');

const WHITELIST = [
  'TENCENT_MAP_KEY',
  'OPENAI_BASE_URL', 'OPENAI_CHAT_COMPLETIONS_PATH', 'OPENAI_API_KEY', 'OPENAI_MODEL',
  'OPENAI_VISION_MODEL', 'OPENAI_TIMEOUT_MS', 'OPENAI_MAX_TOKENS',
  'ASSISTANT_BASE_URL', 'ASSISTANT_CHAT_COMPLETIONS_PATH', 'ASSISTANT_API_KEY', 'ASSISTANT_MODEL',
  'ASSISTANT_TIMEOUT_MS', 'ASSISTANT_MAX_TOKENS',
  'SPEECH_TO_TEXT_PROVIDER', 'SPEECH_TO_TEXT_URL', 'SPEECH_TO_TEXT_TIMEOUT_MS',
  'TENCENTCLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_KEY', 'TENCENTCLOUD_SESSION_TOKEN',
  'TENCENT_ASR_ENGINE', 'TENCENT_ASR_ENDPOINT', 'TENCENT_ASR_REGION', 'ASR_TIMEOUT_MS', 'ASR_MAX_RETRIES',
  'PAID_RATE_LIMIT_PER_MINUTE', 'PAID_MAX_CONCURRENCY', 'TRUST_PROXY', 'ADMIN_TOKEN'
];

// 新服务器固定值：不从旧环境继承（端口/目录/监听地址由部署决定）
const SERVER_DEFAULTS = {
  HOST: '127.0.0.1',
  PORT: '13104',
  DATA_DIR: '/var/lib/dili/data',
  ASSET_DIR: '/var/lib/dili/assets',
  SPEECH_TO_TEXT_PROVIDER: 'tencent',
  TENCENT_ASR_ENGINE: '16k_zh',
  ASR_TIMEOUT_MS: '15000',
  ASR_MAX_RETRIES: '1',
  TRUST_PROXY: '1'
};

function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  if (outIndex < 0 || !args[outIndex + 1]) {
    console.error('usage: merge-env.js --out <target> <env-file>...');
    process.exit(2);
  }
  const out = args[outIndex + 1];
  const sources = args.filter((_, index) => index !== outIndex && index !== outIndex + 1);
  const merged = { ...SERVER_DEFAULTS };
  for (const file of sources) {
    const values = parseDotEnv(fs.readFileSync(file, 'utf8'));
    for (const key of WHITELIST) {
      if (values[key] !== undefined && values[key] !== '') merged[key] = values[key];
    }
  }
  const keys = [...Object.keys(SERVER_DEFAULTS), ...WHITELIST.filter((key) => !(key in SERVER_DEFAULTS))];
  const lines = keys.filter((key) => merged[key] !== undefined).map((key) => `${key}=${merged[key]}`);
  fs.writeFileSync(out, `${lines.join('\n')}\n`, { mode: 0o600 });
  fs.chmodSync(out, 0o600);
  for (const key of keys) console.log(`${key}: ${merged[key] ? 'set' : 'empty'}`);
  console.log(`written: ${out} (mode 600)`);
}

main();
