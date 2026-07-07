const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const favorites = require('../../utils/favorites');
const { createSpeechController } = require('../../utils/speech');

function normalizePlace(place) {
  return {
    ...place,
    categoryText: (place.category || []).join(' / '),
    coverUrl: place.coverImage && place.coverImage.url ? place.coverImage.url : '',
    sourceText: (place.sources || []).map((source) => source.title).join('、') || '资料来源待补充'
  };
}

Page({
  data: {
    loading: false,
    generating: false,
    error: '',
    placeId: '',
    place: null,
    story: null,
    favorite: false,
    audio: {
      status: 'idle',
      statusText: '未播放'
    },
    guideAudio: {
      status: 'idle',
      statusText: '未播放'
    }
  },

  onLoad(options) {
    this.setData({ placeId: options.id || '' });
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
      this.setData({
        loading: false,
        place: normalizePlace(payload.place),
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
    nav.openAi({ type: 'place', id: this.data.placeId });
  },

  playSummary() {
    if (this.summarySpeech) this.summarySpeech.play(this.data.place && this.data.place.summary);
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

  goTab: nav.goTab
});
