#!/usr/bin/env node
// 部署前/后自检：读取 ENV_FILE（或 .env），只输出"是否配置"和数量，绝不打印密钥值。
// 不调用任何计费接口。用法：ENV_FILE=/etc/dili/dili.env node scripts/check-env.js [--strict]
const { readConfig } = require('../backend/src/config');
const { runtimeCheck } = require('../backend/src/services/runtimeCheck');

async function main() {
  const strict = process.argv.includes('--strict');
  const config = readConfig();
  const report = await runtimeCheck({ config });
  console.log(JSON.stringify(report, null, 2));
  // ASSISTANT 未配置时会走模板兜底，不视为阻断；其它问题在 --strict 下阻断部署
  const blocking = report.problems.filter((item) => !item.startsWith('ASSISTANT_NOT_CONFIGURED'));
  if (blocking.length) {
    console.error(`[check-env] problems: ${blocking.join(', ')}`);
    if (strict) process.exit(1);
  } else {
    console.error('[check-env] ok');
  }
}

main().catch((error) => {
  console.error(`[check-env] failed: ${error.code || error.message}`);
  process.exit(2);
});
