const seed = require('../data/beijing-hotspots.seed');

const HISTORY_KEY = 'lhgLocalHistory';
const DISCLAIMER = '本导览基于页面列出的资料生成，请以权威来源为准。';

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const radius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * radius * Math.asin(Math.sqrt(h)));
}

function coverImage(place) {
  const image = (place.images || [])[0];
  if (!image) return null;
  return {
    url: image.url || '',
    caption: image.caption || place.name,
    source: image.source || '',
    searchQuery: image.searchQuery || place.name
  };
}

function listItem(place, distance) {
  const item = {
    id: place.id,
    name: place.name,
    title: place.name,
    aliases: place.aliases || [],
    category: place.category || [],
    tags: place.tags || [],
    city: place.city || seed.city || '北京',
    district: place.district || '',
    address: place.address || '',
    lat: place.lat,
    lng: place.lng,
    location: { lat: place.lat, lng: place.lng },
    summary: place.summary || '',
    coverImage: coverImage(place),
    sources: place.sources || [],
    confidence: place.confidence || 'seed'
  };
  if (distance !== undefined) item.distance = distance;
  return item;
}

function matchesQuery(place, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    place.name,
    place.address,
    ...(place.aliases || []),
    ...(place.category || []),
    ...(place.tags || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function matchesCity(place, city) {
  if (!city) return true;
  return String(place.city || '').includes(city) || city.includes(String(place.city || ''));
}

function listPlaces(params = {}) {
  const city = params.city || seed.city || '北京';
  const q = params.q || '';
  const hasLocation = params.lat !== undefined && params.lng !== undefined && params.lat !== '' && params.lng !== '';
  const origin = hasLocation ? { lat: Number(params.lat), lng: Number(params.lng) } : null;
  const radius = params.radius !== undefined && params.radius !== '' ? Number(params.radius) : null;

  let places = (seed.items || [])
    .filter((place) => matchesCity(place, city))
    .filter((place) => matchesQuery(place, q))
    .map((place) => listItem(place, origin ? distanceMeters(origin, place) : undefined));

  if (origin && Number.isFinite(radius)) {
    places = places.filter((place) => Number(place.distance) <= radius);
  }
  if (origin) {
    places.sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0));
  }

  return {
    city,
    coordinateSystem: seed.coordinateSystem || 'GCJ-02',
    places
  };
}

function getPlace(id) {
  const place = (seed.items || []).find((item) => item.id === id);
  if (!place) {
    const error = new Error('Place not found');
    error.statusCode = 404;
    throw error;
  }
  return {
    place: {
      ...place,
      title: place.name,
      location: { lat: place.lat, lng: place.lng },
      coverImage: coverImage(place),
      aliases: place.aliases || [],
      category: place.category || [],
      tags: place.tags || [],
      timeline: place.timeline || [],
      highlights: place.highlights || [],
      visitTips: place.visitTips || [],
      images: place.images || [],
      sources: place.sources || []
    }
  };
}

function factsForPlace(place) {
  const facts = [];
  if (place.summary) facts.push(`摘要：${place.summary}`);
  if (place.period) facts.push(`时期：${place.period}`);
  for (const item of place.timeline || []) {
    if (item.year && item.event) facts.push(`${item.year}：${item.event}`);
  }
  for (const item of place.highlights || []) facts.push(`看点：${item}`);
  for (const item of place.visitTips || []) facts.push(`游览提示：${item}`);
  return facts;
}

function buildStory(place) {
  if (!place.summary || !(place.sources || []).length) {
    return {
      title: `${place.name || '地点'}资料不足`,
      durationMinutes: 0,
      story: '资料不足，无法生成可信导览。请先补充摘要和来源。',
      factsUsed: [],
      sources: place.sources || [],
      disclaimer: DISCLAIMER
    };
  }

  const timelineText = (place.timeline || []).map((item) => `${item.year}年，${item.event}`).join(' ');
  const highlightsText = (place.highlights || []).join(' ');
  const tipsText = (place.visitTips || []).join(' ');
  const categoryText = (place.category || []).join('、') || '历史地点';

  return {
    title: `${place.name}可信资料导览`,
    durationMinutes: 2,
    story:
      `${place.name}是一处${categoryText}。它位于${place.address || '北京'}。${place.summary}` +
      (timelineText ? ` 关键时间线包括：${timelineText}` : '') +
      (highlightsText ? ` 现场看点包括：${highlightsText}` : '') +
      (tipsText ? ` 游览提示：${tipsText}` : '') +
      ' 以上讲解仅改写页面列出的结构化资料，不新增未列明的年份、人物或事件。',
    factsUsed: factsForPlace(place),
    sources: place.sources || [],
    disclaimer: DISCLAIMER
  };
}

function createStory(payload = {}, userId) {
  const place = payload.placeId ? getPlace(payload.placeId).place : payload.place;
  if (!place) {
    const error = new Error('Place not found');
    error.statusCode = 404;
    throw error;
  }
  const story = buildStory(place);
  const history = wx.getStorageSync(HISTORY_KEY) || [];
  const record = {
    id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    userId,
    placeId: place.id || place.name,
    placeName: place.name || place.title,
    address: place.address || '',
    coarseLocation: {
      lat: Number(Number(place.lat || 0).toFixed(2)),
      lng: Number(Number(place.lng || 0).toFixed(2))
    },
    story,
    createdAt: new Date().toISOString()
  };
  wx.setStorageSync(HISTORY_KEY, [record, ...history].slice(0, 100));
  return { story, historyId: record.id, cached: false, local: true };
}

function listHistory() {
  return { history: wx.getStorageSync(HISTORY_KEY) || [] };
}

function deleteHistory(id) {
  const history = wx.getStorageSync(HISTORY_KEY) || [];
  wx.setStorageSync(HISTORY_KEY, history.filter((record) => record.id !== id));
  return { deleted: true };
}

const routeDefinitions = [
  {
    id: 'beijing-classic-day',
    title: '北京经典一日游',
    coverPlaceId: 'beijing-palace-museum',
    tags: ['文化历史', '摄影打卡', '老北京风情'],
    totalDuration: '约8小时',
    description: '串联北京中轴线和老城代表地点，适合第一次深度了解北京历史的用户。',
    stopIds: [
      ['national-museum-of-china', '1小时'],
      ['beijing-palace-museum', '3-4小时'],
      ['jingshan-park', '1小时'],
      ['shichahai', '1.5小时'],
      ['temple-of-heaven', '2小时']
    ]
  },
  {
    id: 'old-city-walk',
    title: '老城胡同半日游',
    coverPlaceId: 'shichahai',
    tags: ['胡同漫步', '城市水系', '近代生活'],
    totalDuration: '约4小时',
    description: '从钟鼓楼到什刹海，观察北京老城街巷、水系和公共生活空间。',
    stopIds: [
      ['beijing-bell-and-drum-towers', '40分钟'],
      ['nanluoguxiang', '1小时'],
      ['shichahai', '1.5小时'],
      ['prince-kung-mansion', '1小时']
    ]
  }
];

function routePlace(id) {
  return (seed.items || []).find((item) => item.id === id);
}

function listRoutes() {
  return {
    routes: routeDefinitions.map((definition) => {
      const stops = definition.stopIds
        .map(([id, duration], index) => {
          const place = routePlace(id);
          if (!place) return null;
          return {
            attractionId: place.id,
            id: place.id,
            name: place.name,
            image: (coverImage(place) && coverImage(place).url) || '',
            order: index + 1,
            recommendedDuration: duration,
            description: place.summary || '',
            latitude: place.lat,
            longitude: place.lng,
            lat: place.lat,
            lng: place.lng,
            address: place.address || ''
          };
        })
        .filter(Boolean);
      const coverPlace = routePlace(definition.coverPlaceId);
      return {
        id: definition.id,
        title: definition.title,
        coverImage: coverPlace ? coverImage(coverPlace) : null,
        tags: definition.tags,
        totalDuration: definition.totalDuration,
        description: definition.description,
        stops,
        routePolyline: stops.map((stop) => ({
          latitude: stop.latitude,
          longitude: stop.longitude
        }))
      };
    })
  };
}

function askAssistant(payload = {}) {
  const question = String(payload.question || '').trim();
  const context = payload.context || {};
  let contextLabel = '当前城市：北京。';
  if (context.type === 'place' && context.id) {
    const place = routePlace(context.id);
    if (place) contextLabel = `当前景点：${place.name}。${place.summary || ''}`;
  }
  if (context.type === 'route' && context.id) {
    const route = listRoutes().routes.find((item) => item.id === context.id);
    if (route) contextLabel = `当前路线：${route.title}，${route.description}`;
  }
  if (!question) {
    return { answer: '你可以问我景点历史、建筑特色、路线安排或周边文化体验。', source: 'local' };
  }
  if (/路线|亲子|一日游|推荐/.test(question)) {
    return {
      answer: `${contextLabel} 建议优先选择天安门广场、故宫博物院、景山公园、什刹海和天坛公园，按国家礼仪空间、明清宫城、城市中轴线和老城生活几个层次理解北京。`,
      source: 'local'
    };
  }
  return {
    answer: `${contextLabel} 关于“${question}”，可以从地点位置、形成时期、建筑功能和城市关系入手理解。没有明确资料支撑的年代、人物或传说，需要以官方说明和权威资料为准。`,
    source: 'local'
  };
}

module.exports = {
  askAssistant,
  createStory,
  deleteHistory,
  getPlace,
  listRoutes,
  listHistory,
  listPlaces
};
