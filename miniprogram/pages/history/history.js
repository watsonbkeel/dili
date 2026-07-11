const nav = require('../../utils/navigation');
const viewHistory = require('../../utils/viewHistory');

function viewedText(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

Page({
  data: {
    history: []
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    this.setData({
      history: viewHistory.listHistory().map((record) => ({
        ...record,
        viewedText: viewedText(record.viewedAt),
        categoryText: (record.category || []).slice(0, 3).join(' / '),
        coverUrl: record.coverImage && record.coverImage.url ? record.coverImage.url : ''
      }))
    });
  },

  openPlace(event) {
    nav.openPlace(event.currentTarget.dataset.id);
  },

  remove(event) {
    const id = event.currentTarget.dataset.id;
    viewHistory.removeHistory(id);
    this.loadHistory();
  }
});
