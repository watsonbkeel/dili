# AGENTS.md — dili 项目规则（给 AI/协作者）

- 开发在任务分支进行；不直接推送 `main`，不强推。
- 不提交 `.env`、`backend/data/store.json`、`node_modules`、任何密钥或用户数据；提交前扫描敏感信息。
- 不 `cat` 整份 `.env`、不打印完整环境变量；需要核对时只输出“是否配置”（`npm run check-env`）。
- 测试必须离线可跑：`npm test` 使用 mock，不读取真实凭证、不产生计费。
- 真实计费接口（腾讯云 ASR、TokenHub 问答、视觉模型）需 watson 授权，每类最多 3 次，失败和重试也计入。
- 对外接口保持兼容：`POST /api/transcriptions`（multipart 字段 `file`）返回 `{text}`；小程序代码无需随后端 ASR 更换而修改。
- 文字问答用 `ASSISTANT_*`，视觉/故事用 `OPENAI_*`，两者互不影响（`visionCompletionsUrl` 只读 `OPENAI_*`）。
- 单进程部署（systemd `dili`），不要用 PM2 cluster/多实例——限流与并发计数在内存中。
- 生产 DNS 切换、停止旧服务、删除旧服务器/旧数据，必须先得到 watson 确认。
- 部署/回滚/备份见 `docs/腾讯云部署说明.md`、`docs/回滚说明.md`、`deploy/tencent/`。
