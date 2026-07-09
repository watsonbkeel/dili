const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const { createSpeechController } = require('../../utils/speech');

function distanceText(distance) {
  const value = Number(distance || 0);
  if (!value) return '距离 650 米';
  if (value >= 1000) return `距离 ${(value / 1000).toFixed(1)} 公里`;
  return `距离 ${Math.round(value)} 米`;
}

function briefSummary(place) {
  return place.summary || '适合了解北京历史文化。';
}

Page({
  data: {
    loading: false,
    error: '',
    places: [],
    visiblePlaces: [],
    firstPlace: null,
    audio: {
      status: 'idle',
      statusText: '未播放',
      rate: 1
    }
  },

  onLoad() {
    this.speech = createSpeechController(this, 'audio');
    this.loadPlaces();
  },

  onUnload() {
    if (this.speech) this.speech.destroy();
  },

  async loadPlaces() {
    this.setData({ loading: true, error: '' });
    try {
      const payload = await api.listPlaces({ city: '北京' });
      const places = (payload.places || []).map((place) => ({
        ...place,
        distanceText: distanceText(place.distance),
        briefSummary: briefSummary(place)
      }));
      this.setData({
        loading: false,
        places,
        visiblePlaces: places.slice(0, 3),
        firstPlace: places[0] || null
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '附近景点加载失败'
      });
    }
  },

  listenNearby() {
    const place = this.data.firstPlace;
    if (!place) {
      wx.showToast({ title: this.data.loading ? '景点加载中' : '暂无附近景点', icon: 'none' });
      return;
    }
    this.playIntro({ currentTarget: { dataset: { index: 0 } } });
  },

  stopListening() {
    if (this.speech) this.speech.stop();
  },

  changeMode() {
    wx.navigateTo({ url: '/pages/mode-select/mode-select?force=1' });
  },

  openNearest() {
    const place = this.data.firstPlace;
    if (!place) return;
    nav.openPlace(place.id);
  },

  openAi() {
    nav.openAi({ type: 'mode', mode: 'lowVision' });
  },

  openPlace(event) {
    const place = this.data.places[event.currentTarget.dataset.index];
    if (place) nav.openPlace(place.id);
  },

  playIntro(event) {
    const place = this.data.places[event.currentTarget.dataset.index];
    if (place && this.speech) this.speech.play(`${place.name}。${place.briefSummary}`);
  },

  openNavigation(event) {
    const place = this.data.places[event.currentTarget.dataset.index];
    if (place) nav.openLocation(place);
  }
});
