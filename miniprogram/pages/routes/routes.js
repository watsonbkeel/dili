const api = require('../../utils/api');
const nav = require('../../utils/navigation');

Page({
  data: {
    loading: false,
    error: '',
    routes: []
  },

  onLoad() {
    this.loadRoutes();
  },

  async loadRoutes() {
    this.setData({ loading: true, error: '' });
    try {
      const payload = await api.listRoutes();
      this.setData({
        loading: false,
        routes: payload.routes || []
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '推荐路线加载失败'
      });
    }
  },

  openStop(event) {
    const id = event.currentTarget.dataset.id;
    nav.openPlace(id);
  },

  startRoute(event) {
    const index = event.currentTarget.dataset.index;
    const route = this.data.routes[index];
    const firstStop = route && route.stops && route.stops[0];
    if (!firstStop) {
      wx.showToast({ title: '路线暂无站点', icon: 'none' });
      return;
    }
    nav.openLocation({
      lat: firstStop.lat,
      lng: firstStop.lng,
      name: firstStop.name,
      address: firstStop.address
    });
  },

  openAi(event) {
    const index = event.currentTarget.dataset.index;
    const route = this.data.routes[index];
    nav.openAi(route ? { type: 'route', id: route.id } : { type: 'city', city: '北京' });
  },

  openGlobalAi() {
    nav.openAi({ type: 'city', city: '北京' });
  },

  goTab: nav.goTab
});
