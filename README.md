# 本地历史导览小程序

这是一个微信小程序 + Node 后端的 MVP，用本地历史地点资料库展示地图热点，并基于结构化资料生成可信导览讲解。

## 项目结构

- `miniprogram/`：微信小程序端，包含历史热点首页、地图、地点详情、导览生成和历史记录页面。
- `backend/`：Node HTTP API，负责读取 `backend/data/beijing-hotspots.seed.json` 历史地点资料库、百度百科来源字段预留、本地模板导览、缓存和历史记录。
- `.env.example`：后端环境变量模板。

## 本地运行

1. 启动后端：

```bash
cp .env.example .env
npm start
```

本轮导览生成固定使用本地模板基于 seed 资料生成，便于完整体验地图、列表、详情、导览和来源展示流程。未配置 `TENCENT_MAP_KEY` 时，旧定位接口仍使用示例数据。

2. 打开微信开发者工具：

- 导入项目根目录，或导入 `miniprogram/` 目录。
- AppID 可先使用测试号或替换 `miniprogram/project.config.json` 中的 `appid`。
- 本地调试时保持 `urlCheck: false`，或在开发者工具中勾选“不校验合法域名”。
- 小程序默认请求 `http://127.0.0.1:3000`，如需改后端地址，修改 `miniprogram/app.js` 的 `apiBaseUrl`。

## 后端 API

- `GET /health`：健康检查。
- `GET /api/geocode?address=`：手动输入城市、区县或地点，返回解析后的坐标。
- `GET /api/places?city=&q=&lat=&lng=&radius=`：返回历史地点列表，默认 `city=北京`，支持关键词和按距离排序。
- `GET /api/places/:id`：返回地点详情，包括摘要、时间线、图片来源和资料来源。
- `GET /api/nearby?lat=&lng=`：返回附近历史文化地点。
- `POST /api/story`：根据 `placeId` 或完整地点资料生成可信导览。
- `GET /api/history?userId=`：读取用户历史记录。
- `DELETE /api/history/:id?userId=`：删除单条历史记录。

`POST /api/story` 示例：

```json
{
  "userId": "local-user",
  "placeId": "beijing-palace-museum"
}
```

导览生成规则：

- 历史事实来自地点资料的 `summary`、`timeline`、`sources`。
- 如果资料不足，接口返回“资料不足，无法生成可信导览”。
- 当前实现固定使用本地模板，不会调用真实大模型，也不会把 `fetch failed` 暴露给小程序。

## 配置真实服务

在 `.env` 中配置：

```bash
TENCENT_MAP_KEY=你的腾讯位置服务Key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=你的模型Key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=4000
```

后端使用腾讯位置服务 WebService：

- 地点搜索：`https://apis.map.qq.com/ws/place/v1/search`
- 逆地址解析：`https://apis.map.qq.com/ws/geocoder/v1/`

AI 接口按 OpenAI Chat Completions 兼容格式调用，要求模型返回 JSON。

百度百科与图片搜索本阶段通过本地种子资料模拟，接口预留在 `backend/src/services/baiduProvider.js`。种子资料保留 `百度百科：地点名称` 和 `百度图片` 来源字段，未知 URL 和图片地址留空，前端显示占位图。

## 隐私与数据

- 小程序会请求位置权限，用于发现附近地点。
- 后端请求处理中会使用精确坐标，但历史记录只保存粗粒度坐标、地点和故事内容。
- 历史记录按本地匿名用户 ID 保存，当前 MVP 未接微信登录；上线前建议通过 `wx.login` 换取 openid。
- 历史页提供单条删除能力。

## 测试

```bash
npm test
```

测试覆盖坐标校验、故事缓存、历史记录和主要 API。
