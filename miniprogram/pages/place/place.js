const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const favorites = require('../../utils/favorites');
const placeReactions = require('../../utils/placeReactions');
const routeStore = require('../../utils/routeStore');
const viewHistory = require('../../utils/viewHistory');
const { createSpeechController } = require('../../utils/speech');
const userMode = require('../../utils/userMode');

function distanceText(distance) {
  const value = Number(distance || 0);
  if (!value) return '距离约 650 米';
  if (value >= 1000) return `距离约 ${(value / 1000).toFixed(1)} 公里`;
  return `距离约 ${Math.round(value)} 米`;
}

function walkingTimeText(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '预计步行时间待确认';
  if (value >= 60 && value % 60 === 0) return `预计步行约 ${value / 60} 小时`;
  if (value > 60) return `预计步行约 ${Math.floor(value / 60)} 小时 ${value % 60} 分钟`;
  return `预计步行约 ${value} 分钟`;
}

function normalizePlace(place) {
  const accessibility = place.accessibility || null;
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
    sourceText: (place.sources || []).map((source) => source.title).join('、') || '资料来源待补充',
    walkingTimeText: walkingTimeText(place.walkingTimeMinutes),
    accessibility: accessibility
      ? {
          ...accessibility,
          label: accessibility.label || '无障碍信息待确认',
          summary: accessibility.summary || '建议出发前向景区确认无障碍设施开放情况。',
          tone: accessibility.level === 'full' ? 'full' : accessibility.level === 'none' ? 'none' : 'partial'
        }
      : null
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
    reaction: '',
    reactionBusy: false,
    reactionCounts: {
      recommend: 0,
      notRecommend: 0
    },
    showRouteSheet: false,
    routeOptions: [],
    selectedRouteId: '',
    creatingRoute: false,
    newRouteName: '',
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

  onShow() {
    if (this.data.placeId) {
      this.setData({ favorite: favorites.isFavorite(this.data.placeId) });
    }
  },

  async loadPlace() {
    if (!this.data.placeId) {
      this.setData({ error: '没有找到地点 ID。' });
      return;
    }

    this.setData({ loading: true, error: '' });
    try {
      const [payload, reactionPayload] = await Promise.all([
        api.getPlace(this.data.placeId),
        api.getPlaceReactions(this.data.placeId).catch(() => ({
          counts: { recommend: 0, notRecommend: 0 }
        }))
      ]);
      const place = normalizePlace(payload.place);
      viewHistory.recordPlaceView(payload.place);
      this.setData({
        loading: false,
        place,
        summaryPoints: buildSummaryPoints(place),
        favorite: favorites.isFavorite(payload.place.id),
        reaction: placeReactions.getReaction(payload.place.id),
        reactionCounts: reactionPayload.counts || { recommend: 0, notRecommend: 0 }
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

  previewAccessibilityMap() {
    const accessibility = this.data.place && this.data.place.accessibility;
    if (!accessibility || !accessibility.mapUrl) return;
    wx.previewImage({
      current: accessibility.mapUrl,
      urls: [accessibility.mapUrl]
    });
  },

  openAi() {
    const place = this.data.place || {};
    nav.openAi({
      type: 'place',
      id: this.data.placeId,
      name: place.name || '',
      summary: place.summary || '',
      mode: this.data.mode
    });
  },

  playSummary() {
    if (!this.summarySpeech || !this.data.place) return;
    const points = (this.data.summaryPoints || []).map((point) => `${point.title}：${point.text}`);
    const text = points.length ? `${this.data.place.name}。${points.join('。')}` : this.data.place.summary;
    this.summarySpeech.play(text);
  },

  toggleSummaryAudio() {
    const status = this.data.audio && this.data.audio.status;
    if (status === 'playing') {
      this.pauseSummary();
      return;
    }
    if (status === 'paused') {
      this.resumeSummary();
      return;
    }
    this.playSummary();
  },

  pauseSummary() {
    if (this.summarySpeech) this.summarySpeech.pause();
  },

  resumeSummary() {
    if (this.summarySpeech) this.summarySpeech.resume();
  },

  setSummaryRate(event) {
    const rate = event.currentTarget.dataset.rate;
    if (this.summarySpeech) this.summarySpeech.setRate(rate);
  },

  addToRoute() {
    if (!this.data.place) return;
    this.renderRouteOptions(routeStore.loadState());
    this.setData({
      showRouteSheet: true,
      creatingRoute: false,
      newRouteName: ''
    });
  },

  renderRouteOptions(state, selectedRouteId) {
    this._routeState = routeStore.normalizeState(state);
    const selected = this._routeState.routes.some((route) => route.id === selectedRouteId)
      ? selectedRouteId
      : this._routeState.currentRouteId;
    this.setData({
      routeOptions: this._routeState.routes.map((route) => ({
        id: route.id,
        name: route.name,
        stopCount: route.stops.length
      })),
      selectedRouteId: selected
    });
  },

  closeRouteSheet() {
    this.setData({ showRouteSheet: false, creatingRoute: false, newRouteName: '' });
  },

  selectRoute(event) {
    this.setData({ selectedRouteId: event.detail.value });
  },

  toggleCreateRoute() {
    this.setData({ creatingRoute: !this.data.creatingRoute, newRouteName: '' });
  },

  onNewRouteName(event) {
    this.setData({ newRouteName: event.detail.value });
  },

  createRoute() {
    const name = this.data.newRouteName.trim();
    if (!name) {
      wx.showToast({ title: '请输入路线名称', icon: 'none' });
      return;
    }
    const state = routeStore.saveState(routeStore.addRoute(this._routeState, name));
    this.renderRouteOptions(state, state.currentRouteId);
    this.setData({ creatingRoute: false, newRouteName: '' });
  },

  confirmAddToRoute() {
    const place = this.data.place;
    if (!place || !this.data.selectedRouteId) return;
    const result = routeStore.addStop(this._routeState, this.data.selectedRouteId, {
      id: place.id,
      name: place.name,
      stay: '60 分钟',
      image: place.coverUrl,
      lat: place.lat,
      lng: place.lng,
      category: place.category,
      tags: place.tags
    });
    if (!result.added) {
      wx.showToast({
        title: result.reason === 'duplicate' ? '该景点已在所选路线中' : '加入路线失败',
        icon: 'none'
      });
      return;
    }
    routeStore.saveState(result.state);
    const route = this._routeState.routes.find((item) => item.id === this.data.selectedRouteId);
    this.closeRouteSheet();
    wx.showToast({ title: `已加入${route ? route.name : '路线'}`, icon: 'none' });
  },

  noop() {},

  sharePlace() {
    wx.showToast({ title: '请使用右上角分享', icon: 'none' });
  },

  recommendPlace() {
    this.toggleReaction('recommend');
  },

  rejectPlace() {
    this.toggleReaction('notRecommend');
  },

  async toggleReaction(selected) {
    if (!this.data.place || this.data.reactionBusy) return;
    const previous = this.data.reaction || '';
    const reaction = previous === selected ? '' : selected;
    this.setData({ reactionBusy: true });
    try {
      const payload = await api.updatePlaceReaction(this.data.place.id, previous, reaction);
      placeReactions.setReaction(this.data.place.id, reaction);
      this.setData({
        reaction,
        reactionCounts: payload.counts,
        reactionBusy: false
      });
    } catch (error) {
      this.setData({ reactionBusy: false });
      wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none' });
    }
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

  onShareAppMessage() {
    return {
      title: this.data.place ? this.data.place.name : '本地历史导览',
      path: this.data.place ? `/pages/place/place?id=${encodeURIComponent(this.data.place.id)}` : '/pages/home/home'
    };
  },

  openShortRoute() {
    wx.redirectTo({ url: '/pages/routes/routes' });
  },

  goTab: nav.goTab
});
