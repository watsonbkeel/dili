const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { matchPlaces, termSimilarity } = require('../../miniprogram/utils/placeSearch');

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/beijing-hotspots.seed.json'), 'utf8')
);
const places = seed.items;

test('voice place search finds names and aliases inside a longer utterance', () => {
  const result = matchPlaces('我今天想先去故宫博物院，然后看看前门', places);
  assert.equal(result.mode, 'exact');
  assert.deepEqual(result.results.map((place) => place.id), [
    'beijing-palace-museum',
    'zhengyangmen'
  ]);
});

test('voice place search associates an ASR near-match with the intended attraction', () => {
  const result = matchPlaces('帮我找一下卢沟乔', places);
  assert.equal(result.mode, 'similar');
  assert.equal(result.results[0].id, 'lugou-bridge');
  assert.ok(termSimilarity('卢沟桥', '帮我找一下卢沟乔') > 0.5);
});

test('voice place search can use attraction categories for broad requests', () => {
  const result = matchPlaces('我想看看北京的皇家园林', places);
  assert.equal(result.mode, 'similar');
  assert.ok(result.results.some((place) => place.id === 'summer-palace'));
  assert.ok(result.results.length <= 6);
});

test('voice place search returns no arbitrary places for unrelated speech', () => {
  const result = matchPlaces('今天天气怎么样', places);
  assert.deepEqual(result, { mode: 'none', results: [] });
});
