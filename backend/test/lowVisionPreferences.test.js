const test = require('node:test');
const assert = require('node:assert/strict');

const storage = new Map();
global.wx = {
  getStorageSync(key) {
    return storage.get(key);
  },
  setStorageSync(key, value) {
    storage.set(key, value);
  }
};

const preferences = require('../../miniprogram/utils/lowVisionPreferences');

test.beforeEach(() => storage.clear());

test('low-vision font size defaults to large and persists valid choices', () => {
  assert.equal(preferences.getFontSize(), 'large');
  assert.equal(preferences.setFontSize('small'), 'small');
  assert.equal(preferences.getFontSize(), 'small');
  assert.equal(preferences.setFontSize('medium'), 'medium');
  assert.equal(preferences.getFontSize(), 'medium');
});

test('invalid low-vision font sizes fall back to large', () => {
  assert.equal(preferences.setFontSize('huge'), 'large');
  assert.equal(preferences.getFontSize(), 'large');
});
