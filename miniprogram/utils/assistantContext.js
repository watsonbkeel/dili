const defaultQuickQuestions = [
  '北京有哪些值得了解的历史景点？',
  '推荐一条适合半天游览的路线',
  '北京历史建筑有哪些观察重点？',
  '第一次来北京应该怎样安排行程？'
];

function recommendations(subject) {
  return [
    { title: '历史背景', question: `${subject}的历史背景是什么？` },
    { title: '现场看点', question: `到${subject}现场最值得看什么？` },
    { title: '游览建议', question: `${subject}适合怎样安排游览？` }
  ];
}

function placePresentation(context, place) {
  const name = (place && place.name) || context.name || '当前景点';
  const summary = (place && place.summary) || context.summary || '';
  const mobilityQuestion = context.mode === 'mobility'
    ? `${name}有哪些无障碍设施和少步行建议？`
    : `${name}的建筑或文化特色是什么？`;
  return {
    sourceText: `来源：${name}景点详情`,
    focusTitle: `正在了解：${name}`,
    focusDescription: summary || '接下来的问题会优先结合这个景点回答。',
    greeting: `你正在了解${name}。我会优先围绕这个景点的历史、现场看点和游览信息回答。`,
    quickQuestions: [
      `${name}的历史背景是什么？`,
      `到${name}现场最值得看什么？`,
      mobilityQuestion,
      `${name}大概需要多长时间游览？`
    ],
    popularRecommendations: recommendations(name)
  };
}

function recognitionPresentation(context) {
  const name = context.name || '识别到的地点';
  return {
    sourceText: '来源：拍照识别结果',
    focusTitle: `正在了解：${name}`,
    focusDescription: context.summary || '接下来的问题会优先结合这次识别结果回答。',
    greeting: `你刚刚识别了${name}。我会围绕识别结果继续回答。`,
    quickQuestions: [
      `${name}是什么地方？`,
      `${name}有什么历史背景？`,
      `${name}有哪些值得看的细节？`,
      `参观${name}需要注意什么？`
    ],
    popularRecommendations: recommendations(name)
  };
}

function modePresentation(context) {
  if (context.mode === 'mobility') {
    return {
      sourceText: '来源：行动不便人士首页',
      focusTitle: '正在规划：少步行与无障碍游览',
      focusDescription: '回答会优先考虑无障碍通行、步行时长和休息安排。',
      greeting: '我会优先为你提供少步行、无障碍通行和休息安排建议。',
      quickQuestions: [
        '推荐几个轮椅可以游览的北京景点',
        '哪些景点步行时间比较短？',
        '帮我规划一条少步行的半日路线',
        '故宫有哪些无障碍游览注意事项？'
      ],
      popularRecommendations: [
        { title: '无障碍景点', question: '推荐几个无障碍设施较完善的景点' },
        { title: '少步行路线', question: '帮我规划一条少步行路线' },
        { title: '休息安排', question: '怎样安排游览和休息更轻松？' }
      ]
    };
  }

  if (context.mode === 'lowVision') {
    return {
      sourceText: '来源：视障人士首页',
      focusTitle: '正在了解：北京历史景点',
      focusDescription: '回答会使用清晰、适合语音播报的表达。',
      greeting: '你从视障人士首页进入。我会用清晰、适合语音播报的方式回答。',
      quickQuestions: defaultQuickQuestions,
      popularRecommendations: recommendations('北京历史景点')
    };
  }

  return cityPresentation(context);
}

function cityPresentation(context = {}) {
  const city = context.city || '北京';
  return {
    sourceText: `来源：${city}导览首页`,
    focusTitle: `正在了解：${city}历史旅行`,
    focusDescription: `可以询问${city}景点、历史背景和路线安排。`,
    greeting: `我可以为你介绍${city}景点历史、推荐路线和解答游览问题。`,
    quickQuestions: defaultQuickQuestions,
    popularRecommendations: [
      { title: '历史故事', question: `讲一个${city}景点相关的历史故事` },
      { title: '建筑特色', question: `${city}历史建筑有哪些特色？` },
      { title: '路线推荐', question: `推荐一条${city}历史文化路线` }
    ]
  };
}

function presentationForContext(context = {}, place = null) {
  if (context.type === 'place') return placePresentation(context, place);
  if (context.type === 'recognition') return recognitionPresentation(context);
  if (context.type === 'mode') return modePresentation(context);
  return cityPresentation(context);
}

module.exports = {
  presentationForContext
};
