const userMode = require('../../utils/userMode');

Page({
  data: {
    leaving: false,
    entered: false
  },

  onEnter() {
    if (this.data.entered) return;
    this.setData({
      leaving: true,
      entered: true
    });

    setTimeout(() => {
      const savedMode = userMode.getMode();
      wx.redirectTo({
        url: savedMode ? userMode.homeUrlForMode(savedMode) : '/pages/mode-select/mode-select'
      });
    }, 1500);
  }
});
