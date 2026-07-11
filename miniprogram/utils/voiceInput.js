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

module.exports = {
  frameContainsVoice,
  transcriptionText
};
