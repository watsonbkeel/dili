const api = require('../../utils/api');

Page({
  data: {
    loading: false,
    error: '',
    place: null,
    location: null,
    story: null
  },

  onLoad() {
    const input = wx.getStorageSync('selectedStoryInput');
    if (!input || !input.place) {
      this.setData({ error: '没有找到选中的地点，请返回首页重新选择。' });
      return;
    }
    this.setData({
      place: input.place,
      location: input.location,
      story: input.story || null
    });
    if (!input.story) {
      this.generate();
    }
  },

  async generate(options = {}) {
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.createStory({
        placeId: this.data.place.id,
        place: this.data.place,
        forceRefresh: Boolean(options.forceRefresh)
      });
      this.setData({
        loading: false,
        story: result.story
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '导览故事生成失败'
      });
    }
  },

  regenerate() {
    this.generate({ forceRefresh: true });
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});
