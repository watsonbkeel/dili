const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const { getFallbackPlaces, preparePlaces } = require('../../utils/placeList');

Page({
  data: {
    loading: false,
    error: '',
    city: '北京',
    query: '',
    locationMode: false,
    latitude: 39.916345,
    longitude: 116.397155,
    places: getFallbackPlaces(),
    markers: []
  },

  onLoad() {
    getApp().ensureUserId();
    this.loadPlaces();
  },

  async loadPlaces(options = {}) {
    this.setData({ loading: true, error: '' });
    try {
      const params = {
        city: this.data.city,
        q: options.query !== undefined ? options.query : this.data.query
      };
      if (options.lat !== undefined && options.lng !== undefined) {
        params.lat = options.lat;
        params.lng = options.lng;
        params.radius = options.radius || 20000;
      }
      const payload = await api.listPlaces(params);
      const places = preparePlaces(payload.places);
      const markers = places.map((place, index) => ({
        id: index,
        latitude: place.lat,
        longitude: place.lng,
        title: place.name,
        width: 28,
        height: 28
      }));
      const center = places[0] || { lat: 39.916345, lng: 116.397155 };
      wx.setStorageSync('lastPlacesPayload', { places });
      this.setData({
        loading: false,
        places,
        markers,
        latitude: center.lat,
        longitude: center.lng
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: '',
        places: getFallbackPlaces()
      });
    }
  },

  onQueryInput(event) {
    this.setData({ query: event.detail.value });
  },

  searchPlaces() {
    this.loadPlaces({ query: this.data.query.trim() });
  },

  refreshPlaces() {
    this.setData({ query: '', locationMode: false });
    this.loadPlaces({ query: '' });
  },

  refreshLocation() {
    this.setData({ loading: true, error: '' });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ locationMode: true, latitude: res.latitude, longitude: res.longitude });
        this.loadPlaces({ lat: res.latitude, lng: res.longitude, radius: 20000, query: this.data.query.trim() });
      },
      fail: () => {
        this.setData({
          loading: false,
          error: '无法获取定位。你仍可以使用搜索框查找北京历史热点。'
        });
      }
    });
  },

  onMarkerTap(event) {
    const place = this.data.places[event.detail.markerId];
    if (place) this.openPlaceById(place.id);
  },

  openPlace(event) {
    this.openPlaceById(event.currentTarget.dataset.id);
  },

  openPlaceByTap(event) {
    this.openPlaceById(event.currentTarget.dataset.id);
  },

  openPlaceById(id) {
    wx.navigateTo({ url: `/pages/place/place?id=${encodeURIComponent(id)}` });
  },

  openMap() {
    wx.redirectTo({ url: '/pages/map/map' });
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  openAi() {
    nav.openAi({ type: 'city', city: this.data.city });
  },

  goTab: nav.goTab,

  switchCity() {
    wx.showToast({ title: '第一版城市为北京', icon: 'none' });
  }
});
