const api = require('../../utils/api');
const nav = require('../../utils/navigation');
const { createSpeechController } = require('../../utils/speech');
const { getFallbackPlaces, preparePlaces } = require('../../utils/placeList');
const { matchPlaces } = require('../../utils/placeSearch');
const { frameContainsVoice, transcriptionText } = require('../../utils/voiceInput');

const initialPlaces = getFallbackPlaces();
const HEADER_HEIGHT_RPX = 116;
const SILENCE_TIMEOUT_MS = 3000;
const MAX_RECORDING_MS = 60000;

function systemInfo() {
  try {
    if (wx.getWindowInfo) return wx.getWindowInfo();
    return wx.getSystemInfoSync();
  } catch {
    return { statusBarHeight: 24, windowWidth: 375 };
  }
}

function headerMetrics() {
  const info = systemInfo();
  const statusBarHeight = info.statusBarHeight || 24;
  let headerTopPadding = statusBarHeight + 40;
  try {
    const menuButton = wx.getMenuButtonBoundingClientRect();
    if (menuButton && menuButton.bottom) headerTopPadding = menuButton.bottom + 6;
  } catch {
    // Use the status-bar fallback when the menu button API is unavailable.
  }
  const headerHeight =
    headerTopPadding + Math.round((Number(info.windowWidth) || 375) * HEADER_HEIGHT_RPX / 750);
  return { headerTopPadding, headerHeight };
}

function nearbyPlace(places) {
  const place = places[1] || places[0];
  if (!place) return null;
  return {
    ...place,
    routeNote: '少台阶路线'
  };
}

Page({
  data: {
    headerTopPadding: headerMetrics().headerTopPadding,
    headerHeight: 82,
    loading: false,
    error: '',
    places: initialPlaces,
    visiblePlaces: initialPlaces,
    firstPlace: initialPlaces[0] || null,
    nearbyPlace: nearbyPlace(initialPlaces),
    recording: false,
    processing: false,
    searchStatus: '点击开始说出你想找的景点',
    searchQuery: '',
    searchResultTitle: '',
    searchResults: [],
    audio: {
      status: 'idle',
      statusText: '未播放',
      rate: 1
    }
  },

  onLoad() {
    this.setData(headerMetrics());
    this.speech = createSpeechController(this, 'audio');
    this.recorder = wx.getRecorderManager();
    this.bindRecorderEvents();
    this.loadPlaces();
  },

  onUnload() {
    this.destroyed = true;
    this.clearSilenceTimer();
    if (this.data.recording && this.recorder) this.recorder.stop();
    this.unbindRecorderEvents();
    if (this.speech) this.speech.destroy();
  },

  async loadPlaces() {
    this.setData({ loading: true, error: '' });
    try {
      const payload = await api.listPlaces({ city: '北京' });
      const places = preparePlaces(payload.places);
      this.setData({
        loading: false,
        places,
        visiblePlaces: places,
        firstPlace: places[0] || null,
        nearbyPlace: nearbyPlace(places)
      });
    } catch (error) {
      const places = getFallbackPlaces();
      this.setData({
        loading: false,
        error: '',
        places,
        visiblePlaces: places,
        firstPlace: places[0] || null,
        nearbyPlace: nearbyPlace(places)
      });
    }
  },

  changeMode() {
    nav.openModeSelect();
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
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/low-vision-place/low-vision-place?id=${encodeURIComponent(id)}` });
  },

  playIntro(event) {
    const id = event.currentTarget.dataset.id;
    const place = this.data.places.find((item) => item.id === id);
    if (place && this.speech) this.speech.play(`${place.name}。${place.briefSummary}`);
  },

  openNavigation(event) {
    const id = event.currentTarget.dataset.id;
    const place = this.data.places.find((item) => item.id === id);
    if (place) nav.openLocation(place);
  },

  bindRecorderEvents() {
    this.handleRecorderStart = () => {
      this.recordStartedAt = Date.now();
      this.lastVoiceAt = this.recordStartedAt;
      this.voiceDetected = false;
      this.stoppingRecording = false;
      this.setData({
        recording: true,
        processing: false,
        searchStatus: '正在听，请说出你想找的景点'
      });
      this.silenceTimer = setInterval(() => this.checkSilence(), 250);
    };
    this.handleRecorderFrame = (event) => {
      if (!this.data.recording) return;
      if (frameContainsVoice(event.frameBuffer)) {
        this.voiceDetected = true;
        this.lastVoiceAt = Date.now();
      }
    };
    this.handleRecorderStop = (result) => {
      this.clearSilenceTimer();
      if (this.destroyed) return;
      this.setData({ recording: false });
      if (!result.tempFilePath) {
        this.setData({ processing: false, searchStatus: '没有获得录音，请再试一次' });
        return;
      }
      this.transcribeAndSearch(result.tempFilePath);
    };
    this.handleRecorderError = (error) => {
      this.clearSilenceTimer();
      this.setData({
        recording: false,
        processing: false,
        searchStatus: error.errMsg || '录音失败，请检查麦克风权限'
      });
    };
    this.recorder.onStart(this.handleRecorderStart);
    this.recorder.onFrameRecorded(this.handleRecorderFrame);
    this.recorder.onStop(this.handleRecorderStop);
    this.recorder.onError(this.handleRecorderError);
  },

  unbindRecorderEvents() {
    if (!this.recorder) return;
    if (this.recorder.offStart) this.recorder.offStart(this.handleRecorderStart);
    if (this.recorder.offFrameRecorded) this.recorder.offFrameRecorded(this.handleRecorderFrame);
    if (this.recorder.offStop) this.recorder.offStop(this.handleRecorderStop);
    if (this.recorder.offError) this.recorder.offError(this.handleRecorderError);
  },

  clearSilenceTimer() {
    if (!this.silenceTimer) return;
    clearInterval(this.silenceTimer);
    this.silenceTimer = null;
  },

  checkSilence() {
    if (!this.data.recording || this.stoppingRecording) return;
    const now = Date.now();
    const silenceStartedAt = this.voiceDetected ? this.lastVoiceAt : this.recordStartedAt;
    if (now - silenceStartedAt >= SILENCE_TIMEOUT_MS) this.stopRecording();
  },

  toggleVoiceSearch() {
    if (this.data.processing) return;
    if (this.data.recording) {
      this.stopRecording();
      return;
    }
    this.requestRecordPermission();
  },

  requestRecordPermission() {
    wx.getSetting({
      success: (settings) => {
        if (settings.authSetting['scope.record'] === false) {
          wx.showModal({
            title: '需要麦克风权限',
            content: '请在设置中允许录音，才能使用语音搜索景点。',
            confirmText: '去设置',
            success: (result) => {
              if (result.confirm) wx.openSetting();
            }
          });
          return;
        }
        if (settings.authSetting['scope.record']) {
          this.startRecording();
          return;
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => this.startRecording(),
          fail: () => this.setData({ searchStatus: '未获得麦克风权限' })
        });
      },
      fail: () => this.startRecording()
    });
  },

  startRecording() {
    if (!this.recorder) return;
    if (this.speech) this.speech.stop();
    this.setData({
      searchQuery: '',
      searchResultTitle: '',
      searchResults: [],
      searchStatus: '正在打开麦克风'
    });
    this.recorder.start({
      duration: MAX_RECORDING_MS,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'wav',
      frameSize: 4
    });
  },

  stopRecording() {
    if (!this.recorder || this.stoppingRecording) return;
    this.stoppingRecording = true;
    this.clearSilenceTimer();
    this.setData({ searchStatus: '正在处理语音', processing: true });
    this.recorder.stop();
  },

  async transcribeAndSearch(filePath) {
    try {
      this.setData({ processing: true, searchStatus: '正在识别你说的景点' });
      const transcription = await api.transcribeAudio(filePath);
      const query = transcriptionText(transcription);
      if (!query) {
        this.setData({ processing: false, searchStatus: '没有识别出文字，请再试一次' });
        return;
      }

      const match = matchPlaces(query, this.data.places, { limit: 6 });
      const title = match.mode === 'exact' ? '找到以下景点' : '为你找到相似景点';
      const resultNames = match.results.map((place) => place.name).join('、');
      const status = match.results.length ? `共找到 ${match.results.length} 个景点` : '没有找到相关景点，请换一种说法';
      this.setData(
        {
          processing: false,
          searchQuery: query,
          searchResultTitle: match.results.length ? title : '',
          searchResults: match.results,
          searchStatus: status
        },
        () => {
          if (match.results.length && wx.pageScrollTo) {
            wx.pageScrollTo({ selector: '#voice-search-results', duration: 300 });
          }
        }
      );
      if (this.speech) {
        this.speech.play(match.results.length ? `${status}。${resultNames}` : status);
      }
    } catch (error) {
      const message = error.message || '语音搜索失败，请再试一次';
      this.setData({ processing: false, searchStatus: message });
      if (this.speech) this.speech.play(message);
    }
  }
});
