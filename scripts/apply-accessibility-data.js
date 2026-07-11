const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifestPath = path.join(__dirname, 'beijing-accessibility-data.json');
const backendPath = path.join(root, 'backend', 'data', 'beijing-hotspots.seed.json');
const miniprogramPath = path.join(root, 'miniprogram', 'data', 'beijing-hotspots.seed.js');

const levelDetails = {
  full: { hasAccessibleRoute: true, label: '有无障碍通道', wheelchairTourable: true },
  partial: { hasAccessibleRoute: true, label: '部分区域有无障碍通道', wheelchairTourable: true },
  none: { hasAccessibleRoute: false, label: '暂无连续无障碍通道', wheelchairTourable: false }
};

function readMiniprogramSeed() {
  const text = fs.readFileSync(miniprogramPath, 'utf8');
  return JSON.parse(text.replace(/^module\.exports\s*=\s*/, '').replace(/;\s*$/, ''));
}

function applyManifest(seed, manifest) {
  const byId = new Map(manifest.map((entry) => [entry.id, entry]));
  if (byId.size !== seed.items.length) {
    throw new Error(`Expected ${seed.items.length} accessibility records, received ${byId.size}`);
  }
  seed.items.forEach((place) => {
    const entry = byId.get(place.id);
    if (!entry) throw new Error(`Missing accessibility record for ${place.id}`);
    const level = levelDetails[entry.level];
    if (!level) throw new Error(`Invalid accessibility level for ${place.id}: ${entry.level}`);
    place.walkingTimeMinutes = entry.walkingTimeMinutes;
    place.walkingTimeNote = '按主要开放区域的一般游览过程估算';
    place.accessibility = {
      level: entry.level,
      ...level,
      summary: entry.summary,
      mapUrl: entry.mapUrl || '',
      sourceUrl: entry.sourceUrl || '',
      updatedAt: '2026-07-10',
      disclaimer: '无障碍设施可能随开放区域和维护情况变化，出发前请向景区确认。'
    };
  });
  return seed;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const backend = applyManifest(JSON.parse(fs.readFileSync(backendPath, 'utf8')), manifest);
const miniprogram = applyManifest(readMiniprogramSeed(), manifest);

fs.writeFileSync(backendPath, `${JSON.stringify(backend, null, 2)}\n`);
fs.writeFileSync(miniprogramPath, `module.exports = ${JSON.stringify(miniprogram, null, 2)};\n`);
