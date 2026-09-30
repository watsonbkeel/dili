const userMode = require('../../utils/userMode');

Page({
  data: {
    contentTop: 72,
    pageReady: false
  },

  onLoad(options) {
    const savedMode = userMode.getMode();
    if (savedMode && options.force !== '1') {
      wx.reLaunch({
        url: userMode.homeUrlForMode(savedMode)
      });
      return;
    }
    this.setData({ pageReady: true });
    this.setContentTop();
  },

  setContentTop() {
    if (typeof wx.getMenuButtonBoundingClientRect !== 'function') return;
    const capsule = wx.getMenuButtonBoundingClientRect();
    if (capsule && Number.isFinite(capsule.bottom)) {
      this.setData({ contentTop: capsule.bottom + 12 });
    }
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    userMode.setMode(mode);
    wx.reLaunch({
      url: userMode.homeUrlForMode(mode)
    });
  }
});
