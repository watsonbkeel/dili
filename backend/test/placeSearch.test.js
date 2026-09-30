const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { matchPlaces, placesMentionedIn, termSimilarity } = require('../../miniprogram/utils/placeSearch');
const { contextText, templateAnswer } = require('../src/services/assistant');

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

test('city name and filler words alone do not match the same attractions every time', () => {
  // 真机回归：说"北京最大的景点""北京面积最小的景点"都返回 故宫、孔庙、正阳门
  for (const query of ['北京最大的景点', '北京面积最小的景点', '北京有什么好玩的']) {
    assert.deepEqual(matchPlaces(query, places), { mode: 'none', results: [] }, query);
  }
});

test('names that contain the city prefix still match exactly', () => {
  assert.equal(matchPlaces('北京鲁迅博物馆在哪', places).results[0].id, 'beijing-lu-xun-museum');
  assert.equal(matchPlaces('我想去北京人遗址', places).results[0].id, 'zhoukoudian-peking-man-site');
});

test('category requests no longer include unrelated attractions via the city prefix', () => {
  const result = matchPlaces('北京的寺庙', places);
  assert.equal(result.mode, 'similar');
  assert.ok(result.results.some((place) => place.id === 'yonghe-temple'));
  assert.ok(!result.results.some((place) => place.id === 'beijing-palace-museum'));
});

test('placesMentionedIn lists attractions named in an AI answer in order', () => {
  const answer = '收录景点里面积最小的是北京古观象台，其次可以看看白塔寺。故宫是面积最大的。';
  assert.deepEqual(placesMentionedIn(answer, places).map((place) => place.id), [
    'beijing-ancient-observatory',
    'miaoying-temple-white-stupa',
    'beijing-palace-museum'
  ]);
  assert.deepEqual(placesMentionedIn('', places), []);
});

test('placeSearch context gives the model the full attraction catalogue', () => {
  const text = contextText({ type: 'placeSearch', city: '北京' });
  assert.match(text, /已收录的景点/);
  for (const place of places) assert.ok(text.includes(place.name), place.name);
  assert.match(templateAnswer('北京面积最小的景点', { type: 'placeSearch' }), /直接说出景点名称/);
});
