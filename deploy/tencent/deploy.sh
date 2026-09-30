#!/usr/bin/env bash
# 在新腾讯云服务器上以 sudo 执行。幂等；不会删除或覆盖 /var/lib/dili 下已有数据。
# 用法：sudo bash deploy/tencent/deploy.sh <release-tarball.tar.gz> [git-sha]
#   release 包由本机 `git archive` 生成（见 docs/腾讯云部署说明.md）。
set -euo pipefail

TARBALL="${1:?usage: deploy.sh <release.tar.gz> [sha]}"
SHA="${2:-$(date +%Y%m%d%H%M%S)}"
APP_ROOT=/opt/dili
RELEASE_DIR="$APP_ROOT/releases/$SHA"
DATA_ROOT=/var/lib/dili
ENV_FILE=/etc/dili/dili.env
NODE_BIN="$(command -v node || true)"

log() { printf '[deploy] %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "must run as root (sudo)"; exit 1; }
[ -n "$NODE_BIN" ] || { echo "node not found; install Node >= 18 first"; exit 1; }
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || { echo "node >= 18 required, got $NODE_MAJOR"; exit 1; }
[ "$NODE_BIN" = /usr/bin/node ] || log "WARN: node at $NODE_BIN; dili.service uses /usr/bin/node"

# 1. 运行用户与目录（代码与数据分离）
id dili >/dev/null 2>&1 || useradd --system --home-dir "$APP_ROOT" --shell /usr/sbin/nologin dili
install -d -o root -g root -m 755 "$APP_ROOT" "$APP_ROOT/releases"
install -d -o dili -g dili -m 750 "$DATA_ROOT" "$DATA_ROOT/data" "$DATA_ROOT/assets" "$DATA_ROOT/backups"
install -d -o root -g dili -m 750 /etc/dili

# 2. 解包新版本
if [ -d "$RELEASE_DIR" ]; then
  log "release $SHA already exists; reusing"
else
  install -d -o root -g root -m 755 "$RELEASE_DIR"
  tar -xzf "$TARBALL" -C "$RELEASE_DIR"
fi
cd "$RELEASE_DIR"
log "installing production dependencies"
npm ci --omit=dev --no-audit --no-fund >/dev/null
chown -R root:root "$RELEASE_DIR"
chmod -R go-w "$RELEASE_DIR"

# 3. 图片：仅在数据目录为空时从 release 初始化（已迁移的旧图片不会被覆盖）
if [ -z "$(ls -A "$DATA_ROOT/assets" 2>/dev/null)" ]; then
  log "seeding assets from release (data dir empty)"
  cp -a "$RELEASE_DIR/backend/public/assets/." "$DATA_ROOT/assets/"
  chown -R dili:dili "$DATA_ROOT/assets"
fi

# 4. 配置检查（不打印值）
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE; create it with scripts/merge-env.js first"; exit 1; }
chown root:dili "$ENV_FILE"; chmod 640 "$ENV_FILE"
sudo -u dili env ENV_FILE="$ENV_FILE" "$NODE_BIN" "$RELEASE_DIR/scripts/check-env.js" >/dev/null || true

# 5. 切换 current 并记录上一个版本（供回滚）
if [ -L "$APP_ROOT/current" ]; then
  readlink -f "$APP_ROOT/current" > "$APP_ROOT/previous_release"
fi
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current.tmp" && mv -Tf "$APP_ROOT/current.tmp" "$APP_ROOT/current"

# 6. systemd
install -m 644 "$RELEASE_DIR/deploy/tencent/dili.service" /etc/systemd/system/dili.service
systemctl daemon-reload
systemctl enable dili.service >/dev/null
systemctl restart dili.service
sleep 2
systemctl is-active --quiet dili.service || { journalctl -u dili -n 30 --no-pager; exit 1; }

# 7. 本机健康检查
curl -fsS --max-time 5 http://127.0.0.1:13104/health && echo
log "deployed $SHA -> $APP_ROOT/current"
log "Nginx 站点需单独安装：deploy/tencent/nginx-dili.conf（证书就绪后 nginx -t && systemctl reload nginx）"
