App({
  globalData: {
    apiBaseUrl: 'http://175.178.194.44:3000',
    assetBaseUrl: 'https://diary.bkeel.com/uploads/attractions'
  },

  onLaunch() {
    this.ensureUserId();
  },

  ensureUserId() {
    let userId = wx.getStorageSync('lhgUserId');
    if (!userId) {
      userId = `lhg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      wx.setStorageSync('lhgUserId', userId);
    }
    return userId;
  }
});
