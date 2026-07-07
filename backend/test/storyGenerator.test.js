const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DataStore } = require('../src/storage/dataStore');
const { generateStory, parseModelContent, templateStory } = require('../src/services/storyGenerator');
const { getPlaceById } = require('../src/services/placeStore');

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lhg-store-'));
  return new DataStore(dir);
}

test('parseModelContent parses trusted JSON model output', () => {
  const place = getPlaceById('beijing-palace-museum');
  const story = parseModelContent(
    JSON.stringify({
      title: '北京故宫导览',
      durationMinutes: 2,
      story: '北京故宫是明清两代皇宫。',
      factsUsed: ['摘要：北京故宫是在明清两代皇宫紫禁城基础上建立的博物院，保存有大规模古代宫殿建筑群。'],
      sources: [{ title: '百度百科：北京故宫', url: '' }],
      disclaimer: '本导览基于页面列出的资料生成，请以权威来源为准。'
    }),
    place
  );

  assert.equal(story.title, '北京故宫导览');
  assert.equal(story.sources[0].title, '百度百科：北京故宫');
  assert.ok(story.factsUsed.length > 0);
});

test('templateStory uses only seeded place facts', () => {
  const place = getPlaceById('beijing-palace-museum');
  const story = templateStory(place);

  assert.match(story.story, /明清两代皇宫紫禁城/);
  assert.match(story.story, /现场看点/);
  assert.match(story.story, /游览提示/);
  assert.ok(story.factsUsed.some((fact) => fact.includes('1420')));
  assert.ok(story.factsUsed.some((fact) => fact.includes('看点')));
  assert.equal(story.sources[0].title, '百度百科：北京故宫');
});

test('generateStory uses seeded facts without AI key and records history', async () => {
  const store = await tempStore();
  const config = {
    openaiApiKey: '',
    promptVersion: 'test-v1'
  };

  const result = await generateStory({
    config,
    store,
    userId: 'user-1',
    placeId: 'beijing-palace-museum'
  });

  assert.equal(result.cached, false);
  assert.match(result.story.title, /北京故宫/);
  assert.ok(result.story.factsUsed.length > 0);

  const history = await store.listHistory('user-1');
  assert.equal(history.length, 1);
  assert.equal(history[0].placeName, '北京故宫');
});

test('generateStory falls back to local template when AI fetch fails', async () => {
  const store = await tempStore();
  const config = {
    openaiApiKey: 'test-key',
    openaiBaseUrl: 'https://example.invalid/v1',
    openaiModel: 'mock-model',
    promptVersion: 'test-v1'
  };

  const result = await generateStory({
    config,
    store,
    userId: 'user-1',
    placeId: 'temple-of-heaven',
    fetchImpl: async () => {
      throw new Error('fetch failed');
    }
  });

  assert.match(result.story.story, /祈谷|祭天/);
  assert.doesNotMatch(result.story.story, /fetch failed/);
  assert.equal(result.story.sources[0].title, '百度百科：天坛');
});

test('generateStory does not invent conclusions when facts are insufficient', async () => {
  const store = await tempStore();
  const config = {
    openaiApiKey: '',
    promptVersion: 'test-v1'
  };

  const result = await generateStory({
    config,
    store,
    userId: 'user-1',
    place: {
      id: 'unknown-place',
      name: '待补充地点',
      sources: []
    }
  });

  assert.match(result.story.story, /资料不足/);
  assert.deepEqual(result.story.factsUsed, []);
});

test('generateStory returns cached story on repeated request', async () => {
  const store = await tempStore();
  const config = {
    openaiApiKey: '',
    promptVersion: 'test-v1'
  };
  const input = {
    config,
    store,
    userId: 'user-1',
    placeId: 'beijing-palace-museum'
  };

  await generateStory(input);
  const second = await generateStory(input);

  assert.equal(second.cached, true);
  const history = await store.listHistory('user-1');
  assert.equal(history.length, 2);
});

test('generateStory bypasses cache when forceRefresh is true', async () => {
  const store = await tempStore();
  const config = {
    openaiApiKey: '',
    promptVersion: 'test-v1'
  };
  const input = {
    config,
    store,
    userId: 'user-1',
    placeId: 'beijing-palace-museum'
  };

  await generateStory(input);
  const second = await generateStory({ ...input, forceRefresh: true });

  assert.equal(second.cached, false);
});
