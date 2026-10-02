const test = require('node:test');
const assert = require('node:assert/strict');

// 离线 mock：模拟小程序 wx 与 WechatSI 插件，不访问网络、不产生计费
function setupMiniProgram({ failPlayFor = () => false, failSynthesisFor = () => false } = {}) {
  const audios = [];
  const synthesized = [];
  const toasts = [];

  global.wx = {
    createInnerAudioContext() {
      const handlers = {};
      const audio = {
        src: '',
        playbackRate: 1,
        destroyed: false,
        onPlay: (fn) => { handlers.play = fn; },
        onPause: (fn) => { handlers.pause = fn; },
        onEnded: (fn) => { handlers.ended = fn; },
        onError: (fn) => { handlers.error = fn; },
        play() {
          if (this.destroyed) return;
          const src = this.src;
          setImmediate(() => {
            if (this.destroyed) return;
            if (failPlayFor(src)) {
              handlers.error && handlers.error({ errCode: 10001, errMsg: 'mock play error' });
              return;
            }
            handlers.play && handlers.play();
            setImmediate(() => {
              if (!this.destroyed) handlers.ended && handlers.ended();
            });
          });
        },
        pause() {},
        stop() {},
        destroy() { this.destroyed = true; }
      };
      audios.push(audio);
      return audio;
    },
    showToast(options) { toasts.push(options.title); },
    getRealtimeLogManager() {
      return { info() {}, warn() {}, error() {} };
    }
  };

  global.requirePlugin = () => ({
    textToSpeech({ content, success, fail }) {
      synthesized.push(content);
      setImmediate(() => {
        if (failSynthesisFor(content)) {
          fail({ retcode: -1, msg: 'mock synth error' });
          return;
        }
        success({ filename: `tts://${content}` });
      });
    }
  });

  const speechPath = require.resolve('../../miniprogram/utils/speech');
  const loggerPath = require.resolve('../../miniprogram/utils/logger');
  delete require.cache[speechPath];
  delete require.cache[loggerPath];
  const speech = require('../../miniprogram/utils/speech');

  const page = {
    data: { audio: {} },
    setData(patch) { Object.assign(this.data, patch); }
  };

  return { speech, page, audios, synthesized, toasts };
}

function waitFor(predicate, timeoutMs = 2000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('timeout'));
      setImmediate(tick);
    };
    tick();
  });
}

test.afterEach(() => {
  delete global.wx;
  delete global.requirePlugin;
});

test('speech text never keeps "年份：" which makes the TTS audio fail', () => {
  const { speech } = setupMiniProgram();
  const text = speech.normalizeSpeechText('重要历史。1406：明成祖朱棣开始营建北京宫城。1420:紫禁城基本建成。');
  assert.equal(text, '重要历史。1406年，明成祖朱棣开始营建北京宫城。1420年，紫禁城基本建成。');
  assert.doesNotMatch(text, /[：:]/);
});

test('speech text converts clock times and remaining colons, and merges duplicate punctuation', () => {
  const { speech } = setupMiniProgram();
  assert.equal(speech.normalizeSpeechText('开放时间：8:30-17:00'), '开放时间，8点30分-17点00分');
  assert.equal(speech.normalizeSpeechText('明清。。古建筑；。故宫，。'), '明清。古建筑。故宫。');
  assert.equal(speech.normalizeSpeechText('来源：北京故宫景点详情'), '来源，北京故宫景点详情');
});

test('every seeded place introduction is free of colons after speech normalization', () => {
  const { speech } = setupMiniProgram();
  const { items } = require('../data/beijing-hotspots.seed.json');
  items.forEach((place) => {
    const timeline = (place.timeline || []).map((item) => `${item.year}：${item.event}`);
    const raw = [place.name, place.summary, place.period, ...timeline, ...(place.highlights || []), ...(place.visitTips || []), place.address]
      .filter(Boolean)
      .join('。');
    const chunks = speech.splitSpeechText(raw);
    assert.ok(chunks.length > 0, place.id);
    chunks.forEach((chunk) => {
      assert.doesNotMatch(chunk, /[：:]/, `${place.id}: ${chunk}`);
      assert.ok(chunk.length <= 90, `${place.id} chunk too long`);
    });
  });
});

test('seed data contains no developer notes that would be read aloud to visitors', () => {
  const { items } = require('../data/beijing-hotspots.seed.json');
  const devNote = /详情页|列表页|后端|字段|检索词|上线|marker|地图点|地图热点|AI 导览|AI 讲解|导览文案|热点/;
  items.forEach((place) => {
    [...(place.highlights || []), ...(place.visitTips || [])].forEach((line) => {
      assert.doesNotMatch(line, devNote, `${place.id}: ${line}`);
    });
  });
  const local = require('../../miniprogram/data/beijing-hotspots.seed.js');
  assert.deepEqual(local.items, items, 'mini program local copy must match server seed');
});

test('a failing segment is retried once, then skipped so the rest of the introduction still plays', async () => {
  const { speech, page, synthesized } = setupMiniProgram({
    failPlayFor: (src) => src.includes('第二段')
  });
  const controller = speech.createSpeechController(page, 'audio');
  controller.play('第一段内容。'.repeat(15) + '第二段内容。'.repeat(15) + '第三段内容。'.repeat(15));

  await waitFor(() => /播放完成/.test(page.data.audio.statusText || ''));
  const second = synthesized.filter((content) => content.includes('第二段'));
  assert.equal(second.length, 2, 'second segment synthesized twice (original + retry)');
  assert.ok(synthesized.some((content) => content.includes('第三段')), 'third segment still plays');
  assert.equal(page.data.audio.status, 'idle');
  assert.match(page.data.audio.statusText, /1 段未能播放/);
});

test('a segment that fails once and succeeds on retry plays normally', async () => {
  let failures = 0;
  const { speech, page } = setupMiniProgram({
    failPlayFor: (src) => src.includes('第二段') && failures++ === 0
  });
  const controller = speech.createSpeechController(page, 'audio');
  controller.play('第一段内容。'.repeat(15) + '第二段内容。'.repeat(15));

  await waitFor(() => page.data.audio.statusText === '播放完成');
  assert.equal(failures, 2);
});

test('each segment uses a fresh audio player and old players are destroyed', async () => {
  const { speech, page, audios } = setupMiniProgram();
  const controller = speech.createSpeechController(page, 'audio');
  controller.play('第一段内容。'.repeat(15) + '第二段内容。'.repeat(15));

  await waitFor(() => page.data.audio.statusText === '播放完成');
  assert.equal(audios.length, 2);
  assert.ok(audios.every((audio) => audio.destroyed));
});

test('reports failure only when every segment fails', async () => {
  const { speech, page, toasts } = setupMiniProgram({ failSynthesisFor: () => true });
  const controller = speech.createSpeechController(page, 'audio');
  controller.play('只有一段。');

  await waitFor(() => page.data.audio.status === 'failed');
  assert.equal(page.data.audio.statusText, '语音生成失败');
  assert.deepEqual(toasts, ['语音播放失败']);
});

test('stopAndRelease stops playback and waits before the recorder starts', async () => {
  const { speech, page, audios } = setupMiniProgram();
  const controller = speech.createSpeechController(page, 'audio');
  controller.play('第一段内容。'.repeat(15) + '第二段内容。'.repeat(15));
  await waitFor(() => audios.length === 1);

  const started = Date.now();
  await controller.stopAndRelease();
  assert.ok(Date.now() - started >= speech.AUDIO_RELEASE_MS - 20);
  assert.equal(page.data.audio.statusText, '语音已停止');
  assert.ok(audios[0].destroyed);
});
