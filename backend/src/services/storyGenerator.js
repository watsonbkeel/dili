const { cacheKeyForStory } = require('./location');
const { getPlaceById, hasSufficientFacts } = require('./placeStore');

const DEFAULT_DISCLAIMER = '本导览基于页面列出的资料生成，请以权威来源为准。';

function placeName(place) {
  return place.name || place.title || place.id || '历史地点';
}

function factsForPlace(place) {
  const facts = [];
  if (place.summary) facts.push(`摘要：${place.summary}`);
  if (place.period) facts.push(`时期：${place.period}`);
  for (const item of place.timeline || []) {
    if (item.year && item.event) facts.push(`${item.year}：${item.event}`);
  }
  for (const item of place.highlights || []) {
    if (item) facts.push(`看点：${item}`);
  }
  for (const item of place.visitTips || []) {
    if (item) facts.push(`游览提示：${item}`);
  }
  return facts;
}

function insufficientStory(place) {
  return {
    title: `${placeName(place)}资料不足`,
    durationMinutes: 0,
    story: '资料不足，无法生成可信导览。请先补充摘要、时间线和来源。',
    factsUsed: [],
    sources: place.sources || [],
    disclaimer: DEFAULT_DISCLAIMER
  };
}

function templateStory(place) {
  if (!hasSufficientFacts(place)) return insufficientStory(place);

  const name = placeName(place);
  const categoryText = (place.category || []).join('、') || '历史地点';
  const timelineText = (place.timeline || [])
    .map((item) => `${item.year}年，${item.event}`)
    .join(' ');
  const highlightsText = (place.highlights || []).join(' ');
  const tipsText = (place.visitTips || []).join(' ');
  const addressText = place.address ? `它位于${place.address}。` : '';

  return {
    title: `${name}可信资料导览`,
    durationMinutes: 2,
    story:
      `${name}是一处${categoryText}。${addressText}${place.summary}` +
      (timelineText ? ` 这处地点的关键时间线包括：${timelineText}` : '') +
      (highlightsText ? ` 现场看点包括：${highlightsText}` : '') +
      (tipsText ? ` 游览提示：${tipsText}` : '') +
      ' 以上讲解仅改写页面列出的结构化资料，不新增未列明的年份、人物或事件。',
    factsUsed: factsForPlace(place),
    sources: place.sources || [],
    disclaimer: DEFAULT_DISCLAIMER
  };
}

function buildMessages({ place }) {
  return [
    {
      role: 'system',
      content:
        '你是严谨的本地历史导览撰稿人。你只能使用 providedFacts 中的信息写导览，不允许编造年份、人物、事件、来源、建筑细节或传说。无法确认的信息必须省略或标注“待核实”。输出必须是 JSON，不要 Markdown。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        placeName: placeName(place),
        providedFacts: {
          summary: place.summary || '',
          timeline: place.timeline || [],
          highlights: place.highlights || [],
          visitTips: place.visitTips || [],
          category: place.category || [],
          tags: place.tags || [],
          address: place.address || '',
          sources: place.sources || []
        },
        outputSchema: {
          title: 'string',
          durationMinutes: 2,
          story: 'string',
          factsUsed: ['string'],
          sources: [{ title: 'string', url: 'string' }],
          disclaimer: 'string'
        }
      })
    }
  ];
}

function normalizeSources(sources, fallbackSources) {
  if (!Array.isArray(sources) || !sources.length) return fallbackSources || [];
  return sources.map((source) => {
    if (typeof source === 'string') return { title: source, url: '' };
    return {
      title: String(source.title || ''),
      url: String(source.url || '')
    };
  });
}

function parseModelContent(content, place) {
  try {
    const parsed = JSON.parse(content);
    return {
      title: String(parsed.title || `${placeName(place)}导览`),
      durationMinutes: Number(parsed.durationMinutes || 2),
      story: String(parsed.story || ''),
      factsUsed: Array.isArray(parsed.factsUsed) ? parsed.factsUsed.map(String) : factsForPlace(place),
      sources: normalizeSources(parsed.sources, place.sources || []),
      disclaimer: String(parsed.disclaimer || DEFAULT_DISCLAIMER)
    };
  } catch {
    const fallback = templateStory(place);
    return {
      ...fallback,
      sources: fallback.sources,
      disclaimer: DEFAULT_DISCLAIMER
    };
  }
}

async function callOpenAICompatible({ config, place, fetchImpl = fetch }) {
  const timeoutMs = Number(config.openaiTimeoutMs || 4000);
  const response = await fetchImpl(`${config.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: buildMessages({ place })
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`AI request failed with HTTP ${response.status}: ${detail.slice(0, 300)}`);
    error.status = 502;
    throw error;
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('AI response did not include message content');
    error.status = 502;
    throw error;
  }

  return parseModelContent(content, place);
}

function resolvePlace(input) {
  if (input.placeId) return getPlaceById(input.placeId);
  if (input.place && input.place.id) return getPlaceById(input.place.id) || input.place;
  return input.place || input.facts || null;
}

async function generateStory({
  config,
  store,
  userId,
  placeId,
  place,
  facts,
  forceRefresh = false,
  fetchImpl = fetch
}) {
  const resolvedPlace = resolvePlace({ placeId, place, facts });
  if (!resolvedPlace) {
    const error = new Error('placeId or place facts are required');
    error.status = 400;
    throw error;
  }

  const coarseLocation = {
    lat: Number(Number(resolvedPlace.lat || resolvedPlace.location?.lat || 0).toFixed(2)),
    lng: Number(Number(resolvedPlace.lng || resolvedPlace.location?.lng || 0).toFixed(2))
  };
  const cacheKey = cacheKeyForStory({
    place: { id: resolvedPlace.id, title: placeName(resolvedPlace) },
    coarseLocation,
    style: 'trusted-guide',
    promptVersion: config.promptVersion
  });

  const cached = forceRefresh ? null : await store.getStoryCache(cacheKey);
  let story = cached;
  if (!story) {
    story = templateStory(resolvedPlace);
  }

  if (!cached) await store.setStoryCache(cacheKey, story);

  const history = await store.addHistory({
    userId,
    place: { id: resolvedPlace.id, title: placeName(resolvedPlace), name: placeName(resolvedPlace), address: resolvedPlace.address },
    coarseLocation,
    story
  });

  return {
    story,
    historyId: history.id,
    cached: Boolean(cached)
  };
}

module.exports = {
  buildMessages,
  callOpenAICompatible,
  factsForPlace,
  generateStory,
  insufficientStory,
  parseModelContent,
  templateStory
};
