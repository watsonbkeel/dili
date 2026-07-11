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

const favorites = require('../../miniprogram/utils/favorites');
const placeReactions = require('../../miniprogram/utils/placeReactions');

test.beforeEach(() => storage.clear());

test('favorites retain city and group existing records by city', () => {
  favorites.addFavorite({ id: 'beijing-place', name: '北京地点', city: '北京' });
  favorites.addFavorite({ id: 'hangzhou-place', name: '杭州地点', city: '杭州' });
  storage.set('lhgFavorites', [
    ...favorites.listFavorites(),
    { id: 'shanghai-place', name: '上海地点', address: '上海市黄浦区' }
  ]);

  const groups = favorites.groupFavoritesByCity();
  assert.deepEqual(groups.map((group) => group.city), ['杭州', '北京', '上海']);
  assert.deepEqual(groups.map((group) => group.count), [1, 1, 1]);
  assert.equal(groups[2].items[0].city, '上海');
});

test('legacy Ming Tombs favorite is restored to Beijing by place id', () => {
  storage.set('lhgFavorites', [{ id: 'ming-tombs', name: '明十三陵' }]);

  const items = favorites.listFavorites();
  const groups = favorites.groupFavoritesByCity(items);

  assert.equal(items[0].city, '北京');
  assert.equal(items[0].address, '北京市昌平区十三陵镇');
  assert.deepEqual(groups.map((group) => group.city), ['北京']);
  assert.equal(storage.get('lhgFavorites')[0].city, '北京');
});

test('non-Beijing favorites show their actual city instead of a generic group', () => {
  storage.set('lhgFavorites', [
    { id: 'hangzhou-place', name: '杭州地点', city: '其他城市', address: '浙江省杭州市西湖区' },
    { id: 'chengdu-place', name: '成都地点', city: '成都市' },
    { id: 'unknown-place', name: '城市未知地点' }
  ]);

  const groups = favorites.groupFavoritesByCity();

  assert.deepEqual(groups.map((group) => group.city), ['杭州', '成都', '其他城市']);
  assert.equal(groups[0].items[0].city, '杭州');
  assert.equal(groups[1].items[0].city, '成都');
});

test('favorites can be removed immediately from the stored list', () => {
  favorites.addFavorite({ id: 'place-1', name: '地点一', city: '北京' });
  favorites.addFavorite({ id: 'place-2', name: '地点二', city: '北京' });
  const next = favorites.removeFavorite('place-1');
  assert.deepEqual(next.map((item) => item.id), ['place-2']);
});

test('local place reaction is exclusive and can be cancelled', () => {
  placeReactions.setReaction('place-1', 'recommend');
  assert.equal(placeReactions.getReaction('place-1'), 'recommend');
  placeReactions.setReaction('place-1', 'notRecommend');
  assert.equal(placeReactions.getReaction('place-1'), 'notRecommend');
  placeReactions.setReaction('place-1', '');
  assert.equal(placeReactions.getReaction('place-1'), '');
});
