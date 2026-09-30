// 付费接口（语音识别/视觉识别/文字问答）的进程内限流与并发保护。
// 单进程部署（systemd 单实例，不用 PM2 cluster），所以内存计数即可。

function clientKey(req, trustProxy = true) {
  if (trustProxy) {
    const realIp = req.headers['x-real-ip'];
    if (realIp) return String(realIp).trim();
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function tooMany(message, retryAfterSeconds) {
  const error = new Error(message);
  error.status = 429;
  error.code = 'RATE_LIMITED';
  if (retryAfterSeconds) error.retryAfter = retryAfterSeconds;
  return error;
}

function createPaidGuard({ perMinute = 20, maxConcurrency = 4, now = () => Date.now() } = {}) {
  const windows = new Map(); // key -> { start, count }
  let active = 0;
  const windowMs = 60 * 1000;

  function sweep(current) {
    if (windows.size < 5000) return;
    for (const [key, value] of windows) {
      if (current - value.start >= windowMs) windows.delete(key);
    }
  }

  async function run(key, task) {
    const current = now();
    sweep(current);
    if (perMinute > 0) {
      const entry = windows.get(key);
      if (!entry || current - entry.start >= windowMs) {
        windows.set(key, { start: current, count: 1 });
      } else if (entry.count >= perMinute) {
        throw tooMany('请求过于频繁，请稍后再试', Math.ceil((entry.start + windowMs - current) / 1000));
      } else {
        entry.count += 1;
      }
    }
    if (maxConcurrency > 0 && active >= maxConcurrency) {
      throw tooMany('服务繁忙，请稍后再试', 2);
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
    }
  }

  return {
    run,
    get active() {
      return active;
    }
  };
}

module.exports = { clientKey, createPaidGuard };
