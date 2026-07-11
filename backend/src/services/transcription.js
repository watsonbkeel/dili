function transcriptionText(payload) {
  return String(
    (payload && payload.text) ||
      (payload && payload.data && payload.data.text) ||
      ''
  ).trim();
}

async function transcribeAudio({ body, contentType, config, fetchImpl = fetch }) {
  if (!String(contentType || '').toLowerCase().startsWith('multipart/form-data')) {
    const error = new Error('Audio upload must use multipart/form-data');
    error.status = 415;
    throw error;
  }
  if (!body || !body.length) {
    const error = new Error('Audio file is required');
    error.status = 400;
    throw error;
  }

  let response;
  try {
    response = await fetchImpl(config.speechToTextUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(Number(config.speechToTextTimeoutMs || 60000)),
      headers: {
        'Content-Type': contentType,
        Accept: 'application/json'
      },
      body
    });
  } catch {
    const error = new Error('Local speech recognition service is unavailable');
    error.status = 502;
    throw error;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.detail || payload.error || 'Speech recognition failed');
    error.status = 502;
    throw error;
  }

  return {
    ...payload,
    text: transcriptionText(payload)
  };
}

module.exports = {
  transcribeAudio,
  transcriptionText
};
