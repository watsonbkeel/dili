const nav = require('../../utils/navigation');

Page({
  data: {
    tips: ['匾额', '雕刻', '建筑轮廓', '展品说明牌'],
    choosing: false
  },

  chooseSource(event) {
    if (this.data.choosing) return;
    const sourceType = event.currentTarget.dataset.source;
    this.setData({ choosing: true });
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: [sourceType],
      success: (res) => {
        const image = res.tempFilePaths && res.tempFilePaths[0];
        if (!image) {
          this.setData({ choosing: false });
          return;
        }
        wx.compressImage({
          src: image,
          quality: 55,
          success: (compressed) => this.openRecognition(compressed.tempFilePath || image),
          fail: () => this.openRecognition(image)
        });
      },
      fail: () => {
        this.setData({ choosing: false });
        wx.showToast({ title: '未选择图片', icon: 'none' });
      }
    });
  },

  openRecognition(image) {
    wx.getLocation({
      type: 'gcj02',
      success: (location) => this.navigateToRecognition(image, location),
      fail: () => {
        wx.showToast({ title: '未获取定位，将仅识别图片', icon: 'none' });
        this.navigateToRecognition(image, null);
      }
    });
  },

  navigateToRecognition(image, location) {
    this.setData({ choosing: false });
    const locationQuery = location
      ? `&lat=${encodeURIComponent(location.latitude)}&lng=${encodeURIComponent(location.longitude)}&accuracy=${encodeURIComponent(location.accuracy || '')}`
      : '';
    wx.navigateTo({
      url: `/pages/recognition-result/recognition-result?image=${encodeURIComponent(image)}${locationQuery}`
    });
  },

  goTab: nav.goTab
});
