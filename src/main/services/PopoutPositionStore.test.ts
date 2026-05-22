import Store from 'electron-store'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PopoutPositionStore } from './PopoutPositionStore'

function makeStore(cwd: string) {
  return new Store<{ positions: Record<string, unknown> }>({
    name: 'popout-positions-test',
    cwd,
    defaults: { positions: {} },
  })
}

describe('PopoutPositionStore', () => {
  it('persists positions by port across store instances with size metadata', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'devhub-popout-position-'))
    const first = new PopoutPositionStore(makeStore(cwd))

    const saved = first.set({
      port: 3000,
      position: { x: 220, y: 360 },
      size: { width: 420, height: 340 },
    })

    expect(saved).toMatchObject({
      x: 220,
      y: 360,
      w: 420,
      h: 340
    })
    expect(first.get(3000)).toMatchObject({
      x: 220,
      y: 360,
      w: 420,
      h: 340
    })

    const reopened = new PopoutPositionStore(makeStore(cwd))
    expect(reopened.get(3000)).toMatchObject({
      x: 220,
      y: 360,
      w: 420,
      h: 340
    })
  })

  it('ignores malformed persisted records and can remove saved positions', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'devhub-popout-position-'))
    const raw = makeStore(cwd)
    raw.set('positions', {
      'port:3000': { x: 'bad', y: 360 },
      'port:4000': { x: 44, y: 55, w: 320, h: 240, updatedAt: 1 }
    })

    const store = new PopoutPositionStore(raw)
    expect(store.get(3000)).toBeNull()
    expect(store.list()).toEqual({
      'port:4000': { x: 44, y: 55, w: 320, h: 240, updatedAt: 1 }
    })

    expect(store.remove(4000)).toBe(true)
    expect(store.get(4000)).toBeNull()
  })
})
