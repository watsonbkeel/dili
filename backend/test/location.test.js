const test = require('node:test');
const assert = require('node:assert/strict');
const { validateLatLng, coarseCoordinate, cacheKeyForStory } = require('../src/services/location');

test('validateLatLng accepts numeric coordinates', () => {
  assert.deepEqual(validateLatLng('39.9', '116.4'), { lat: 39.9, lng: 116.4 });
});

test('validateLatLng rejects invalid coordinates', () => {
  assert.throws(() => validateLatLng('abc', '116.4'), /lat must be a valid number/);
  assert.throws(() => validateLatLng('91', '116.4'), /out of range/);
});

test('coarseCoordinate rounds to coarse precision', () => {
  assert.deepEqual(coarseCoordinate(39.904211, 116.407395), { lat: 39.9, lng: 116.41 });
});

test('cacheKeyForStory is stable for the same inputs', () => {
  const input = {
    place: { id: 'poi-1', title: '博物馆' },
    coarseLocation: { lat: 39.9, lng: 116.41 },
    style: '导览故事',
    promptVersion: 'v1'
  };
  assert.equal(cacheKeyForStory(input), cacheKeyForStory(input));
});
