# AI 助手接入外部大模型接口开发 Prompt

把下面这段发给主对话 AI，用来继续开发当前微信小程序的 AI 助手接口接入。

```text
请继续开发当前微信小程序，让小程序 AI 助手能调用我提供的外部 AI 大模型接口。

注意：
- 先不要大范围重构。
- 只围绕 AI 助手调用链路修改。
- 保持现有页面结构、聊天 UI、快捷问题、热门推荐、语音播报逻辑不变。
- 先检查当前代码里 AI 助手页面、前端 api 封装、后端 `/api/assistant` 接口和配置文件。
- 找到当前 AI 不可用的原因，再做最小改动。
- 不要把 API Key 写死在小程序前端。
- 不要把 API Key 写进前端代码、seed 数据或可公开提交的文档。
- 小程序仍然请求自己的后端，由后端转发到第三方 AI 接口。
- 兼容没有配置接口时的本地模板回答，避免页面直接报错。

我要接入的 AI 大模型接口信息如下：

- 接口 Base URL：`https://api.bkeel.com`
- 模型名称：`gpt-5.4-mini`
- API Key：通过后端环境变量配置，不要写进代码。
- 建议环境变量：
  - `OPENAI_BASE_URL=https://api.bkeel.com`
  - `OPENAI_MODEL=gpt-5.4-mini`
  - `OPENAI_API_KEY=<在服务器环境变量中填写我提供的 key>`

开发要求：

1. 梳理当前 AI 调用链路：
   - `miniprogram/pages/assistant/assistant.*`
   - `miniprogram/utils/api.js`
   - `backend/src/server.js`
   - `backend/src/services/assistant.js`
   - `backend/src/config.js`
   - 相关测试文件

2. 根据上面的接口，修改后端 AI 调用逻辑：
   - 从环境变量读取接口地址、Key、模型等配置。
   - 后端 `/api/assistant` 接收小程序问题和上下文。
   - 后端调用第三方 AI 接口。
   - 如果该接口兼容 OpenAI Chat Completions 格式，优先复用现有 OpenAI 兼容调用逻辑。
   - 如果当前代码只支持故事生成 AI，不支持助手 AI，需要补齐助手接口的外部模型调用。
   - 解析第三方响应，返回小程序当前页面需要的格式，例如 `{ answer: "..." }`。
   - 第三方接口失败时返回可读错误或降级模板回答，不要让前端崩溃。

3. 鉴权要求：
   - 后端请求第三方接口时使用 `Authorization: Bearer ${OPENAI_API_KEY}`。
   - 不允许小程序前端直接持有或发送大模型 API Key。
   - 不允许把明文 Key 写入仓库。

4. 如有必要，更新 `.env.example` 或 README，说明需要配置哪些环境变量：
   - `OPENAI_BASE_URL`
   - `OPENAI_MODEL`
   - `OPENAI_API_KEY`

5. 如有必要，补充或更新后端测试：
   - mock 第三方 AI 成功响应。
   - mock 第三方 AI 失败响应。
   - 无接口配置时仍走本地模板回答。

6. 运行验证：
   - `npm test`
   - 相关 JS 文件 `node --check`
   - 如果可以，启动后端并用 curl 测试 `/api/assistant`

7. 最后告诉我：
   - 修改了哪些文件。
   - 需要我在服务器上配置哪些环境变量。
   - 小程序前端是否需要重新上传。
   - 后端是否需要重新部署。
   - 如何验证 AI 助手已经接通。

安全要求：
- 我会单独把真实 API Key 配置到服务器环境变量中。
- 如果你在当前对话中看到明文 Key，不要把它写入代码或文档。
- 如果发现仓库里已有明文 Key，先提示我并改成环境变量读取。
```

## 接口配置说明

本次要接入的大模型服务：

```text
OPENAI_BASE_URL=https://api.bkeel.com
OPENAI_MODEL=gpt-5.4-mini
OPENAI_API_KEY=<服务器环境变量中配置真实 key>
```

真实 Key 不建议写入仓库文档。部署时请在服务器进程环境变量或 `.env` 文件中配置，并确保 `.env` 不提交到 Git。
