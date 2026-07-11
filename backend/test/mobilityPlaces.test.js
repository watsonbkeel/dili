const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shortWalkScore,
  sortAccessiblePlaces,
  sortShortWalkPlaces
} = require('../../miniprogram/utils/mobilityPlaces');

function place(id, level, wheelchairTourable, distance, walkingTimeMinutes) {
  return {
    id,
    distance,
    walkingTimeMinutes,
    accessibility: { level, wheelchairTourable }
  };
}

test('accessible sorting excludes non-wheelchair places and prioritizes access level', () => {
  const places = [
    place('partial-near', 'partial', true, 100, 30),
    place('full-far', 'full', true, 2000, 60),
    place('full-near', 'full', true, 500, 90),
    place('not-tourable', 'none', false, 10, 10)
  ];

  assert.deepEqual(
    sortAccessiblePlaces(places).map((item) => item.id),
    ['full-near', 'full-far', 'partial-near']
  );
});

test('short-walk sorting combines distance and walking time', () => {
  const nearbyLongWalk = place('nearby-long', 'full', true, 200, 180);
  const fartherShortWalk = place('farther-short', 'partial', true, 1000, 30);
  const excluded = place('excluded', 'none', false, 10, 5);

  assert.ok(shortWalkScore(fartherShortWalk) < shortWalkScore(nearbyLongWalk));
  assert.deepEqual(
    sortShortWalkPlaces([nearbyLongWalk, fartherShortWalk, excluded]).map((item) => item.id),
    ['farther-short', 'nearby-long']
  );
});
