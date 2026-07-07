const { getPlaceById } = require('./placeStore');

const ROUTE_DEFINITIONS = [
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

function placeToStop(place, index, duration) {
  return {
    attractionId: place.id,
    id: place.id,
    name: place.name,
    image: place.coverImage?.url || '',
    order: index + 1,
    recommendedDuration: duration,
    description: place.summary || '',
    latitude: place.lat,
    longitude: place.lng,
    lat: place.lat,
    lng: place.lng,
    address: place.address || ''
  };
}

function buildRoute(definition) {
  const stops = definition.stopIds
    .map(([id, duration], index) => {
      const place = getPlaceById(id);
      return place ? placeToStop(place, index, duration) : null;
    })
    .filter(Boolean);
  const coverPlace = getPlaceById(definition.coverPlaceId) || stops[0] || {};
  return {
    id: definition.id,
    title: definition.title,
    coverImage: coverPlace.coverImage || null,
    tags: definition.tags,
    totalDuration: definition.totalDuration,
    description: definition.description,
    stops,
    routePolyline: stops.map((stop) => ({
      latitude: stop.latitude,
      longitude: stop.longitude
    }))
  };
}

function listRoutes() {
  return ROUTE_DEFINITIONS.map(buildRoute);
}

function getRouteById(id) {
  return listRoutes().find((route) => route.id === id) || null;
}

module.exports = {
  getRouteById,
  listRoutes
};
