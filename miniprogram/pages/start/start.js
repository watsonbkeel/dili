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
      wx.redirectTo({
        url: '/pages/home/home'
      });
    }, 1500);
  }
});
