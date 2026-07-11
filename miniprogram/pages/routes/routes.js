const nav = require('../../utils/navigation');
const routeStore = require('../../utils/routeStore');

const withOrder = routeStore.withOrder;

function blankCandidate(order) {
  return {
    id: '',
    name: '',
    stay: '60 分钟',
    image: '',
    order
  };
}

Page({
  data: {
    routeName: '',
    routeNames: [],
    currentRouteIndex: 0,
    currentRouteId: '',
    editingName: false,
    draftName: '',
    stops: [],
    showAddModal: false,
    showCreateModal: false,
    newRouteName: '',
    candidate: blankCandidate(1),
    sorting: false
  },

  onShow() {
    this.renderState(routeStore.loadState());
    const pending = wx.getStorageSync('pendingRoutePlace');
    if (pending && pending.name) {
      this.setData({
        candidate: {
          id: pending.id || '',
          name: pending.name,
          stay: pending.recommendedDuration || '45 分钟',
          image: pending.image || '',
          lat: pending.lat,
          lng: pending.lng,
          order: this.data.stops.length + 1
        },
        showAddModal: true
      });
      wx.removeStorageSync('pendingRoutePlace');
    }
  },

  renderState(state) {
    this._routeState = routeStore.normalizeState(state);
    const currentRouteIndex = Math.max(
      0,
      this._routeState.routes.findIndex((route) => route.id === this._routeState.currentRouteId)
    );
    const route = this._routeState.routes[currentRouteIndex];
    this.setData({
      routeName: route.name,
      routeNames: this._routeState.routes.map((item) => item.name),
      currentRouteIndex,
      currentRouteId: route.id,
      stops: withOrder(route.stops)
    });
  },

  persistAndRender(state) {
    this.renderState(routeStore.saveState(state));
  },

  noop() {},

  switchRoute(event) {
    const index = Number(event.detail.value);
    const route = this._routeState.routes[index];
    if (!route) return;
    this.persistAndRender({ ...this._routeState, currentRouteId: route.id });
    this.setData({ editingName: false });
  },

  startEditName() {
    this.setData({ editingName: true, draftName: this.data.routeName });
  },

  cancelEditName() {
    this.setData({ editingName: false, draftName: this.data.routeName });
  },

  onNameInput(event) {
    this.setData({ draftName: event.detail.value });
  },

  saveName() {
    const name = this.data.draftName.trim();
    if (!name) {
      wx.showToast({ title: '路线名称不能为空', icon: 'none' });
      return;
    }
    this.persistAndRender(routeStore.renameRoute(this._routeState, this.data.currentRouteId, name));
    this.setData({ editingName: false });
  },

  openCreateModal() {
    this.setData({ showCreateModal: true, newRouteName: `北京路线 ${this._routeState.routes.length + 1}` });
  },

  closeCreateModal() {
    this.setData({ showCreateModal: false, newRouteName: '' });
  },

  onNewRouteName(event) {
    this.setData({ newRouteName: event.detail.value });
  },

  confirmCreateRoute() {
    const name = this.data.newRouteName.trim();
    if (!name) {
      wx.showToast({ title: '请输入路线名称', icon: 'none' });
      return;
    }
    this.persistAndRender(routeStore.addRoute(this._routeState, name));
    this.setData({ showCreateModal: false, newRouteName: '' });
    wx.showToast({ title: '路线已新建', icon: 'none' });
  },

  deleteCurrentRoute() {
    const routeName = this.data.routeName;
    wx.showModal({
      title: '删除路线',
      content: `确定删除“${routeName}”吗？路线中的地点也会一并删除。`,
      confirmText: '删除',
      confirmColor: '#b3261e',
      success: (result) => {
        if (!result.confirm) return;
        this.persistAndRender(routeStore.deleteRoute(this._routeState, this.data.currentRouteId));
        wx.showToast({ title: '路线已删除', icon: 'none' });
      }
    });
  },

  openAddModal() {
    this.setData({
      showAddModal: true,
      candidate: blankCandidate(this.data.stops.length + 1)
    });
  },

  closeAddModal() {
    this.setData({ showAddModal: false });
  },

  onCandidateName(event) {
    this.setData({ 'candidate.name': event.detail.value, 'candidate.id': '' });
  },

  onCandidateStay(event) {
    this.setData({ 'candidate.stay': event.detail.value });
  },

  onCandidateOrder(event) {
    this.setData({ 'candidate.order': Number(event.detail.value) || this.data.stops.length + 1 });
  },

  confirmAdd() {
    const candidate = this.data.candidate;
    if (!candidate.name.trim()) {
      wx.showToast({ title: '请输入地点名称', icon: 'none' });
      return;
    }
    const result = routeStore.addStop(
      this._routeState,
      this.data.currentRouteId,
      candidate,
      candidate.order
    );
    if (!result.added) {
      wx.showToast({ title: result.reason === 'duplicate' ? '该地点已在当前路线中' : '添加失败', icon: 'none' });
      return;
    }
    this.persistAndRender(result.state);
    this.setData({
      showAddModal: false,
      candidate: blankCandidate(this.data.stops.length + 1)
    });
    wx.showToast({ title: '已加入当前路线', icon: 'none' });
  },

  applySmartSort(origin) {
    const stops = routeStore.smartSortStops(this.data.stops, origin);
    this.persistAndRender(routeStore.replaceStops(this._routeState, this.data.currentRouteId, stops));
    this.setData({ sorting: false });
    wx.showToast({ title: '已按重要程度、时长和距离排序', icon: 'none', duration: 2200 });
  },

  smartSort() {
    if (this.data.stops.length < 2 || this.data.sorting) return;
    this.setData({ sorting: true });
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: false,
      success: (location) => this.applySmartSort({ lat: Number(location.latitude), lng: Number(location.longitude) }),
      fail: () => this.applySmartSort(null)
    });
  },

  moveStop(event) {
    const index = Number(event.currentTarget.dataset.index);
    const direction = event.currentTarget.dataset.direction;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= this.data.stops.length) return;
    const stops = [...this.data.stops];
    const temp = stops[index];
    stops[index] = stops[target];
    stops[target] = temp;
    this.persistAndRender(routeStore.replaceStops(this._routeState, this.data.currentRouteId, withOrder(stops)));
  },

  removeStop(event) {
    const index = Number(event.currentTarget.dataset.index);
    const stop = this.data.stops[index];
    if (!stop) return;
    wx.showModal({
      title: '删除地点',
      content: `确定从路线中删除“${stop.name}”吗？`,
      confirmText: '删除',
      confirmColor: '#b3261e',
      success: (result) => {
        if (!result.confirm) return;
        const stops = this.data.stops.filter((_, stopIndex) => stopIndex !== index);
        this.persistAndRender(routeStore.replaceStops(this._routeState, this.data.currentRouteId, withOrder(stops)));
        wx.showToast({ title: '已删除并重新排序', icon: 'none' });
      }
    });
  },

  openStop(event) {
    const id = event.currentTarget.dataset.id;
    if (id && !String(id).startsWith('custom-')) nav.openPlace(id);
  },

  shareRoute() {
    wx.showToast({ title: '请使用右上角分享', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: this.data.routeName,
      path: '/pages/routes/routes'
    };
  },

  goTab: nav.goTab
});
