import process from 'node:process'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'

function assertCondition(condition, message) {
  return {
    message,
    pass: Boolean(condition)
  }
}

async function main() {
  const electronApp = await electron.launch({
    args: [APP_MAIN],
    env: {
      ...process.env,
      ENABLE_DEV_OBS: '1'
    }
  })

  try {
    const started = await electronApp.evaluate(async () => {
      const hooks = globalThis.__DEVHUB_TEST_HOOKS__
      if (!hooks) {
        throw new Error('Runtime test hooks are not available')
      }

      return hooks.startPowerShellHoldProbeForTests({
        count: 4,
        sleepMs: 8000,
        timeoutMs: 12000
      })
    })

    const shutdown = await electronApp.evaluate(async () => {
      const hooks = globalThis.__DEVHUB_TEST_HOOKS__
      if (!hooks) {
        throw new Error('Runtime test hooks are not available')
      }

      return hooks.disposeRuntimeForTests()
    })

    const checks = [
      assertCondition(started.activeCount > 0 || started.queuedCount > 0, '关停前已存在真实 PowerShell probe 任务'),
      assertCondition(shutdown.killedChildren >= 1, 'shutdownPowerShellGateway 至少回收 1 个活跃 PowerShell 子进程'),
      assertCondition(shutdown.report.failed.length === 0, 'DisposalReport.failed 为空'),
      assertCondition(shutdown.report.timedOut.length === 0, 'DisposalReport.timedOut 为空'),
      assertCondition(shutdown.report.remainingAfter.length === 0, 'DisposalRegistry 关停后无残留 entry'),
      assertCondition(shutdown.report.durationMs <= 5000, '统一退出清理链在 5 秒窗口内完成'),
      assertCondition(shutdown.report.succeeded.length >= 8, '全部已注册清理器进入 succeeded 列表')
    ]

    const passed = checks.every((check) => check.pass)
    const payload = {
      checks,
      label: 'BENCH-X7',
      passed,
      shutdown,
      started
    }

    console.log(JSON.stringify(payload, null, 2))
    if (!passed) {
      process.exitCode = 1
    }
  } finally {
    await electronApp.close().catch(() => {})
  }
}

await main()
