const preferenceOptions = ['历史故事', '亲子研学', '少步行', '语音讲解'];

function defaultProfile() {
  return wx.getStorageSync('userProfile') || {
    avatar: '',
    nickname: '本地访客',
    city: '北京',
    preferences: ['历史故事', '语音讲解']
  };
}

Page({
  data: {
    profile: defaultProfile(),
    preferenceItems: []
  },

  onLoad() {
    this.syncPreferenceItems();
  },

  syncPreferenceItems() {
    const selected = this.data.profile.preferences || [];
    this.setData({
      preferenceItems: preferenceOptions.map((name) => ({
        name,
        checked: selected.indexOf(name) >= 0
      }))
    });
  },

  onChooseAvatar(event) {
    this.setData({ 'profile.avatar': event.detail.avatarUrl });
  },

  onNicknameInput(event) {
    this.setData({ 'profile.nickname': event.detail.value });
  },

  onCityInput(event) {
    this.setData({ 'profile.city': event.detail.value });
  },

  onPreferencesChange(event) {
    this.setData({ 'profile.preferences': event.detail.value }, () => this.syncPreferenceItems());
  },

  saveProfile() {
    const profile = {
      ...this.data.profile,
      nickname: String(this.data.profile.nickname || '').trim() || '本地访客',
      city: String(this.data.profile.city || '').trim() || '北京'
    };
    wx.setStorageSync('userProfile', profile);
    wx.showToast({ title: '资料已保存', icon: 'none' });
    setTimeout(() => wx.navigateBack(), 300);
  }
});
