const seed = require('../data/beijing-hotspots.seed');

const STORAGE_KEY = 'localHistoryGuideRoutesV1';
const DEFAULT_ROUTE_ID = 'route-beijing-history';

const CORE_PLACE_SCORES = {
  'beijing-palace-museum': 100,
  'national-museum-of-china': 98,
  'temple-of-heaven': 97,
  'badaling-great-wall': 96,
  'summer-palace': 95,
  'ming-tombs': 94,
  'old-summer-palace-ruins': 92,
  'jingshan-park': 90,
  'prince-kung-mansion': 88,
  shichahai: 86
};

const DEFAULT_STOP_DEFINITIONS = [
  ['beijing-palace-museum', '90 分钟'],
  ['jingshan-park', '40 分钟'],
  ['shichahai', '60 分钟']
];

function placeForStop(stop = {}) {
  const id = String(stop.id || stop.attractionId || '');
  const name = String(stop.name || '').trim();
  return (seed.items || []).find((place) => {
    if (id && place.id === id) return true;
    return name && [place.name, ...(place.aliases || [])].includes(name);
  });
}

function imageForPlace(place) {
  const image = place && (place.images || [])[0];
  return (image && image.url) || '';
}

function durationMinutes(value) {
  if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
  const text = String(value || '').replace(/\s/g, '');
  const hourRange = text.match(/(\d+(?:\.\d+)?)[-~至](\d+(?:\.\d+)?)小时/);
  if (hourRange) return ((Number(hourRange[1]) + Number(hourRange[2])) / 2) * 60;
  const hours = text.match(/(\d+(?:\.\d+)?)小时/);
  const minutes = text.match(/(\d+(?:\.\d+)?)分钟/);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0) || 45;
}

function normalizeStop(stop = {}, index = 0) {
  const place = placeForStop(stop);
  const id = String(stop.id || stop.attractionId || (place && place.id) || `custom-${Date.now()}-${index}`);
  const stay = String(stop.stay || stop.recommendedDuration || '45 分钟');
  const latValue = stop.lat !== undefined && stop.lat !== null
    ? stop.lat
    : (stop.latitude !== undefined && stop.latitude !== null ? stop.latitude : (place && place.lat));
  const lngValue = stop.lng !== undefined && stop.lng !== null
    ? stop.lng
    : (stop.longitude !== undefined && stop.longitude !== null ? stop.longitude : (place && place.lng));
  const lat = Number(latValue);
  const lng = Number(lngValue);
  return {
    id,
    order: index + 1,
    name: String(stop.name || (place && place.name) || '未命名地点').trim(),
    stay,
    durationMinutes: durationMinutes(stay),
    image: String(stop.image || imageForPlace(place) || ''),
    note: String(stop.note || (place && place.summary) || '自定义地点'),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    category: Array.isArray(stop.category) ? stop.category : ((place && place.category) || []),
    tags: Array.isArray(stop.tags) ? stop.tags : ((place && place.tags) || []),
    importance: Number.isFinite(Number(stop.importance)) ? Number(stop.importance) : undefined
  };
}

function withOrder(stops) {
  return (stops || []).map((stop, index) => normalizeStop(stop, index));
}

function makeRoute(name, stops = []) {
  return {
    id: `route-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: String(name || '新路线').trim() || '新路线',
    stops: withOrder(stops),
    updatedAt: new Date().toISOString()
  };
}

function defaultState() {
  const route = {
    id: DEFAULT_ROUTE_ID,
    name: '北京历史半日游',
    stops: withOrder(DEFAULT_STOP_DEFINITIONS.map(([id, stay]) => ({ id, stay }))),
    updatedAt: new Date().toISOString()
  };
  return { version: 1, currentRouteId: route.id, routes: [route] };
}

function normalizeState(value) {
  if (!value || !Array.isArray(value.routes) || !value.routes.length) return defaultState();
  const seen = new Set();
  const routes = value.routes.map((route, index) => {
    let id = String(route.id || `route-migrated-${index}`);
    if (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return {
      id,
      name: String(route.name || route.title || `路线 ${index + 1}`).trim() || `路线 ${index + 1}`,
      stops: withOrder(route.stops),
      updatedAt: route.updatedAt || new Date().toISOString()
    };
  });
  const currentRouteId = routes.some((route) => route.id === value.currentRouteId)
    ? value.currentRouteId
    : routes[0].id;
  return { version: 1, currentRouteId, routes };
}

function loadState() {
  try {
    return normalizeState(wx.getStorageSync(STORAGE_KEY));
  } catch {
    return defaultState();
  }
}

function saveState(value) {
  const state = normalizeState(value);
  wx.setStorageSync(STORAGE_KEY, state);
  return state;
}

function updateRoute(state, routeId, updater) {
  return {
    ...state,
    routes: state.routes.map((route) => {
      if (route.id !== routeId) return route;
      return { ...updater(route), updatedAt: new Date().toISOString() };
    })
  };
}

function addRoute(state, name) {
  const route = makeRoute(name);
  return { ...state, currentRouteId: route.id, routes: [...state.routes, route] };
}

function deleteRoute(state, routeId) {
  const routes = state.routes.filter((route) => route.id !== routeId);
  if (!routes.length) {
    const route = makeRoute('新路线');
    return { ...state, currentRouteId: route.id, routes: [route] };
  }
  return {
    ...state,
    currentRouteId: state.currentRouteId === routeId ? routes[0].id : state.currentRouteId,
    routes
  };
}

function renameRoute(state, routeId, name) {
  const nextName = String(name || '').trim();
  if (!nextName) return state;
  return updateRoute(state, routeId, (route) => ({ ...route, name: nextName }));
}

function replaceStops(state, routeId, stops) {
  return updateRoute(state, routeId, (route) => ({ ...route, stops: withOrder(stops) }));
}

function addStop(state, routeId, input, order) {
  const route = state.routes.find((item) => item.id === routeId);
  if (!route) return { state, added: false, reason: 'missing-route' };
  const stop = normalizeStop(input, route.stops.length);
  const duplicate = route.stops.some((item) => item.id === stop.id || item.name === stop.name);
  if (duplicate) return { state, added: false, reason: 'duplicate' };
  const stops = [...route.stops];
  const index = Math.max(0, Math.min(stops.length, Number(order || stops.length + 1) - 1));
  stops.splice(index, 0, stop);
  return { state: replaceStops(state, routeId, stops), added: true };
}

function importanceScore(stop) {
  if (Number.isFinite(Number(stop.importance))) return Number(stop.importance);
  if (CORE_PLACE_SCORES[stop.id]) return CORE_PLACE_SCORES[stop.id];
  const labels = [...(stop.category || []), ...(stop.tags || [])].join(' ');
  if (/世界文化遗产|国家一级博物馆|国家博物馆/.test(labels)) return 82;
  if (/博物馆|古建筑|遗址|坛庙|皇家园林/.test(labels)) return 68;
  if (String(stop.id).startsWith('custom-')) return 30;
  return 55;
}

function importanceTier(stop) {
  const score = importanceScore(stop);
  if (score >= 90) return 3;
  if (score >= 75) return 2;
  return 1;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
    return Number.POSITIVE_INFINITY;
  }
  const radius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function chooseNext(candidates, cursor) {
  const maxDuration = Math.max(...candidates.map((stop) => durationMinutes(stop.stay)), 1);
  const distances = candidates.map((stop) => distanceMeters(cursor, stop));
  const finiteDistances = distances.filter(Number.isFinite);
  const maxDistance = Math.max(...finiteDistances, 1);
  return candidates
    .map((stop, index) => {
      const durationPart = durationMinutes(stop.stay) / maxDuration;
      const distance = distances[index];
      const distancePart = Number.isFinite(distance) ? 1 - distance / maxDistance : 0;
      const score = cursor ? durationPart * 0.6 + distancePart * 0.4 : durationPart;
      return { stop, score, originalIndex: index };
    })
    .sort((a, b) =>
      b.score - a.score ||
      importanceScore(b.stop) - importanceScore(a.stop) ||
      durationMinutes(b.stop.stay) - durationMinutes(a.stop.stay) ||
      a.originalIndex - b.originalIndex
    )[0].stop;
}

function smartSortStops(stops, origin) {
  const remaining = withOrder(stops);
  const result = [];
  let cursor = origin && Number.isFinite(Number(origin.lat)) && Number.isFinite(Number(origin.lng))
    ? { lat: Number(origin.lat), lng: Number(origin.lng) }
    : null;
  const tiers = [...new Set(remaining.map(importanceTier))].sort((a, b) => b - a);

  for (const tier of tiers) {
    const candidates = remaining.filter((stop) => importanceTier(stop) === tier);
    while (candidates.length) {
      const next = chooseNext(candidates, cursor);
      result.push(next);
      const index = candidates.findIndex((stop) => stop.id === next.id);
      candidates.splice(index, 1);
      if (Number.isFinite(next.lat) && Number.isFinite(next.lng)) cursor = { lat: next.lat, lng: next.lng };
    }
  }
  return withOrder(result);
}

module.exports = {
  STORAGE_KEY,
  addRoute,
  addStop,
  defaultState,
  deleteRoute,
  durationMinutes,
  importanceScore,
  loadState,
  normalizeState,
  renameRoute,
  replaceStops,
  saveState,
  smartSortStops,
  withOrder
};
