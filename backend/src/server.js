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
const { listRoutes } = require('./services/routeStore');

function sendJson(res, status, payload) {
  res.writeHead(status, {
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
  '.webp': 'image/webp'
};

async function sendStaticAsset(req, res, pathname) {
  const publicRoot = path.join(process.cwd(), 'backend', 'public');
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.replace(/^\/+/, '');
  const filePath = path.resolve(publicRoot, relativePath);
  if (!filePath.startsWith(publicRoot + path.sep)) {
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

function getUserId(req, url, body = {}) {
  return (
    req.headers['x-user-id'] ||
    url.searchParams.get('userId') ||
    body.userId ||
    body.openid ||
    'anonymous'
  );
}

function createApp({ config = readConfig(), store = new DataStore(config.dataDir), fetchImpl = fetch } = {}) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/assets/')) {
        await sendStaticAsset(req, res, url.pathname);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true });
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

      if (req.method === 'POST' && url.pathname === '/api/assistant') {
        const body = await readBody(req);
        const userId = String(getUserId(req, url, body));
        const result = await askAssistant({
          config,
          fetchImpl,
          question: body.question || '',
          context: body.context || {}
        });
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
      sendJson(res, error.status || 500, {
        error: error.message || 'Internal server error'
      });
    }
  });
}

if (require.main === module) {
  const config = readConfig();
  const server = createApp({ config });
  server.listen(config.port, () => {
    console.log(`Local history backend listening on http://localhost:${config.port}`);
  });
}

module.exports = {
  createApp,
  readBody,
  sendJson
};
