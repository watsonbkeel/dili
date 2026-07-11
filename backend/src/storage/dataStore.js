const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const INITIAL_DATA = {
  storyCache: {},
  history: [],
  assistantRecords: [],
  placeReactions: {}
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
      await this.writeFile(data);
    });
    return this.writeQueue;
  }

  async writeFile(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, this.filePath);
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

  async addAssistantRecord({ userId, question, answer, source, context }) {
    const data = await this.read();
    const record = {
      id: crypto.randomUUID(),
      userId,
      question: String(question || ''),
      answer: String(answer || ''),
      source: source || 'unknown',
      context: context || {},
      createdAt: new Date().toISOString()
    };
    data.assistantRecords.unshift(record);
    data.assistantRecords = data.assistantRecords.slice(0, 500);
    await this.write(data);
    return record;
  }

  async listAssistantRecords(userId) {
    const data = await this.read();
    return data.assistantRecords.filter((record) => record.userId === userId);
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

  async getPlaceReactions(placeId) {
    const data = await this.read();
    const counts = data.placeReactions[placeId] || {};
    return {
      recommend: Math.max(0, Number(counts.recommend) || 0),
      notRecommend: Math.max(0, Number(counts.notRecommend) || 0)
    };
  }

  async updatePlaceReaction(placeId, previous, reaction) {
    let result;
    this.writeQueue = this.writeQueue.then(async () => {
      const data = await this.read();
      data.placeReactions = { ...(data.placeReactions || {}) };
      const current = data.placeReactions[placeId] || {};
      const counts = {
        recommend: Math.max(0, Number(current.recommend) || 0),
        notRecommend: Math.max(0, Number(current.notRecommend) || 0)
      };
      if (previous && previous !== reaction) counts[previous] = Math.max(0, counts[previous] - 1);
      if (reaction && reaction !== previous) counts[reaction] += 1;
      data.placeReactions[placeId] = {
        ...counts,
        updatedAt: new Date().toISOString()
      };
      await this.writeFile(data);
      result = counts;
    });
    await this.writeQueue;
    return result;
  }
}

module.exports = { DataStore };
