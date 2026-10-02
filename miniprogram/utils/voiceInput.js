function frameContainsVoice(frameBuffer) {
  if (!frameBuffer || frameBuffer.byteLength < 4) return false;
  const bytes = new Uint8Array(frameBuffer);
  const isWaveHeader =
    bytes.length > 44 &&
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70;
  const offset = isWaveHeader ? 44 : 0;
  const view = new DataView(frameBuffer);
  let peak = 0;
  let squareSum = 0;
  let sampleCount = 0;

  for (let index = offset; index + 1 < frameBuffer.byteLength; index += 2) {
    const sample = Math.abs(view.getInt16(index, true));
    peak = Math.max(peak, sample);
    squareSum += sample * sample;
    sampleCount += 1;
  }

  if (!sampleCount) return false;
  const rms = Math.sqrt(squareSum / sampleCount);
  return peak >= 500 && rms >= 100;
}

function transcriptionText(payload) {
  return String(
    (payload && payload.text) ||
      (payload && payload.data && payload.data.text) ||
      ''
  ).trim();
}

// 录音启动失败（多为麦克风/音频会话被占用）时自动重试一次
const RECORDER_RETRY_DELAY_MS = 500;

function isStartRecordFailure(error) {
  const message = String((error && error.errMsg) || error || '');
  return /start\s*record\s*fail|start:fail|operateRecorder:fail/i.test(message);
}

function recorderErrorMessage(error) {
  const message = String((error && error.errMsg) || error || '');
  if (/auth|permission|deny|denied|authorize/i.test(message)) {
    return '没有麦克风权限，请在设置中允许录音';
  }
  if (isStartRecordFailure(message)) {
    return '麦克风暂时被占用，请稍后再点一次';
  }
  return '录音失败，请再试一次';
}

module.exports = {
  RECORDER_RETRY_DELAY_MS,
  frameContainsVoice,
  isStartRecordFailure,
  recorderErrorMessage,
  transcriptionText
};
