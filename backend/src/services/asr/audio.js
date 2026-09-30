const { asrError } = require('./errors');

// 腾讯云一句话识别限制：音频 ≤60s，base64 后 ≤3MB。
const MAX_DURATION_SECONDS = 60;
const MAX_BASE64_BYTES = 3 * 1024 * 1024;

function base64Length(byteLength) {
  return Math.ceil(byteLength / 3) * 4;
}

// 按文件头识别格式，不信任客户端声明的 MIME / 文件名。
function detectVoiceFormat(buffer) {
  if (!buffer || buffer.length < 12) return '';
  const head4 = buffer.subarray(0, 4).toString('latin1');
  if (head4 === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WAVE') return 'wav';
  if (head4 === 'OggS') return 'ogg-opus';
  if (buffer.subarray(0, 5).toString('latin1') === '#!AMR') return 'amr';
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') return 'm4a';
  if (buffer.subarray(0, 3).toString('latin1') === 'ID3') return 'mp3';
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    // AAC ADTS 的 layer 位为 00；MP3 为非 00
    return (buffer[1] & 0x06) === 0 ? 'aac' : 'mp3';
  }
  return '';
}

// 解析 WAV 头，返回 { durationSeconds, dataBytes, sampleRate, channels, bitsPerSample }
function parseWav(buffer) {
  let offset = 12;
  let fmt = null;
  let dataBytes = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.subarray(offset, offset + 4).toString('latin1');
    const size = buffer.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;
    if (id === 'fmt ' && bodyStart + 16 <= buffer.length) {
      fmt = {
        audioFormat: buffer.readUInt16LE(bodyStart),
        channels: buffer.readUInt16LE(bodyStart + 2),
        sampleRate: buffer.readUInt32LE(bodyStart + 4),
        byteRate: buffer.readUInt32LE(bodyStart + 8),
        bitsPerSample: buffer.readUInt16LE(bodyStart + 14)
      };
    } else if (id === 'data') {
      // 录音中途生成的 WAV 可能写入 0 或超大 size，按实际剩余字节取最小值
      const remaining = buffer.length - bodyStart;
      dataBytes = size && size <= remaining ? size : remaining;
      break;
    }
    offset = bodyStart + size + (size % 2);
  }
  if (!fmt || !fmt.byteRate) return null;
  return {
    durationSeconds: dataBytes / fmt.byteRate,
    dataBytes,
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    bitsPerSample: fmt.bitsPerSample
  };
}

async function audioFromMultipart(body, contentType) {
  if (!String(contentType || '').toLowerCase().startsWith('multipart/form-data')) {
    throw asrError('UPLOAD_NOT_MULTIPART');
  }
  if (!body || !body.length) throw asrError('NO_FILE');

  let form;
  try {
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    });
    form = await request.formData();
  } catch {
    throw asrError('UPLOAD_UNPARSABLE');
  }

  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') throw asrError('NO_FILE');
  const audio = Buffer.from(await file.arrayBuffer());
  // 客户端传入的 model / language / response_format 字段仅为兼容保留，服务端不采用。
  return { audio, fileName: String(file.name || ''), declaredType: String(file.type || '') };
}

function validateAudio(audio) {
  if (!audio || !audio.length) throw asrError('EMPTY_AUDIO');
  const voiceFormat = detectVoiceFormat(audio);
  if (!voiceFormat) throw asrError('UNSUPPORTED_FORMAT');
  if (base64Length(audio.length) > MAX_BASE64_BYTES) throw asrError('TOO_LARGE');

  let durationSeconds = null;
  if (voiceFormat === 'wav') {
    const wav = parseWav(audio);
    if (!wav) throw asrError('UNSUPPORTED_FORMAT');
    if (!wav.dataBytes) throw asrError('EMPTY_AUDIO');
    durationSeconds = wav.durationSeconds;
    if (durationSeconds > MAX_DURATION_SECONDS + 0.5) throw asrError('TOO_LONG');
  }
  return { voiceFormat, durationSeconds, byteLength: audio.length };
}

module.exports = {
  MAX_BASE64_BYTES,
  MAX_DURATION_SECONDS,
  audioFromMultipart,
  base64Length,
  detectVoiceFormat,
  parseWav,
  validateAudio
};
