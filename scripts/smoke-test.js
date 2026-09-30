#!/usr/bin/env node
// 冒烟测试。默认只调用不计费接口；加 --paid 才会对语音/文字/视觉各发 1 次真实请求（会计费）。
// 用法：
//   node scripts/smoke-test.js https://dili.bkeel.com
//   node scripts/smoke-test.js http://127.0.0.1:13104 --paid --audio sample.wav --image sample.jpg
//   通过 IP 验证新服务器但不改 DNS：加 --resolve-ip 1.2.3.4（仅 https，依赖 curl）
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);
const baseUrl = (args.find((arg) => /^https?:\/\//.test(arg)) || 'http://127.0.0.1:13104').replace(/\/$/, '');
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
};
const paid = flag('--paid');
const resolveIp = option('--resolve-ip');
const results = [];

function curlRequest(url, { method = 'GET', json, form = [] } = {}) {
  const target = new URL(url);
  const curlArgs = ['-sS', '--max-time', '75', '-o', '-', '-w', '\n%{http_code}', '-X', method];
  curlArgs.push('--resolve', `${target.hostname}:${target.port || 443}:${resolveIp}`);
  if (json) curlArgs.push('-H', 'Content-Type: application/json', '--data', JSON.stringify(json));
  form.forEach((field) => curlArgs.push('-F', field));
  curlArgs.push(url);
  const output = execFileSync('curl', curlArgs, { encoding: 'utf8' });
  const lines = output.trimEnd().split('\n');
  const status = Number(lines.pop());
  return { status, text: lines.join('\n') };
}

async function request(pathname, options = {}) {
  const url = `${baseUrl}${pathname}`;
  if (resolveIp) return curlRequest(url, options);
  const init = { method: options.method || 'GET', signal: AbortSignal.timeout(75000), headers: { 'X-User-Id': 'smoke-test' } };
  if (options.json) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.json);
  }
  if (options.formData) init.body = options.formData;
  const res = await fetch(url, init);
  return { status: res.status, text: await res.text() };
}

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail });
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, detail: error.message });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function fileForm(filePath, type, extra = {}) {
  if (resolveIp) {
    return [`file=@${filePath};type=${type}`, ...Object.entries(extra).map(([k, v]) => `${k}=${v}`)];
  }
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type }), path.basename(filePath));
  Object.entries(extra).forEach(([key, value]) => form.append(key, value));
  return form;
}

async function main() {
  await check('health', async () => {
    const res = await request('/health');
    expect(res.status === 200 && JSON.parse(res.text).ok === true, `HTTP ${res.status}`);
    return 'ok';
  });
  await check('places', async () => {
    const res = await request('/api/places');
    const count = JSON.parse(res.text).places.length;
    expect(res.status === 200 && count > 0, `HTTP ${res.status}`);
    return `${count} places`;
  });
  await check('routes', async () => {
    const res = await request('/api/routes');
    expect(res.status === 200, `HTTP ${res.status}`);
    return `${JSON.parse(res.text).routes.length} routes`;
  });
  await check('asset image', async () => {
    const places = JSON.parse((await request('/api/places')).text).places;
    const detail = JSON.parse((await request(`/api/places/${encodeURIComponent(places[0].id)}`)).text).place;
    const image = [detail.image, ...(detail.images || []).map((item) => (item && item.url) || item)]
      .find((value) => typeof value === 'string' && value.includes('/assets/'));
    expect(image, 'no image url in places');
    const assetPath = String(image).replace(/^https?:\/\/[^/]+/, '');
    const res = await request(assetPath);
    expect(res.status === 200, `HTTP ${res.status} for ${assetPath}`);
    return assetPath;
  });
  await check('transcriptions rejects empty upload (no billing)', async () => {
    const form = resolveIp ? ['model=Qwen/Qwen3-ASR-1.7B'] : (() => {
      const data = new FormData();
      data.append('model', 'Qwen/Qwen3-ASR-1.7B');
      return data;
    })();
    const res = await request('/api/transcriptions', { method: 'POST', formData: form, form });
    expect([400, 503].includes(res.status), `HTTP ${res.status}`);
    return `HTTP ${res.status} ${JSON.parse(res.text).code || ''}`;
  });

  if (paid) {
    const audio = option('--audio');
    const image = option('--image');
    if (audio) {
      await check('PAID asr x1', async () => {
        const form = fileForm(audio, 'audio/wav', { model: 'Qwen/Qwen3-ASR-1.7B', language: 'Chinese' });
        const res = await request('/api/transcriptions', { method: 'POST', formData: form, form });
        const payload = JSON.parse(res.text);
        expect(res.status === 200, `HTTP ${res.status} ${payload.code || ''}`);
        return `text length=${String(payload.text || '').length} provider=${payload.provider}`;
      });
    }
    await check('PAID assistant x1', async () => {
      const res = await request('/api/assistant', { method: 'POST', json: { question: '故宫的中轴线有什么意义？', context: { type: 'mode', mode: 'lowVision' } } });
      const payload = JSON.parse(res.text);
      expect(res.status === 200, `HTTP ${res.status}`);
      expect(payload.source === 'ai', `source=${payload.source} (template fallback means model not reachable)`);
      return `source=${payload.source} length=${String(payload.answer || '').length}`;
    });
    if (image) {
      await check('PAID vision x1', async () => {
        const type = /\.png$/i.test(image) ? 'image/png' : 'image/jpeg';
        const form = fileForm(image, type);
        const res = await request('/api/recognize', { method: 'POST', formData: form, form });
        const payload = JSON.parse(res.text);
        expect(res.status === 200, `HTTP ${res.status} ${payload.error || ''}`);
        return `recognized=${payload.result.recognized} name=${payload.result.name}`;
      });
    }
  }

  for (const item of results) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}  (${item.ms}ms)  ${item.detail}`);
  }
  process.exit(results.every((item) => item.ok) ? 0 : 1);
}

main();
