// 腾讯云一句话识别 SentenceRecognition（官方 SDK tencentcloud-sdk-nodejs-asr）。
// 文档：https://cloud.tencent.com/document/product/1093/35646
const { asrError, AsrError } = require('./errors');
const { validateAudio } = require('./audio');

const DEFAULT_ENDPOINT = 'asr.tencentcloudapi.com';

function defaultCreateClient(config) {
  // 延迟加载：openai-compatible 回滚模式下不依赖 SDK
  const tencentcloud = require('tencentcloud-sdk-nodejs-asr');
  const AsrClient = tencentcloud.asr.v20190614.Client;
  const credential = {
    secretId: config.tencentSecretId,
    secretKey: config.tencentSecretKey
  };
  if (config.tencentSessionToken) credential.token = config.tencentSessionToken;
  return new AsrClient({
    credential,
    region: config.tencentAsrRegion || '',
    profile: {
      httpProfile: {
        endpoint: config.tencentAsrEndpoint || DEFAULT_ENDPOINT,
        reqTimeout: Math.max(1, Math.ceil(Number(config.asrTimeoutMs || 15000) / 1000))
      }
    }
  });
}

const BALANCE_CODES = new Set([
  'FailedOperation.ServiceIsolate',
  'FailedOperation.UserHasNoAmount',
  'FailedOperation.UserHasNoFreeAmount',
  'FailedOperation.UserNotRegistered'
]);

function classifyTencentError(error) {
  if (error instanceof AsrError) return error;
  const code = String((error && error.code) || '');
  const message = String((error && error.message) || '');
  const name = String((error && error.name) || '');

  if (name === 'AbortError' || name === 'TimeoutError' || /timeout|timed out|aborted/i.test(message)) {
    return asrError('TIMEOUT');
  }
  if (/^AuthFailure/.test(code) || /^UnauthorizedOperation/.test(code)) return asrError('AUTH_FAILED');
  if (/^RequestLimitExceeded/.test(code) || code === 'LimitExceeded') return asrError('RATE_LIMITED');
  if (BALANCE_CODES.has(code) || /^ResourceUnavailable/.test(code) || /^ResourceInsufficient/.test(code)) {
    return asrError('BALANCE');
  }
  if (code === 'InvalidParameterValue.ErrorVoicedataTooLong' || code === 'InvalidParameter.ErrorContentlength') {
    return asrError('TOO_LARGE');
  }
  if (code === 'InvalidParameterValue.ErrorInvalidVoiceFormat') return asrError('UNSUPPORTED_FORMAT');
  if (code === 'InvalidParameterValue.ErrorInvalidVoicedata' || code === 'FailedOperation.ErrorRecognize') {
    return asrError('BAD_AUDIO');
  }
  const classified = asrError('UPSTREAM');
  classified.upstreamCode = code || 'NETWORK';
  return classified;
}

// 只对网络抖动/超时/服务端内部错误重试；鉴权、欠费、限流、参数错误不重试。
function isRetryable(error) {
  if (!(error instanceof AsrError)) return false;
  if (error.code === 'ASR_TIMEOUT') return true;
  if (error.code !== 'ASR_UPSTREAM_ERROR') return false;
  return error.upstreamCode === 'NETWORK' || /^InternalError/.test(error.upstreamCode || '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transcribeWithTencent({ audio, config, createClient = defaultCreateClient, logger = null }) {
  if (!config.tencentSecretId || !config.tencentSecretKey) throw asrError('NOT_CONFIGURED');

  const meta = validateAudio(audio);
  const timeoutMs = Math.max(1000, Number(config.asrTimeoutMs || 15000));
  const maxRetries = Math.max(0, Math.min(2, Number(config.asrMaxRetries ?? 1)));
  const request = {
    EngSerViceType: config.tencentAsrEngine || '16k_zh',
    SourceType: 1,
    VoiceFormat: meta.voiceFormat,
    Data: audio.toString('base64'),
    DataLen: audio.length,
    FilterDirty: 0,
    FilterModal: 0,
    FilterPunc: 0,
    ConvertNumMode: 1,
    WordInfo: 0
  };

  const client = createClient(config);
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now();
    try {
      // 双重超时：SDK reqTimeout + AbortSignal，确保不会无限挂起
      const response = await client.request('SentenceRecognition', request, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      const text = String((response && response.Result) || '').trim();
      const requestId = String((response && response.RequestId) || '');
      if (logger) {
        logger({
          event: 'asr',
          provider: 'tencent',
          ok: true,
          code: text ? 'OK' : 'ASR_EMPTY_RESULT',
          requestId,
          bytes: meta.byteLength,
          durationSeconds: meta.durationSeconds,
          latencyMs: Date.now() - startedAt,
          attempt
        });
      }
      const result = { text, provider: 'tencent', requestId };
      if (!text) result.code = 'ASR_EMPTY_RESULT';
      if (response && Number.isFinite(Number(response.AudioDuration))) {
        result.audioDurationMs = Number(response.AudioDuration);
      }
      return result;
    } catch (error) {
      lastError = classifyTencentError(error);
      if (logger) {
        logger({
          event: 'asr',
          provider: 'tencent',
          ok: false,
          code: lastError.code,
          upstreamCode: lastError.upstreamCode || String((error && error.code) || ''),
          requestId: String((error && error.requestId) || ''),
          bytes: meta.byteLength,
          durationSeconds: meta.durationSeconds,
          latencyMs: Date.now() - startedAt,
          attempt
        });
      }
      if (attempt >= maxRetries || !isRetryable(lastError)) break;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastError;
}

module.exports = {
  classifyTencentError,
  defaultCreateClient,
  isRetryable,
  transcribeWithTencent
};
