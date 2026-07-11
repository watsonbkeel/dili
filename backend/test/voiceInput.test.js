const test = require('node:test');
const assert = require('node:assert/strict');

const {
  frameContainsVoice,
  transcriptionText
} = require('../../miniprogram/utils/voiceInput');

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
