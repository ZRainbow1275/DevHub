import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProcessInfo } from '@shared/types-extended'
import { ProcessTreemapView } from './ProcessTreemapView'

function processRow(overrides: Partial<ProcessInfo> & { ppid?: number; rss?: number } = {}): ProcessInfo & { ppid?: number; rss?: number } {
  return {
    command: overrides.command ?? '',
    cpu: overrides.cpu ?? 0,
    memory: overrides.memory ?? 1024,
    name: overrides.name ?? `process-${overrides.pid ?? 1}.exe`,
    pid: overrides.pid ?? 1,
    ppid: overrides.ppid ?? 0,
    rss: overrides.rss ?? overrides.memory ?? 1024,
    startTime: overrides.startTime ?? 1,
    status: overrides.status ?? 'running',
    type: overrides.type ?? 'other',
    ...overrides
  }
}

describe('ProcessTreemapView', () => {
  it('delegates tile activation from the bulk-rendered SVG markup', () => {
    const onSelectProcess = vi.fn()
    const onShowDetail = vi.fn()
    const { container } = render(
      <ProcessTreemapView
        processes={[
          processRow({ pid: 100, memory: 2048, name: 'alpha.exe' }),
          processRow({ pid: 101, memory: 1024, name: 'beta.exe' })
        ]}
        selectedPid={null}
        onSelectProcess={onSelectProcess}
        onShowDetail={onShowDetail}
      />
    )

    const tile = container.querySelector('[data-testid="treemap-tile-100"]')
    expect(tile).toBeInTheDocument()
    if (!tile) throw new Error('treemap tile 100 was not rendered')

    fireEvent.click(tile.querySelector('rect') ?? tile)

    expect(onSelectProcess).toHaveBeenCalledWith(100)
    expect(onShowDetail).toHaveBeenCalledWith(100)
  })

  it('escapes dirty executable names before writing SVG innerHTML', () => {
    const dirtyName = `bad<&"'process<script>.exe`
    const { container } = render(
      <ProcessTreemapView
        processes={[processRow({ pid: 200, memory: 4096, name: dirtyName })]}
        selectedPid={null}
        onSelectProcess={vi.fn()}
        onShowDetail={vi.fn()}
      />
    )

    const tile = container.querySelector('[data-testid="treemap-tile-200"]')

    expect(tile).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(tile?.getAttribute('aria-label')).toContain('&lt;script&gt;')
    expect(container.textContent).toContain(dirtyName)
  })
})
