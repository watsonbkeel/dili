const MODE_KEY = 'lhgUserMode';

const modes = {
  normal: {
    key: 'normal',
    label: '普通用户',
    homeUrl: '/pages/home/home'
  },
  lowVision: {
    key: 'lowVision',
    label: '视力障碍 / 低视力用户',
    homeUrl: '/pages/low-vision-home/low-vision-home'
  },
  mobility: {
    key: 'mobility',
    label: '行动不便用户',
    homeUrl: '/pages/mobility-home/mobility-home'
  }
};

function getMode() {
  const mode = wx.getStorageSync(MODE_KEY);
  return modes[mode] ? mode : '';
}

function setMode(mode) {
  if (!modes[mode]) return '';
  wx.setStorageSync(MODE_KEY, mode);
  return mode;
}

function clearMode() {
  wx.removeStorageSync(MODE_KEY);
}

function homeUrlForMode(mode = getMode()) {
  return (modes[mode] || modes.normal).homeUrl;
}

function labelForMode(mode = getMode()) {
  return (modes[mode] || modes.normal).label;
}

module.exports = {
  clearMode,
  getMode,
  homeUrlForMode,
  labelForMode,
  modes,
  setMode
};
