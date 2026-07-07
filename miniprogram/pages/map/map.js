const api = require('../../utils/api');
const nav = require('../../utils/navigation');

Page({
  data: {
    loading: false,
    error: '',
    latitude: 39.916345,
    longitude: 116.397155,
    places: [],
    markers: []
  },

  onLoad() {
    this.loadPlaces();
  },

  async loadPlaces() {
    this.setData({ loading: true, error: '' });
    try {
      const cached = wx.getStorageSync('lastPlacesPayload');
      const payload = cached && cached.places ? cached : await api.listPlaces({ city: '北京' });
      const places = (payload.places || []).map((place) => ({
        ...place,
        categoryText: (place.category || []).slice(0, 2).join(' / ')
      }));
      const markers = places.map((place, index) => ({
        id: index,
        latitude: place.lat,
        longitude: place.lng,
        title: place.name,
        width: 28,
        height: 28
      }));
      const center = places[0] || { lat: 39.916345, lng: 116.397155 };
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
        error: error.message || '地图地点加载失败'
      });
    }
  },

  onMarkerTap(event) {
    const place = this.data.places[event.detail.markerId];
    if (place) this.openPlaceById(place.id);
  },

  openPlace(event) {
    this.openPlaceById(event.currentTarget.dataset.id);
  },

  openPlaceById(id) {
    wx.navigateTo({ url: `/pages/place/place?id=${encodeURIComponent(id)}` });
  },

  openAi() {
    nav.openAi({ type: 'city', city: '北京' });
  },

  goTab: nav.goTab
});
