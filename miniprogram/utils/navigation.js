const userMode = require('./userMode');

const tabPages = {
  home: '/pages/home/home',
  camera: '/pages/camera/camera',
  routes: '/pages/routes/routes',
  profile: '/pages/profile/profile'
};

function goTab(event) {
  const key = event.currentTarget.dataset.tab;
  if (key === 'home') {
    goHome();
    return;
  }
  const url = tabPages[key];
  if (!url) return;
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  if (`/${current.route}` === url) return;
  wx.redirectTo({ url });
}

function goHome(mode = userMode.getMode()) {
  const url = userMode.homeUrlForMode(mode);
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  if (current && `/${current.route}` === url) return;
  wx.reLaunch({ url });
}

function openAi(context = {}) {
  wx.setStorageSync('aiAssistantContext', context);
  wx.navigateTo({ url: '/pages/assistant/assistant' });
}

function openModeSelect() {
  wx.redirectTo({ url: '/pages/mode-select/mode-select?force=1' });
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
  goHome,
  goTab,
  openAi,
  openLocation,
  openModeSelect,
  openPlace,
  tabPages
};
