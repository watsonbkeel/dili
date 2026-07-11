const priorityPlaceIds = ['beijing-palace-museum', 'temple-of-heaven', 'shichahai'];

const fallbackPlaceData = [
  {
    id: 'beijing-palace-museum',
    name: '故宫博物院',
    lat: 39.916345,
    lng: 116.397155,
    distance: 1200,
    category: ['世界文化遗产', '皇家文化'],
    tags: ['适合步行'],
    summary: '沿中轴线了解明清宫廷建筑、礼制空间与北京城市记忆。',
    coverImage: { url: '/assets/images/forbidden-city-cover.jpeg' }
  },
  {
    id: 'temple-of-heaven',
    name: '天坛公园',
    lat: 39.88218,
    lng: 116.406605,
    distance: 4800,
    category: ['祭天礼制', '古建筑'],
    tags: ['亲子研学'],
    summary: '从祈年殿到圜丘，观察古代祭祀建筑与声学空间。'
  },
  {
    id: 'shichahai',
    name: '什刹海',
    lat: 39.941448,
    lng: 116.385257,
    distance: 2100,
    category: ['胡同', '水系'],
    tags: ['老北京'],
    summary: '适合慢行，感受水岸、胡同和王府遗存交织的城市历史。'
  }
];

function distanceText(distance) {
  const value = Number(distance || 0);
  if (!value) return '';
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.round(value)} m`;
}

function normalizePlace(place) {
  const category = place.category || [];
  const tags = place.tags || [];
  return {
    ...place,
    category,
    tags,
    categoryText: category.slice(0, 3).join(' / '),
    displayTags: [...category, ...tags].filter(Boolean).slice(0, 3),
    distanceText: distanceText(place.distance),
    sourceText: (place.sources || []).map((source) => source.title).join('、') || '种子资料',
    coverUrl: place.coverImage && place.coverImage.url ? place.coverImage.url : '',
    briefSummary: place.summary || '适合了解北京历史文化。'
  };
}

function preparePlaces(places) {
  return (places || [])
    .map(normalizePlace)
    .sort((a, b) => {
      const ai = priorityPlaceIds.indexOf(a.id);
      const bi = priorityPlaceIds.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

function getFallbackPlaces() {
  return preparePlaces(fallbackPlaceData);
}

module.exports = {
  getFallbackPlaces,
  preparePlaces
};
