const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const INITIAL_DATA = {
  storyCache: {},
  history: []
};

class DataStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, 'store.json');
    this.writeQueue = Promise.resolve();
  }

  async read() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return { ...INITIAL_DATA, ...JSON.parse(raw) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { ...INITIAL_DATA };
    }
  }

  async write(data) {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmpPath = `${this.filePath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
      await fs.rename(tmpPath, this.filePath);
    });
    return this.writeQueue;
  }

  async getStoryCache(cacheKey) {
    const data = await this.read();
    return data.storyCache[cacheKey] || null;
  }

  async setStoryCache(cacheKey, story) {
    const data = await this.read();
    data.storyCache[cacheKey] = {
      ...story,
      cachedAt: new Date().toISOString()
    };
    await this.write(data);
    return data.storyCache[cacheKey];
  }

  async addHistory({ userId, place, coarseLocation, story }) {
    const data = await this.read();
    const record = {
      id: crypto.randomUUID(),
      userId,
      placeId: place.id || place.title || place.name,
      placeName: place.title || place.name,
      address: place.address || '',
      coarseLocation,
      story,
      createdAt: new Date().toISOString()
    };
    data.history.unshift(record);
    data.history = data.history.slice(0, 500);
    await this.write(data);
    return record;
  }

  async listHistory(userId) {
    const data = await this.read();
    return data.history.filter((record) => record.userId === userId);
  }

  async deleteHistory(userId, id) {
    const data = await this.read();
    const originalLength = data.history.length;
    data.history = data.history.filter((record) => !(record.userId === userId && record.id === id));
    await this.write(data);
    return data.history.length !== originalLength;
  }
}

module.exports = { DataStore };
