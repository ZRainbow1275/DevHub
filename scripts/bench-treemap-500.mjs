/* global window */

import process from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { build } from 'vite'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const width = 1280
const height = 720
const nodeCount = 500
const sampleCount = 12
const renderBudgetMs = 16
const virtualEntryId = 'virtual:treemap-bench-entry'
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
import { ProcessTreemapView } from '/src/renderer/components/monitor/process/ProcessTreemapView.tsx'

const width = ${width}
const height = ${height}
const nodeCount = ${nodeCount}
const sampleCount = ${sampleCount}
const tileSelector = '[data-testid^="treemap-tile-"]'

function createBenchmarkProcesses() {
  return Array.from({ length: nodeCount }, (_, index) => {
    const pid = 80_000 + index
    const parentPid = index === 0 ? 0 : 80_000 + Math.floor((index - 1) / 4)
    const memory = (nodeCount - index + 32) * 1024 * 1024

    return {
      command: 'C:/Program Files/DevHubBench/process-' + index + '.exe --pid=' + pid,
      cpu: Number(((index % 37) * 1.7).toFixed(2)),
      memory,
      name: 'bench-process-' + String(index).padStart(3, '0') + '.exe',
      parentPid,
      pid,
      ppid: parentPid,
      rss: memory,
      startTime: 1_700_000_000 + index,
      status: 'running',
      type: index % 17 === 0 ? 'ai-tool' : index % 11 === 0 ? 'dev-server' : 'other',
      workingDir: 'C:/DevHub/bench/' + (index % 9)
    }
  })
}

function renderOnce(processes) {
  const container = document.createElement('div')
  container.style.width = width + 'px'
  container.style.height = height + 'px'
  document.body.appendChild(container)
  const root = createRoot(container)
  const startedAt = performance.now()

  flushSync(() => {
    root.render(React.createElement(ProcessTreemapView, {
      processes,
      selectedPid: null,
      onSelectProcess: () => undefined,
      onShowDetail: () => undefined
    }))
  })

  const elapsedMs = performance.now() - startedAt
  const tileCount = container.querySelectorAll(tileSelector).length
  root.unmount()
  container.remove()
  return { elapsedMs, tileCount }
}

window.runTreemapBench = () => {
  const processes = createBenchmarkProcesses()
  renderOnce(processes)

  const samples = []
  const tileCounts = []
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const result = renderOnce(processes)
    samples.push(result.elapsedMs)
    tileCounts.push(result.tileCount)
  }

  return { samples, tileCounts }
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
        name: 'treemap-bench-entry',
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
          entryFileNames: 'treemap-bench.js',
          format: 'iife',
          inlineDynamicImports: true
        }
      }
    }
  })

  const outputs = Array.isArray(buildResult) ? buildResult.flatMap(result => result.output) : buildResult.output
  const chunks = outputs.filter(output => output.type === 'chunk')
  if (chunks.length === 0) throw new Error('Treemap benchmark bundle did not produce a JavaScript chunk')
  return chunks.map(chunk => chunk.code).join('\n')
}

async function runBrowserBenchmark(code) {
  const browser = await chromium.launch({ headless: true })
  const browserMessages = []
  try {
    const page = await browser.newPage({ viewport: { width, height } })
    page.on('console', message => {
      browserMessages.push(`console:${message.type()}:${message.text()}`)
    })
    page.on('pageerror', error => {
      browserMessages.push(`pageerror:${error.message}`)
    })
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body><main id="root"></main></body></html>`)
    await page.addScriptTag({ content: code })
    const result = await page.evaluate(() => {
      try {
        if (typeof window.runTreemapBench !== 'function') {
          return { ok: false, error: 'window.runTreemapBench is not installed' }
        }
        return { ok: true, result: window.runTreemapBench() }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      }
    })
    if (!result.ok) {
      throw new Error(`Browser treemap benchmark failed: ${result.error}\n${result.stack ?? ''}\n${browserMessages.join('\n')}`)
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
  const minTileCount = Math.min(...result.tileCounts)
  const passed = minTileCount === nodeCount && stats.p95 < renderBudgetMs
  const payload = {
    budgetMs: renderBudgetMs,
    dimensions: { width, height },
    label: 'BENCH-TREEMAP-500-DOM',
    measurement: 'Chromium DOM commit for production ProcessTreemapView bundle with 500 RSS-proportional SVG tiles',
    nodeCount,
    passed,
    stats,
    tileCount: {
      expected: nodeCount,
      min: minTileCount,
      max: Math.max(...result.tileCounts)
    }
  }

  console.log(JSON.stringify(payload, null, 2))
  if (!passed) process.exitCode = 1
}

await main()
