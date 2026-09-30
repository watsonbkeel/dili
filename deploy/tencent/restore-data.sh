#!/usr/bin/env bash
# 把 backup-data.sh 产出的归档恢复到新服务器数据目录。
# 安全措施：校验归档 sha256 与内部 SHA256SUMS；恢复前先把现有数据再备份一份；需要 --yes 才会写入。
# 用法：sudo bash restore-data.sh <archive.tar.gz> [--yes]
set -euo pipefail
ARCHIVE="${1:?archive}"; CONFIRM="${2:-}"
DATA_ROOT=/var/lib/dili
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -f "$ARCHIVE.sha256" ]; then
  ( cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$ARCHIVE").sha256" )
else
  echo "WARN: $ARCHIVE.sha256 not found; skipping outer checksum"
fi
tar -xzf "$ARCHIVE" -C "$WORK"
( cd "$WORK/dili-backup" && sha256sum -c --quiet SHA256SUMS ) && echo "[restore] inner checksums OK"
node -e "const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('[restore] store.json keys:',Object.keys(s).map(k=>k+'='+(Array.isArray(s[k])?s[k].length:Object.keys(s[k]||{}).length)).join(' '))" "$WORK/dili-backup/data/store.json"
echo "[restore] asset files: $(find "$WORK/dili-backup/assets" -type f | wc -l)"

if [ "$CONFIRM" != "--yes" ]; then
  echo "[restore] dry run only. Re-run with --yes to write into $DATA_ROOT"
  exit 0
fi

# 恢复前保留现有数据
if [ -f "$DATA_ROOT/data/store.json" ] || [ -n "$(ls -A "$DATA_ROOT/assets" 2>/dev/null)" ]; then
  PRE="$DATA_ROOT/backups/pre-restore-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$PRE"
  cp -a "$DATA_ROOT/data" "$PRE/" 2>/dev/null || true
  cp -a "$DATA_ROOT/assets" "$PRE/" 2>/dev/null || true
  echo "[restore] existing data saved to $PRE"
fi

systemctl stop dili.service 2>/dev/null || true
cp -a "$WORK/dili-backup/data/." "$DATA_ROOT/data/"
cp -a "$WORK/dili-backup/assets/." "$DATA_ROOT/assets/"
chown -R dili:dili "$DATA_ROOT/data" "$DATA_ROOT/assets"
# 恢复后再次逐文件校验
( cd "$WORK/dili-backup" && sed 's#  \./data/#  '"$DATA_ROOT"'/data/#; s#  \./assets/#  '"$DATA_ROOT"'/assets/#' SHA256SUMS | sha256sum -c --quiet ) \
  && echo "[restore] restored files verified"
systemctl start dili.service 2>/dev/null || true
