const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const userMode = require('../../utils/userMode');

Page({
  data: {
    loading: false,
    error: '',
    routes: [],
    mode: 'normal',
    pageTitle: '推荐路线',
    pageSubtitle: '按北京核心历史文化区域规划，适合现场探索。'
  },

  onLoad() {
    this.loadRoutes();
  },

  onShow() {
    const mode = userMode.getMode() || 'normal';
    const copy = {
      normal: {
        pageTitle: '推荐路线',
        pageSubtitle: '按北京核心历史文化区域规划，适合现场探索。'
      },
      lowVision: {
        pageTitle: '大字路线推荐',
        pageSubtitle: '路线信息放大显示，优先保留站点和导航操作。'
      },
      mobility: {
        pageTitle: '少步行路线推荐',
        pageSubtitle: '优先选择少步行、少台阶和方便休息的路线。'
      }
    };
    this.setData({
      mode,
      ...(copy[mode] || copy.normal)
    });
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
    nav.openAi(route ? { type: 'route', id: route.id, mode: this.data.mode } : { type: 'city', city: '北京', mode: this.data.mode });
  },

  openGlobalAi() {
    nav.openAi({ type: 'city', city: '北京', mode: this.data.mode });
  },

  goTab: nav.goTab
});
