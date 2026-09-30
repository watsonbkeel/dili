const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { readConfig } = require('./config');
const { DataStore } = require('./storage/dataStore');
const { coarseCoordinate, validateLatLng } = require('./services/location');
const { geocodeAddress, getNearbyPlaces } = require('./services/tencentMap');
const { generateStory } = require('./services/storyGenerator');
const { getMetadata, getPlaceById, listPlaces } = require('./services/placeStore');
const { askAssistant } = require('./services/assistant');
const { transcribeAudio } = require('./services/transcription');
const { recognizeImage } = require('./services/recognition');
const { listRoutes } = require('./services/routeStore');
const { clientKey, createPaidGuard } = require('./services/paidGuard');
const { runtimeCheck } = require('./services/runtimeCheck');

const MAX_AUDIO_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

// 结构化日志：只记录事件元数据，不记录音频、base64、图片、密钥或用户原文
function defaultLogger(entry) {
  console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    ...extraHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-User-Id'
  });
  res.end(JSON.stringify(payload));
}

const STATIC_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4'
};

async function sendStaticAsset(req, res, pathname, assetDir) {
  const publicRoot = path.resolve(assetDir || path.join(process.cwd(), 'backend', 'public', 'assets'));
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.replace(/^\/assets\/?/, '');
  const filePath = path.resolve(publicRoot, relativePath);
  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return true;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendJson(res, 404, { error: 'Asset not found' });
      return true;
    }
    throw error;
  }
  return true;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.status = 400;
    throw error;
  }
}

async function readRawBody(req, maxBytes = MAX_IMAGE_UPLOAD_BYTES, tooLargeMessage = 'Upload is too large') {
  const declared = Number(req.headers['content-length'] || 0);
  const tooLarge = () => {
    const error = new Error(tooLargeMessage);
    error.status = 413;
    return error;
  };
  if (declared && declared > maxBytes) {
    req.resume();
    throw tooLarge();
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      req.resume();
      throw tooLarge();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function getUserId(req, url, body = {}) {
  return (
    req.headers['x-user-id'] ||
    url.searchParams.get('userId') ||
    body.userId ||
    body.openid ||
    'anonymous'
  );
}

function createApp({
  config = readConfig(),
  store = new DataStore(config.dataDir),
  fetchImpl = fetch,
  createAsrClient,
  logger = defaultLogger,
  paidGuard = createPaidGuard({
    perMinute: Number(config.paidRateLimitPerMinute ?? 20),
    maxConcurrency: Number(config.paidMaxConcurrency ?? 4)
  })
} = {}) {
  const guarded = (req, task) => paidGuard.run(clientKey(req, config.trustProxy !== false), task);

  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/assets/')) {
        await sendStaticAsset(req, res, url.pathname, config.assetDir);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      // 受保护的配置/存储自检：需要 ADMIN_TOKEN；未配置时接口不存在。不调用任何计费接口。
      if (req.method === 'GET' && url.pathname === '/api/admin/check') {
        if (!isAdmin(req, config)) {
          sendJson(res, 404, { error: 'Not found' });
          return;
        }
        sendJson(res, 200, await runtimeCheck({ config }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/nearby') {
        const { lat, lng } = validateLatLng(url.searchParams.get('lat'), url.searchParams.get('lng'));
        const payload = await getNearbyPlaces({
          lat,
          lng,
          key: config.tencentMapKey,
          fetchImpl
        });
        sendJson(res, 200, payload);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/geocode') {
        const payload = await geocodeAddress({
          address: url.searchParams.get('address'),
          key: config.tencentMapKey,
          fetchImpl
        });
        sendJson(res, 200, payload);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/places') {
        const metadata = getMetadata();
        const places = listPlaces({
          city: url.searchParams.get('city') || metadata.city,
          q: url.searchParams.get('q') || '',
          lat: url.searchParams.get('lat') || undefined,
          lng: url.searchParams.get('lng') || undefined,
          radius: url.searchParams.get('radius') || undefined
        });
        sendJson(res, 200, {
          city: url.searchParams.get('city') || metadata.city,
          coordinateSystem: metadata.coordinateSystem,
          places
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/routes') {
        sendJson(res, 200, { routes: listRoutes() });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/transcriptions') {
        const result = await guarded(req, async () => {
          const body = await readRawBody(req, MAX_AUDIO_UPLOAD_BYTES, '录音文件过大，请缩短到 60 秒以内');
          return transcribeAudio({
            body,
            contentType: req.headers['content-type'],
            config,
            fetchImpl,
            createAsrClient,
            logger
          });
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/recognize') {
        const result = await guarded(req, async () => {
          const body = await readRawBody(req, MAX_IMAGE_UPLOAD_BYTES, 'Image upload is too large');
          return recognizeImage({
            body,
            contentType: req.headers['content-type'],
            config,
            fetchImpl
          });
        });
        sendJson(res, 200, { result });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/assistant') {
        const body = await readBody(req);
        const userId = String(getUserId(req, url, body));
        const result = await guarded(req, () =>
          askAssistant({
            config,
            fetchImpl,
            question: body.question || '',
            context: body.context || {}
          })
        );
        const record = await store.addAssistantRecord({
          userId,
          question: body.question || '',
          answer: result.answer || '',
          source: result.source || '',
          context: body.context || {}
        });
        sendJson(res, 200, {
          ...result,
          recordId: record.id
        });
        return;
      }

      const reactionMatch = url.pathname.match(/^\/api\/places\/([^/]+)\/reactions$/);
      if (reactionMatch) {
        const placeId = decodeURIComponent(reactionMatch[1]);
        if (!getPlaceById(placeId)) {
          sendJson(res, 404, { error: 'Place not found' });
          return;
        }
        if (req.method === 'GET') {
          const counts = await store.getPlaceReactions(placeId);
          sendJson(res, 200, { placeId, counts });
          return;
        }
        if (req.method === 'POST') {
          const body = await readBody(req);
          const allowed = new Set(['', 'recommend', 'notRecommend']);
          const previous = body.previous || '';
          const reaction = body.reaction || '';
          if (!allowed.has(previous) || !allowed.has(reaction)) {
            sendJson(res, 400, { error: 'Reaction must be recommend, notRecommend or empty' });
            return;
          }
          const counts = await store.updatePlaceReaction(placeId, previous, reaction);
          sendJson(res, 200, { placeId, reaction, counts });
          return;
        }
      }

      const placeMatch = url.pathname.match(/^\/api\/places\/([^/]+)$/);
      if (req.method === 'GET' && placeMatch) {
        const place = getPlaceById(decodeURIComponent(placeMatch[1]));
        if (!place) {
          sendJson(res, 404, { error: 'Place not found' });
          return;
        }
        sendJson(res, 200, { place });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/story') {
        const body = await readBody(req);
        if (!body.placeId && !body.place && !body.facts) {
          sendJson(res, 400, { error: 'placeId or place facts are required' });
          return;
        }
        if (body.placeId && !getPlaceById(body.placeId)) {
          sendJson(res, 404, { error: 'Place not found' });
          return;
        }
        const userId = String(getUserId(req, url, body));
        const inputLocation = body.location || {};
        const result = await generateStory({
          config,
          store,
          fetchImpl,
          userId,
          placeId: body.placeId,
          place: body.place,
          facts: body.facts,
          location: {
            ...inputLocation,
            coarse: inputLocation.coarse || coarseCoordinate(Number(inputLocation.lat || 0), Number(inputLocation.lng || 0))
          },
          forceRefresh: Boolean(body.forceRefresh)
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/history') {
        const userId = String(getUserId(req, url));
        const history = await store.listHistory(userId);
        sendJson(res, 200, { history });
        return;
      }

      const historyMatch = url.pathname.match(/^\/api\/history\/([^/]+)$/);
      if (req.method === 'DELETE' && historyMatch) {
        const userId = String(getUserId(req, url));
        const deleted = await store.deleteHistory(userId, decodeURIComponent(historyMatch[1]));
        sendJson(res, deleted ? 200 : 404, { deleted });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500 && logger) {
        logger({ event: 'error', method: req.method, path: req.url && req.url.split('?')[0], status, code: error.code || '' });
      }
      const payload = { error: status >= 500 && !error.status ? 'Internal server error' : error.message || 'Internal server error' };
      if (error.code) payload.code = error.code;
      sendJson(res, status, payload, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
    }
  });
}

function isAdmin(req, config) {
  const expected = String(config.adminToken || '');
  if (expected.length < 16) return false;
  const provided = String(req.headers['x-admin-token'] || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && require('node:crypto').timingSafeEqual(a, b);
}

if (require.main === module) {
  const config = readConfig();
  const server = createApp({ config });
  // Node 默认 requestTimeout 300s；这里与 Nginx/小程序超时对齐
  server.requestTimeout = 90 * 1000;
  server.headersTimeout = 30 * 1000;
  server.listen(config.port, config.host, () => {
    console.log(
      JSON.stringify({
        event: 'listening',
        host: config.host,
        port: config.port,
        speechToTextProvider: config.speechToTextProvider
      })
    );
  });
}

module.exports = {
  createApp,
  readBody,
  readRawBody,
  sendJson
};
