const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const { getFallbackPlaces, preparePlaces } = require('../../utils/placeList');

const DEFAULT_LOCATION = {
  latitude: 39.90746,
  longitude: 116.39763
};

function createMarkers(places) {
  return places.map((place, index) => ({
    id: index,
    latitude: Number(place.lat),
    longitude: Number(place.lng),
    title: place.name,
    width: 28,
    height: 28,
    callout: {
      content: place.name,
      display: 'BYCLICK',
      padding: 6,
      borderRadius: 4
    }
  }));
}

Page({
  data: {
    loading: false,
    locating: false,
    error: '',
    city: '北京',
    query: '',
    locationMode: false,
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    places: getFallbackPlaces(),
    markers: []
  },

  onLoad() {
    getApp().ensureUserId();
    this.loadPlaces({
      lat: DEFAULT_LOCATION.latitude,
      lng: DEFAULT_LOCATION.longitude
    });
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
      const markers = createMarkers(places);
      wx.setStorageSync('lastPlacesPayload', { places });
      const nextData = {
        loading: false,
        places,
        markers
      };
      if (options.lat !== undefined && options.lng !== undefined) {
        nextData.latitude = Number(options.lat);
        nextData.longitude = Number(options.lng);
      }
      this.setData(nextData);
    } catch (error) {
      const places = getFallbackPlaces();
      this.setData({
        loading: false,
        error: '',
        places,
        markers: createMarkers(places)
      });
    }
  },

  onQueryInput(event) {
    this.setData({ query: event.detail.value });
  },

  searchPlaces() {
    this.loadPlaces({
      query: this.data.query.trim(),
      lat: this.data.latitude,
      lng: this.data.longitude
    });
  },

  refreshPlaces() {
    this.setData({ query: '' });
    this.loadPlaces({
      query: '',
      lat: this.data.latitude,
      lng: this.data.longitude
    });
  },

  refreshLocation() {
    if (this.data.locating) return;
    this.setData({ locating: true, error: '' });
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        this.setData({
          locating: false,
          locationMode: true,
          latitude: res.latitude,
          longitude: res.longitude
        });
        this.loadPlaces({ lat: res.latitude, lng: res.longitude, radius: 20000, query: this.data.query.trim() });
      },
      fail: () => {
        this.setData({
          locating: false,
          locationMode: false,
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude
        });
        wx.showToast({ title: '无法定位，继续使用天安门默认位置', icon: 'none' });
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
