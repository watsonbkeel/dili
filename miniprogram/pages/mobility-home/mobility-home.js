const api = require('../../utils/api');
const nav = require('../../utils/navigation');

function distanceText(distance) {
  const value = Number(distance || 0);
  if (!value) return '距离 650 米';
  if (value >= 1000) return `距离 ${(value / 1000).toFixed(1)} 公里`;
  return `距离 ${Math.round(value)} 米`;
}

function normalizePlace(place) {
  return {
    ...place,
    distanceText: distanceText(place.distance),
    coverUrl: place.coverImage && place.coverImage.url ? place.coverImage.url : '',
    intensity: place.id === 'beijing-palace-museum' ? '中等' : '轻松'
  };
}

Page({
  data: {
    loading: false,
    error: '',
    places: [],
    featured: null
  },

  onLoad() {
    this.loadPlaces();
  },

  async loadPlaces() {
    this.setData({ loading: true, error: '' });
    try {
      const payload = await api.listPlaces({ city: '北京' });
      const places = (payload.places || []).map(normalizePlace);
      this.setData({
        loading: false,
        places,
        featured: places[0] || null
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '无障碍景点加载失败' });
    }
  },

  refreshLocation() {
    wx.showToast({ title: '当前位置已刷新', icon: 'none' });
  },

  openPlace(event) {
    const id = event.currentTarget.dataset.id;
    nav.openPlace(id);
  },

  openNavigation(event) {
    const index = event.currentTarget.dataset.index;
    const place = this.data.places[index] || this.data.featured;
    if (place) nav.openLocation(place);
  },

  openAi() {
    nav.openAi({ type: 'mode', mode: 'mobility' });
  },

  openShortRoute() {
    wx.redirectTo({ url: '/pages/routes/routes' });
  },

  changeMode() {
    wx.navigateTo({ url: '/pages/mode-select/mode-select?force=1' });
  },

  goTab: nav.goTab
});
