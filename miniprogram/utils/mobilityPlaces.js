const ACCESSIBILITY_ORDER = {
  full: 0,
  partial: 1,
  none: 2
};

function distanceValue(place) {
  const value = Number(place && place.distance);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function walkingTimeValue(place) {
  const value = Number(place && place.walkingTimeMinutes);
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

function isWheelchairTourable(place) {
  return Boolean(place && place.accessibility && place.accessibility.wheelchairTourable);
}

function accessibilityRank(place) {
  const level = place && place.accessibility && place.accessibility.level;
  return Object.prototype.hasOwnProperty.call(ACCESSIBILITY_ORDER, level)
    ? ACCESSIBILITY_ORDER[level]
    : ACCESSIBILITY_ORDER.none;
}

function sortAccessiblePlaces(places) {
  return (places || [])
    .filter(isWheelchairTourable)
    .slice()
    .sort((a, b) => {
      const levelDifference = accessibilityRank(a) - accessibilityRank(b);
      if (levelDifference) return levelDifference;
      const distanceDifference = distanceValue(a) - distanceValue(b);
      if (distanceDifference) return distanceDifference;
      return walkingTimeValue(a) - walkingTimeValue(b);
    });
}

function shortWalkScore(place) {
  return distanceValue(place) + walkingTimeValue(place) * 80;
}

function sortShortWalkPlaces(places) {
  return (places || [])
    .filter(isWheelchairTourable)
    .slice()
    .sort((a, b) => {
      const scoreDifference = shortWalkScore(a) - shortWalkScore(b);
      if (scoreDifference) return scoreDifference;
      return accessibilityRank(a) - accessibilityRank(b);
    });
}

module.exports = {
  accessibilityRank,
  isWheelchairTourable,
  shortWalkScore,
  sortAccessiblePlaces,
  sortShortWalkPlaces
};
