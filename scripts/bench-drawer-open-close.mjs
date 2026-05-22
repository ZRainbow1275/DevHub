/* global window, document */

import process from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { build } from 'vite'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const iterations = Number.parseInt(process.env.DRAWER_BENCH_ITERATIONS ?? '1000', 10)
const p99BudgetMs = Number.parseFloat(process.env.DRAWER_BENCH_P99_BUDGET_MS ?? '250')
const persistBudgetMs = Number.parseFloat(process.env.DRAWER_BENCH_PERSIST_P95_BUDGET_MS ?? '80')
const virtualEntryId = 'virtual:drawer-open-close-bench-entry'
const resolvedVirtualEntryId = `\0${virtualEntryId}`

function percentile(values, percentileRank) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil((percentileRank / 100) * sorted.length) - 1)
  return sorted[index]
}

function roundMetric(value) {
  return Math.round(value * 100) / 100
}

function summarize(values) {
  const samples = values.filter(value => Number.isFinite(value) && value >= 0)
  return {
    average: roundMetric(samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1)),
    max: roundMetric(Math.max(...samples)),
    p50: roundMetric(percentile(samples, 50)),
    p95: roundMetric(percentile(samples, 95)),
    p99: roundMetric(percentile(samples, 99)),
    samples: samples.length
  }
}

function benchEntrySource() {
  return `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { DrawerProvider } from '/src/renderer/components/drawer/DrawerProvider.tsx'
import { DrawerSystemHost } from '/src/renderer/components/drawer/DrawerSystemHost.tsx'
import { createDefaultDrawerStateMap, drawerStatesToMap } from '/src/renderer/components/drawer/drawer-model.ts'
import '/src/renderer/styles/globals.css'

let stateMap = createDefaultDrawerStateMap()
window.__drawerPersistCount = 0
window.__drawerPersistDurations = []

function statesArray() {
  return Object.values(stateMap)
}

window.devhub = {
  r8: {
    command: {
      onEvent: () => () => undefined
    },
    drawer: {
      getState: async () => statesArray(),
      setState: async (state) => {
        const startedAt = performance.now()
        const current = stateMap[state.slot]
        const next = drawerStatesToMap([{ ...current, ...state, updatedAt: Date.now() }])[state.slot]
        stateMap = { ...stateMap, [next.slot]: next }
        window.__drawerPersistCount += 1
        window.__drawerPersistDurations.push(performance.now() - startedAt)
        return next
      },
      saveLayout: async (name, states) => ({ name, states: Object.values(states ?? stateMap), savedAt: Date.now() }),
      loadLayout: async (name) => ({ name, states: statesArray(), savedAt: Date.now() }),
      listLayouts: async () => [],
      morphToPopout: async () => ({ popoutId: 'bench-popout' }),
      morphFromPopout: async () => ({ drawerState: stateMap.right })
    },
    popout: {
      list: async () => []
    },
    processViews: {
      treeChildren: async () => ({ children: [], truncated: false })
    }
  }
}

const root = createRoot(document.getElementById('root'))
root.render(
  React.createElement(DrawerProvider, null,
    React.createElement(DrawerSystemHost, null,
      React.createElement('main', { 'data-testid': 'drawer-bench-main', className: 'h-screen bg-surface-950 text-text-primary' }, 'drawer bench')
    )
  )
)
`
}

async function bundleBenchmark() {
  const buildResult = await build({
    root: rootDir,
    logLevel: 'silent',
    plugins: [
      react(),
      {
        name: 'drawer-open-close-bench-entry',
        resolveId(id) {
          if (id === virtualEntryId) return resolvedVirtualEntryId
          return null
        },
        load(id) {
          if (id === resolvedVirtualEntryId) return benchEntrySource()
          return null
        }
      }
    ],
    resolve: {
      alias: {
        '@': resolve(rootDir, 'src'),
        '@main': resolve(rootDir, 'src/main'),
        '@renderer': resolve(rootDir, 'src/renderer'),
        '@shared': resolve(rootDir, 'src/shared')
      }
    },
    build: {
      emptyOutDir: false,
      minify: true,
      sourcemap: false,
      write: false,
      rollupOptions: {
        input: virtualEntryId,
        output: {
          entryFileNames: 'drawer-open-close-bench.js',
          format: 'iife',
          inlineDynamicImports: true
        }
      }
    }
  })

  const outputs = Array.isArray(buildResult) ? buildResult.flatMap(result => result.output) : buildResult.output
  const chunks = outputs.filter(output => output.type === 'chunk')
  const assets = outputs.filter(output => output.type === 'asset' && output.fileName.endsWith('.css'))
  if (chunks.length === 0) throw new Error('Drawer benchmark bundle did not produce a JavaScript chunk')
  return {
    code: chunks.map(chunk => chunk.code).join('\n'),
    css: assets.map(asset => String(asset.source)).join('\n')
  }
}

async function runBrowserBenchmark(bundle) {
  const browser = await chromium.launch({ headless: true })
  const browserMessages = []
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
    page.on('console', message => {
      browserMessages.push(`console:${message.type()}:${message.text()}`)
    })
    page.on('pageerror', error => {
      browserMessages.push(`pageerror:${error.message}`)
    })
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
html, body, #root { width: 100%; height: 100%; margin: 0; background: #070b12; }
${bundle.css}
</style></head><body><main id="root"></main></body></html>`)
    await page.addScriptTag({ content: bundle.code })
    await page.waitForSelector('[data-testid="drawer-system-host"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="open-drawer-right"]', { timeout: 10_000 })

    return await page.evaluate(async (cycleCount) => {
      const openButton = document.querySelector('[data-testid="open-drawer-right"]')
      if (!(openButton instanceof window.HTMLButtonElement)) throw new Error('Drawer open button was not mounted')

      const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)))
      const durations = []
      for (let index = 0; index < cycleCount; index += 1) {
        const startedAt = performance.now()
        openButton.click()
        await nextFrame()
        const drawer = document.querySelector('[data-testid="drawer-right"]')
        if (!drawer) throw new Error('Right drawer did not mount after open click')
        const closeButton = document.querySelector('[data-testid="drawer-right-close"]')
        if (!(closeButton instanceof window.HTMLButtonElement)) throw new Error('Right drawer close button was not mounted')
        closeButton.click()
        await nextFrame()
        if (document.querySelector('[data-testid="drawer-right"]')) throw new Error('Right drawer did not unmount after close click')
        durations.push(performance.now() - startedAt)
      }
      return {
        durations,
        persistCount: window.__drawerPersistCount,
        persistDurations: window.__drawerPersistDurations
      }
    }, iterations)
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${browserMessages.join('\n')}`)
  } finally {
    await browser.close()
  }
}

async function main() {
  const bundle = await bundleBenchmark()
  const result = await runBrowserBenchmark(bundle)
  const cycleStats = summarize(result.durations)
  const persistStats = summarize(result.persistDurations)
  const expectedPersistCount = iterations * 2
  const passed = cycleStats.samples === iterations
    && result.persistCount >= expectedPersistCount
    && cycleStats.p99 <= p99BudgetMs
    && persistStats.p95 <= persistBudgetMs

  const payload = {
    expectedPersistCount,
    iterations,
    label: 'BENCH-DRAWER-OPEN-CLOSE',
    measurement: 'Chromium click benchmark for production Drawer open/close cycle and drawer:set-state persistence path',
    passed,
    persistCount: result.persistCount,
    persistP95BudgetMs: persistBudgetMs,
    persistStats,
    p99BudgetMs,
    cycleStats
  }

  console.log(JSON.stringify(payload, null, 2))
  if (!passed) process.exitCode = 1
}

await main()
