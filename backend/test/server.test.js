const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/server');
const { DataStore } = require('../src/storage/dataStore');

async function startTestServer() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lhg-server-'));
  const store = new DataStore(dir);
  const server = createApp({
    store,
    config: {
      dataDir: dir,
      tencentMapKey: '',
      openaiApiKey: '',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiModel: 'mock-model',
      promptVersion: 'test-v1'
    }
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
