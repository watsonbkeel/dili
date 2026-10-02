// 现场日志：优先写入微信实时日志（小程序后台「开发管理 → 运维中心 → 实时日志」可查），
// 不可用时退回 console。只记录错误码/段号等诊断信息，不记录用户隐私。
let realtime = null;

function manager() {
  if (realtime !== null) return realtime;
  try {
    realtime = (typeof wx !== 'undefined' && wx.getRealtimeLogManager && wx.getRealtimeLogManager()) || false;
  } catch {
    realtime = false;
  }
  return realtime;
}

function write(level, args) {
  const log = manager();
  if (log && typeof log[level] === 'function') {
    try {
      log[level](...args);
    } catch {
      // 实时日志失败不影响业务
    }
  }
  const fallback = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  fallback(...args);
}

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args)
};
