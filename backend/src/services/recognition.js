const crypto = require('node:crypto');
const { visionCompletionsUrl } = require('./assistant');
const { listPlaces } = require('./placeStore');
const { validateLatLng } = require('./location');

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function parseJsonContent(content) {
  const value = String(content || '').trim();
  const withoutFence = value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(withoutFence.slice(start, end + 1));
    throw new Error('Vision model returned invalid JSON');
  }
}

function confidenceValue(value) {
  const number = Number.parseFloat(String(value || ''));
  if (!Number.isFinite(number)) return 0;
  const percentage = number <= 1 ? number * 100 : number;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

function findKnownPlace(name) {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) return null;
  const exactMatch = listPlaces({ city: '北京', q: normalizedName })[0];
  if (exactMatch) return exactMatch;

  let bestMatch = null;
  let bestScore = 0;
  listPlaces({ city: '北京' }).forEach((place) => {
    [place.name, ...(place.aliases || [])].filter(Boolean).forEach((candidate) => {
      const value = String(candidate).trim();
      if (value.length < 2) return;
      if (normalizedName.includes(value) || value.includes(normalizedName)) {
        if (value.length > bestScore) {
          bestMatch = place;
          bestScore = value.length;
        }
      }
    });
  });
  return bestMatch;
}

function normalizeRecognition(parsed, imageBuffer) {
  const confidence = confidenceValue(parsed.confidence);
  const recognizedFlag = parsed.recognized === true || String(parsed.recognized).toLowerCase() === 'true';
  const recognized = Boolean(recognizedFlag && parsed.name && confidence >= 45);
  const knownPlace = recognized ? findKnownPlace(parsed.name) : null;
  const fallbackId = `vision-${crypto.createHash('sha256').update(imageBuffer).digest('hex').slice(0, 16)}`;
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).filter(Boolean).slice(0, 4) : [];
  const result = {
    id: knownPlace ? knownPlace.id : fallbackId,
    recognized,
    name: recognized ? String(parsed.name) : '未能可靠识别',
    confidence: `${confidence}%`,
    confidenceValue: confidence,
    type: String(parsed.type || (recognized ? '历史景点或文物' : '需要重新拍摄')),
    tags,
    visualEvidence: String(parsed.visualEvidence || ''),
    summary: String(parsed.summary || ''),
    story: String(parsed.story || ''),
    accessibility: '仅凭照片无法确认无障碍条件，请以现场标识和官方信息为准。',
    source: 'ai',
    knownPlaceId: knownPlace ? knownPlace.id : ''
  };

  if (knownPlace) {
    result.summary = knownPlace.summary || result.summary;
    result.type = (knownPlace.category || []).join('、') || result.type;
    result.tags = [...(knownPlace.category || []), ...(knownPlace.tags || [])].slice(0, 4);
  }
  if (!recognized) {
    result.summary = result.visualEvidence || '照片中的主体或文字不够清楚，无法给出可靠识别结果。';
    result.story = '请重新拍摄主体完整、光线充足且轮廓清晰的照片。';
  }
  return result;
}

function locationFromForm(form) {
  const latitude = form.get('latitude');
  const longitude = form.get('longitude');
  if (latitude === null || longitude === null || latitude === '' || longitude === '') return null;
  const location = validateLatLng(latitude, longitude);
  const accuracy = Number(form.get('accuracy'));
  return {
    ...location,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : 0
  };
}

function locationContext(location) {
  if (!location) return null;
  const nearbyKnownPlaces = listPlaces({
    city: '北京',
    lat: location.lat,
    lng: location.lng,
    radius: 5000
  })
    .slice(0, 6)
    .map((place) => ({
      id: place.id,
      name: place.name,
      distanceMeters: place.distance,
      address: place.address
    }));
  return {
    coordinateSystem: 'GCJ-02',
    latitude: location.lat,
    longitude: location.lng,
    accuracyMeters: location.accuracy,
    nearbyKnownPlaces
  };
}

async function imageFromMultipart(body, contentType) {
  if (!String(contentType || '').toLowerCase().startsWith('multipart/form-data')) {
    const error = new Error('Image upload must use multipart/form-data');
    error.status = 415;
    throw error;
  }

  let form;
  try {
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    });
    form = await request.formData();
  } catch {
    const error = new Error('Image upload could not be parsed');
    error.status = 400;
    throw error;
  }

  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    const error = new Error('Image file is required');
    error.status = 400;
    throw error;
  }
  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const mimeType = String(file.type || 'image/jpeg').toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    const error = new Error('Only JPEG, PNG and WebP images are supported');
    error.status = 415;
    throw error;
  }
  if (!imageBuffer.length || imageBuffer.length > MAX_IMAGE_BYTES) {
    const error = new Error('Image must be smaller than 8 MB');
    error.status = imageBuffer.length ? 413 : 400;
    throw error;
  }
  return { imageBuffer, mimeType, location: locationFromForm(form) };
}

function recognitionMessages(dataUrl, geoContext) {
  return [
    {
      role: 'system',
      content:
        '你是严谨的北京历史景点与文物图像识别助手。必须先依据图片中的建筑轮廓、匾额、文字、纹饰或展签判断对象。不要默认回答故宫。不能可靠识别时 recognized 必须为 false。历史内容必须简洁，不得编造具体年代、人物或传说。只输出 JSON，不要 Markdown。'
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            task: '识别照片中的北京历史景点、建筑、文物或展品',
            locationContext: geoContext,
            locationInstruction:
              '定位是上传图片时的当前位置，仅用于缩小候选范围。若图片视觉证据与定位冲突，必须以图片证据为准。',
            outputSchema: {
              recognized: 'boolean',
              name: 'string，尽量给出具体对象名称',
              confidence: '0 到 100 的数字',
              type: 'string',
              tags: ['最多 4 个简短标签'],
              visualEvidence: 'string，说明图片中的判断依据',
              summary: 'string，两句话以内的简介',
              story: 'string，三句话以内且有把握的历史信息'
            }
          })
        },
        {
          type: 'image_url',
          image_url: { url: dataUrl }
        }
      ]
    }
  ];
}

async function recognizeImage({ body, contentType, config, fetchImpl = fetch }) {
  if (!config.openaiApiKey) {
    const error = new Error('Vision model is not configured');
    error.status = 503;
    throw error;
  }
  const { imageBuffer, mimeType, location } = await imageFromMultipart(body, contentType);
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const geoContext = locationContext(location);
  let response;
  try {
    response = await fetchImpl(visionCompletionsUrl(config), {
      method: 'POST',
      signal: AbortSignal.timeout(Number(config.openaiTimeoutMs || 30000)),
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.openaiVisionModel || 'deepseek/deepseek-flash',
        temperature: 0.1,
        max_tokens: Math.max(700, Number(config.openaiMaxTokens || 600)),
        response_format: { type: 'json_object' },
        messages: recognitionMessages(dataUrl, geoContext)
      })
    });
  } catch {
    const error = new Error('Vision model is unavailable');
    error.status = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`Vision model request failed with HTTP ${response.status}`);
    error.status = 502;
    throw error;
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('Vision model returned no result');
    error.status = 502;
    throw error;
  }
  let parsed;
  try {
    parsed = parseJsonContent(content);
  } catch {
    const error = new Error('Vision model returned an unreadable result');
    error.status = 502;
    throw error;
  }
  return {
    ...normalizeRecognition(parsed, imageBuffer),
    locationUsed: Boolean(geoContext),
    nearbyCandidateCount: geoContext ? geoContext.nearbyKnownPlaces.length : 0
  };
}

module.exports = {
  confidenceValue,
  imageFromMultipart,
  locationContext,
  normalizeRecognition,
  parseJsonContent,
  recognizeImage
};
