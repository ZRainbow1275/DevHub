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
    const result = await electronApp.evaluate(async () => {
      const hooks = globalThis.__DEVHUB_TEST_HOOKS__
      if (!hooks) {
        throw new Error('Runtime test hooks are not available')
      }

      return hooks.runPowerShellConcurrencyProbeForTests({
        count: 12,
        sampleIntervalMs: 20,
        sleepMs: 500,
        timeoutMs: 5000
      })
    })

    const checks = [
      assertCondition(result.fulfilledCount === 12, '全部 12 个真实 PowerShell 任务完成'),
      assertCondition(result.rejectedCount === 0, '无任务被拒绝'),
      assertCondition(result.maxActiveCount <= 2, '并发上限始终不超过 2'),
      assertCondition(result.maxRunningPids <= 2, '同时存在的 PowerShell 子进程数不超过 2'),
      assertCondition(result.maxQueuedCount >= 10, '队列峰值至少达到 10，证明额外任务进入等待队列'),
      assertCondition(result.completedCount >= 12, 'Gateway completedCount 增量至少覆盖本次 12 个 probe 任务'),
      assertCondition(result.failedCount === 0, 'Gateway failedCount 增量为 0'),
      assertCondition(result.timedOutCount === 0, 'Gateway timedOutCount 增量为 0'),
      assertCondition(result.abortedCount === 0, 'Gateway abortedCount 增量为 0'),
      assertCondition(result.durationMs >= 2500, '总耗时体现出 semaphore 分批执行，而非一次性并发跑完'),
      assertCondition(result.durationMs <= 15000, '总耗时仍处于可接受的 bench 窗口内')
    ]

    const passed = checks.every((check) => check.pass)
    const payload = {
      checks,
      label: 'BENCH-X6',
      passed,
      result
    }

    console.log(JSON.stringify(payload, null, 2))
    if (!passed) {
      process.exitCode = 1
    }
  } finally {
    await electronApp.close()
  }
}

await main()
