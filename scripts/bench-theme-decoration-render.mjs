/* global document, window */

import process from 'node:process'
import { existsSync } from 'node:fs'
import { _electron as electron } from 'playwright'

const APP_MAIN = 'out/main/index.js'
const ITERATIONS_PER_DECORATION = Number.parseInt(process.env.THEME_DECORATION_ITERATIONS ?? '100', 10)
const RENDER_BUDGET_MS = Number.parseFloat(process.env.THEME_DECORATION_P99_BUDGET_MS ?? '16')
const DECORATION_CHANGE_EVENT = 'devhub:theme-decoration-change'
const SAFE_SVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="none" stroke="currentColor"/></svg>'

function roundMetric(value) {
  return Math.round(value * 100) / 100
}

function percentile(values, percentileRank) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil((percentileRank / 100) * sorted.length) - 1)
  return sorted[index]
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
    const mainWindow = electronApp.windows().find(page =>
      page.url().includes('/out/renderer/index.html')
      || page.url().includes('/out/renderer/index.html'.replace(/\//g, '\\'))
    )
    if (mainWindow) {
      await mainWindow.waitForLoadState('domcontentloaded')
      return mainWindow
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Timed out while waiting for DevHub main window')
}

async function closeElectronApp(electronApp) {
  try {
    await electronApp.evaluate(({ app }) => {
      app.quit()
    })
  } catch (error) {
    if (process.env.DEBUG_THEME_DECORATION_BENCH) console.warn(error)
  }

  await Promise.race([
    electronApp.close(),
    new Promise(resolve => {
      const timer = setTimeout(resolve, 8000)
      timer.unref?.()
    })
  ]).catch(() => undefined)
}

async function dismissAutoDiscoveryIfPresent(page) {
  const skipButton = page.locator('button').filter({ hasText: '跳过' }).first()
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click()
  }
}

async function main() {
  if (!existsSync(APP_MAIN)) {
    throw new Error(`Missing ${APP_MAIN}. Run pnpm -C devhub build first.`)
  }

  const electronApp = await electron.launch({ args: [APP_MAIN] })

  try {
    const page = await waitForMainWindow(electronApp)
    await dismissAutoDiscoveryIfPresent(page)

    const result = await page.evaluate(async ({ eventName, iterations, safeSvg }) => {
      const uploaded = await window.devhub.r8.themeDecoration.uploadCustomSvg('bench-theme-decoration.svg', safeSvg, 'theme-decoration-bench')
      const base = {
        opacity: 0.18,
        positions: ['global-background'],
        blendMode: 'normal',
        scale: 1,
        motionRespect: true
      }
      const configs = [
        'soviet-geo',
        'diagonals',
        'paper',
        'scanline',
        'grid',
        'golden',
        'noise',
        'blocks'
      ].map(kind => ({ ...base, kind }))
      configs.push({ ...base, kind: 'custom-svg', customSvgId: uploaded.id })

      const samples = []
      const seenKinds = new Set()

      for (let round = 0; round < iterations; round += 1) {
        for (const config of configs) {
          const startedAt = performance.now()
          window.dispatchEvent(new CustomEvent(eventName, { detail: config }))
          await Promise.resolve()
          const layer = document.querySelector(`[data-decoration-kind="${config.kind}"]`)
          if (layer) seenKinds.add(config.kind)
          samples.push(performance.now() - startedAt)
        }
      }

      await window.devhub.r8.themeDecoration.removeCustomSvg(uploaded.id, 'theme-decoration-bench')
      return {
        samples,
        seenKinds: [...seenKinds]
      }
    }, { eventName: DECORATION_CHANGE_EVENT, iterations: ITERATIONS_PER_DECORATION, safeSvg: SAFE_SVG })

    const stats = summarize(result.samples)
    const expectedKinds = ['soviet-geo', 'diagonals', 'paper', 'scanline', 'grid', 'golden', 'noise', 'blocks', 'custom-svg']
    const missingKinds = expectedKinds.filter(kind => !result.seenKinds.includes(kind))
    const passed = missingKinds.length === 0 && stats.p99 <= RENDER_BUDGET_MS
    const payload = {
      budgetMs: RENDER_BUDGET_MS,
      decorationKinds: expectedKinds,
      iterationsPerDecoration: ITERATIONS_PER_DECORATION,
      label: 'BENCH-THEME-DECORATION-RENDER',
      measurement: 'real Electron renderer decoration CustomEvent to committed DOM layer latency',
      missingKinds,
      passed,
      stats
    }

    console.log(JSON.stringify(payload, null, 2))
    if (!passed) process.exitCode = 1
  } finally {
    await closeElectronApp(electronApp)
  }
}

await main()
