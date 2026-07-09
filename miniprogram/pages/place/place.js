const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const favorites = require('../../utils/favorites');
const { createSpeechController } = require('../../utils/speech');
const userMode = require('../../utils/userMode');

function distanceText(distance) {
  const value = Number(distance || 0);
  if (!value) return '距离约 650 米';
  if (value >= 1000) return `距离约 ${(value / 1000).toFixed(1)} 公里`;
  return `距离约 ${Math.round(value)} 米`;
}

function normalizePlace(place) {
  return {
    ...place,
    category: place.category || [],
    tags: place.tags || [],
    timeline: place.timeline || [],
    highlights: place.highlights || [],
    visitTips: place.visitTips || [],
    images: place.images || [],
    sources: place.sources || [],
    categoryText: (place.category || []).join(' / '),
    coverUrl: place.coverImage && place.coverImage.url ? place.coverImage.url : '',
    distanceText: distanceText(place.distance),
    sourceText: (place.sources || []).map((source) => source.title).join('、') || '资料来源待补充'
  };
}

function buildSummaryPoints(place) {
  const timeline = place.timeline || [];
  const highlights = place.highlights || [];
  return [
    {
      title: '这个地方是什么',
      text: place.summary || '资料不足，待补充。'
    },
    {
      title: '和哪段历史有关',
      text: timeline.length ? `${timeline[0].year}：${timeline[0].event}` : `${place.period || '北京历史'}相关地点。`
    },
    {
      title: '到现场应该看什么',
      text: highlights[0] || '建议观察建筑空间、地名和周边城市关系。'
    }
  ];
}

const mobilityInfo = [
  { label: '路线强度', value: '中等' },
  { label: '步行距离', value: '约 650 米' },
  { label: '台阶情况', value: '部分区域有台阶' },
  { label: '轮椅友好', value: '部分区域适合' },
  { label: '休息点', value: '有' },
  { label: '无障碍卫生间', value: '建议出发前确认' },
  { label: '推荐入口', value: '主入口' },
  { label: '建议游览方式', value: '选择短路线，预留休息时间' }
];

Page({
  data: {
    loading: false,
    generating: false,
    error: '',
    placeId: '',
    place: null,
    story: null,
    mode: 'normal',
    summaryPoints: [],
    mobilityInfo,
    favorite: false,
    audio: {
      status: 'idle',
      statusText: '未播放',
      rate: 1
    },
    guideAudio: {
      status: 'idle',
      statusText: '未播放',
      rate: 1
    }
  },

  onLoad(options) {
    this.setData({ placeId: options.id || '', mode: userMode.getMode() || 'normal' });
    this.summarySpeech = createSpeechController(this, 'audio');
    this.guideSpeech = createSpeechController(this, 'guideAudio');
    this.loadPlace();
  },

  onUnload() {
    if (this.summarySpeech) this.summarySpeech.destroy();
    if (this.guideSpeech) this.guideSpeech.destroy();
  },

  async loadPlace() {
    if (!this.data.placeId) {
      this.setData({ error: '没有找到地点 ID。' });
      return;
    }

    this.setData({ loading: true, error: '' });
    try {
      const payload = await api.getPlace(this.data.placeId);
      const place = normalizePlace(payload.place);
      this.setData({
        loading: false,
        place,
        summaryPoints: buildSummaryPoints(place),
        favorite: favorites.isFavorite(payload.place.id)
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '地点详情加载失败'
      });
    }
  },

  async generateGuide() {
    if (!this.data.place) return;
    this.setData({ generating: true, error: '' });
    try {
      const result = await api.createStory({
        placeId: this.data.place.id,
        forceRefresh: true
      });
      this.setData({
        generating: false,
        story: result.story
      });
    } catch (error) {
      this.setData({
        generating: false,
        error: error.message || '导览生成失败'
      });
    }
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({ url: userMode.homeUrlForMode(this.data.mode) });
  },

  toggleFavorite() {
    if (!this.data.place) return;
    const favorite = favorites.toggleFavorite(this.data.place);
    this.setData({ favorite });
    wx.showToast({ title: favorite ? '已收藏' : '已取消收藏', icon: 'none' });
  },

  openNavigation() {
    nav.openLocation(this.data.place);
  },

  openAi() {
    nav.openAi({ type: 'place', id: this.data.placeId, mode: this.data.mode });
  },

  playSummary() {
    if (!this.summarySpeech || !this.data.place) return;
    const points = (this.data.summaryPoints || []).map((point) => `${point.title}：${point.text}`);
    const text = points.length ? `${this.data.place.name}。${points.join('。')}` : this.data.place.summary;
    this.summarySpeech.play(text);
  },

  pauseSummary() {
    if (this.summarySpeech) this.summarySpeech.pause();
  },

  resumeSummary() {
    if (this.summarySpeech) this.summarySpeech.resume();
  },

  stopSummary() {
    if (this.summarySpeech) this.summarySpeech.stop();
  },

  setSummaryRate(event) {
    const rate = event.currentTarget.dataset.rate;
    if (this.summarySpeech) this.summarySpeech.setRate(rate);
  },

  playGuide() {
    if (this.guideSpeech) this.guideSpeech.play(this.data.story && this.data.story.story);
  },

  pauseGuide() {
    if (this.guideSpeech) this.guideSpeech.pause();
  },

  resumeGuide() {
    if (this.guideSpeech) this.guideSpeech.resume();
  },

  stopGuide() {
    if (this.guideSpeech) this.guideSpeech.stop();
  },

  setGuideRate(event) {
    const rate = event.currentTarget.dataset.rate;
    if (this.guideSpeech) this.guideSpeech.setRate(rate);
  },

  goHome() {
    wx.redirectTo({ url: userMode.homeUrlForMode(this.data.mode) });
  },

  openShortRoute() {
    wx.redirectTo({ url: '/pages/routes/routes' });
  },

  goTab: nav.goTab
});
