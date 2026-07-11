const app = getApp();
const localStore = require('./localPlaceStore');

function userId() {
  return app.ensureUserId();
}

function assetUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/assets/')) {
    const assetBaseUrl = (app.globalData.assetBaseUrl || `${app.globalData.apiBaseUrl}/assets`).replace(/\/$/, '');
    const assetPath = url.replace(/^\/assets\/?/, '');
    if (assetPath) {
      return `${assetBaseUrl}/${assetPath}`;
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

function getPlaceReactions(id) {
  return request(`/api/places/${encodeURIComponent(id)}/reactions`);
}

function updatePlaceReaction(id, previous, reaction) {
  return request(`/api/places/${encodeURIComponent(id)}/reactions`, {
    method: 'POST',
    data: { previous: previous || '', reaction: reaction || '' }
  });
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
  });
}

function transcribeAudio(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/transcriptions`,
      filePath,
      name: 'file',
      header: {
        'X-User-Id': userId()
      },
      formData: {
        model: 'Qwen/Qwen3-ASR-1.7B',
        language: 'Chinese',
        response_format: 'json'
      },
      success(res) {
        let payload;
        try {
          payload = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        } catch {
          reject(new Error('语音识别返回格式错误'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(payload);
          return;
        }
        reject(new Error((payload && payload.error) || `语音识别失败：${res.statusCode}`));
      },
      fail(error) {
        reject(new Error(error.errMsg || '语音上传失败'));
      }
    });
  });
}

function recognizeImage(filePath, location = null) {
  const formData = {};
  if (location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))) {
    formData.latitude = String(location.lat);
    formData.longitude = String(location.lng);
    if (location.accuracy !== undefined && location.accuracy !== '') {
      formData.accuracy = String(location.accuracy);
    }
  }
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/recognize`,
      filePath,
      name: 'file',
      header: {
        'X-User-Id': userId()
      },
      formData,
      success(res) {
        let payload;
        try {
          payload = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        } catch {
          reject(new Error('图片识别返回格式错误'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(payload);
          return;
        }
        reject(new Error((payload && payload.error) || `图片识别失败：${res.statusCode}`));
      },
      fail(error) {
        reject(new Error(error.errMsg || '图片上传失败'));
      }
    });
  });
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
  getPlaceReactions,
  getNearby,
  listRoutes,
  listPlaces,
  listHistory,
  recognizeImage,
  transcribeAudio,
  updatePlaceReaction
};
