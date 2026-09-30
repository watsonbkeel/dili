#!/usr/bin/env bash
# 代码回滚：把 /opt/dili/current 切回上一个版本（或指定版本）。不改动数据目录。
# 用法：sudo bash rollback.sh [release-sha]
#   ASR 回滚到旧 Qwen 服务不需要回滚代码：见 docs/回滚说明.md（改 SPEECH_TO_TEXT_PROVIDER）。
set -euo pipefail
APP_ROOT=/opt/dili
TARGET="${1:-}"
if [ -n "$TARGET" ]; then
  TARGET_DIR="$APP_ROOT/releases/$TARGET"
else
  TARGET_DIR="$(cat "$APP_ROOT/previous_release" 2>/dev/null || true)"
fi
[ -n "$TARGET_DIR" ] && [ -d "$TARGET_DIR" ] || { echo "no rollback target; available:"; ls -1 "$APP_ROOT/releases"; exit 1; }
CURRENT="$(readlink -f "$APP_ROOT/current")"
echo "[rollback] $CURRENT -> $TARGET_DIR"
ln -sfn "$TARGET_DIR" "$APP_ROOT/current.tmp" && mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"
echo "$CURRENT" > "$APP_ROOT/previous_release"
systemctl restart dili.service
sleep 2
systemctl is-active --quiet dili.service && curl -fsS --max-time 5 http://127.0.0.1:13104/health && echo
