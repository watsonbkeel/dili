const DEFAULT_LIMIT = 6;

// 口语里的城市名、"景点"、疑问词等不代表具体景点，参与模糊匹配会让所有带"北京"的句子
// 都命中"北京故宫/北京孔庙"等名称，导致说什么结果都一样。模糊匹配前先去掉这些词。
const NOISE_WORDS = [
  '北京市', '北京的', '北京',
  '景点', '景区', '地方', '名胜', '古迹',
  '帮我找一下', '帮我找', '帮我查', '找一下', '搜一下', '查一下', '帮我', '请问', '请',
  '我想去', '我想看看', '我想看', '我想', '我要去', '我要', '想去', '想看',
  '有没有', '有什么', '有哪些', '哪一个', '哪个', '哪些', '哪里', '在哪', '什么',
  '推荐一下', '推荐', '介绍一下', '介绍', '一下', '看看', '一个', '一些',
  '吗', '呢', '吧', '啊', '呀', '了', '的'
];

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()【】\[\]{}<>《》\-—_]/g, '');
}

function stripNoiseWords(value) {
  let text = normalizeSearchText(value);
  NOISE_WORDS.forEach((word) => {
    text = text.split(word).join('');
  });
  return text;
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

// 名称同样去掉"北京"等前缀再比较，避免"北京故宫"仅因"北京"二字与任意问句相似
function strippedNameTerms(place) {
  return uniqueText(nameTerms(place).map((term) => stripNoiseWords(term) || normalizeSearchText(term)));
}

function similarityScore(place, strippedQuery) {
  // 单字查询（如"大""小"）信息量太低，不做模糊联想
  if (strippedQuery.length < 2) return 0;
  const names = strippedNameTerms(place);
  const nameSimilarity = Math.max(
    0,
    ...names.map((term) => termSimilarity(term, strippedQuery))
  );
  const nameScore = nameSimilarity >= 0.32 ? nameSimilarity * 100 : 0;
  const categories = uniqueText([...(place.category || []), ...(place.tags || [])]);
  const categorySimilarity = Math.max(
    0,
    ...categories.map((term) => termSimilarity(term, strippedQuery))
  );
  const categoryScore = categorySimilarity >= 0.45 ? categorySimilarity * 55 : 0;
  const context = uniqueText([place.address, place.summary]);
  const contextSimilarity = Math.max(
    0,
    ...context.map((term) => termSimilarity(term, strippedQuery))
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

  const strippedQuery = stripNoiseWords(query);
  if (!strippedQuery) return { mode: 'none', results: [] };

  const scored = (places || [])
    .map((place, index) => ({ place, index, score: similarityScore(place, strippedQuery) }))
    .filter((item) => item.score >= 30)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit);

  return {
    mode: scored.length ? 'similar' : 'none',
    results: scored.map((item) => item.place)
  };
}

// 从一段文字（如 AI 回答）里找出提到的已收录景点，按出现先后排序
function placesMentionedIn(text, places, options = {}) {
  const normalized = normalizeSearchText(text);
  const limit = Math.max(1, Number(options.limit) || DEFAULT_LIMIT);
  if (!normalized) return [];
  return (places || [])
    .map((place) => {
      const positions = nameTerms(place)
        .map((term) => normalizeSearchText(term))
        .filter((term) => term.length >= 2)
        .map((term) => normalized.indexOf(term))
        .filter((position) => position >= 0);
      return { place, position: positions.length ? Math.min(...positions) : -1 };
    })
    .filter((item) => item.position >= 0)
    .sort((left, right) => left.position - right.position)
    .slice(0, limit)
    .map((item) => item.place);
}

module.exports = {
  matchPlaces,
  normalizeSearchText,
  placesMentionedIn,
  stripNoiseWords,
  termSimilarity
};
