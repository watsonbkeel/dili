function parseCoordinate(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new Error(`${name} must be a valid number`);
    error.status = 400;
    throw error;
  }
  return number;
}

function validateLatLng(latValue, lngValue) {
  const lat = parseCoordinate(latValue, 'lat');
  const lng = parseCoordinate(lngValue, 'lng');
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const error = new Error('lat/lng out of range');
    error.status = 400;
    throw error;
  }
  return { lat, lng };
}

function coarseCoordinate(lat, lng) {
  return {
    lat: Number(lat.toFixed(2)),
    lng: Number(lng.toFixed(2))
  };
}

function cacheKeyForStory({ place, coarseLocation, style, promptVersion }) {
  const placeKey = place.id || place.title || place.name || 'unknown-place';
  return [promptVersion, style || 'guide', placeKey, coarseLocation.lat, coarseLocation.lng].join(':');
}

module.exports = {
  cacheKeyForStory,
  coarseCoordinate,
  validateLatLng
};
