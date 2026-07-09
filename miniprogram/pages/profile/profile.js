const nav = require('../../utils/navigation');
const favorites = require('../../utils/favorites');
const api = require('../../utils/api');
const userMode = require('../../utils/userMode');

Page({
  data: {
    userId: '',
    favoriteCount: 0,
    historyCount: 0,
    currentModeLabel: ''
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    const userId = getApp().ensureUserId();
    let historyCount = 0;
    try {
      const payload = await api.listHistory();
      historyCount = (payload.history || []).length;
    } catch {
      historyCount = 0;
    }
    this.setData({
      userId,
      favoriteCount: favorites.listFavorites().length,
      historyCount,
      currentModeLabel: userMode.labelForMode()
    });
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  openAi() {
    nav.openAi({ type: 'city', city: '北京' });
  },

  changeMode() {
    wx.navigateTo({ url: '/pages/mode-select/mode-select?force=1' });
  },

  goTab: nav.goTab
});
