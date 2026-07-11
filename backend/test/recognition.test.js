const test = require('node:test');
const assert = require('node:assert/strict');
const {
  confidenceValue,
  normalizeRecognition,
  parseJsonContent,
  recognizeImage
} = require('../src/services/recognition');

async function multipartImage() {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('fake-jpeg-data')], { type: 'image/jpeg' }), 'place.jpg');
  form.append('latitude', '39.916345');
  form.append('longitude', '116.397155');
  form.append('accuracy', '18');
  const request = new Request('http://localhost/upload', { method: 'POST', body: form });
  return {
    body: Buffer.from(await request.arrayBuffer()),
    contentType: request.headers.get('content-type')
  };
}

test('parseJsonContent accepts JSON wrapped in a markdown fence', () => {
  assert.deepEqual(parseJsonContent('```json\n{"recognized":false}\n```'), { recognized: false });
});

test('confidenceValue supports decimal, percentage and percent strings', () => {
  assert.equal(confidenceValue(0.92), 92);
  assert.equal(confidenceValue(92), 92);
  assert.equal(confidenceValue('87%'), 87);
});

test('normalizeRecognition does not treat string false as recognized', () => {
  const result = normalizeRecognition(
    { recognized: 'false', name: '故宫博物院', confidence: 99, visualEvidence: '轮廓不清楚' },
    Buffer.from('image')
  );
  assert.equal(result.recognized, false);
  assert.equal(result.name, '未能可靠识别');
});

test('normalizeRecognition links a specific landmark detail to its known place', () => {
  const result = normalizeRecognition(
    { recognized: true, name: '故宫角楼', confidence: 92, visualEvidence: '红墙黄瓦和角楼轮廓' },
    Buffer.from('image')
  );
  assert.equal(result.recognized, true);
  assert.equal(result.knownPlaceId, 'beijing-palace-museum');
});

test('recognizeImage sends image data to the configured vision model', async () => {
  const upload = await multipartImage();
  let capturedBody = null;
  const result = await recognizeImage({
    ...upload,
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.bkeel.com',
      openaiModel: 'gpt-5.4-mini',
      openaiVisionModel: 'gpt-5.6-terra',
      openaiTimeoutMs: 30000,
      openaiMaxTokens: 600
    },
    fetchImpl: async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  recognized: true,
                  name: '故宫博物院',
                  confidence: 94,
                  type: '明清宫殿建筑',
                  tags: ['故宫', '中轴线'],
                  visualEvidence: '红墙、黄瓦和宫殿中轴布局清晰可见',
                  summary: '图片展示了故宫建筑。',
                  story: '故宫是明清两代皇宫。'
                })
              }
            }
          ]
        })
      };
    }
  });

  assert.equal(capturedBody.model, 'gpt-5.6-terra');
  assert.match(capturedBody.messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/);
  const prompt = JSON.parse(capturedBody.messages[1].content[0].text);
  assert.equal(prompt.locationContext.coordinateSystem, 'GCJ-02');
  assert.equal(prompt.locationContext.latitude, 39.916345);
  assert.equal(prompt.locationContext.accuracyMeters, 18);
  assert.ok(prompt.locationContext.nearbyKnownPlaces.some((place) => place.id === 'beijing-palace-museum'));
  assert.equal(result.recognized, true);
  assert.equal(result.knownPlaceId, 'beijing-palace-museum');
  assert.equal(result.source, 'ai');
  assert.equal(result.locationUsed, true);
});
