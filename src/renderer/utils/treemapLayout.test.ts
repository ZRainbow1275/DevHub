import { describe, expect, it } from 'vitest'
import type { ProcessInfo } from '@shared/types-extended'
import { buildProcessTree, computeTreemapLayout } from './treemapLayout'

function processRow(overrides: Partial<ProcessInfo> & { ppid?: number; rss?: number } = {}): ProcessInfo & { ppid?: number; rss?: number } {
  return {
    pid: overrides.pid ?? 1,
    name: overrides.name ?? 'node.exe',
    command: overrides.command ?? 'node server.js',
    cpu: overrides.cpu ?? 1,
    memory: overrides.memory ?? 100,
    status: overrides.status ?? 'running',
    startTime: overrides.startTime ?? 1,
    type: overrides.type ?? 'other',
    ...overrides
  }
}

describe('R8.B process treemap layout', () => {
  it('builds a parent-child tree without synthetic process rows', () => {
    const tree = buildProcessTree([
      processRow({ pid: 10, ppid: 0, name: 'root.exe' }),
      processRow({ pid: 11, ppid: 10, name: 'child.exe' })
    ])

    expect(tree.children[0]).toMatchObject({ pid: 10, exe: 'root.exe' })
    expect(tree.children[0].children[0]).toMatchObject({ pid: 11, exe: 'child.exe', depth: 2 })
  })

  it('keeps treemap tile area proportional to RSS within five percent', () => {
    const layout = computeTreemapLayout([
      processRow({ pid: 1, name: 'a.exe', memory: 1000 }),
      processRow({ pid: 2, name: 'b.exe', memory: 500 })
    ], 1500, 100, 'none', 'rss')
    const area = (pid: number) => {
      const node = layout.nodes.find(item => item.pid === pid)
      if (!node) throw new Error(`missing node ${pid}`)
      return (node.x1 - node.x0) * (node.y1 - node.y0)
    }
    const ratio = area(1) / area(2)

    expect(Math.abs(ratio - 2)).toBeLessThanOrEqual(0.05 * 2)
  })

  it('uses d3 treemap for top-500 truncation within the render budget', () => {
    const rows = Array.from({ length: 620 }, (_, index) => processRow({
      memory: 10_000 - index,
      name: `process-${index}.exe`,
      pid: 10_000 + index
    }))
    const samples: number[] = []
    let layout = computeTreemapLayout(rows, 1280, 720, 'parent', 'rss')

    for (let sampleIndex = 0; sampleIndex < 12; sampleIndex += 1) {
      const startedAt = performance.now()
      layout = computeTreemapLayout(rows, 1280, 720, 'parent', 'rss')
      samples.push(performance.now() - startedAt)
    }

    const sortedSamples = [...samples].sort((left, right) => left - right)
    const p95 = sortedSamples[Math.floor(sortedSamples.length * 0.95)] ?? sortedSamples[sortedSamples.length - 1]

    expect(layout.truncated).toBe(true)
    expect(layout.nodes).toHaveLength(500)
    expect(layout.nodes.every(node => node.x0 >= 0 && node.y0 >= 0 && node.x1 <= 1280 && node.y1 <= 720)).toBe(true)
    expect(p95).toBeLessThan(200)
  })
})
