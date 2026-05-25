import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, cleanup } from '@testing-library/react'
import { act } from 'react'
import { ContextMenu } from './ContextMenu'

const items = [
  { label: '启动', onClick: vi.fn() },
  { label: '', onClick: () => {}, divider: true },
  { label: '删除', onClick: vi.fn(), danger: true }
]

describe('ContextMenu portal + z-index + viewport clamp', () => {
  beforeEach(() => {
    cleanup()
  })

  it('position 为 null 时不渲染任何菜单节点', async () => {
    await act(async () => {
      render(
        <ContextMenu items={items} position={null} onClose={vi.fn()} />
      )
    })

    expect(document.body.querySelector('[data-testid="context-menu-portal"]')).toBeNull()
  })

  it('position 有值时 portal 挂载到 document.body 而不是父容器内', async () => {
    const { container } = await act(async () => {
      return render(
        <ContextMenu items={items} position={{ x: 10, y: 20 }} onClose={vi.fn()} />
      )
    })

    expect(container.querySelector('[data-testid="context-menu-portal"]')).toBeNull()

    const portal = within(document.body).getByTestId('context-menu-portal')
    expect(portal).toBeTruthy()
    expect(portal.parentElement).toBe(document.body)
  })

  it('渲染的 portal className 包含 z-[100] 高层 z-index', async () => {
    await act(async () => {
      render(
        <ContextMenu items={items} position={{ x: 10, y: 20 }} onClose={vi.fn()} />
      )
    })

    const portal = within(document.body).getByTestId('context-menu-portal')
    expect(portal.className).toContain('z-[100]')
  })

  it('靠近视口右下角时位置被向内夹回 (edge-clamp)', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })

    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        width: 200,
        height: 150,
        top: 0,
        left: 0,
        right: 200,
        bottom: 150,
        toJSON: () => ({})
      } as DOMRect
    }

    try {
      await act(async () => {
        render(
          <ContextMenu items={items} position={{ x: 780, y: 580 }} onClose={vi.fn()} />
        )
      })

      const portal = within(document.body).getByTestId('context-menu-portal')

      const leftPx = parseFloat(portal.style.left)
      const topPx = parseFloat(portal.style.top)

      expect(leftPx).toBeLessThan(780)
      expect(topPx).toBeLessThan(580)
      expect(leftPx).toBeLessThanOrEqual(800 - 200)
      expect(topPx).toBeLessThanOrEqual(600 - 150)
    } finally {
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
    }
  })
})
