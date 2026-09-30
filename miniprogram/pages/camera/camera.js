const nav = require('../../utils/navigation');

const MAX_RECOGNITION_IMAGE_SIDE = 1280;
const RECOGNITION_IMAGE_QUALITY = 45;

function compressForRecognition(image, done) {
  const compress = (dimensions = {}) => {
    wx.compressImage({
      src: image,
      quality: RECOGNITION_IMAGE_QUALITY,
      ...dimensions,
      success: (result) => done(result.tempFilePath || image),
      fail: () => done(image)
    });
  };

  if (typeof wx.getImageInfo !== 'function') {
    compress();
    return;
  }
  wx.getImageInfo({
    src: image,
    success: (info) => {
      const width = Number(info.width) || MAX_RECOGNITION_IMAGE_SIDE;
      const height = Number(info.height) || MAX_RECOGNITION_IMAGE_SIDE;
      const scale = Math.min(1, MAX_RECOGNITION_IMAGE_SIDE / Math.max(width, height));
      compress({
        compressedWidth: Math.max(1, Math.round(width * scale)),
        compressedHeight: Math.max(1, Math.round(height * scale))
      });
    },
    fail: () => compress()
  });
}

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
        compressForRecognition(image, (preparedImage) => this.openRecognition(preparedImage));
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
