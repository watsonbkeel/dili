const test = require('node:test');
const assert = require('node:assert/strict');

const storage = new Map();
global.wx = {
  getStorageSync(key) {
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, JSON.parse(JSON.stringify(value)));
  }
};

const viewHistory = require('../../miniprogram/utils/viewHistory');

test.beforeEach(() => storage.clear());

test('view history is newest first and revisiting moves a place without duplicating it', () => {
  storage.set(viewHistory.STORAGE_KEY, [
    { id: 'place-newer', name: '较新景点', viewedAt: '2026-07-09T12:00:00.000Z' },
    { id: 'place-older', name: '较早景点', viewedAt: '2026-07-08T12:00:00.000Z' }
  ]);

  viewHistory.recordPlaceView({
    id: 'place-older',
    name: '较早景点',
    city: '北京',
    summary: '重新浏览后应排在最前。'
  });
  const history = viewHistory.listHistory();
  assert.deepEqual(history.map((item) => item.id), ['place-older', 'place-newer']);
  assert.equal(history.length, 2);
  assert.equal(history[0].city, '北京');
});

test('view history supports immediate removal', () => {
  viewHistory.recordPlaceView({ id: 'place-1', name: '地点一' });
  viewHistory.recordPlaceView({ id: 'place-2', name: '地点二' });
  const next = viewHistory.removeHistory('place-1');
  assert.deepEqual(next.map((item) => item.id), ['place-2']);
});
