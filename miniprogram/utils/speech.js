const logger = require('./logger');

const MAX_TTS_CHARS = 90;
// 每段失败后重新合成并重试的次数；仍失败则跳到下一段，不让整篇播报中断
const MAX_SEGMENT_RETRIES = 1;
// 停止播放后给系统释放音频会话的时间，再开始录音（iOS 上立即录音易报 start record fail）
const AUDIO_RELEASE_MS = 300;

function normalizeSpeechText(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>~|]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/^\s*\d+[.)、]\s*/gm, '')
    .replace(/(^|\s)\d+[.)、]\s*/g, '$1')
    // 时刻：9:00 / 10：30 → 9点00分（须在年份规则之前，避免把 10:30 读成年份）
    .replace(/(^|[^\d])(\d{1,2})\s*[：:]\s*(\d{2})(?!\d)/g, '$1$2点$3分')
    // 年份后接冒号：1406：明成祖… → 1406年，明成祖…（同声传译插件对“数字＋冒号”合成的音频会播放失败）
    .replace(/(^|[^\d])(\d{3,4})\s*[：:]/g, '$1$2年，')
    // 其余冒号一律改为逗号，读起来自然，也避免合成异常
    .replace(/\s*[：:]\s*/g, '，')
    .replace(/\s+/g, ' ')
    // 合并拼接产生的重复标点：“。。” “。；” “，。”
    .replace(/[，,、；;]*([。！？!?])[。！？!?，,、；;\s]*/g, '$1')
    .replace(/([，,、；;])[，,、；;\s]+/g, '$1')
    .trim();
}

function hardSplit(text) {
  const chunks = [];
  for (let index = 0; index < text.length; index += MAX_TTS_CHARS) {
    chunks.push(text.slice(index, index + MAX_TTS_CHARS));
  }
  return chunks;
}

function splitLongSentence(sentence) {
  const parts = sentence.split(/([，,、：:])/);
  const chunks = [];
  let current = '';

  parts.forEach((part) => {
    if (!part) return;
    if ((current + part).length > MAX_TTS_CHARS && current) {
      chunks.push(current);
      current = part;
      return;
    }
    current += part;
  });

  if (current) chunks.push(current);
  return chunks.reduce((result, chunk) => {
    if (chunk.length > MAX_TTS_CHARS) {
      return result.concat(hardSplit(chunk));
    }
    result.push(chunk);
    return result;
  }, []);
}

function splitSpeechText(text) {
  const content = normalizeSpeechText(text);
  if (!content) return [];

  const sentences = content.match(/[^。！？；.!?;]+[。！？；.!?;]?/g) || [content];
  const chunks = [];
  let current = '';

  sentences.forEach((sentence) => {
    const value = sentence.trim();
    if (!value) return;

    if (value.length > MAX_TTS_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitLongSentence(value));
      return;
    }

    if ((current + value).length > MAX_TTS_CHARS && current) {
      chunks.push(current);
      current = value;
      return;
    }
    current += value;
  });

  if (current) chunks.push(current);
  return chunks;
}

function createSpeechController(page, dataKey) {
  let audio = null;
  let currentRate = 1;
  let plugin = null;
  let queue = [];
  let queueIndex = 0;
  let attempts = 0;
  let failedSegments = 0;
  let playToken = 0;
  let resumeAfterInterruption = false;

  function current() {
    return page.data[dataKey] || {};
  }

  function setState(patch) {
    page.setData({
      [dataKey]: {
        ...current(),
        ...patch
      }
    });
  }

  function releaseAudio() {
    if (!audio) return;
    const old = audio;
    audio = null;
    try {
      old.stop();
    } catch {
      // 已停止或已销毁
    }
    try {
      old.destroy();
    } catch {
      // ignore
    }
  }

  function finish() {
    releaseAudio();
    if (failedSegments) {
      setState({ status: 'idle', statusText: `播放完成（${failedSegments} 段未能播放）` });
      return;
    }
    setState({ status: 'idle', statusText: '播放完成' });
  }

  function nextSegment(token) {
    if (token !== playToken) return;
    queueIndex += 1;
    attempts = 0;
    if (queueIndex >= queue.length) {
      finish();
      return;
    }
    synthesizeAndPlay(token);
  }

  // 某一段合成或播放失败：先重试，仍失败则跳过该段继续播放
  function segmentFailed(token, stage, error) {
    if (token !== playToken) return;
    logger.error('Speech segment failed', {
      stage,
      segment: `${queueIndex + 1}/${queue.length}`,
      attempt: attempts + 1,
      errCode: error && error.errCode,
      errMsg: (error && (error.errMsg || error.msg || error.message)) || String(error || ''),
      text: String(queue[queueIndex] || '').slice(0, 30)
    });
    releaseAudio();
    if (attempts < MAX_SEGMENT_RETRIES) {
      attempts += 1;
      synthesizeAndPlay(token);
      return;
    }
    failedSegments += 1;
    if (failedSegments >= queue.length) {
      setState({
        status: 'failed',
        statusText: stage === 'synthesize' ? '语音生成失败' : '语音播放失败'
      });
      wx.showToast({ title: '语音播放失败', icon: 'none' });
      return;
    }
    nextSegment(token);
  }

  // 每段使用新的播放器，避免在 onEnded 回调里给同一实例换 src 时部分机型报错
  function playFile(token, filename) {
    releaseAudio();
    const segmentAudio = wx.createInnerAudioContext();
    audio = segmentAudio;
    const isCurrent = () => token === playToken && audio === segmentAudio;

    segmentAudio.onPlay(() => {
      if (isCurrent()) setState({ status: 'playing', statusText: '语音播放中' });
    });
    segmentAudio.onPause(() => {
      if (isCurrent()) setState({ status: 'paused', statusText: '语音已暂停' });
    });
    segmentAudio.onEnded(() => {
      if (isCurrent()) nextSegment(token);
    });
    segmentAudio.onError((error) => {
      if (isCurrent()) segmentFailed(token, 'play', error);
    });

    segmentAudio.src = filename;
    segmentAudio.playbackRate = currentRate;
    segmentAudio.play();
  }

  function getPlugin() {
    if (plugin) return plugin;
    plugin = requirePlugin('WechatSI');
    return plugin;
  }

  function synthesizeAndPlay(token) {
    if (token !== playToken) return;
    const content = queue[queueIndex];
    if (!content) {
      finish();
      return;
    }

    setState({
      status: 'loading',
      statusText: queue.length > 1 ? `语音生成中 ${queueIndex + 1}/${queue.length}` : '语音加载中'
    });

    getPlugin().textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content,
      success(res) {
        if (token !== playToken) return;
        const filename = res && (res.filename || res.tempFilePath);
        if (!filename) {
          segmentFailed(token, 'synthesize', res);
          return;
        }
        playFile(token, filename);
      },
      fail(error) {
        segmentFailed(token, 'synthesize', error);
      }
    });
  }

  function play(text) {
    const chunks = splitSpeechText(text);
    if (!chunks.length) {
      wx.showToast({ title: '暂无可播报内容', icon: 'none' });
      return;
    }
    playToken += 1;
    releaseAudio();
    queue = chunks;
    queueIndex = 0;
    attempts = 0;
    failedSegments = 0;
    resumeAfterInterruption = false;
    setState({ status: 'loading', statusText: '语音加载中' });
    try {
      getPlugin();
    } catch (error) {
      logger.error('Speech plugin unavailable', error);
      setState({ status: 'failed', statusText: '语音插件不可用' });
      wx.showToast({ title: '语音插件不可用', icon: 'none' });
      return;
    }

    synthesizeAndPlay(playToken);
  }

  function isActive() {
    const status = current().status;
    return Boolean(audio) || status === 'loading' || status === 'playing' || status === 'paused';
  }

  function stop() {
    const wasActive = isActive();
    playToken += 1;
    queue = [];
    queueIndex = 0;
    resumeAfterInterruption = false;
    releaseAudio();
    if (wasActive) setState({ status: 'idle', statusText: '语音已停止' });
    return wasActive;
  }

  // 来电、微信语音等打断播放后，结束时自动继续
  const handleInterruptionBegin = () => {
    resumeAfterInterruption = Boolean(audio) && current().status === 'playing';
  };
  const handleInterruptionEnd = () => {
    if (!resumeAfterInterruption || !audio) return;
    resumeAfterInterruption = false;
    audio.play();
  };
  if (wx.onAudioInterruptionBegin) wx.onAudioInterruptionBegin(handleInterruptionBegin);
  if (wx.onAudioInterruptionEnd) wx.onAudioInterruptionEnd(handleInterruptionEnd);

  return {
    play,
    pause() {
      if (audio) audio.pause();
    },
    resume() {
      if (audio) audio.play();
    },
    setRate(rate) {
      currentRate = Number(rate) || 1;
      if (audio) audio.playbackRate = currentRate;
      setState({ rate: currentRate, statusText: `${currentRate}x 倍速` });
    },
    stop,
    // 停止播放并等待系统释放音频会话，供录音前调用
    stopAndRelease() {
      const wasActive = stop();
      return new Promise((resolve) => setTimeout(resolve, wasActive ? AUDIO_RELEASE_MS : 0));
    },
    destroy() {
      playToken += 1;
      queue = [];
      releaseAudio();
      if (wx.offAudioInterruptionBegin) wx.offAudioInterruptionBegin(handleInterruptionBegin);
      if (wx.offAudioInterruptionEnd) wx.offAudioInterruptionEnd(handleInterruptionEnd);
    }
  };
}

module.exports = {
  AUDIO_RELEASE_MS,
  createSpeechController,
  normalizeSpeechText,
  splitSpeechText
};
