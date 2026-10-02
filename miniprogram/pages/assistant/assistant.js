const api = require('../../utils/api');
const { presentationForContext } = require('../../utils/assistantContext');
const { createSpeechController } = require('../../utils/speech');
const {
  RECORDER_RETRY_DELAY_MS,
  frameContainsVoice,
  isStartRecordFailure,
  recorderErrorMessage,
  transcriptionText
} = require('../../utils/voiceInput');
const logger = require('../../utils/logger');

const SILENCE_TIMEOUT_MS = 3000;
const MAX_RECORDING_MS = 60000;

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
    input: '',
    inputMode: 'text',
    loading: false,
    contextLoading: false,
    error: '',
    context: {},
    sourceText: '来源：北京导览首页',
    focusTitle: '正在了解：北京历史旅行',
    focusDescription: '',
    quickQuestions: [],
    popularRecommendations: [],
    recording: false,
    processingVoice: false,
    voiceStatus: '点击开始说出你的问题',
    messages: [],
    audioMessageIndex: -1,
    audio: {
      status: 'idle',
      statusText: '未播放'
    }
  },

  onLoad() {
    const context = wx.getStorageSync('aiAssistantContext') || {};
    this.speech = createSpeechController(this, 'audio');
    this.recorder = wx.getRecorderManager();
    this.bindRecorderEvents();
    this.applyContext(context);
  },

  onUnload() {
    this.destroyed = true;
    this.clearSilenceTimer();
    if (this.data.recording && this.recorder) this.recorder.stop();
    this.unbindRecorderEvents();
    if (this.speech) this.speech.destroy();
  },

  async applyContext(context) {
    let place = null;
    this.setData({ context, contextLoading: context.type === 'place' && Boolean(context.id) });
    if (context.type === 'place' && context.id) {
      try {
        const payload = await api.getPlace(context.id);
        place = payload.place;
        context = {
          ...context,
          name: place.name,
          summary: place.summary
        };
      } catch {
        // The backend can still resolve the place ID when answering.
      }
    }

    const presentation = presentationForContext(context, place);
    this.setData({
      context,
      contextLoading: false,
      sourceText: presentation.sourceText,
      focusTitle: presentation.focusTitle,
      focusDescription: presentation.focusDescription,
      quickQuestions: presentation.quickQuestions,
      popularRecommendations: presentation.popularRecommendations,
      messages: [{ role: 'assistant', content: presentation.greeting }],
      audioMessageIndex: -1
    });
  },

  onInput(event) {
    this.setData({ input: event.detail.value });
  },

  toggleInputMode() {
    if (this.data.recording || this.data.processingVoice) return;
    const inputMode = this.data.inputMode === 'voice' ? 'text' : 'voice';
    this.setData({
      inputMode,
      voiceStatus: inputMode === 'voice' ? '点击开始说出你的问题' : this.data.voiceStatus
    });
  },

  askQuick(event) {
    this.sendQuestion(event.currentTarget.dataset.text);
  },

  askPopular(event) {
    this.sendQuestion(event.currentTarget.dataset.question);
  },

  send() {
    this.sendQuestion(this.data.input);
  },

  async sendQuestion(value, options = {}) {
    const question = String(value || '').trim();
    if (!question) {
      wx.showToast({ title: this.data.inputMode === 'voice' ? '请先说出问题' : '请输入问题', icon: 'none' });
      return;
    }
    if (this.data.loading) return;

    const messages = [...this.data.messages, { role: 'user', content: question }];
    this.setData({
      messages,
      input: '',
      loading: true,
      error: '',
      voiceStatus: options.fromVoice ? '正在查询相关信息' : this.data.voiceStatus
    });
    try {
      const payload = await api.askAssistant({
        question,
        context: this.data.context
      });
      const answer = plainAnswer(payload.answer);
      const answerIndex = messages.length;
      const nextData = {
        loading: false,
        processingVoice: false,
        voiceStatus: options.fromVoice ? 'AI 已回答并开始播报' : this.data.voiceStatus,
        messages: [...messages, { role: 'assistant', content: answer }]
      };
      if (options.fromVoice) nextData.audioMessageIndex = answerIndex;
      this.setData(nextData);
      if (options.fromVoice && answer && this.speech) this.speech.play(answer);
    } catch (error) {
      const message = error.message || 'AI 回复失败';
      this.setData({
        loading: false,
        processingVoice: false,
        voiceStatus: options.fromVoice ? message : this.data.voiceStatus,
        error: message
      });
    }
  },

  bindRecorderEvents() {
    this.handleRecorderStart = () => {
      this.startingRecording = false;
      this.recordStartedAt = Date.now();
      this.lastVoiceAt = this.recordStartedAt;
      this.voiceDetected = false;
      this.stoppingRecording = false;
      this.setData({
        recording: true,
        processingVoice: false,
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
      this.startingRecording = false;
      this.clearSilenceTimer();
      if (this.destroyed) return;
      this.setData({ recording: false });
      if (!result || !result.tempFilePath) {
        this.setData({ processingVoice: false, voiceStatus: '没有获得录音，请再试一次' });
        return;
      }
      this.transcribeAndSend(result.tempFilePath);
    };
    this.handleRecorderError = (error) => {
      this.clearSilenceTimer();
      logger.error('Recorder error', {
        page: 'assistant',
        errMsg: error && error.errMsg,
        retried: Boolean(this.recordRetried)
      });
      if (this.destroyed) return;
      // 麦克风/音频会话被占用导致启动失败：稍等后自动重试一次
      if (!this.data.recording && !this.recordRetried && isStartRecordFailure(error)) {
        this.recordRetried = true;
        this.setData({ voiceStatus: '正在重新打开麦克风' });
        setTimeout(() => {
          if (!this.destroyed) this.launchRecorder();
        }, RECORDER_RETRY_DELAY_MS);
        return;
      }
      this.startingRecording = false;
      this.setData({
        recording: false,
        processingVoice: false,
        voiceStatus: recorderErrorMessage(error)
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
    const silenceStartedAt = this.voiceDetected ? this.lastVoiceAt : this.recordStartedAt;
    if (Date.now() - silenceStartedAt >= SILENCE_TIMEOUT_MS) this.stopRecording();
  },

  toggleVoiceInput() {
    if (this.data.processingVoice || this.data.loading || this.startingRecording) return;
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
    if (!this.recorder || this.startingRecording) return;
    this.startingRecording = true;
    this.recordRetried = false;
    this.setData({ input: '', error: '', voiceStatus: '正在打开麦克风' });
    // 先停止播报并等待系统释放音频，再开始录音，避免 start record fail
    const ready = this.speech ? this.speech.stopAndRelease() : Promise.resolve();
    ready.then(() => {
      if (!this.destroyed) this.launchRecorder();
    });
  },

  launchRecorder() {
    try {
      this.recorder.start({
        duration: MAX_RECORDING_MS,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'wav',
        audioSource: 'auto',
        frameSize: 5
      });
    } catch (error) {
      this.handleRecorderError(error);
    }
  },

  stopRecording() {
    if (!this.recorder || this.stoppingRecording) return;
    this.stoppingRecording = true;
    this.clearSilenceTimer();
    this.setData({ voiceStatus: '正在处理语音', processingVoice: true });
    this.recorder.stop();
  },

  async transcribeAndSend(filePath) {
    try {
      this.setData({ processingVoice: true, voiceStatus: '正在识别你的问题' });
      const transcription = await api.transcribeAudio(filePath);
      const question = transcriptionText(transcription);
      if (!question) {
        this.setData({ processingVoice: false, voiceStatus: '没有识别出文字，请再试一次' });
        return;
      }
      this.setData({ input: question });
      await this.sendQuestion(question, { fromVoice: true });
    } catch (error) {
      this.setData({
        processingVoice: false,
        voiceStatus: error.message || '语音识别失败，请再试一次'
      });
    }
  },

  toggleMessageAudio(event) {
    if (!this.speech) return;
    const index = Number(event.currentTarget.dataset.index);
    const message = this.data.messages[index];
    if (!message || message.role !== 'assistant') return;
    const status = this.data.audio && this.data.audio.status;
    const isCurrentMessage = this.data.audioMessageIndex === index;
    if (isCurrentMessage && status === 'loading') return;
    if (isCurrentMessage && status === 'playing') {
      this.speech.pause();
      return;
    }
    if (isCurrentMessage && status === 'paused') {
      this.speech.resume();
      return;
    }
    this.setData({ audioMessageIndex: index });
    this.speech.play(message.content);
  }
});
