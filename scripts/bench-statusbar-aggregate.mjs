/* global document, MutationObserver, requestAnimationFrame, window */

import process from 'node:process'
import { existsSync } from 'node:fs'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const SAMPLE_COUNT = 1000
const RENDER_BUDGET_MS = 100
const STATUSBAR_SELECTOR = '[data-testid="statusbar"]'
const GENERATED_AT_ATTR = 'data-r8b-statusbar-generated-at'

function percentile(values, percentileRank) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil((percentileRank / 100) * sorted.length) - 1)
  return sorted[index]
}

function roundMetric(value) {
  return Math.round(value * 100) / 100
}

function summarize(samples) {
  return {
    max: roundMetric(Math.max(...samples)),
    min: roundMetric(Math.min(...samples)),
    p50: roundMetric(percentile(samples, 50)),
    p95: roundMetric(percentile(samples, 95)),
    p99: roundMetric(percentile(samples, 99)),
    samples: samples.length
  }
}

async function waitForMainWindow(electronApp) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const mainWindow = electronApp.windows().find((page) =>
      page.url().includes('/out/renderer/index.html')
      || page.url().includes('/out/renderer/index.html'.replace(/\//g, '\\'))
    )

    if (mainWindow) {
      await mainWindow.waitForLoadState('domcontentloaded')
      return mainWindow
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Timed out while waiting for DevHub main window')
}

async function closeElectronApp(electronApp) {
  try {
    await electronApp.evaluate(({ app }) => {
      app.quit()
    })
  } catch {
    // The process may already be closing.
  }

  await Promise.race([
    electronApp.close(),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, 8000)
      timer.unref?.()
    })
  ]).catch(() => undefined)
}

async function installRendererBenchmarkProbe(page) {
  await page.waitForSelector(STATUSBAR_SELECTOR, { timeout: 15_000 })
  await page.evaluate(({ attr, selector }) => {
    const existingCleanup = window.__devhubStatusbarBenchCleanup
    if (typeof existingCleanup === 'function') existingCleanup()

    const footer = document.querySelector(selector)
    if (!footer) throw new Error('Statusbar DOM node was not found')
    if (!window.devhub?.r8?.status?.onAggregate) {
      throw new Error('window.devhub.r8.status.onAggregate is not available')
    }

    const records = new Map()
    const waiters = new Map()

    const completeIfRendered = (generatedAt) => {
      const key = String(generatedAt)
      const record = records.get(key)
      if (!record || typeof record.renderedAt === 'number') return
      if (footer.getAttribute(attr) !== key) return
      record.renderedAt = performance.now()
      const waiter = waiters.get(key)
      if (waiter) {
        waiters.delete(key)
        waiter(record)
      }
    }

    const observer = new MutationObserver(() => {
      const generatedAt = footer.getAttribute(attr)
      if (generatedAt) completeIfRendered(generatedAt)
    })
    observer.observe(footer, { attributes: true, attributeFilter: [attr] })

    const unsubscribe = window.devhub.r8.status.onAggregate((aggregate) => {
      const key = String(aggregate.generatedAt)
      records.set(key, { generatedAt: aggregate.generatedAt, receivedAt: performance.now() })
      completeIfRendered(key)
      requestAnimationFrame(() => completeIfRendered(key))
    })

    window.__devhubStatusbarBenchWaitForRender = (generatedAt, timeoutMs) => {
      const key = String(generatedAt)
      const existing = records.get(key)
      if (existing && typeof existing.renderedAt === 'number') return Promise.resolve(existing)

      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          waiters.delete(key)
          reject(new Error(`Timed out waiting for statusbar render ${key}`))
        }, timeoutMs)
        waiters.set(key, (record) => {
          window.clearTimeout(timeout)
          resolve(record)
        })
      })
    }

    window.__devhubStatusbarBenchCleanup = () => {
      observer.disconnect()
      unsubscribe()
      delete window.__devhubStatusbarBenchWaitForRender
      delete window.__devhubStatusbarBenchCleanup
    }
  }, { attr: GENERATED_AT_ATTR, selector: STATUSBAR_SELECTOR })
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }

  const electronApp = await electron.launch({
    args: [APP_MAIN, '--enable-dev-obs'],
    env: { ...process.env, ENABLE_DEV_OBS: '1' }
  })

  try {
    const page = await waitForMainWindow(electronApp)
    await installRendererBenchmarkProbe(page)

    await electronApp.evaluate(() => {
      const hooks = globalThis.__DEVHUB_TEST_HOOKS__
      if (!hooks) throw new Error('Runtime test hooks are not available')
      hooks.setStatusAggregatorRunningForTests(false)
    })

    const samples = []
    const generatedAtValues = new Set()
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const result = await electronApp.evaluate(async () => {
        const hooks = globalThis.__DEVHUB_TEST_HOOKS__
        if (!hooks) throw new Error('Runtime test hooks are not available')
        return hooks.publishStatusAggregateNowForTests()
      })

      if (!result.success || !result.aggregate) {
        throw new Error(result.error ?? 'Statusbar aggregate publish failed')
      }

      const generatedAt = result.aggregate.generatedAt
      if (generatedAtValues.has(generatedAt)) {
        throw new Error(`Statusbar aggregate generatedAt was not unique: ${generatedAt}`)
      }
      generatedAtValues.add(generatedAt)

      const record = await page.evaluate(async ({ generatedAt: pushedGeneratedAt }) => {
        const waitForRender = window.__devhubStatusbarBenchWaitForRender
        if (typeof waitForRender !== 'function') {
          throw new Error('Statusbar benchmark renderer probe is not installed')
        }
        return waitForRender(pushedGeneratedAt, 2000)
      }, { generatedAt })

      samples.push(record.renderedAt - record.receivedAt)
    }

    const stats = summarize(samples)
    const passed = stats.samples === SAMPLE_COUNT && stats.p99 < RENDER_BUDGET_MS
    const payload = {
      budgetMs: RENDER_BUDGET_MS,
      label: 'BENCH-STATUSBAR-AGGREGATE',
      measurement: 'renderer status:aggregate receive to statusbar DOM commit',
      passed,
      stats
    }

    console.log(JSON.stringify(payload, null, 2))
    if (!passed) process.exitCode = 1

    await page.evaluate(() => {
      const cleanup = window.__devhubStatusbarBenchCleanup
      if (typeof cleanup === 'function') cleanup()
    }).catch(() => undefined)

    await electronApp.evaluate(() => {
      const hooks = globalThis.__DEVHUB_TEST_HOOKS__
      hooks?.setStatusAggregatorRunningForTests(true)
    }).catch(() => undefined)
  } finally {
    await closeElectronApp(electronApp)
  }
}

await main()
