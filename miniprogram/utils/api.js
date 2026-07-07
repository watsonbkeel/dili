const app = getApp();
const localStore = require('./localPlaceStore');

function userId() {
  return app.ensureUserId();
}

function assetUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/assets/')) {
    const filename = url.split('/').pop();
    if (app.globalData.assetBaseUrl && filename) {
      return `${app.globalData.assetBaseUrl}/${filename}`;
    }
    return `${app.globalData.apiBaseUrl}${url}`;
  }
  return url;
}

function withAssetHost(value) {
  if (Array.isArray(value)) return value.map(withAssetHost);
  if (!value || typeof value !== 'object') return value;
  const next = {};
  Object.keys(value).forEach((key) => {
    if (key === 'url' || key === 'image') {
      next[key] = assetUrl(value[key]);
      return;
    }
    next[key] = withAssetHost(value[key]);
  });
  return next;
}

function request(path, options = {}) {
  const baseUrl = app.globalData.apiBaseUrl;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'X-User-Id': userId()
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(withAssetHost(res.data));
          return;
        }
        reject(new Error((res.data && res.data.error) || `请求失败：${res.statusCode}`));
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'));
      }
    });
  });
}

function shouldUseLocalData() {
  const baseUrl = app.globalData.apiBaseUrl || '';
  if (!/localhost|127\.0\.0\.1/.test(baseUrl)) return false;
  try {
    return wx.getSystemInfoSync().platform !== 'devtools';
  } catch {
    return false;
  }
}

function getNearby(lat, lng) {
  return request(`/api/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
}

function listPlaces(params = {}) {
  if (shouldUseLocalData()) return Promise.resolve(withAssetHost(localStore.listPlaces(params)));
  const query = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  return request(`/api/places${query ? `?${query}` : ''}`).catch(() => withAssetHost(localStore.listPlaces(params)));
}

function getPlace(id) {
  if (shouldUseLocalData()) return Promise.resolve(withAssetHost(localStore.getPlace(id)));
  return request(`/api/places/${encodeURIComponent(id)}`).catch(() => withAssetHost(localStore.getPlace(id)));
}

function geocode(address) {
  return request(`/api/geocode?address=${encodeURIComponent(address)}`);
}

function createStory(payload) {
  if (shouldUseLocalData()) return Promise.resolve(withAssetHost(localStore.createStory(payload, userId())));
  return request('/api/story', {
    method: 'POST',
    data: {
      ...payload,
      userId: userId()
    }
  }).catch(() => withAssetHost(localStore.createStory(payload, userId())));
}

function listRoutes() {
  if (shouldUseLocalData()) return Promise.resolve(withAssetHost(localStore.listRoutes()));
  return request('/api/routes').catch(() => withAssetHost(localStore.listRoutes()));
}

function askAssistant(payload) {
  if (shouldUseLocalData()) return Promise.resolve(localStore.askAssistant(payload));
  return request('/api/assistant', {
    method: 'POST',
    data: payload
  }).catch(() => localStore.askAssistant(payload));
}

function listHistory() {
  if (shouldUseLocalData()) return Promise.resolve(localStore.listHistory());
  return request(`/api/history?userId=${encodeURIComponent(userId())}`).catch(() => localStore.listHistory());
}

function deleteHistory(id) {
  if (shouldUseLocalData()) return Promise.resolve(localStore.deleteHistory(id));
  return request(`/api/history/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId())}`, {
    method: 'DELETE'
  }).catch(() => localStore.deleteHistory(id));
}

module.exports = {
  askAssistant,
  createStory,
  deleteHistory,
  geocode,
  getPlace,
  getNearby,
  listRoutes,
  listPlaces,
  listHistory
};
