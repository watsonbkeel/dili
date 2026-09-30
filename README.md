# 本地历史导览小程序

这是一个微信小程序 + Node 后端项目，用本地历史地点资料库展示北京历史热点，并面向普通用户、低视力用户、行动不便用户提供不同导览体验。AI 助手由小程序请求自有后端，后端负责记录问答并转发到 OpenAI 兼容大模型接口。

## 当前能力

- 三类使用模式：普通用户、低视力用户、行动不便用户。
- 首次进入选择使用方式，之后可在首页或“我的”页切换模式。
- 景点列表、地图、路线、详情页、收藏、历史记录。
- 低视力模式提供大字、高对比度、简化语音控制。
- 行动不便模式提供少步行、休息点、无障碍信息提示。
- AI 助手支持快捷问题、热门推荐、语音播报。
- 后端 `/api/assistant` 支持问答记录；配置 API Key 后转发到外部大模型，未配置时返回本地模板回答。

## 项目结构

- `miniprogram/`：微信小程序端，包含模式选择、三类首页、地图、路线、景点详情、AI 助手、收藏和历史记录页面。
- `backend/`：Node HTTP API，负责景点/路线数据、AI 助手转发、问答记录、导览缓存和历史记录。
- `backend/data/beijing-hotspots.seed.json`：北京历史地点种子数据。
- `backend/data/store.json`：运行时数据文件，保存历史记录、AI 问答记录和缓存；该文件不提交。
- `docs/`：产品需求、设计参考、图片抓取记录、开发提示和部署交接文档。
- `.env.example`：后端环境变量模板。

## 快速开始

环境要求：

- Node.js 18 或更高版本。
- npm。
- 微信开发者工具。

安装依赖：

```bash
npm install
```

启动后端：

```bash
cp .env.example .env
npm start
```

未配置 `OPENAI_API_KEY` 时，AI 助手会返回本地模板回答；配置后会由后端转发到外部大模型。未配置 `TENCENT_MAP_KEY` 时，定位相关接口使用示例数据。

打开微信开发者工具：

- 导入项目根目录，或导入 `miniprogram/` 目录。
- AppID 可先使用测试号或替换 `project.config.json` 中的 `appid`。
- 本地调试时保持 `urlCheck: false`，或在开发者工具中勾选“不校验合法域名”。
- 小程序请求地址配置在 `miniprogram/app.js` 的 `apiBaseUrl`。
- 真机体验版/正式版必须使用 HTTPS 合法域名，不能使用 `http://IP:端口`。

## 后端 API

- `GET /health`：健康检查。
- `GET /api/geocode?address=`：手动输入城市、区县或地点，返回解析后的坐标。
- `GET /api/places?city=&q=&lat=&lng=&radius=`：返回历史地点列表，默认 `city=北京`，支持关键词和按距离排序。
- `GET /api/places/:id`：返回地点详情，包括摘要、时间线、图片来源和资料来源。
- `GET /api/nearby?lat=&lng=`：返回附近历史文化地点。
- `GET /api/routes`：返回推荐路线。
- `POST /api/story`：根据 `placeId` 或完整地点资料生成可信导览。
- `POST /api/assistant`：AI 助手问答。后端记录问题和回答，并在有模型配置时转发到外部模型。
- `POST /api/transcriptions`：接收小程序录音（multipart 字段 `file`，16k 单声道 wav，≤60 秒），默认调用腾讯云一句话识别 SentenceRecognition，返回 `{ text, provider, requestId }`。设 `SPEECH_TO_TEXT_PROVIDER=openai-compatible` 可回滚到旧的本地 Qwen3 ASR。失败时返回 `{ error, code }`（如 `ASR_NOT_CONFIGURED`、`ASR_TIMEOUT`、`ASR_BALANCE`）。
- `POST /api/recognize`：接收拍摄图片和地理位置，并调用 `OPENAI_VISION_MODEL` 视觉模型（当前 TokenHub `deepseek/deepseek-flash`）返回动态景点或文物识别结果。
- `GET /api/history?userId=`：读取用户历史记录。
- `DELETE /api/history/:id?userId=`：删除单条历史记录。

`POST /api/assistant` 示例：

```bash
curl -X POST http://127.0.0.1:13104/api/assistant \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: local-user' \
  -d '{"question":"故宫有什么建筑特色？","context":{"type":"city","city":"北京"}}'
```

返回中的 `source` 含义：

- `ai`：已调用外部大模型。
- `template`：未配置 API Key，使用本地模板。
- `template-fallback`：已配置 API Key，但外部模型请求失败，降级到本地模板。

## 环境变量

完整模板见 [.env.example](.env.example)（含腾讯云 ASR、限流、HOST、ADMIN_TOKEN 等新变量）。常用项：

```bash
HOST=127.0.0.1
PORT=13104
DATA_DIR=backend/data
ASSET_DIR=backend/public/assets
TENCENT_MAP_KEY=你的腾讯位置服务Key
OPENAI_BASE_URL=https://tokenhub.tencentmaas.com
OPENAI_CHAT_COMPLETIONS_PATH=/v1/chat/completions
OPENAI_API_KEY=你的模型Key
OPENAI_MODEL=deepseek/deepseek-flash
OPENAI_VISION_MODEL=deepseek/deepseek-flash
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_TOKENS=600
ASSISTANT_BASE_URL=https://tokenhub.tencentmaas.com
ASSISTANT_CHAT_COMPLETIONS_PATH=/v1/chat/completions
ASSISTANT_API_KEY=你的TokenHub模型Key
ASSISTANT_MODEL=deepseek/deepseek-flash
ASSISTANT_TIMEOUT_MS=30000
ASSISTANT_MAX_TOKENS=2000
SPEECH_TO_TEXT_PROVIDER=tencent
TENCENTCLOUD_SECRET_ID=
TENCENTCLOUD_SECRET_KEY=
TENCENT_ASR_ENGINE=16k_zh
ASR_TIMEOUT_MS=15000
ASR_MAX_RETRIES=1
```

安全要求：

- 不要把 `.env` 提交到 Git。
- 不要把 `OPENAI_API_KEY` 写进小程序前端、seed 数据或文档。
- 小程序只请求自己的后端，由后端带 key 转发。

本地静态资源：

- `ASSET_DIR` 会被后端映射到 `/assets`。
- 默认目录是 `backend/public/assets`。
- 例如把 `demo.jpg` 放到 `backend/public/assets/images/demo.jpg` 后，可通过 `https://dili.bkeel.com/assets/images/demo.jpg` 访问。

AI 助手优先使用独立的 `ASSISTANT_*` 配置，拍照识别继续使用 `OPENAI_API_KEY`、`OPENAI_BASE_URL` 和 `OPENAI_VISION_MODEL`。两套配置互不影响；未配置 `ASSISTANT_*` 时，AI 助手才兼容回退到 `OPENAI_*`。

拍照识别默认请求路径为：

```text
https://tokenhub.tencentmaas.com/v1/chat/completions
```

若第三方服务路径不是 `/v1/chat/completions`，可分别通过 `ASSISTANT_CHAT_COMPLETIONS_PATH` 或 `OPENAI_CHAT_COMPLETIONS_PATH` 调整。

## 小程序发布注意事项

微信体验版/正式版需要：

- `apiBaseUrl` 使用 HTTPS 域名，例如 `https://dili.bkeel.com`。
- 在微信公众平台配置 request 合法域名。
- 图片资源通过 `https://dili.bkeel.com/assets/...` 访问时，也要在下载/图片相关合法域名中确认。
- 不要使用 `http://IP:端口` 作为正式后端地址。

腾讯云部署（systemd 单实例 + 独立 Nginx 站点 + 代码/数据分离）见 [docs/腾讯云部署说明.md](docs/腾讯云部署说明.md)，回滚见 [docs/回滚说明.md](docs/回滚说明.md)，验收记录见 [docs/迁移验收报告.md](docs/迁移验收报告.md)。

常用命令：

```bash
npm test                                   # 离线自动化测试（mock，不计费）
ENV_FILE=/etc/dili/dili.env npm run check-env   # 配置/存储自检，只输出是否配置
npm run smoke -- https://dili.bkeel.com    # 非计费冒烟测试
```

已知风险：`X-User-Id` 由客户端自报，不是身份认证，只用于区分历史记录，不能作为权限依据。

旧版交接见 [docs/部署与AI接手指南.md](docs/部署与AI接手指南.md)。

## 设计与数据说明

- 景点图片 URL 当前主要指向 `https://dili.bkeel.com/assets/images/attractions/`。
- 如新增景点图片，可放入 `backend/public/assets/images/attractions/`，再把 seed 数据中的 `images[].url` 更新为完整 HTTPS 地址。
- 故事导览仍优先使用本地结构化资料模板，避免编造未在资料库中出现的历史细节。
- 行动不便模式中的无障碍信息包含演示数据，页面中已提示出发前以景区官方信息为准。

## 隐私与数据

- 小程序会请求位置权限，用于发现附近地点。
- 后端请求处理中会使用精确坐标，但历史记录只保存粗粒度坐标、地点和故事内容。
- AI 助手记录保存用户问题、回答、来源、上下文和时间。
- 历史记录按本地匿名用户 ID 保存，当前未接微信登录；上线前建议通过 `wx.login` 换取 openid。
- 历史页提供单条删除能力。

## 测试

```bash
npm test
```

测试覆盖坐标校验、故事缓存、历史记录、AI 助手转发/降级和主要 API。
