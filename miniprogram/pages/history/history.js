const api = require('../../utils/api');

function createdText(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

Page({
  data: {
    loading: false,
    error: '',
    history: []
  },

  onShow() {
    this.loadHistory();
  },

  async loadHistory() {
    this.setData({ loading: true, error: '' });
    try {
      const payload = await api.listHistory();
      this.setData({
        loading: false,
        history: (payload.history || []).map((record) => ({
          ...record,
          createdText: createdText(record.createdAt)
        }))
      });
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '历史记录加载失败'
      });
    }
  },

  reopen(event) {
    const record = this.data.history[event.currentTarget.dataset.index];
    wx.setStorageSync('selectedStoryInput', {
      place: {
        id: record.placeId,
        title: record.placeName,
        address: record.address
      },
      location: {
        coarse: record.coarseLocation
      },
      story: record.story
    });
    wx.navigateTo({ url: '/pages/story/story' });
  },

  remove(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '删除后无法在历史记录中查看这次讲述。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteHistory(id);
          this.loadHistory();
        } catch (error) {
          wx.showToast({
            title: error.message || '删除失败',
            icon: 'none'
          });
        }
      }
    });
  }
});
