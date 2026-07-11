App({
  globalData: {
    apiBaseUrl: 'https://dili.bkeel.com',
    assetBaseUrl: 'https://dili.bkeel.com/assets'
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
