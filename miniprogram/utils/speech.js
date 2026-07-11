const MAX_TTS_CHARS = 90;

function normalizeSpeechText(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>~]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/^\s*\d+[.)、]\s*/gm, '')
    .replace(/(^|\s)\d+[.)、]\s*/g, '$1')
    .replace(/\s+/g, ' ')
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
  const audio = wx.createInnerAudioContext();
  let currentRate = 1;
  let plugin = null;
  let queue = [];
  let queueIndex = 0;
  let playToken = 0;
  let ignoreNextStop = false;

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

  audio.onPlay(() => setState({ status: 'playing', statusText: '语音播放中' }));
  audio.onPause(() => setState({ status: 'paused', statusText: '语音已暂停' }));
  audio.onStop(() => {
    if (ignoreNextStop) {
      ignoreNextStop = false;
      return;
    }
    setState({ status: 'idle', statusText: '语音已停止' });
  });
  audio.onEnded(() => {
    if (queueIndex < queue.length - 1) {
      queueIndex += 1;
      synthesizeAndPlay(playToken);
      return;
    }
    setState({ status: 'idle', statusText: '播放完成' });
  });
  audio.onError((error) => {
    console.error('Speech audio playback failed', error);
    setState({ status: 'failed', statusText: '语音播放失败' });
  });

  function getPlugin() {
    if (plugin) return plugin;
    plugin = requirePlugin('WechatSI');
    return plugin;
  }

  function synthesizeAndPlay(token) {
    if (token !== playToken) return;
    const content = queue[queueIndex];
    if (!content) {
      setState({ status: 'idle', statusText: '播放完成' });
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
        const filename = res.filename || res.tempFilePath;
        if (!filename) {
          console.error('Speech synthesis returned no audio file', res);
          setState({ status: 'failed', statusText: '语音生成失败' });
          wx.showToast({ title: '语音生成失败', icon: 'none' });
          return;
        }
        audio.src = filename;
        audio.playbackRate = currentRate;
        audio.play();
      },
      fail(error) {
        if (token !== playToken) return;
        console.error('Speech synthesis failed', error);
        setState({ status: 'failed', statusText: '语音生成失败' });
        wx.showToast({ title: '语音生成失败', icon: 'none' });
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
    queue = chunks;
    queueIndex = 0;
    ignoreNextStop = true;
    audio.stop();
    setTimeout(() => {
      ignoreNextStop = false;
    }, 0);
    setState({ status: 'loading', statusText: '语音加载中' });
    try {
      getPlugin();
    } catch (error) {
      console.error('Speech plugin unavailable', error);
      setState({ status: 'failed', statusText: '语音插件不可用' });
      wx.showToast({ title: '语音插件不可用', icon: 'none' });
      return;
    }

    synthesizeAndPlay(playToken);
  }

  return {
    play,
    pause() {
      audio.pause();
    },
    resume() {
      audio.play();
    },
    setRate(rate) {
      currentRate = Number(rate) || 1;
      audio.playbackRate = currentRate;
      setState({ rate: currentRate, statusText: `${currentRate}x 倍速` });
    },
    stop() {
      playToken += 1;
      queue = [];
      queueIndex = 0;
      audio.stop();
    },
    destroy() {
      playToken += 1;
      queue = [];
      audio.destroy();
    }
  };
}

module.exports = { createSpeechController };
