const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/server');
const { DataStore } = require('../src/storage/dataStore');

async function startTestServer(options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lhg-server-'));
  const store = new DataStore(dir);
  const server = createApp({
    store,
    createAsrClient: options.createAsrClient,
    logger: options.logger || null,
    config: {
      dataDir: dir,
      tencentMapKey: '',
      openaiApiKey: '',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiModel: 'mock-model',
      speechToTextUrl: 'http://127.0.0.1:3102/v1/audio/transcriptions',
      promptVersion: 'test-v1',
      ...(options.config || {})
    },
    fetchImpl: options.fetchImpl || fetch
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    store,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test('GET /api/nearby returns mock places without Tencent key', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/nearby?lat=39.9&lng=116.4`);
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.source, 'mock');
  assert.ok(payload.places.length > 0);
});

test('GET /api/geocode returns fallback coordinates without Tencent key', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/geocode?address=${encodeURIComponent('北京故宫')}`);
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.source, 'mock');
  assert.equal(payload.location.city, '北京市');
  assert.equal(payload.location.coarse.lat, 39.9);
});

test('GET /api/places returns Beijing historical places by default', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/places`);
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.city, '北京');
  assert.equal(payload.coordinateSystem, 'GCJ-02');
  assert.ok(payload.places.length >= 15);
  assert.ok(payload.places.some((place) => place.id === 'beijing-palace-museum'));
  assert.ok(payload.places.some((place) => place.name === '天坛'));
});

test('GET /api/places?q=故宫 returns Beijing Palace Museum', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/places?q=${encodeURIComponent('故宫')}`);
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.places[0].id, 'beijing-palace-museum');
});

test('GET /api/places/:id returns timeline, sources and highlights', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/places/beijing-palace-museum`);
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.ok(payload.place.timeline.length > 0);
  assert.ok(payload.place.highlights.length > 0);
  assert.ok(payload.place.sources.some((source) => source.title.includes('百度百科')));
});

test('GET /api/places with coordinates returns distance sorted places', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/places?lat=39.916345&lng=116.397155&radius=20000`);
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.places[0].id, 'beijing-palace-museum');
  assert.equal(typeof payload.places[0].distance, 'number');
  assert.ok(payload.places[0].distance <= payload.places[1].distance);
});

test('place reaction counts support selecting, switching and cancelling without identity verification', async (t) => {
  const server = await startTestServer();
  t.after(server.close);
  const url = `${server.baseUrl}/api/places/beijing-palace-museum/reactions`;

  const initial = await fetch(url).then((res) => res.json());
  assert.deepEqual(initial.counts, { recommend: 0, notRecommend: 0 });

  const recommend = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previous: '', reaction: 'recommend' })
  }).then((res) => res.json());
  assert.deepEqual(recommend.counts, { recommend: 1, notRecommend: 0 });

  const switched = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previous: 'recommend', reaction: 'notRecommend' })
  }).then((res) => res.json());
  assert.deepEqual(switched.counts, { recommend: 0, notRecommend: 1 });

  const cancelled = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previous: 'notRecommend', reaction: '' })
  }).then((res) => res.json());
  assert.deepEqual(cancelled.counts, { recommend: 0, notRecommend: 0 });
});

test('GET /assets serves attraction images from backend public directory', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/assets/images/attractions/beijing-palace-museum.jpg`);
  const contentType = res.headers.get('content-type');
  const body = Buffer.from(await res.arrayBuffer());

  assert.equal(res.status, 200);
  assert.equal(contentType, 'image/jpeg');
  assert.ok(body.length > 1000);
});

test('GET /api/routes returns Beijing route stops', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/routes`);
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.ok(payload.routes.length > 0);
  assert.equal(payload.routes[0].id, 'beijing-classic-day');
  assert.ok(payload.routes[0].stops.length >= 5);
});

test('POST /api/assistant returns template answer without AI key', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: '推荐一条适合亲子游的路线',
      context: { type: 'city', city: '北京' }
    })
  });
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.ok(payload.recordId);
  assert.match(payload.answer, /天安门|故宫|路线/);

  const records = await server.store.listAssistantRecords('anonymous');
  assert.equal(records.length, 1);
  assert.equal(records[0].question, '推荐一条适合亲子游的路线');
  assert.match(records[0].answer, /天安门|故宫|路线/);
  assert.equal(records[0].source, 'template');
});

test('POST /api/transcriptions proxies multipart audio to local ASR in openai-compatible rollback mode', async (t) => {
  let capturedUrl = '';
  let capturedOptions = null;
  const server = await startTestServer({
    config: { speechToTextProvider: 'openai-compatible' },
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: '故宫中轴线有什么意义？' })
      };
    }
  });
  t.after(server.close);

  const form = new FormData();
  form.append('file', new Blob([Buffer.from('RIFF-test-audio')], { type: 'audio/wav' }), 'question.wav');
  form.append('model', 'Qwen/Qwen3-ASR-1.7B');
  form.append('language', 'Chinese');
  const res = await fetch(`${server.baseUrl}/api/transcriptions`, {
    method: 'POST',
    body: form
  });
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.text, '故宫中轴线有什么意义？');
  assert.equal(capturedUrl, 'http://127.0.0.1:3102/v1/audio/transcriptions');
  assert.match(capturedOptions.headers['Content-Type'], /^multipart\/form-data; boundary=/);
  assert.ok(Buffer.isBuffer(capturedOptions.body));
  assert.match(capturedOptions.body.toString(), /Qwen\/Qwen3-ASR-1.7B/);
  assert.match(capturedOptions.body.toString(), /Chinese/);
});

test('POST /api/recognize returns a dynamic vision-model result', async (t) => {
  const server = await startTestServer({
    config: { openaiApiKey: 'vision-test-key', openaiVisionModel: 'gpt-5.6-terra' },
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.model, 'gpt-5.6-terra');
      assert.match(request.messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/);
      const prompt = JSON.parse(request.messages[1].content[0].text);
      assert.equal(prompt.locationContext.latitude, 39.905078);
      assert.ok(prompt.locationContext.nearbyKnownPlaces.length > 0);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  recognized: true,
                  name: '天坛',
                  confidence: 91,
                  type: '坛庙建筑',
                  tags: ['祈年殿'],
                  visualEvidence: '蓝色琉璃瓦和圆形攒尖顶清晰可见',
                  summary: '图片中是天坛代表建筑。',
                  story: '天坛是明清皇家祭天场所。'
                })
              }
            }
          ]
        })
      };
    }
  });
  t.after(server.close);

  const form = new FormData();
  form.append('file', new Blob([Buffer.from('fake-jpeg-data')], { type: 'image/jpeg' }), 'temple.jpg');
  form.append('latitude', '39.905078');
  form.append('longitude', '116.401632');
  form.append('accuracy', '20');
  const res = await fetch(`${server.baseUrl}/api/recognize`, { method: 'POST', body: form });
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.result.name, '天坛');
  assert.equal(payload.result.source, 'ai');
  assert.equal(payload.result.knownPlaceId, 'temple-of-heaven');
  assert.equal(payload.result.locationUsed, true);
});

test('story and history endpoints work together', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const storyRes = await fetch(`${server.baseUrl}/api/story`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': 'user-1'
    },
    body: JSON.stringify({
      placeId: 'beijing-palace-museum'
    })
  });
  const storyPayload = await storyRes.json();
  assert.equal(storyRes.status, 200);
  assert.ok(storyPayload.historyId);
  assert.match(storyPayload.story.story, /明清两代皇宫/);
  assert.ok(storyPayload.story.factsUsed.length > 0);

  const historyRes = await fetch(`${server.baseUrl}/api/history?userId=user-1`);
  const historyPayload = await historyRes.json();
  assert.equal(historyPayload.history.length, 1);

  const deleteRes = await fetch(`${server.baseUrl}/api/history/${storyPayload.historyId}?userId=user-1`, {
    method: 'DELETE'
  });
  assert.equal(deleteRes.status, 200);

  const afterDelete = await fetch(`${server.baseUrl}/api/history?userId=user-1`).then((res) => res.json());
  assert.equal(afterDelete.history.length, 0);
});

test('POST /api/story returns clear error for unknown placeId', async (t) => {
  const server = await startTestServer();
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId: 'missing-place' })
  });
  const payload = await res.json();

  assert.equal(res.status, 404);
  assert.equal(payload.error, 'Place not found');
});
