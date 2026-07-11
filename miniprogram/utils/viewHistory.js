const STORAGE_KEY = 'lhgPlaceViewHistoryV1';
const MAX_HISTORY_ITEMS = 200;

function listHistory() {
  const value = wx.getStorageSync(STORAGE_KEY);
  if (!Array.isArray(value)) return [];
  return [...value].sort((a, b) => String(b.viewedAt || '').localeCompare(String(a.viewedAt || '')));
}

function recordPlaceView(place) {
  if (!place || !place.id) return listHistory();
  const history = listHistory().filter((item) => item.id !== place.id);
  const item = {
    id: place.id,
    name: place.name || place.title || '未命名景点',
    city: place.city || '其他城市',
    address: place.address || '',
    summary: place.summary || '',
    category: Array.isArray(place.category) ? place.category : [],
    coverImage: place.coverImage || null,
    viewedAt: new Date().toISOString()
  };
  const next = [item, ...history].slice(0, MAX_HISTORY_ITEMS);
  wx.setStorageSync(STORAGE_KEY, next);
  return next;
}

function removeHistory(id) {
  const next = listHistory().filter((item) => item.id !== id);
  wx.setStorageSync(STORAGE_KEY, next);
  return next;
}

module.exports = {
  STORAGE_KEY,
  listHistory,
  recordPlaceView,
  removeHistory
};
