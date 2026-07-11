const api = require('../../utils/api');
const favorites = require('../../utils/favorites');
const nav = require('../../utils/navigation');

Page({
  data: {
    image: '',
    loading: true,
    error: '',
    result: null,
    saved: false,
    location: null
  },

  onLoad(options) {
    const image = options.image ? decodeURIComponent(options.image) : '';
    const lat = Number(options.lat);
    const lng = Number(options.lng);
    const location = Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, accuracy: Number(options.accuracy) || 0 }
      : null;
    this.setData({ image, location });
    if (!image) {
      this.setData({ loading: false, error: '没有收到需要识别的图片。' });
      return;
    }
    this.recognize();
  },

  async recognize() {
    if (!this.data.image) return;
    this.setData({ loading: true, error: '', result: null });
    try {
      const payload = await api.recognizeImage(this.data.image, this.data.location);
      const result = payload.result;
      if (!result) throw new Error('AI 没有返回识别结果');
      this.setData({
        loading: false,
        result,
        saved: result.recognized ? favorites.isFavorite(result.id) : false
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '图片识别失败，请重试。'
      });
    }
  },

  chooseAgain() {
    wx.navigateBack();
  },

  addToRoute() {
    const result = this.data.result;
    if (!result || !result.recognized) return;
    wx.setStorageSync('pendingRoutePlace', {
      id: result.knownPlaceId || result.id,
      name: result.name,
      recommendedDuration: '30 分钟',
      image: this.data.image
    });
    wx.showToast({ title: '已加入路线草稿', icon: 'none' });
  },

  toggleFavorite() {
    const result = this.data.result;
    if (!result || !result.recognized) return;
    const item = {
      id: result.id,
      name: result.name,
      city: '北京',
      category: result.tags,
      summary: result.summary,
      coverImage: { url: this.data.image }
    };
    const saved = favorites.toggleFavorite(item);
    this.setData({ saved });
  },

  askAi() {
    const result = this.data.result;
    if (!result) return;
    nav.openAi({
      type: 'recognition',
      id: result.knownPlaceId || '',
      name: result.name,
      summary: result.summary
    });
  },

  shareFriend() {
    wx.showToast({ title: '请使用右上角分享', icon: 'none' });
  },

  onShareAppMessage() {
    const result = this.data.result;
    return {
      title: result && result.recognized ? `我识别到了${result.name}` : '本地历史导览 AI 图片识别',
      path: '/pages/camera/camera'
    };
  }
});
