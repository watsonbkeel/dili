// 语音识别统一错误。message 面向小程序用户（会直接展示），code 供日志与排障使用。
class AsrError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'AsrError';
    this.code = code;
    this.status = status;
  }
}

const ASR_ERRORS = {
  NOT_CONFIGURED: ['ASR_NOT_CONFIGURED', '语音识别服务暂未配置，请稍后再试', 503],
  UPLOAD_NOT_MULTIPART: ['ASR_UPLOAD_NOT_MULTIPART', '语音上传格式错误，请重新录音', 415],
  UPLOAD_UNPARSABLE: ['ASR_UPLOAD_UNPARSABLE', '语音上传内容无法解析，请重新录音', 400],
  NO_FILE: ['ASR_NO_FILE', '没有收到录音文件，请重新录音', 400],
  EMPTY_AUDIO: ['ASR_EMPTY_AUDIO', '录音内容为空，请重新录音', 400],
  UNSUPPORTED_FORMAT: ['ASR_UNSUPPORTED_FORMAT', '暂不支持该录音格式，请重新录音', 415],
  TOO_LARGE: ['ASR_TOO_LARGE', '录音文件过大，请缩短到 60 秒以内', 413],
  TOO_LONG: ['ASR_TOO_LONG', '录音超过 60 秒，请缩短后再试', 413],
  TIMEOUT: ['ASR_TIMEOUT', '语音识别超时，请稍后再试', 504],
  AUTH_FAILED: ['ASR_AUTH_FAILED', '语音识别服务鉴权失败，请联系管理员', 502],
  RATE_LIMITED: ['ASR_RATE_LIMITED', '语音识别请求过多，请稍后再试', 429],
  BALANCE: ['ASR_BALANCE', '语音识别服务暂不可用（额度或欠费），请联系管理员', 503],
  BAD_AUDIO: ['ASR_BAD_AUDIO', '录音无法识别，请靠近麦克风重新录音', 422],
  UPSTREAM: ['ASR_UPSTREAM_ERROR', '语音识别服务暂时不可用，请稍后再试', 502]
};

function asrError(key) {
  const [code, message, status] = ASR_ERRORS[key] || ASR_ERRORS.UPSTREAM;
  return new AsrError(code, message, status);
}

module.exports = { AsrError, ASR_ERRORS, asrError };
