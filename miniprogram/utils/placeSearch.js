const DEFAULT_LIMIT = 6;

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()【】\[\]{}<>《》\-—_]/g, '');
}

function uniqueText(values) {
  const seen = new Set();
  return (values || [])
    .map((value) => String(value || '').trim())
    .filter((value) => {
      const key = normalizeSearchText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function nameTerms(place) {
  return uniqueText([place && place.name, ...((place && place.aliases) || [])]);
}

function bigrams(value) {
  const text = normalizeSearchText(value);
  if (text.length < 2) return text ? [text] : [];
  const result = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    result.push(text.slice(index, index + 2));
  }
  return result;
}

function termSimilarity(term, query) {
  const needle = normalizeSearchText(term);
  const haystack = normalizeSearchText(query);
  if (!needle || !haystack) return 0;
  if (needle === haystack || haystack.includes(needle) || needle.includes(haystack)) return 1;

  const needleChars = [...new Set(needle)];
  const characterCoverage =
    needleChars.filter((character) => haystack.includes(character)).length / needleChars.length;
  const needleBigrams = [...new Set(bigrams(needle))];
  const bigramCoverage = needleBigrams.length
    ? needleBigrams.filter((item) => haystack.includes(item)).length / needleBigrams.length
    : 0;
  return bigramCoverage * 0.65 + characterCoverage * 0.35;
}

function exactNameMatch(place, normalizedQuery) {
  return nameTerms(place).some((term) => {
    const normalizedTerm = normalizeSearchText(term);
    return normalizedTerm.length >= 2 && normalizedQuery.includes(normalizedTerm);
  });
}

function similarityScore(place, normalizedQuery) {
  const names = nameTerms(place);
  const nameSimilarity = Math.max(
    0,
    ...names.map((term) => termSimilarity(term, normalizedQuery))
  );
  const nameScore = nameSimilarity >= 0.32 ? nameSimilarity * 100 : 0;
  const categories = uniqueText([...(place.category || []), ...(place.tags || [])]);
  const categorySimilarity = Math.max(
    0,
    ...categories.map((term) => termSimilarity(term, normalizedQuery))
  );
  const categoryScore = categorySimilarity >= 0.45 ? categorySimilarity * 55 : 0;
  const context = uniqueText([place.address, place.summary]);
  const contextSimilarity = Math.max(
    0,
    ...context.map((term) => termSimilarity(term, normalizedQuery))
  );
  const contextScore = contextSimilarity >= 0.62 ? contextSimilarity * 24 : 0;
  return Math.round((nameScore + categoryScore + contextScore) * 100) / 100;
}

function matchPlaces(query, places, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const limit = Math.max(1, Number(options.limit) || DEFAULT_LIMIT);
  if (!normalizedQuery) return { mode: 'none', results: [] };

  const exactResults = (places || []).filter((place) => exactNameMatch(place, normalizedQuery));
  if (exactResults.length) {
    return { mode: 'exact', results: exactResults.slice(0, limit) };
  }

  const scored = (places || [])
    .map((place, index) => ({ place, index, score: similarityScore(place, normalizedQuery) }))
    .filter((item) => item.score >= 30)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit);

  return {
    mode: scored.length ? 'similar' : 'none',
    results: scored.map((item) => item.place)
  };
}

module.exports = {
  matchPlaces,
  normalizeSearchText,
  termSimilarity
};
