const test = require('node:test');
const assert = require('node:assert/strict');

const {
  frameContainsVoice,
  isStartRecordFailure,
  recorderErrorMessage,
  transcriptionText
} = require('../../miniprogram/utils/voiceInput');

test('start record fail is recognized and shown in Chinese', () => {
  const error = { errMsg: 'operateRecorder:fail start record fail' };
  assert.equal(isStartRecordFailure(error), true);
  assert.equal(recorderErrorMessage(error), '麦克风暂时被占用，请稍后再点一次');
  assert.equal(recorderErrorMessage({ errMsg: 'operateRecorder:fail auth deny' }), '没有麦克风权限，请在设置中允许录音');
  assert.equal(recorderErrorMessage({ errMsg: 'something else' }), '录音失败，请再试一次');
  assert.equal(isStartRecordFailure({ errMsg: 'something else' }), false);
});

function audioFrame(samples) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  samples.forEach((sample, index) => view.setInt16(index * 2, sample, true));
  return buffer;
}

test('voice activity detection distinguishes silence from speech-level samples', () => {
  assert.equal(frameContainsVoice(audioFrame(new Array(100).fill(10))), false);
  assert.equal(frameContainsVoice(audioFrame(new Array(100).fill(1200))), true);
});

test('transcription helper supports direct and nested ASR payloads', () => {
  assert.equal(transcriptionText({ text: ' 故宫 ' }), '故宫');
  assert.equal(transcriptionText({ data: { text: ' 天坛 ' } }), '天坛');
});
