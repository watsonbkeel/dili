# 部署与 AI 接手指南

本文面向接手开发者或后续 AI，说明如何在新服务器上继续运行本项目，并让微信小程序 AI 助手在真机环境可用。

## 一句话架构

```text
微信小程序
  -> 自有 HTTPS 后端域名
  -> Node 后端 /api/assistant 记录问答并转发
  -> OpenAI 兼容大模型接口
```

不要让小程序前端直接持有大模型 API Key。

## 关键目录

- `miniprogram/`：微信小程序端。
- `backend/src/server.js`：Node HTTP API 入口。
- `backend/src/services/assistant.js`：AI 助手外部模型转发逻辑。
- `backend/src/storage/dataStore.js`：本地运行时数据读写。
- `backend/data/beijing-hotspots.seed.json`：景点种子数据。
- `.env.example`：后端环境变量模板。

## 新服务器部署步骤

1. 拉取代码：

```bash
git clone https://github.com/chennuoinsz/dili.git
cd dili
```

2. 安装依赖：

```bash
npm install
```

3. 创建 `.env`：

```bash
cp .env.example .env
```

4. 编辑 `.env`，至少配置：

```bash
PORT=3000
DATA_DIR=backend/data
OPENAI_BASE_URL=https://api.bkeel.com
OPENAI_CHAT_COMPLETIONS_PATH=/v1/chat/completions
OPENAI_MODEL=gpt-5.4-mini
OPENAI_API_KEY=真实模型Key
OPENAI_TIMEOUT_MS=4000
```

安全要求：

- `.env` 不提交 Git。
- 不要把真实 key 写入 README、docs、seed 数据或小程序前端。

5. 启动后端：

```bash
npm start
```

生产环境建议使用 pm2 或 systemd。

pm2 示例：

```bash
pm2 start backend/src/server.js --name local-history-guide
pm2 save
```

## HTTPS 域名要求

微信小程序体验版/正式版不能使用：

```text
http://IP:端口
```

必须使用 HTTPS 合法域名，例如：

```text
https://lhg-api.example.com
```

用 nginx 反向代理到后端：

```nginx
server {
    listen 443 ssl http2;
    server_name lhg-api.example.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

然后在微信公众平台配置 request 合法域名：

```text
https://lhg-api.example.com
```

## 小程序配置

修改：

```text
miniprogram/app.js
```

把：

```js
apiBaseUrl: 'http://175.178.194.44:3000'
```

改成 HTTPS 后端域名：

```js
apiBaseUrl: 'https://lhg-api.example.com'
```

如果图片继续使用 `https://diary.bkeel.com/uploads/attractions`，保持：

```js
assetBaseUrl: 'https://diary.bkeel.com/uploads/attractions'
```

## 验证命令

后端健康检查：

```bash
curl https://lhg-api.example.com/health
```

景点数据：

```bash
curl 'https://lhg-api.example.com/api/places?city=北京'
```

AI 助手：

```bash
curl -X POST https://lhg-api.example.com/api/assistant \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: deploy-test' \
  -d '{"question":"故宫有什么建筑特色？","context":{"type":"city","city":"北京"}}'
```

判断返回：

- `source: "ai"`：外部大模型已接通。
- `source: "template"`：没有配置 `OPENAI_API_KEY`。
- `source: "template-fallback"`：后端可用，但外部模型请求失败。

## 测试

提交前运行：

```bash
npm test
node --check backend/src/server.js
node --check backend/src/services/assistant.js
node --check backend/src/config.js
```

## 常见问题

### 手机体验版 AI 不通，但本机 curl 通

通常是小程序拦截了 `http://IP:端口`。请换成 HTTPS 域名，并在微信公众平台配置 request 合法域名。

### 3000 端口 Connection refused

表示服务器可达，但端口没有服务监听。检查：

```bash
ss -lntp | grep :3000
```

### 3000 端口 Connection timed out

通常是云安全组或系统防火墙未放行 TCP 3000。正式小程序不建议暴露 3000，应通过 HTTPS 反向代理访问。

### AI 返回模板，不是大模型

检查 `.env`：

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_CHAT_COMPLETIONS_PATH=
OPENAI_MODEL=
```

并查看服务日志。

## 接手建议

先读这些文件：

1. `README.md`
2. `docs/本地历史旅行导览小程序产品需求文档.md`
3. `docs/按image1设计图开发三类人群模式指令.md`
4. `backend/src/server.js`
5. `backend/src/services/assistant.js`
6. `miniprogram/app.js`
7. `miniprogram/pages/assistant/assistant.js`
8. `miniprogram/utils/api.js`
