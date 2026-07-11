const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const backendSeed = require('../data/beijing-hotspots.seed.json');
const miniprogramSeed = require('../../miniprogram/data/beijing-hotspots.seed.js');
const imageDir = path.join(root, 'backend', 'public', 'assets', 'images', 'attractions');
const publicImageBase = 'https://dili.bkeel.com/assets/images/attractions';

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += 2 + length;
  }
  return null;
}

test('all Beijing attractions have matching locally hosted landscape JPEG images', () => {
  assert.equal(backendSeed.items.length, 30);
  assert.deepEqual(miniprogramSeed, backendSeed);

  const expectedFiles = backendSeed.items.map((item) => `${item.id}.jpg`).sort();
  const actualFiles = fs.readdirSync(imageDir).filter((file) => file.endsWith('.jpg')).sort();
  assert.deepEqual(actualFiles, expectedFiles);

  backendSeed.items.forEach((item) => {
    const image = item.images?.[0];
    assert.ok(image, `${item.id} is missing images[0]`);
    assert.equal(image.url, `${publicImageBase}/${item.id}.jpg`);
    assert.ok(image.caption, `${item.id} is missing an image caption`);
    assert.ok(image.source, `${item.id} is missing an image source`);
    assert.ok(image.sourceUrl, `${item.id} is missing an image source URL`);
    assert.ok(image.license, `${item.id} is missing image license information`);

    const buffer = fs.readFileSync(path.join(imageDir, `${item.id}.jpg`));
    const size = jpegSize(buffer);
    assert.ok(size, `${item.id}.jpg is not a valid JPEG`);
    assert.ok(buffer.length >= 30 * 1024, `${item.id}.jpg is unexpectedly small`);
    assert.ok(size.width >= 600 && size.height >= 400, `${item.id}.jpg is too small: ${size.width}x${size.height}`);
    assert.ok(size.width > size.height, `${item.id}.jpg is not landscape: ${size.width}x${size.height}`);
  });
});
