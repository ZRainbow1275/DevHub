/* global window */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { build } from 'vite'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sparklineCount = 100
const pointCount = 1440
const sampleCount = 12
const renderBudgetMs = 16
const viewport = { width: 1280, height: 360 }
const virtualEntryId = 'virtual:process-sparkline-bench-entry'
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

function summarize(samples) {
  return {
    min: roundMetric(Math.min(...samples)),
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
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ProcessSparkline } from '/src/renderer/components/monitor/process/ProcessSparkline.tsx'

const sparklineCount = ${sparklineCount}
const pointCount = ${pointCount}
const sampleCount = ${sampleCount}
const sparklineSelector = '[data-testid^="bench-process-sparkline-"]'

function createHistory(index) {
  const now = 1_713_830_400_000
  const points = Array.from({ length: pointCount }, (_, pointIndex) => {
    const missing = pointIndex > 0 && pointIndex % 211 === 0
    return {
      ts: now + pointIndex * 60_000,
      cpu: missing ? 0 : Number((((pointIndex + index * 7) % 100) * 0.91).toFixed(2)),
      rssMb: missing ? 0 : 128 + ((pointIndex + index * 13) % 512),
      handles: missing ? undefined : 40 + ((pointIndex + index) % 80),
      threads: missing ? undefined : 4 + ((pointIndex + index) % 24),
      missing
    }
  })
  return {
    key: 'bench-process-' + index,
    exe: 'bench-process-' + index + '.exe',
    cwd: 'D:/DevHub/bench/' + (index % 9),
    windowMs: 86_400_000,
    points
  }
}

function SparklineWall({ histories }) {
  return React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(10, 112px)',
      gap: '4px',
      padding: '12px'
    }
  }, histories.map((history, index) => React.createElement(ProcessSparkline, {
    key: history.key,
    history,
    metric: index % 2 === 0 ? 'cpu' : 'rssMb',
    width: 96,
    height: 20,
    testId: 'bench-process-sparkline-' + index
  })))
}

function renderOnce(histories) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const startedAt = performance.now()

  flushSync(() => {
    root.render(React.createElement(SparklineWall, { histories }))
  })

  const elapsedMs = performance.now() - startedAt
  const renderedCount = container.querySelectorAll(sparklineSelector).length
  const pathCount = container.querySelectorAll('path').length
  root.unmount()
  container.remove()
  return { elapsedMs, pathCount, renderedCount }
}

window.runProcessSparklineBench = () => {
  const histories = Array.from({ length: sparklineCount }, (_, index) => createHistory(index))
  renderOnce(histories)

  const samples = []
  const renderedCounts = []
  const pathCounts = []
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const result = renderOnce(histories)
    samples.push(result.elapsedMs)
    renderedCounts.push(result.renderedCount)
    pathCounts.push(result.pathCount)
  }

  return { pathCounts, renderedCounts, samples }
}
`
}

async function bundleBenchmark() {
  const buildResult = await build({
    root: rootDir,
    logLevel: 'silent',
    plugins: [
      react(),
      {
        name: 'process-sparkline-bench-entry',
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
          entryFileNames: 'process-sparkline-bench.js',
          format: 'iife',
          inlineDynamicImports: true
        }
      }
    }
  })

  const outputs = Array.isArray(buildResult) ? buildResult.flatMap(result => result.output) : buildResult.output
  const chunks = outputs.filter(output => output.type === 'chunk')
  if (chunks.length === 0) throw new Error('Process sparkline benchmark bundle did not produce a JavaScript chunk')
  return chunks.map(chunk => chunk.code).join('\n')
}

async function runBrowserBenchmark(code) {
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
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><main id="root"></main></body></html>')
    await page.addScriptTag({ content: code })
    const result = await page.evaluate(() => {
      try {
        if (typeof window.runProcessSparklineBench !== 'function') {
          return { ok: false, error: 'window.runProcessSparklineBench is not installed' }
        }
        return { ok: true, result: window.runProcessSparklineBench() }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      }
    })
    if (!result.ok) {
      throw new Error(`Browser process sparkline benchmark failed: ${result.error}\n${result.stack ?? ''}\n${browserMessages.join('\n')}`)
    }
    return result.result
  } finally {
    await browser.close()
  }
}

async function main() {
  const code = await bundleBenchmark()
  const result = await runBrowserBenchmark(code)
  const stats = summarize(result.samples)
  const minRenderedCount = Math.min(...result.renderedCounts)
  const passed = minRenderedCount === sparklineCount && stats.p95 < renderBudgetMs
  const payload = {
    budgetMs: renderBudgetMs,
    label: 'BENCH-PROCESS-SPARKLINE-100-DOM',
    measurement: 'Chromium DOM commit for production ProcessSparkline bundle with 100 visible 24h histories',
    pointCount,
    sparklineCount,
    passed,
    stats,
    renderedCount: {
      expected: sparklineCount,
      min: minRenderedCount,
      max: Math.max(...result.renderedCounts)
    },
    pathCount: {
      min: Math.min(...result.pathCounts),
      max: Math.max(...result.pathCounts)
    }
  }

  console.log(JSON.stringify(payload, null, 2))
  if (!passed) process.exitCode = 1
}

await main()
