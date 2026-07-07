const KEY = 'lhgFavorites';

function listFavorites() {
  return wx.getStorageSync(KEY) || [];
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
  isFavorite,
  listFavorites,
  removeFavorite,
  toggleFavorite
};
