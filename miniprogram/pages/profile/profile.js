const nav = require('../../utils/navigation');
const favorites = require('../../utils/favorites');
const userMode = require('../../utils/userMode');
const viewHistory = require('../../utils/viewHistory');

function getProfile() {
  const profile = wx.getStorageSync('userProfile') || {
    avatar: '',
    nickname: '本地访客',
    city: '北京',
    preferences: ['历史故事', '语音讲解']
  };
  return {
    ...profile,
    avatarText: String(profile.nickname || '旅').slice(0, 1)
  };
}

Page({
  data: {
    profile: getProfile(),
    favoriteCount: 0,
    historyCount: 0,
    currentModeLabel: ''
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    this.setData({
      profile: getProfile(),
      favoriteCount: favorites.listFavorites().length,
      historyCount: viewHistory.listHistory().length,
      currentModeLabel: userMode.labelForMode()
    });
  },

  editProfile() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
  },

  openFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' });
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  changeMode() {
    nav.openModeSelect();
  },

  openAccessibility() {
    nav.openModeSelect();
  },

  openAi() {
    nav.openAi({ type: 'city', city: '北京' });
  },

  goTab: nav.goTab
});
