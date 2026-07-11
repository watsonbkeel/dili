const api = require('../../utils/api');
const { createSpeechController } = require('../../utils/speech');
const { frameContainsVoice, transcriptionText } = require('../../utils/voiceInput');
const viewHistory = require('../../utils/viewHistory');

const SILENCE_TIMEOUT_MS = 3000;
const MAX_RECORDING_MS = 30000;
const NAV_ROW_RPX = 104;

function systemInfo() {
  try {
    if (wx.getWindowInfo) return wx.getWindowInfo();
    return wx.getSystemInfoSync();
  } catch {
    return { statusBarHeight: 24 };
  }
}

function textList(values) {
  return (values || []).map((value) => String(value || '').trim()).filter(Boolean);
}

function buildSections(place) {
  const categories = [...textList(place.category), ...textList(place.tags)];
  const timeline = (place.timeline || [])
    .map((item) => [item.year, item.event].filter(Boolean).join('：'))
    .filter(Boolean);
  const sections = [
    {
      title: '地点简介',
      lines: textList([place.summary])
    },
    {
      title: '历史与类型',
      lines: textList([place.period, categories.join('、')])
    },
    {
      title: '重要历史',
      lines: timeline
    },
    {
      title: '现场重点',
      lines: textList(place.highlights)
    },
    {
      title: '参观提示',
      lines: textList(place.visitTips)
    },
    {
      title: '地点位置',
      lines: textList([place.address])
    }
  ];
  return sections.filter((section) => section.lines.length);
}

function introductionText(place, sections) {
  const content = sections
    .map((section) => `${section.title}。${section.lines.join('。')}`)
    .join('。');
  return `${place.name}。${content}`;
}

function plainAnswer(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>~]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Page({
  data: {
    statusBarHeight: systemInfo().statusBarHeight || 24,
    navigationHeight: 76,
    placeId: '',
    place: null,
    sections: [],
    loading: true,
    error: '',
    recording: false,
    processing: false,
    voiceStatus: '点按“问 AI”开始说话',
    question: '',
    answer: '',
    audio: {
      status: 'idle',
      statusText: '介绍尚未播放'
    }
  },

  onLoad(options) {
    const info = systemInfo();
    const statusBarHeight = info.statusBarHeight || 24;
    const navigationHeight = statusBarHeight + Math.round((Number(info.windowWidth) || 375) * NAV_ROW_RPX / 750);
    this.setData({
      placeId: options.id || '',
      statusBarHeight,
      navigationHeight
    });
    this.speech = createSpeechController(this, 'audio');
    this.recorder = wx.getRecorderManager();
    this.bindRecorderEvents();
    this.loadPlace();
  },

  onUnload() {
    this.destroyed = true;
    this.clearSilenceTimer();
    if (this.data.recording && this.recorder) this.recorder.stop();
    this.unbindRecorderEvents();
    if (this.speech) this.speech.destroy();
  },

  async loadPlace() {
    if (!this.data.placeId) {
      this.setData({ loading: false, error: '没有找到这个景点。' });
      return;
    }
    try {
      const payload = await api.getPlace(this.data.placeId);
      const place = payload.place;
      const sections = buildSections(place);
      viewHistory.recordPlaceView(place);
      this.setData({ loading: false, place, sections, error: '' }, () => {
        if (this.speech) this.speech.play(introductionText(place, sections));
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '景点介绍加载失败。' });
    }
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
        voiceStatus: '正在听，请说出你的问题'
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
        this.setData({ processing: false, voiceStatus: '没有获得录音，请再试一次' });
        return;
      }
      this.transcribeAndAsk(result.tempFilePath);
    };
    this.handleRecorderError = (error) => {
      this.clearSilenceTimer();
      this.setData({
        recording: false,
        processing: false,
        voiceStatus: error.errMsg || '录音失败，请检查麦克风权限'
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
    if (now - silenceStartedAt >= SILENCE_TIMEOUT_MS) {
      this.stopRecording('silence');
    }
  },

  toggleVoiceQuestion() {
    if (this.data.processing) return;
    if (this.data.recording) {
      this.stopRecording('manual');
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
            content: '请在设置中允许录音，才能通过语音向 AI 提问。',
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
          fail: () => this.setData({ voiceStatus: '未获得麦克风权限' })
        });
      },
      fail: () => this.startRecording()
    });
  },

  startRecording() {
    if (!this.recorder) return;
    if (this.speech) this.speech.stop();
    this.setData({
      question: '',
      answer: '',
      voiceStatus: '正在打开麦克风'
    });
    this.recordStopReason = '';
    this.recorder.start({
      duration: MAX_RECORDING_MS,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'wav',
      frameSize: 4
    });
  },

  stopRecording(reason) {
    if (!this.recorder || this.stoppingRecording) return;
    this.stoppingRecording = true;
    this.recordStopReason = reason;
    this.clearSilenceTimer();
    this.setData({ voiceStatus: '正在处理语音', processing: true });
    this.recorder.stop();
  },

  async transcribeAndAsk(filePath) {
    try {
      this.setData({ processing: true, voiceStatus: '正在识别你的问题' });
      const transcription = await api.transcribeAudio(filePath);
      const question = transcriptionText(transcription);
      if (!question) {
        this.setData({ processing: false, voiceStatus: '没有识别出文字，请再试一次' });
        return;
      }

      this.setData({ question, voiceStatus: '正在查询历史信息' });
      const response = await api.askAssistant({
        question,
        context: {
          type: 'place',
          id: this.data.placeId,
          mode: 'lowVision'
        }
      });
      const answer = plainAnswer(response.answer);
      this.setData({
        answer,
        processing: false,
        voiceStatus: answer ? 'AI 已回答并开始播报' : 'AI 没有返回内容'
      });
      if (answer && this.speech) this.speech.play(answer);
    } catch (error) {
      const message = error.message || '语音提问失败，请再试一次';
      this.setData({ processing: false, voiceStatus: message });
      if (this.speech) this.speech.play(message);
    }
  },

  goBack() {
    if (this.speech) this.speech.stop();
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({ url: '/pages/low-vision-home/low-vision-home' });
  }
});
