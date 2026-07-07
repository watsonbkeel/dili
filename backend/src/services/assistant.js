const { getPlaceById } = require('./placeStore');
const { getRouteById } = require('./routeStore');

function contextText(context = {}) {
  if (context.type === 'place' && context.id) {
    const place = getPlaceById(context.id);
    if (place) return `当前景点：${place.name}。${place.summary || ''}`;
  }
  if (context.type === 'route' && context.id) {
    const route = getRouteById(context.id);
    if (route) return `当前路线：${route.title}，${route.description}`;
  }
  return '当前城市：北京。';
}

function templateAnswer(question, context = {}) {
  const q = String(question || '').trim();
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
        '你是北京本地历史旅行助手。回答要中文、简洁、适合旅行现场理解。不能虚构具体年份、书名、链接或人物关系；不确定内容必须提示需核实。'
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

async function askAssistant({ config, question, context = {}, fetchImpl = fetch }) {
  if (!config.openaiApiKey) {
    return {
      answer: templateAnswer(question, context),
      source: 'template'
    };
  }

  const response = await fetchImpl(`${config.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(Number(config.openaiTimeoutMs || 4000)),
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.4,
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
  const answer = payload.choices?.[0]?.message?.content;
  return {
    answer: answer || templateAnswer(question, context),
    source: answer ? 'ai' : 'template-fallback'
  };
}

module.exports = {
  askAssistant,
  templateAnswer
};
