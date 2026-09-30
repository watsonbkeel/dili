const FONT_SIZE_KEY = 'lhgLowVisionFontSize';
const FONT_SIZES = ['small', 'medium', 'large'];
const DEFAULT_FONT_SIZE = 'large';

function isFontSize(value) {
  return FONT_SIZES.includes(value);
}

function getFontSize() {
  const value = wx.getStorageSync(FONT_SIZE_KEY);
  return isFontSize(value) ? value : DEFAULT_FONT_SIZE;
}

function setFontSize(value) {
  const fontSize = isFontSize(value) ? value : DEFAULT_FONT_SIZE;
  wx.setStorageSync(FONT_SIZE_KEY, fontSize);
  return fontSize;
}

module.exports = {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_KEY,
  FONT_SIZES,
  getFontSize,
  isFontSize,
  setFontSize
};
