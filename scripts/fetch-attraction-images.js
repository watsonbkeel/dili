const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sourcesPath = path.join(__dirname, 'attraction-image-sources.json');
const backendSeedPath = path.join(root, 'backend', 'data', 'beijing-hotspots.seed.json');
const miniprogramSeedPath = path.join(root, 'miniprogram', 'data', 'beijing-hotspots.seed.js');
const imageDir = path.join(root, 'backend', 'public', 'assets', 'images', 'attractions');
const reportPath = path.join(root, 'docs', '景点图片抓取报告.md');

const userAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

function absoluteUrl(rawUrl, baseUrl) {
  if (!rawUrl || rawUrl.startsWith('data:')) return '';
  const clean = rawUrl.trim().replace(/&amp;/g, '&');
  if (clean.startsWith('//')) return `https:${clean}`;
  try {
    return new URL(clean, baseUrl).toString();
  } catch {
    return '';
  }
}

function normalizeImageUrl(url) {
  return url.replace(/@base@.*$/, '');
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']+)["']/g)) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function extractCandidates(html, source) {
  const candidates = [];

  for (const match of html.matchAll(/<meta[^>]+>/gi)) {
    const attrs = parseAttributes(match[0]);
    const key = attrs.property || attrs.name || '';
    if (['og:image', 'twitter:image'].includes(key.toLowerCase())) {
      candidates.push({
        url: absoluteUrl(attrs.content, source.sourceUrl),
        text: key,
        reason: key
      });
    }
  }

  for (const match of html.matchAll(/<img[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const rawUrl =
      attrs.src ||
      attrs['data-src'] ||
      attrs.original ||
      attrs['data-original'] ||
      attrs.lazyload ||
      '';
    candidates.push({
      url: absoluteUrl(rawUrl, source.sourceUrl),
      text: [attrs.alt, attrs.title, attrs.class, attrs.id].filter(Boolean).join(' '),
      reason: 'img'
    });
  }

  const seen = new Set();
  return candidates
    .map((candidate) => ({
      ...candidate,
      url: normalizeImageUrl(candidate.url)
    }))
    .filter((candidate) => {
      if (!candidate.url || seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      if (!/\.(jpe?g|png|webp)(\?|$)/i.test(candidate.url)) return false;
      if (/logo|icon|wechat|weixin|qrcode|qr|share|sprite|blank|avatar/i.test(candidate.url)) return false;
      return true;
    });
}

function readJpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += 2 + length;
  }
  return null;
}

function readPngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function imageSize(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return readJpegSize(buffer);
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return readPngSize(buffer);
  return null;
}

function scoreCandidate(candidate, source) {
  const haystack = `${candidate.url} ${candidate.text}`.toLowerCase();
  let score = 0;
  if (candidate.reason === 'og:image') score += 30;
  if (/visitbeijing|dpm|chnmuseum|pgm|summerpalace|tiantan|yuanmingyuan/i.test(candidate.url)) score += 20;
  if (/\/vbj-s\/|\/Uploads\/image\//i.test(candidate.url)) score += 15;
  if (/\.(jpe?g)(\?|$)/i.test(candidate.url)) score += 10;
  if (/logo|icon|png|wechat|share/i.test(candidate.url)) score -= 30;
  for (const keyword of source.preferredKeywords || []) {
    if (haystack.includes(String(keyword).toLowerCase())) score += 10;
  }
  return score;
}

async function downloadCandidate(candidate) {
  const response = await fetch(candidate.url, {
    headers: {
      'user-agent': userAgent,
      referer: candidate.url
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`not image: ${contentType}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const size = imageSize(buffer);
  if (!size) throw new Error('unknown image size');
  if (size.width < 500 || size.height < 280) {
    throw new Error(`too small: ${size.width}x${size.height}`);
  }
  if (buffer.length < 30 * 1024) {
    throw new Error(`too small file: ${buffer.length}`);
  }
  return { buffer, size, bytes: buffer.length };
}

async function fetchImageForSource(source) {
  if (source.directImageUrl) {
    const downloaded = await downloadCandidate({
      url: normalizeImageUrl(source.directImageUrl),
      text: source.name,
      reason: 'directImageUrl'
    });
    return {
      ...downloaded,
      imageUrl: normalizeImageUrl(source.directImageUrl),
      attempts: []
    };
  }

  const pageResponse = await fetch(source.sourceUrl, {
    headers: {
      'user-agent': userAgent
    }
  });
  if (!pageResponse.ok) throw new Error(`source page HTTP ${pageResponse.status}`);
  const html = await pageResponse.text();
  const candidates = extractCandidates(html, source)
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, source)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  const attempts = [];
  for (const candidate of candidates) {
    try {
      const downloaded = await downloadCandidate(candidate);
      return {
        ...downloaded,
        imageUrl: candidate.url,
        attempts
      };
    } catch (error) {
      attempts.push(`${candidate.url} -> ${error.message}`);
    }
  }
  throw new Error(`no usable image. attempts: ${attempts.slice(0, 5).join('; ')}`);
}

function updateSeed(seed, source) {
  const item = seed.items.find((entry) => entry.id === source.id);
  if (!item) throw new Error(`missing seed item: ${source.id}`);
  item.images = [
    {
      url: `/assets/images/attractions/${source.targetFile}`,
      caption: source.name,
      source: source.sourceName,
      sourceUrl: source.sourceUrl,
      license: '教育版演示使用'
    },
    ...(item.images || []).slice(1)
  ];
}

async function readMiniprogramSeed() {
  const text = await fs.readFile(miniprogramSeedPath, 'utf8');
  const jsonText = text.replace(/^module\.exports\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(jsonText);
}

async function main() {
  await fs.mkdir(imageDir, { recursive: true });

  const sources = JSON.parse(await fs.readFile(sourcesPath, 'utf8'));
  const backendSeed = JSON.parse(await fs.readFile(backendSeedPath, 'utf8'));
  const miniprogramSeed = await readMiniprogramSeed();
  const report = ['# 景点图片抓取报告', '', `生成时间：${new Date().toISOString()}`, ''];

  for (const source of sources) {
    const outputPath = path.join(imageDir, source.targetFile);
    process.stdout.write(`Fetching ${source.id}... `);
    const result = await fetchImageForSource(source);
    await fs.writeFile(outputPath, result.buffer);
    updateSeed(backendSeed, source);
    updateSeed(miniprogramSeed, source);
    console.log(`${result.size.width}x${result.size.height}, ${Math.round(result.bytes / 1024)}KB`);
    report.push(
      `## ${source.name}`,
      '',
      `- ID：\`${source.id}\``,
      `- 文件：\`backend/public/assets/images/attractions/${source.targetFile}\``,
      `- 来源：${source.sourceName}`,
      `- 来源页：${source.sourceUrl}`,
      `- 实际图片 URL：${result.imageUrl}`,
      `- 尺寸：${result.size.width}x${result.size.height}`,
      `- 大小：${Math.round(result.bytes / 1024)}KB`,
      `- license：教育版演示使用`,
      ''
    );
  }

  await fs.writeFile(backendSeedPath, `${JSON.stringify(backendSeed, null, 2)}\n`);
  await fs.writeFile(miniprogramSeedPath, `module.exports = ${JSON.stringify(miniprogramSeed, null, 2)};\n`);
  await fs.writeFile(reportPath, `${report.join('\n')}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
