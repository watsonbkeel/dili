const tabPages = {
  home: '/pages/home/home',
  map: '/pages/map/map',
  routes: '/pages/routes/routes',
  favorites: '/pages/favorites/favorites',
  profile: '/pages/profile/profile'
};

function goTab(event) {
  const key = event.currentTarget.dataset.tab;
  const url = tabPages[key];
  if (!url) return;
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  if (`/${current.route}` === url) return;
  wx.redirectTo({ url });
}

function openAi(context = {}) {
  wx.setStorageSync('aiAssistantContext', context);
  wx.navigateTo({ url: '/pages/assistant/assistant' });
}

function openPlace(id) {
  wx.navigateTo({ url: `/pages/place/place?id=${encodeURIComponent(id)}` });
}

function openLocation(target) {
  if (!target || !target.lat || !target.lng) {
    wx.showToast({ title: '缺少导航坐标', icon: 'none' });
    return;
  }
  wx.openLocation({
    latitude: Number(target.lat),
    longitude: Number(target.lng),
    name: target.name || target.title || '目的地',
    address: target.address || '',
    scale: 16,
    fail() {
      wx.showToast({ title: '地图唤起失败', icon: 'none' });
    }
  });
}

module.exports = {
  goTab,
  openAi,
  openLocation,
  openPlace,
  tabPages
};
