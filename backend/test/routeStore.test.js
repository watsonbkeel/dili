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

const routeStore = require('../../miniprogram/utils/routeStore');

test.beforeEach(() => storage.clear());

test('route edits persist across a fresh load', () => {
  let state = routeStore.loadState();
  const firstRouteId = state.currentRouteId;

  state = routeStore.renameRoute(state, firstRouteId, '周末中轴线');
  state = routeStore.replaceStops(state, firstRouteId, state.routes[0].stops.slice(0, 2).reverse());
  routeStore.saveState(state);

  const reloaded = routeStore.loadState();
  assert.equal(reloaded.routes[0].name, '周末中轴线');
  assert.equal(reloaded.routes[0].stops.length, 2);
  assert.equal(reloaded.routes[0].stops[0].order, 1);
  assert.equal(reloaded.routes[0].stops[0].id, 'jingshan-park');
});

test('multiple routes can be created, switched, renamed and deleted independently', () => {
  let state = routeStore.defaultState();
  state = routeStore.addRoute(state, '博物馆路线');
  const museumRouteId = state.currentRouteId;
  const result = routeStore.addStop(state, museumRouteId, {
    id: 'national-museum-of-china',
    name: '中国国家博物馆',
    stay: '2 小时'
  });
  assert.equal(result.added, true);

  state = routeStore.renameRoute(result.state, museumRouteId, '国家博物馆半日游');
  state = routeStore.saveState(state);
  assert.equal(state.routes.length, 2);
  assert.equal(state.routes.find((route) => route.id === museumRouteId).stops.length, 1);

  state = routeStore.deleteRoute(state, museumRouteId);
  state = routeStore.saveState(state);
  assert.equal(state.routes.length, 1);
  assert.notEqual(state.currentRouteId, museumRouteId);
  assert.equal(state.routes[0].name, '北京历史半日游');
});

test('adding the same attraction twice does not duplicate a route stop', () => {
  let state = routeStore.addRoute(routeStore.defaultState(), '测试路线');
  const routeId = state.currentRouteId;
  const first = routeStore.addStop(state, routeId, { id: 'temple-of-heaven', name: '天坛', stay: '90 分钟' });
  const second = routeStore.addStop(first.state, routeId, { id: 'temple-of-heaven', name: '天坛公园', stay: '60 分钟' });
  assert.equal(first.added, true);
  assert.equal(second.added, false);
  assert.equal(second.reason, 'duplicate');
});

test('smart sorting keeps important attractions first, then considers duration and distance', () => {
  const origin = { lat: 39.9, lng: 116.4 };
  const stops = [
    { id: 'custom-short-near', name: '附近短游', stay: '30 分钟', lat: 39.901, lng: 116.401 },
    { id: 'custom-long-far', name: '较远长游', stay: '120 分钟', lat: 39.95, lng: 116.45 },
    { id: 'beijing-palace-museum', name: '北京故宫', stay: '30 分钟' }
  ];
  const sorted = routeStore.smartSortStops(stops, origin);
  assert.equal(sorted[0].id, 'beijing-palace-museum');
  assert.equal(sorted[1].id, 'custom-long-far');
  assert.deepEqual(sorted.map((stop) => stop.order), [1, 2, 3]);

  const equalDuration = routeStore.smartSortStops([
    { id: 'custom-far', name: '远处', stay: '60 分钟', lat: 40.1, lng: 116.6 },
    { id: 'custom-near', name: '近处', stay: '60 分钟', lat: 39.901, lng: 116.401 }
  ], origin);
  assert.equal(equalDuration[0].id, 'custom-near');
});
