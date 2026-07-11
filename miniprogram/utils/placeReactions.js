const STORAGE_KEY = 'lhgPlaceReactionsV1';
const VALID_REACTIONS = new Set(['recommend', 'notRecommend']);

function readAll() {
  const value = wx.getStorageSync(STORAGE_KEY);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getReaction(placeId) {
  const reaction = readAll()[placeId];
  return VALID_REACTIONS.has(reaction) ? reaction : '';
}

function setReaction(placeId, reaction) {
  const next = { ...readAll() };
  if (VALID_REACTIONS.has(reaction)) next[placeId] = reaction;
  else delete next[placeId];
  wx.setStorageSync(STORAGE_KEY, next);
  return reaction || '';
}

module.exports = {
  STORAGE_KEY,
  getReaction,
  setReaction
};
