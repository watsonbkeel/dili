const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const {
  sortAccessiblePlaces,
  sortShortWalkPlaces
} = require('../../utils/mobilityPlaces');

const DEMO_LOCATION = {
  lat: 39.90746,
  lng: 116.39763,
  label: '天安门前的长安大街'
};

function distanceText(distance) {
  const value = Number(distance);
  if (!Number.isFinite(value)) return '距离待定位';
  if (value >= 1000) return `距离 ${(value / 1000).toFixed(1)} 公里`;
  return `距离 ${Math.max(1, Math.round(value))} 米`;
}

function walkingTimeText(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '步行时间待确认';
  if (value >= 60 && value % 60 === 0) return `预计步行约 ${value / 60} 小时`;
  if (value > 60) return `预计步行约 ${Math.floor(value / 60)} 小时 ${value % 60} 分钟`;
  return `预计步行约 ${value} 分钟`;
}

function normalizePlace(place) {
  const accessibility = place.accessibility || {};
  return {
    ...place,
    accessibility,
    distanceText: distanceText(place.distance),
    walkingTimeText: walkingTimeText(place.walkingTimeMinutes),
    coverUrl: place.coverImage && place.coverImage.url ? place.coverImage.url : '',
    accessibilityLabel: accessibility.label || '无障碍信息待确认',
    accessibilitySummary: accessibility.summary || '建议出发前向景区确认无障碍设施开放情况。',
    accessibilityTone: accessibility.level === 'full' ? 'full' : 'partial'
  };
}

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

function nowText() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

Page({
  data: {
    loading: false,
    locating: false,
    error: '',
    location: DEMO_LOCATION,
    usingRealLocation: false,
    locationLabel: DEMO_LOCATION.label,
    locationSourceText: '演示定位',
    locationUpdatedText: nowText(),
    places: [],
    markers: [],
    accessiblePlaces: [],
    visibleAccessiblePlaces: [],
    shortWalkPlaces: [],
    visibleShortWalkPlaces: [],
    showAccessiblePlaces: false,
    showShortWalkPlaces: false
  },

  onLoad() {
    this.loadPlaces(DEMO_LOCATION);
  },

  async loadPlaces(location) {
    this.setData({ loading: true, error: '' });
    try {
      const payload = await api.listPlaces({
        city: '北京',
        lat: location.lat,
        lng: location.lng
      });
      const places = (payload.places || []).map(normalizePlace);
      const markers = createMarkers(places);
      const accessiblePlaces = sortAccessiblePlaces(places);
      const shortWalkPlaces = sortShortWalkPlaces(places);
      this.setData({
        loading: false,
        places,
        markers,
        accessiblePlaces,
        visibleAccessiblePlaces: this.data.showAccessiblePlaces ? accessiblePlaces : accessiblePlaces.slice(0, 1),
        shortWalkPlaces,
        visibleShortWalkPlaces: this.data.showShortWalkPlaces ? shortWalkPlaces : shortWalkPlaces.slice(0, 1)
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '无障碍景点加载失败' });
    }
  },

  refreshLocation() {
    if (this.data.locating) return;
    this.setData({ locating: true });
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (result) => {
        const location = { lat: result.latitude, lng: result.longitude };
        this.setData({
          locating: false,
          location,
          usingRealLocation: true,
          locationLabel: '真实当前位置',
          locationSourceText: result.accuracy ? `真实定位，精度约 ${Math.round(result.accuracy)} 米` : '真实定位',
          locationUpdatedText: nowText()
        });
        this.loadPlaces(location);
        wx.showToast({ title: '已使用真实定位', icon: 'none' });
      },
      fail: () => {
        this.setData({
          locating: false,
          location: DEMO_LOCATION,
          usingRealLocation: false,
          locationLabel: DEMO_LOCATION.label,
          locationSourceText: '定位未授权，继续使用演示定位',
          locationUpdatedText: nowText()
        });
        this.loadPlaces(DEMO_LOCATION);
        wx.showToast({ title: '无法定位，已使用演示位置', icon: 'none' });
      }
    });
  },

  openPlace(event) {
    nav.openPlace(event.currentTarget.dataset.id);
  },

  onMarkerTap(event) {
    const place = this.data.places[event.detail.markerId];
    if (place) nav.openPlace(place.id);
  },

  openNavigation(event) {
    const id = event.currentTarget.dataset.id;
    const place = this.data.places.find((item) => item.id === id);
    if (place) nav.openLocation(place);
  },

  openAi() {
    nav.openAi({ type: 'mode', mode: 'mobility' });
  },

  openShortRoute() {
    const showShortWalkPlaces = !this.data.showShortWalkPlaces;
    this.setData({
      showShortWalkPlaces,
      visibleShortWalkPlaces: showShortWalkPlaces
        ? this.data.shortWalkPlaces
        : this.data.shortWalkPlaces.slice(0, 1)
    });
    if (showShortWalkPlaces) wx.pageScrollTo({ selector: '#short-routes', duration: 300 });
  },

  openAccessiblePlaces() {
    const showAccessiblePlaces = !this.data.showAccessiblePlaces;
    this.setData({
      showAccessiblePlaces,
      visibleAccessiblePlaces: showAccessiblePlaces
        ? this.data.accessiblePlaces
        : this.data.accessiblePlaces.slice(0, 1)
    });
    if (showAccessiblePlaces) wx.pageScrollTo({ selector: '#accessible-places', duration: 300 });
  },

  changeMode() {
    nav.openModeSelect();
  },

  goTab: nav.goTab
});
