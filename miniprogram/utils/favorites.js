const placeSeed = require('../data/beijing-hotspots.seed');

const KEY = 'lhgFavorites';
const UNKNOWN_CITY_NAMES = new Set(['其他', '其他城市', '未知', '未知城市', '未定位']);
const SEEDED_PLACES = new Map((placeSeed.items || []).map((place) => [place.id, place]));

function normalizeCityName(value) {
  const city = String(value || '').trim();
  if (!city || UNKNOWN_CITY_NAMES.has(city)) return '';
  const municipality = city.match(/^(北京|上海|天津|重庆)(?:市)?$/);
  if (municipality) return municipality[1];
  return city.replace(/市$/, '');
}

function cityFromAddress(value) {
  const address = String(value || '').trim();
  if (!address) return '';
  const municipality = address.match(/(?:^|[省区])?(北京|上海|天津|重庆)市?/);
  if (municipality) return municipality[1];
  const cityMatch = address.match(/([^省市区县]{2,8})市/);
  return cityMatch ? cityMatch[1] : '';
}

function seededPlaceFor(item = {}) {
  return item.id ? SEEDED_PLACES.get(item.id) : null;
}

function listFavorites() {
  const value = wx.getStorageSync(KEY);
  if (!Array.isArray(value)) return [];
  let changed = false;
  const next = value.map((item) => {
    const hydrated = hydrateFavorite(item);
    if (hydrated.city !== item.city || hydrated.address !== item.address) changed = true;
    return hydrated;
  });
  if (changed) wx.setStorageSync(KEY, next);
  return next;
}

function cityForFavorite(item = {}) {
  const seededPlace = seededPlaceFor(item) || {};
  const city =
    normalizeCityName(item.city) ||
    normalizeCityName(item.cityName) ||
    normalizeCityName(item.municipality) ||
    normalizeCityName(item.location && item.location.city) ||
    normalizeCityName(item.adInfo && item.adInfo.city) ||
    cityFromAddress(item.address) ||
    normalizeCityName(seededPlace.city) ||
    cityFromAddress(seededPlace.address);
  return city || '其他城市';
}

function hydrateFavorite(item = {}) {
  const seededPlace = seededPlaceFor(item) || {};
  return {
    ...item,
    city: cityForFavorite(item),
    address: item.address || seededPlace.address || ''
  };
}

function isFavorite(id) {
  return listFavorites().some((item) => item.id === id);
}

function addFavorite(place) {
  const favorites = listFavorites();
  if (!place || !place.id || favorites.some((item) => item.id === place.id)) return favorites;
  const item = {
    id: place.id,
    name: place.name || place.title,
    city: cityForFavorite(place),
    address: place.address || '',
    summary: place.summary || '',
    category: place.category || [],
    tags: place.tags || [],
    lat: place.lat || (place.location && place.location.lat),
    lng: place.lng || (place.location && place.location.lng),
    coverImage: place.coverImage || null,
    savedAt: new Date().toISOString()
  };
  const next = [item, ...favorites].slice(0, 200);
  wx.setStorageSync(KEY, next);
  return next;
}

function groupFavoritesByCity(items = listFavorites()) {
  const groups = new Map();
  items.forEach((item) => {
    const hydrated = hydrateFavorite(item);
    const city = hydrated.city;
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city).push(hydrated);
  });
  return [...groups.entries()].map(([city, cityItems]) => ({
    city,
    count: cityItems.length,
    items: cityItems
  }));
}

function removeFavorite(id) {
  const next = listFavorites().filter((item) => item.id !== id);
  wx.setStorageSync(KEY, next);
  return next;
}

function toggleFavorite(place) {
  if (isFavorite(place.id)) {
    removeFavorite(place.id);
    return false;
  }
  addFavorite(place);
  return true;
}

module.exports = {
  addFavorite,
  cityForFavorite,
  groupFavoritesByCity,
  hydrateFavorite,
  isFavorite,
  listFavorites,
  removeFavorite,
  toggleFavorite
};
