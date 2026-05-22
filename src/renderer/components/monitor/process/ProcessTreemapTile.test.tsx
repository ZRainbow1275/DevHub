import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TreemapNode } from '@shared/schemas/r8-runtime'
import { ProcessTreemapTile } from './ProcessTreemapTile'

function treemapNode(): TreemapNode {
  return {
    color: 'warning',
    exe: 'alpha.exe',
    pid: 321,
    value: 4096,
    x0: 0,
    x1: 120,
    y0: 0,
    y1: 60,
  } as TreemapNode
}

describe('ProcessTreemapTile accessibility', () => {
  it('exposes a named keyboard-activatable SVG button', () => {
    const onSelect = vi.fn()
    const onShowDetail = vi.fn()

    render(
      <svg>
        <ProcessTreemapTile
          colorBy="rss"
          node={treemapNode()}
          selected={true}
          onSelect={onSelect}
          onShowDetail={onShowDetail}
        />
      </svg>
    )

    const tile = screen.getByRole('button', { name: /alpha\.exe PID 321/ })
    expect(tile).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyDown(tile, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(321)
    expect(onShowDetail).toHaveBeenCalledWith(321)

    fireEvent.keyDown(tile, { key: ' ' })
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onShowDetail).toHaveBeenCalledTimes(2)
  })
})
