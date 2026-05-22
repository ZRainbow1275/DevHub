/* global window */

import process from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { build } from 'vite'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viewport = { width: 1280, height: 820 }
const dragIterations = Number.parseInt(process.env.DASHBOARD_DRAG_ITERATIONS ?? '1000', 10)
const frameBudgetMs = 1000 / 60
const frameP95BudgetMs = Number.parseFloat(process.env.DASHBOARD_DRAG_P95_BUDGET_MS ?? '20')
const targetAverageFps = Number.parseFloat(process.env.DASHBOARD_DRAG_TARGET_FPS ?? '58')
const virtualEntryId = 'virtual:dashboard-drag-bench-entry'
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

function summarizeFrames(frameDeltas) {
  const samples = frameDeltas.filter(value => Number.isFinite(value) && value > 0)
  const averageFrameMs = samples.length > 0 ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 0
  return {
    averageFps: averageFrameMs > 0 ? roundMetric(1000 / averageFrameMs) : 0,
    averageFrameMs: roundMetric(averageFrameMs),
    droppedFrameCount: samples.filter(value => value > frameBudgetMs * 1.5).length,
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
import { Dashboard } from '/src/renderer/components/dashboard/Dashboard.tsx'
import { createDashboardLayout } from '/src/renderer/components/dashboard/dashboard-model.ts'
import '/src/renderer/styles/globals.css'

const layoutNames = ['default', 'minimal', 'monitor-focus', 'ai-focus']
let currentLayout = createDashboardLayout('default')

window.__dashboardSaveCount = 0
window.__dashboardLayout = currentLayout
window.__dashboardFeatureEnabled = true

window.devhub = {
  r8: {
    dashboard: {
      getLayout: async (name) => ({ layout: name && name !== currentLayout.name ? createDashboardLayout(name) : currentLayout }),
      saveLayout: async (layout) => {
        currentLayout = layout
        window.__dashboardLayout = layout
        window.__dashboardSaveCount += 1
        return { success: true, layout }
      },
      listPresets: async () => ({ names: layoutNames }),
      deletePreset: async (name) => ({ success: true, name }),
      reset: async (preset) => {
        currentLayout = createDashboardLayout(preset ?? 'default')
        window.__dashboardLayout = currentLayout
        return { layout: currentLayout }
      },
      morphWidgetToDrawer: async () => ({ drawerState: { slot: 'right', open: true, pinned: true, contentId: 'topology', scope: 'global', updatedAt: Date.now() }, layout: currentLayout })
    },
    integrations: {
      getFlag: async () => window.__dashboardFeatureEnabled,
      setFlag: async (_flag, value, confirmedBy) => {
        window.__dashboardFeatureEnabled = value
        return { flag: 'R8.B.dashboard.grid', value, confirmedBy: confirmedBy ?? null }
      }
    },
    status: {
      aggregate: async () => ({
        badges: [],
        generatedAt: Date.now(),
        tiles: [{ id: 'notifications', label: 'Notifications', value: 0, visible: true, order: 0, tone: 'neutral' }]
      })
    }
  }
}

const root = createRoot(document.getElementById('root'))
root.render(React.createElement(Dashboard))
`
}

async function bundleBenchmark() {
  const buildResult = await build({
    root: rootDir,
    logLevel: 'silent',
    plugins: [
      react(),
      {
        name: 'dashboard-drag-bench-entry',
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
          entryFileNames: 'dashboard-drag-bench.js',
          format: 'iife',
          inlineDynamicImports: true
        }
      }
    }
  })

  const outputs = Array.isArray(buildResult) ? buildResult.flatMap(result => result.output) : buildResult.output
  const chunks = outputs.filter(output => output.type === 'chunk')
  const assets = outputs.filter(output => output.type === 'asset' && output.fileName.endsWith('.css'))
  if (chunks.length === 0) throw new Error('Dashboard drag benchmark bundle did not produce a JavaScript chunk')
  return {
    code: chunks.map(chunk => chunk.code).join('\n'),
    css: assets.map(asset => String(asset.source)).join('\n')
  }
}

async function runBrowserBenchmark(bundle) {
  const browser = await chromium.launch({ headless: true })
  const browserMessages = []
  try {
    const page = await browser.newPage({ viewport })
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
    await page.waitForSelector('[data-testid="dashboard-page"]', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="dashboard-grid-item-widget-process-summary"]', { timeout: 10_000 })

    const before = await page.evaluate(() => {
      const item = window.__dashboardLayout.layouts.md.find(candidate => candidate.i === 'widget-process-summary')
      return { x: item?.x ?? -1, y: item?.y ?? -1, saveCount: window.__dashboardSaveCount }
    })

    const handle = await page.locator('[data-testid="dashboard-grid-item-widget-process-summary"] [data-testid="widget-drag-handle"]').boundingBox()
    if (!handle) throw new Error(`Dashboard drag handle was not measurable\n${browserMessages.join('\n')}`)

    await page.evaluate(() => {
      const frames = []
      let running = true
      let last = performance.now()
      function tick(now) {
        if (!running) return
        frames.push(now - last)
        last = now
        window.requestAnimationFrame(tick)
      }
      window.__dashboardDragFrames = frames
      window.__dashboardStopDragFrames = () => {
        running = false
        return frames
      }
      window.requestAnimationFrame(tick)
    })

    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 + 360, handle.y + handle.height / 2 + 180, { steps: dragIterations })
    await page.mouse.up()
    await page.waitForTimeout(120)

    const after = await page.evaluate(() => {
      const frames = typeof window.__dashboardStopDragFrames === 'function' ? window.__dashboardStopDragFrames() : []
      const item = window.__dashboardLayout.layouts.md.find(candidate => candidate.i === 'widget-process-summary')
      return {
        frames,
        item: { x: item?.x ?? -1, y: item?.y ?? -1 },
        saveCount: window.__dashboardSaveCount
      }
    })

    return { after, before }
  } finally {
    await browser.close()
  }
}

async function main() {
  const bundle = await bundleBenchmark()
  const result = await runBrowserBenchmark(bundle)
  const stats = summarizeFrames(result.after.frames)
  const moved = result.after.item.x !== result.before.x || result.after.item.y !== result.before.y
  const persisted = result.after.saveCount > result.before.saveCount
  const passed = moved && persisted && stats.samples > 0 && stats.averageFps >= targetAverageFps && stats.p95 <= frameP95BudgetMs
  const payload = {
    averageFpsTarget: targetAverageFps,
    dragIterations,
    frameBudgetMs: roundMetric(frameBudgetMs),
    frameP95BudgetMs,
    label: 'BENCH-DASHBOARD-DRAG-RGL',
    measurement: 'Chromium pointer-drag benchmark for production Dashboard react-grid-layout bundle and layout save path',
    moved,
    passed,
    persisted,
    position: {
      before: { x: result.before.x, y: result.before.y },
      after: result.after.item
    },
    saveCountDelta: result.after.saveCount - result.before.saveCount,
    stats
  }

  console.log(JSON.stringify(payload, null, 2))
  if (!passed) process.exitCode = 1
}

await main()
