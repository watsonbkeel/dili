// 配置与存储自检：只报告"是否配置/是否可读写/数量"，绝不输出密钥值或用户数据。
// 不调用任何计费接口。供 /api/admin/check 与 scripts/check-env.js 共用。
const fs = require('node:fs/promises');
const path = require('node:path');

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

async function countFiles(dir) {
  let count = 0;
  let bytes = 0;
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        count += 1;
        bytes += (await fs.stat(full)).size;
      }
    }
  }
  await walk(dir);
  return { count, bytes };
}

async function checkDataDir(dataDir) {
  const result = { path: dataDir, writable: false, storeJson: 'missing' };
  try {
    await fs.mkdir(dataDir, { recursive: true });
    const probe = path.join(dataDir, `.write-probe-${process.pid}`);
    await fs.writeFile(probe, 'ok');
    await fs.unlink(probe);
    result.writable = true;
  } catch (error) {
    result.error = error.code || 'UNKNOWN';
  }
  try {
    const raw = await fs.readFile(path.join(dataDir, 'store.json'), 'utf8');
    const store = JSON.parse(raw);
    result.storeJson = 'ok';
    result.counts = {
      storyCache: Object.keys(store.storyCache || {}).length,
      history: Object.keys(store.history || {}).length,
      assistantRecords: Object.keys(store.assistantRecords || {}).length,
      placeReactions: Object.keys(store.placeReactions || {}).length
    };
  } catch (error) {
    result.storeJson = error.code === 'ENOENT' ? 'missing' : 'invalid';
  }
  return result;
}

async function checkAssetDir(assetDir) {
  try {
    const { count, bytes } = await countFiles(assetDir);
    return { path: assetDir, readable: true, files: count, bytes };
  } catch (error) {
    return { path: assetDir, readable: false, error: error.code || 'UNKNOWN' };
  }
}

function configSummary(config) {
  const provider = config.speechToTextProvider === 'openai-compatible' ? 'openai-compatible' : 'tencent';
  const asrConfigured =
    provider === 'tencent'
      ? Boolean(config.tencentSecretId && config.tencentSecretKey)
      : Boolean(config.speechToTextUrl);
  return {
    listen: { host: config.host, port: config.port },
    asr: {
      provider,
      configured: asrConfigured,
      engine: provider === 'tencent' ? config.tencentAsrEngine : undefined,
      endpointHost: provider === 'tencent' ? config.tencentAsrEndpoint : hostOf(config.speechToTextUrl),
      sessionToken: provider === 'tencent' ? Boolean(config.tencentSessionToken) : undefined,
      timeoutMs: provider === 'tencent' ? config.asrTimeoutMs : config.speechToTextTimeoutMs
    },
    assistant: {
      configured: Boolean(config.assistantApiKey || config.openaiApiKey),
      host: hostOf(config.assistantBaseUrl || config.openaiBaseUrl),
      model: config.assistantModel || config.openaiModel,
      timeoutMs: config.assistantTimeoutMs
    },
    vision: {
      configured: Boolean(config.openaiApiKey),
      host: hostOf(config.openaiBaseUrl),
      model: config.openaiVisionModel,
      timeoutMs: config.openaiTimeoutMs
    },
    story: {
      configured: Boolean(config.openaiApiKey),
      host: hostOf(config.openaiBaseUrl),
      model: config.openaiModel
    },
    tencentMap: { configured: Boolean(config.tencentMapKey) },
    paidGuard: {
      perMinute: config.paidRateLimitPerMinute,
      maxConcurrency: config.paidMaxConcurrency
    }
  };
}

async function runtimeCheck({ config }) {
  const [data, assets] = await Promise.all([checkDataDir(config.dataDir), checkAssetDir(config.assetDir)]);
  const summary = configSummary(config);
  const problems = [];
  if (!summary.asr.configured) problems.push('ASR_NOT_CONFIGURED');
  if (!summary.vision.configured) problems.push('VISION_NOT_CONFIGURED');
  if (!summary.assistant.configured) problems.push('ASSISTANT_NOT_CONFIGURED(template fallback)');
  if (!data.writable) problems.push('DATA_DIR_NOT_WRITABLE');
  if (data.storeJson !== 'ok') problems.push(`STORE_JSON_${data.storeJson.toUpperCase()}`);
  if (!assets.readable || !assets.files) problems.push('ASSETS_MISSING');
  return { ok: problems.length === 0, problems, config: summary, data, assets };
}

module.exports = { configSummary, runtimeCheck };
