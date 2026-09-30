const { getPlaceById, listPlaces } = require('./placeStore');

// 语音搜景点：把已收录景点清单（名称+类别+一句话简介）交给模型，
// 让"面积最大/最小""能看升旗"这类比较、条件型问题也能落到具体景点上
function placeCatalogText(city = '北京') {
  const places = listPlaces({ city });
  return places
    .map((place) => {
      const tags = [...(place.category || []), ...(place.tags || [])].slice(0, 4).join('/');
      const summary = String(place.summary || '').replace(/\s+/g, '').slice(0, 40);
      return `${place.name}（${tags}）${summary}`;
    })
    .join('；');
}
const { getRouteById } = require('./routeStore');

function contextText(context = {}) {
  if (context.type === 'place' && context.id) {
    const place = getPlaceById(context.id);
    if (place) {
      const accessibility = place.accessibility || {};
      const facts = [
        `当前景点：${place.name}`,
        place.summary || '',
        (place.highlights || []).length ? `现场看点：${place.highlights.join('；')}` : '',
        place.walkingTimeMinutes ? `预计步行时间：${place.walkingTimeMinutes}分钟。${place.walkingTimeNote || ''}` : '',
        accessibility.label ? `无障碍情况：${accessibility.label}。${accessibility.summary || ''}` : ''
      ].filter(Boolean);
      return facts.join('。');
    }
  }
  if (context.type === 'route' && context.id) {
    const route = getRouteById(context.id);
    if (route) return `当前路线：${route.title}，${route.description}`;
  }
  if (context.type === 'recognition') {
    return `当前图片识别对象：${context.name || '未知'}。${context.summary || ''}`;
  }
  if (context.type === 'mode' && context.mode === 'mobility') {
    return '当前城市：北京。用户从行动不便人士首页进入，回答时优先考虑无障碍通行、步行时长和休息安排。';
  }
  if (context.type === 'placeSearch') {
    const city = context.city || '北京';
    return `当前城市：${city}。用户在视障语音导览首页用语音找景点，回答会被语音播报。本应用已收录的景点：${placeCatalogText(city)}。请直接回答用户的问题，并点名一到三个最相关的已收录景点（名称必须与清单一致）；清单里没有合适的，就如实说明并给出一般性建议，控制在150字以内。`;
  }
  if (context.type === 'mode' && context.mode === 'lowVision') {
    return '当前城市：北京。用户从视障人士首页进入，回答应清晰、简洁，适合语音播报。';
  }
  return `当前城市：${context.city || '北京'}。`;
}

function templateAnswer(question, context = {}) {
  const q = String(question || '').trim();
  if (context.type === 'placeSearch') {
    return '暂时无法回答这个问题。你可以直接说出景点名称，比如故宫、天坛、颐和园。';
  }
  const ctx = contextText(context);
  if (!q) {
    return '你可以问我某个景点的历史背景、建筑特色，或请我推荐一条适合当前行程的路线。';
  }
  if (/路线|亲子|一日游|推荐/.test(q)) {
    return `${ctx} 如果想安排轻松的一日历史游，可以优先选择天安门广场、故宫博物院、景山公园、什刹海和天坛公园。这样的顺序能从国家礼仪空间、明清宫城、城市中轴线和老城生活几个角度理解北京。实际游览时建议根据开放时间、体力和交通情况调整。`;
  }
  if (/建筑|特点|天坛|故宫|景山|什刹海/.test(q)) {
    return `${ctx} 这类地点的观察重点可以放在空间轴线、建筑等级、材料色彩和使用功能上。以北京历史建筑为例，很多空间并不是孤立存在，而是和礼制、城市道路、水系或皇家园林格局共同构成历史现场。具体年代和事件仍建议以景区说明、官方资料和权威文献为准。`;
  }
  return `${ctx} 关于“${q}”，可以先从地点所处的城市位置、形成时期、代表建筑或事件入手理解。若资料中没有明确证据，我会避免补充未经确认的人物关系、年代或传说；建议结合现场说明和官方资料继续核对。`;
}

function buildAssistantMessages({ question, context }) {
  return [
    {
      role: 'system',
      content:
        '你是北京本地历史旅行助手。回答必须使用简洁、自然、适合现场阅读和语音播报的中文，控制在600个汉字以内并完整收尾，不使用Markdown、表格或链接。优先依据用户提供的当前景点和无障碍上下文；不能虚构具体年份、书名或人物关系。严禁补充上下文未出现的具体入口名称、无障碍通道走向、卫生间位置、轮椅租借点、票务和开放时间；即使你认为自己知道也不要写。此类实时信息如果上下文没有明确提供，只能提示向景区官方或现场工作人员核实。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        question,
        context: contextText(context)
      })
    }
  ];
}

function buildChatCompletionsUrl(base, path) {
  const baseUrl = new URL(base || 'https://tokenhub.tencentmaas.com');
  const configuredPath = String(path || '').trim();
  if (configuredPath) {
    baseUrl.pathname = configuredPath.startsWith('/') ? configuredPath : `/${configuredPath}`;
    return baseUrl.toString();
  }

  const normalizedPath = baseUrl.pathname.replace(/\/$/, '');
  baseUrl.pathname = normalizedPath.endsWith('/v1')
    ? `${normalizedPath}/chat/completions`
    : `${normalizedPath}/v1/chat/completions`;
  return baseUrl.toString();
}

// 文字问答：ASSISTANT_* 优先，未配置时回退 OPENAI_*
function chatCompletionsUrl(config) {
  return buildChatCompletionsUrl(
    config.assistantBaseUrl || config.openaiBaseUrl,
    config.assistantChatCompletionsPath || config.openaiChatCompletionsPath
  );
}

// 视觉识别：只用 OPENAI_*，不受 ASSISTANT_* 影响（两套配置互不干扰）
function visionCompletionsUrl(config) {
  return buildChatCompletionsUrl(config.openaiBaseUrl, config.openaiChatCompletionsPath);
}

// 返回要合并进请求体的思考开关字段；值非法或为 none 时不发送
function thinkingParams(config = {}) {
  const mode = String(config.llmThinking ?? 'disabled').trim().toLowerCase();
  if (mode === 'disabled' || mode === 'enabled') return { thinking: { type: mode } };
  return {};
}

function extractAnswer(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        return item.text || item.content || '';
      })
      .join('')
      .trim();
  }
  return '';
}

function normalizeAssistantAnswer(text, maxChars = 600) {
  const normalized = String(text || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>~]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) return normalized;

  const limited = chars.slice(0, maxChars).join('');
  const sentenceEnd = Math.max(
    limited.lastIndexOf('。'),
    limited.lastIndexOf('！'),
    limited.lastIndexOf('？'),
    limited.lastIndexOf('!'),
    limited.lastIndexOf('?')
  );
  if (sentenceEnd >= Math.floor(maxChars * 0.6)) return limited.slice(0, sentenceEnd + 1).trim();
  return `${chars.slice(0, Math.max(1, maxChars - 1)).join('').trim()}。`;
}

async function askAssistant({ config, question, context = {}, fetchImpl = fetch }) {
  const apiKey = config.assistantApiKey || config.openaiApiKey;
  const model = config.assistantModel || config.openaiModel || 'deepseek/deepseek-flash';
  const timeoutMs = Number(config.assistantTimeoutMs || config.openaiTimeoutMs || 30000);
  const maxTokens = Number(config.assistantMaxTokens || config.openaiMaxTokens || 600);
  if (!apiKey) {
    return {
      answer: templateAnswer(question, context),
      source: 'template'
    };
  }

  try {
    const response = await fetchImpl(chatCompletionsUrl(config), {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: maxTokens,
        ...thinkingParams(config),
        messages: buildAssistantMessages({ question, context })
      })
    });

    if (!response.ok) {
      return {
        answer: templateAnswer(question, context),
        source: 'template-fallback'
      };
    }

    const payload = await response.json();
    const answer = normalizeAssistantAnswer(extractAnswer(payload));
    return {
      answer: answer || templateAnswer(question, context),
      source: answer ? 'ai' : 'template-fallback'
    };
  } catch {
    return {
      answer: templateAnswer(question, context),
      source: 'template-fallback'
    };
  }
}

module.exports = {
  askAssistant,
  buildAssistantMessages,
  chatCompletionsUrl,
  contextText,
  extractAnswer,
  normalizeAssistantAnswer,
  templateAnswer,
  thinkingParams,
  visionCompletionsUrl
};
