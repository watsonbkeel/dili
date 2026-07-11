const fs = require('node:fs');
const path = require('node:path');
const { validateLatLng } = require('./location');

const seedPath = path.join(__dirname, '..', '..', 'data', 'beijing-hotspots.seed.json');
let cache = null;

function loadSeed() {
  if (cache) return cache;
  const payload = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  cache = {
    version: payload.version || 'seed',
    city: payload.city || '北京',
    coordinateSystem: payload.coordinateSystem || 'GCJ-02',
    items: Array.isArray(payload.items) ? payload.items : []
  };
  return cache;
}

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
    city: place.city || '北京',
    district: place.district || '',
    address: place.address || '',
    lat: place.lat,
    lng: place.lng,
    location: { lat: place.lat, lng: place.lng },
    summary: place.summary || '',
    walkingTimeMinutes: Number(place.walkingTimeMinutes) || 0,
    walkingTimeNote: place.walkingTimeNote || '',
    accessibility: place.accessibility || null,
    coverImage: coverImage(place),
    sources: place.sources || [],
    confidence: place.confidence || 'seed'
  };
  if (distance !== undefined) item.distance = distance;
  return item;
}

function matchesCity(place, city) {
  if (!city) return true;
  return String(place.city || '').includes(city) || city.includes(String(place.city || ''));
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

function listPlaces({ city = '北京', q = '', lat, lng, radius } = {}) {
  const seed = loadSeed();
  let origin = null;
  if (lat !== undefined && lng !== undefined) {
    origin = validateLatLng(lat, lng);
  }
  const maxRadius = radius !== undefined && radius !== '' ? Number(radius) : null;

  let places = seed.items
    .filter((place) => matchesCity(place, city || seed.city))
    .filter((place) => matchesQuery(place, q))
    .map((place) => listItem(place, origin ? distanceMeters(origin, place) : undefined));

  if (origin && Number.isFinite(maxRadius)) {
    places = places.filter((place) => Number(place.distance) <= maxRadius);
  }

  if (origin) {
    places.sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0));
  }

  return places;
}

function getPlaceById(id) {
  const seed = loadSeed();
  const place = seed.items.find((item) => item.id === id);
  if (!place) return null;
  return {
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
  };
}

function hasSufficientFacts(place) {
  return Boolean(place && place.summary && Array.isArray(place.sources) && place.sources.length);
}

function getMetadata() {
  const seed = loadSeed();
  return {
    city: seed.city,
    coordinateSystem: seed.coordinateSystem,
    version: seed.version
  };
}

module.exports = {
  distanceMeters,
  getMetadata,
  getPlaceById,
  hasSufficientFacts,
  listPlaces
};
