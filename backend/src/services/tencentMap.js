const SEARCH_KEYWORDS = ['历史', '博物馆', '纪念馆', '古迹', '文化'];

const FALLBACK_CITIES = [
  { keyword: '北京', city: '北京市', district: '', lat: 39.904211, lng: 116.407395 },
  { keyword: '上海', city: '上海市', district: '', lat: 31.230416, lng: 121.473701 },
  { keyword: '广州', city: '广州市', district: '', lat: 23.12911, lng: 113.264385 },
  { keyword: '深圳', city: '深圳市', district: '', lat: 22.543096, lng: 114.057865 },
  { keyword: '杭州', city: '杭州市', district: '', lat: 30.274084, lng: 120.15507 },
  { keyword: '南京', city: '南京市', district: '', lat: 32.060255, lng: 118.796877 },
  { keyword: '成都', city: '成都市', district: '', lat: 30.572815, lng: 104.066801 },
  { keyword: '西安', city: '西安市', district: '', lat: 34.341568, lng: 108.940174 },
  { keyword: '武汉', city: '武汉市', district: '', lat: 30.592849, lng: 114.305539 },
  { keyword: '重庆', city: '重庆市', district: '', lat: 29.563761, lng: 106.550464 },
  { keyword: '天津', city: '天津市', district: '', lat: 39.0851, lng: 117.19937 },
  { keyword: '苏州', city: '苏州市', district: '', lat: 31.298974, lng: 120.585289 }
];

function mockNearby(lat, lng) {
  const coarse = {
    lat: Number(lat.toFixed(2)),
    lng: Number(lng.toFixed(2))
  };
  return {
    source: 'mock',
    location: {
      lat,
      lng,
      coarse,
      city: '示例城市',
      district: '示例城区',
      address: '示例当前位置'
    },
    places: [
      {
        id: `mock-museum-${coarse.lat}-${coarse.lng}`,
        title: '城市历史博物馆',
        address: '示例路 1 号',
        category: '博物馆',
        distance: 320,
        location: { lat: lat + 0.002, lng: lng + 0.001 }
      },
      {
        id: `mock-street-${coarse.lat}-${coarse.lng}`,
        title: '老街历史街区',
        address: '示例老街',
        category: '历史街区',
        distance: 680,
        location: { lat: lat - 0.003, lng: lng + 0.002 }
      },
      {
        id: `mock-memorial-${coarse.lat}-${coarse.lng}`,
        title: '近代人物纪念馆',
        address: '示例巷 8 号',
        category: '纪念馆',
        distance: 960,
        location: { lat: lat + 0.004, lng: lng - 0.002 }
      }
    ]
  };
}

function normalizePoi(poi) {
  return {
    id: poi.id || poi.uid || poi.title,
    title: poi.title,
    address: poi.address || poi._address || '',
    category: poi.category || '',
    distance: Number(poi._distance || poi.distance || 0),
    location: poi.location
      ? {
          lat: Number(poi.location.lat),
          lng: Number(poi.location.lng)
        }
      : null
  };
}

async function requestJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    const error = new Error(`Tencent map request failed with HTTP ${response.status}`);
    error.status = 502;
    throw error;
  }
  const payload = await response.json();
  if (payload.status !== 0) {
    const error = new Error(payload.message || 'Tencent map request failed');
    error.status = 502;
    throw error;
  }
  return payload;
}

async function reverseGeocode({ lat, lng, key, fetchImpl = fetch }) {
  const url = new URL('https://apis.map.qq.com/ws/geocoder/v1/');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('key', key);
  const payload = await requestJson(url, fetchImpl);
  const result = payload.result || {};
  const component = result.address_component || {};
  return {
    city: component.city || '',
    district: component.district || '',
    address: result.address || ''
  };
}

function fallbackGeocode(address) {
  const query = String(address || '').trim();
  const match = FALLBACK_CITIES.find((city) => query.includes(city.keyword));
  if (!match) {
    const error = new Error('当前未配置腾讯位置服务 Key，手动定位仅支持北京、上海、广州、深圳、杭州等示例城市');
    error.status = 400;
    throw error;
  }

  return {
    source: 'mock',
    location: {
      lat: match.lat,
      lng: match.lng,
      coarse: {
        lat: Number(match.lat.toFixed(2)),
        lng: Number(match.lng.toFixed(2))
      },
      city: match.city,
      district: match.district,
      address: query || match.city
    }
  };
}

async function geocodeAddress({ address, key, fetchImpl = fetch }) {
  const query = String(address || '').trim();
  if (!query) {
    const error = new Error('address is required');
    error.status = 400;
    throw error;
  }

  if (!key) return fallbackGeocode(query);

  const url = new URL('https://apis.map.qq.com/ws/geocoder/v1/');
  url.searchParams.set('address', query);
  url.searchParams.set('key', key);
  const payload = await requestJson(url, fetchImpl);
  const result = payload.result || {};
  const point = result.location || {};
  const component = result.address_components || result.address_component || {};
  const lat = Number(point.lat);
  const lng = Number(point.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error('无法解析该位置，请输入更完整的城市、区县或街道');
    error.status = 400;
    throw error;
  }

  return {
    source: 'tencent-map',
    location: {
      lat,
      lng,
      coarse: {
        lat: Number(lat.toFixed(2)),
        lng: Number(lng.toFixed(2))
      },
      city: component.city || '',
      district: component.district || '',
      address: result.address || query
    }
  };
}

async function searchNearby({ lat, lng, key, radius = 1500, fetchImpl = fetch }) {
  const requests = SEARCH_KEYWORDS.map(async (keyword) => {
    const url = new URL('https://apis.map.qq.com/ws/place/v1/search');
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('boundary', `nearby(${lat},${lng},${radius})`);
    url.searchParams.set('orderby', '_distance');
    url.searchParams.set('page_size', '10');
    url.searchParams.set('key', key);
    const payload = await requestJson(url, fetchImpl);
    return payload.data || [];
  });

  const settled = await Promise.allSettled(requests);
  const pois = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  const seen = new Set();
  return pois
    .map(normalizePoi)
    .filter((poi) => {
      if (!poi.title || seen.has(poi.id)) return false;
      seen.add(poi.id);
      return true;
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 20);
}

async function getNearbyPlaces({ lat, lng, key, fetchImpl = fetch }) {
  if (!key) {
    return mockNearby(lat, lng);
  }

  const [reverse, places] = await Promise.all([
    reverseGeocode({ lat, lng, key, fetchImpl }),
    searchNearby({ lat, lng, key, fetchImpl })
  ]);

  return {
    source: 'tencent-map',
    location: {
      lat,
      lng,
      coarse: {
        lat: Number(lat.toFixed(2)),
        lng: Number(lng.toFixed(2))
      },
      ...reverse
    },
    places
  };
}

module.exports = {
  geocodeAddress,
  getNearbyPlaces,
  mockNearby,
  reverseGeocode,
  searchNearby
};
