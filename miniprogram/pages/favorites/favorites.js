const favorites = require('../../utils/favorites');
const nav = require('../../utils/navigation');

function normalize(item) {
  return {
    ...item,
    categoryText: (item.category || []).slice(0, 3).join(' / '),
    savedText: item.savedAt ? item.savedAt.slice(0, 10) : '',
    coverUrl: item.coverUrl || (item.coverImage && item.coverImage.url) || ''
  };
}

Page({
  data: {
    items: [],
    groups: []
  },

  onShow() {
    this.loadFavorites();
  },

  loadFavorites() {
    const items = favorites.listFavorites().map(normalize);
    this.setData({ items, groups: favorites.groupFavoritesByCity(items) });
  },

  openPlace(event) {
    nav.openPlace(event.currentTarget.dataset.id);
  },

  remove(event) {
    favorites.removeFavorite(event.currentTarget.dataset.id);
    this.loadFavorites();
  },

  addToRoute(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.items.find((favorite) => favorite.id === id);
    if (!item) return;
    wx.setStorageSync('pendingRoutePlace', {
      id: item.id,
      name: item.name,
      recommendedDuration: '60 分钟',
      image: item.coverUrl
    });
    wx.navigateTo({ url: '/pages/routes/routes' });
  },

  shareItem() {
    wx.showToast({ title: '请使用右上角分享', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '我的历史地点收藏',
      path: '/pages/favorites/favorites'
    };
  },

  goTab: nav.goTab
});
