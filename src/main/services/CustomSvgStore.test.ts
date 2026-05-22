import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Store from 'electron-store'
import { CustomSvgStore } from './CustomSvgStore'

function makeStore() {
  return new Store<{ customSvgs?: unknown[] }>({
    name: `custom-svg-store-${Date.now()}-${Math.random()}`,
    cwd: mkdtempSync(join(tmpdir(), 'devhub-custom-svg-')),
    defaults: { customSvgs: [] }
  })
}

describe('CustomSvgStore', () => {
  it('persists sanitized SVG entries with SHA256 hash and metadata', () => {
    const store = new CustomSvgStore(makeStore())
    const result = store.upload({
      name: 'safe.svg',
      content: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
      confirmedBy: 'vitest'
    })

    expect(result.entry.name).toBe('safe.svg')
    expect(result.entry.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(store.list().items).toHaveLength(1)
  })

  it('rejects script-bearing SVG before it reaches the persistent store', () => {
    const store = new CustomSvgStore(makeStore())

    expect(() => store.upload({
      name: 'bad.svg',
      content: '<svg><script>alert(1)</script></svg>',
      confirmedBy: 'vitest'
    })).toThrow(/禁止标签：script/)
    expect(store.list().items).toEqual([])
  })

  it('removes persisted SVG entries by id', () => {
    const store = new CustomSvgStore(makeStore())
    const result = store.upload({
      name: 'safe.svg',
      content: '<svg viewBox="0 0 10 10"><path d="M0 0H10"/></svg>',
      confirmedBy: 'vitest'
    })

    expect(store.remove({ id: result.id, confirmedBy: 'vitest' })).toMatchObject({
      success: true,
      removed: 1,
      remaining: 0
    })
  })
})
