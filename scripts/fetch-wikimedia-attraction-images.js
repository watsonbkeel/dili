const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sourcesPath = path.join(__dirname, 'attraction-image-sources.wikimedia.json');
const backendSeedPath = path.join(root, 'backend', 'data', 'beijing-hotspots.seed.json');
const miniprogramSeedPath = path.join(root, 'miniprogram', 'data', 'beijing-hotspots.seed.js');
const imageDir = path.join(root, 'backend', 'public', 'assets', 'images', 'attractions');
const reportPath = path.join(root, 'docs', '景点图片补全-Wikimedia.md');
const commonsApi = 'https://commons.wikimedia.org/w/api.php';
const publicImageBase = 'https://dili.bkeel.com/assets/images/attractions';
const userAgent = 'DiliLocalHistoryGuide/1.0 (image attribution audit; https://dili.bkeel.com)';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += 2 + length;
  }
  return null;
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'user-agent': userAgent, ...(options.headers || {}) }
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (![429, 500, 502, 503, 504].includes(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(attempt * 1500);
  }
  throw lastError;
}

async function commonsMetadata(source) {
  const url = new URL(commonsApi);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('titles', source.commonsTitle);
  url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  url.searchParams.set('iiurlwidth', '1200');
  const response = await fetchWithRetry(url);
  const payload = await response.json();
  const page = payload?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || page.missing || !info) throw new Error(`Wikimedia file not found: ${source.commonsTitle}`);
  if (info.mime !== 'image/jpeg') throw new Error(`Expected JPEG for ${source.id}, received ${info.mime}`);
  const metadata = info.extmetadata || {};
  return {
    title: page.title,
    sourceUrl: info.descriptionurl,
    originalUrl: info.url,
    downloadUrl: info.thumburl || info.url,
    originalWidth: info.width,
    originalHeight: info.height,
    license: stripHtml(metadata.LicenseShortName?.value || metadata.UsageTerms?.value),
    licenseUrl: metadata.LicenseUrl?.value || '',
    author: stripHtml(metadata.Artist?.value || metadata.Credit?.value || 'Wikimedia Commons contributor')
  };
}

async function downloadJpeg(url, source) {
  const response = await fetchWithRetry(url, { headers: { referer: 'https://commons.wikimedia.org/' } });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/jpeg')) {
    throw new Error(`Expected image/jpeg for ${source.id}, received ${contentType || 'unknown'}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const size = jpegSize(buffer);
  if (!size) throw new Error(`Invalid JPEG for ${source.id}`);
  if (buffer.length < 30 * 1024) throw new Error(`Image is too small for ${source.id}: ${buffer.length} bytes`);
  if (size.width < 900 || size.height < 450 || size.width <= size.height) {
    throw new Error(`Image dimensions are unsuitable for ${source.id}: ${size.width}x${size.height}`);
  }
  return { buffer, size };
}

function imageRecord(source, metadata) {
  return {
    url: `${publicImageBase}/${source.id}.jpg`,
    caption: source.name,
    source: 'Wikimedia Commons',
    sourceUrl: metadata.sourceUrl,
    license: metadata.license,
    licenseUrl: metadata.licenseUrl,
    author: metadata.author,
    originalUrl: metadata.originalUrl
  };
}

function verifyExpectedMetadata(source, metadata) {
  if (source.expectedLicense && metadata.license !== source.expectedLicense) {
    throw new Error(
      `License changed for ${source.id}: expected ${source.expectedLicense}, received ${metadata.license}`
    );
  }
  if (
    source.expectedAuthor &&
    !metadata.author.toLocaleLowerCase().includes(source.expectedAuthor.toLocaleLowerCase())
  ) {
    throw new Error(
      `Author changed for ${source.id}: expected ${source.expectedAuthor}, received ${metadata.author}`
    );
  }
}

function updateSeed(seed, source, metadata) {
  const item = seed.items.find((entry) => entry.id === source.id);
  if (!item) throw new Error(`Missing seed item: ${source.id}`);
  item.images = [imageRecord(source, metadata), ...(item.images || []).slice(1)];
}

async function readMiniprogramSeed() {
  const text = await fs.readFile(miniprogramSeedPath, 'utf8');
  return JSON.parse(text.replace(/^module\.exports\s*=\s*/, '').replace(/;\s*$/, ''));
}

function reportSection(source, metadata, size, byteLength) {
  return [
    `## ${source.name}`,
    '',
    `- ID: \`${source.id}\``,
    `- 本地文件: \`backend/public/assets/images/attractions/${source.id}.jpg\``,
    `- Wikimedia 文件: ${metadata.sourceUrl}`,
    `- 作者: ${metadata.author}`,
    `- 许可: ${metadata.license}${metadata.licenseUrl ? ` (${metadata.licenseUrl})` : ''}`,
    `- 原图: ${metadata.originalUrl}`,
    `- 下载尺寸: ${size.width}x${size.height}`,
    `- 文件大小: ${Math.round(byteLength / 1024)} KB`,
    ''
  ];
}

async function main() {
  const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));
  const backendSeed = JSON.parse(await fs.readFile(backendSeedPath, 'utf8'));
  const miniprogramSeed = await readMiniprogramSeed();
  const report = [
    '# 景点图片补全 - Wikimedia Commons',
    '',
    '以下图片均已下载到本站服务器，小程序运行时不直接引用 Wikimedia 图片。请按对应许可保留署名。',
    '',
    `生成时间: ${new Date().toISOString()}`,
    ''
  ];

  await fs.mkdir(imageDir, { recursive: true });
  for (const [index, source] of sources.entries()) {
    process.stdout.write(`[${index + 1}/${sources.length}] ${source.id}: `);
    const metadata = await commonsMetadata(source);
    if (!metadata.license) throw new Error(`Missing license metadata for ${source.id}`);
    verifyExpectedMetadata(source, metadata);
    const { buffer, size } = await downloadJpeg(metadata.downloadUrl, source);
    await fs.writeFile(path.join(imageDir, `${source.id}.jpg`), buffer);
    updateSeed(backendSeed, source, metadata);
    updateSeed(miniprogramSeed, source, metadata);
    report.push(...reportSection(source, metadata, size, buffer.length));
    console.log(`${size.width}x${size.height}, ${Math.round(buffer.length / 1024)} KB, ${metadata.license}`);
    if (index < sources.length - 1) await sleep(1200);
  }

  await fs.writeFile(backendSeedPath, `${JSON.stringify(backendSeed, null, 2)}\n`);
  await fs.writeFile(miniprogramSeedPath, `module.exports = ${JSON.stringify(miniprogramSeed, null, 2)};\n`);
  await fs.writeFile(reportPath, `${report.join('\n')}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
