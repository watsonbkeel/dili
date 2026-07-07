const api = require('../../utils/api');
const { createSpeechController } = require('../../utils/speech');

const quickQuestions = [
  '故宫的历史背景是什么？',
  '推荐一条适合亲子游的路线',
  '天坛的建筑有什么特点？',
  '什刹海周边有哪些值得去的地方？'
];

const popularRecommendations = [
  {
    title: '历史故事',
    question: '给我讲一个附近或当前地点相关的历史故事'
  },
  {
    title: '建筑特色',
    question: '当前地点或北京历史建筑有哪些建筑特色？'
  },
  {
    title: '文化体验',
    question: '附近有哪些适合体验北京历史文化的地方？'
  }
];

Page({
  data: {
    input: '',
    loading: false,
    error: '',
    context: {},
    quickQuestions,
    popularRecommendations,
    messages: [
      {
        role: 'assistant',
        content: '你好！我是你的历史旅行助手。我可以为你介绍景点历史、推荐路线和解答疑问。'
      }
    ],
    audio: {
      status: 'idle',
      statusText: '未播放'
    }
  },

  onLoad() {
    this.speech = createSpeechController(this, 'audio');
    this.setData({ context: wx.getStorageSync('aiAssistantContext') || {} });
  },

  onUnload() {
    if (this.speech) this.speech.destroy();
  },

  onInput(event) {
    this.setData({ input: event.detail.value });
  },

  askQuick(event) {
    const text = event.currentTarget.dataset.text;
    this.setData({ input: text });
    this.send();
  },

  askPopular(event) {
    const text = event.currentTarget.dataset.question;
    this.setData({ input: text }, () => {
      this.send();
    });
  },

  async send() {
    const question = this.data.input.trim();
    if (!question) {
      wx.showToast({ title: '请输入问题', icon: 'none' });
      return;
    }
    const messages = [...this.data.messages, { role: 'user', content: question }];
    this.setData({ messages, input: '', loading: true, error: '' });
    try {
      const payload = await api.askAssistant({
        question,
        context: this.data.context
      });
      this.setData({
        loading: false,
        messages: [...messages, { role: 'assistant', content: payload.answer }]
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || 'AI 回复失败'
      });
    }
  },

  playAnswer(event) {
    const index = event.currentTarget.dataset.index;
    const message = this.data.messages[index];
    if (this.speech) this.speech.play(message && message.content);
  },

  pauseAudio() {
    if (this.speech) this.speech.pause();
  },

  resumeAudio() {
    if (this.speech) this.speech.resume();
  },

  stopAudio() {
    if (this.speech) this.speech.stop();
  }
});
