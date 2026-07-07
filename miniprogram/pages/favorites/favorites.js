const favorites = require('../../utils/favorites');
const nav = require('../../utils/navigation');

function normalize(item) {
  return {
    ...item,
    categoryText: (item.category || []).slice(0, 3).join(' / '),
    savedText: item.savedAt ? item.savedAt.slice(0, 10) : ''
  };
}

Page({
  data: {
    items: []
  },

  onShow() {
    this.loadFavorites();
  },

  loadFavorites() {
    this.setData({ items: favorites.listFavorites().map(normalize) });
  },

  openPlace(event) {
    nav.openPlace(event.currentTarget.dataset.id);
  },

  remove(event) {
    favorites.removeFavorite(event.currentTarget.dataset.id);
    this.loadFavorites();
  },

  goTab: nav.goTab
});
