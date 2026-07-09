const userMode = require('../../utils/userMode');

Page({
  onLoad(options) {
    const savedMode = userMode.getMode();
    if (savedMode && options.force !== '1') {
      wx.redirectTo({
        url: userMode.homeUrlForMode(savedMode)
      });
    }
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    userMode.setMode(mode);
    wx.redirectTo({
      url: userMode.homeUrlForMode(mode)
    });
  }
});
