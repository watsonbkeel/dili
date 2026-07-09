function createSpeechController(page, dataKey) {
  const audio = wx.createInnerAudioContext();
  let currentRate = 1;

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
  audio.onStop(() => setState({ status: 'idle', statusText: '语音已停止' }));
  audio.onEnded(() => setState({ status: 'idle', statusText: '播放完成' }));
  audio.onError(() => setState({ status: 'failed', statusText: '语音播放失败' }));

  function play(text) {
    const content = String(text || '').trim();
    if (!content) {
      wx.showToast({ title: '暂无可播报内容', icon: 'none' });
      return;
    }
    setState({ status: 'loading', statusText: '语音加载中' });
    let plugin = null;
    try {
      plugin = requirePlugin('WechatSI');
    } catch (error) {
      setState({ status: 'failed', statusText: '语音插件不可用' });
      wx.showToast({ title: '语音插件不可用', icon: 'none' });
      return;
    }

    plugin.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content,
      success(res) {
        if (!res.filename) {
          setState({ status: 'failed', statusText: '语音生成失败' });
          return;
        }
        audio.src = res.filename;
        audio.playbackRate = currentRate;
        audio.play();
      },
      fail() {
        setState({ status: 'failed', statusText: '语音生成失败' });
      }
    });
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
      audio.stop();
    },
    destroy() {
      audio.destroy();
    }
  };
}

module.exports = { createSpeechController };
