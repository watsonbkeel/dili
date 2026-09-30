#!/usr/bin/env bash
# 备份 dili 运行数据（store.json + 图片目录），生成带 SHA256 清单的 tar.gz。只读源目录。
# 可在旧服务器或新服务器上运行。
# 用法：bash backup-data.sh <DATA_DIR> <ASSET_DIR> <OUTPUT_DIR>
#   旧服务器示例：bash backup-data.sh /home/chennuo/project/dili/backend/data /home/chennuo/project/dili/backend/public/assets ~/dili-backup
#   新服务器示例：sudo -u dili bash backup-data.sh /var/lib/dili/data /var/lib/dili/assets /var/lib/dili/backups
set -euo pipefail
DATA_DIR="${1:?DATA_DIR}"; ASSET_DIR="${2:?ASSET_DIR}"; OUT_DIR="${3:?OUTPUT_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
umask 077
mkdir -p "$OUT_DIR" "$WORK/dili-backup/data" "$WORK/dili-backup/assets"

[ -f "$DATA_DIR/store.json" ] || { echo "store.json not found in $DATA_DIR — refusing to create an empty backup"; exit 1; }
# 复制期间写入可能导致不一致：先拷贝再校验 JSON 合法
cp -a "$DATA_DIR/." "$WORK/dili-backup/data/"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$WORK/dili-backup/data/store.json" \
  || { echo "copied store.json is not valid JSON (concurrent write?) — retry"; exit 1; }
[ -d "$ASSET_DIR" ] && cp -a "$ASSET_DIR/." "$WORK/dili-backup/assets/"

( cd "$WORK/dili-backup" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
FILES="$(wc -l < "$WORK/dili-backup/SHA256SUMS" | tr -d ' ')"
ARCHIVE="$OUT_DIR/dili-data-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK" dili-backup
( cd "$OUT_DIR" && sha256sum "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256" )
echo "[backup] $ARCHIVE files=$FILES"
cat "$ARCHIVE.sha256"
