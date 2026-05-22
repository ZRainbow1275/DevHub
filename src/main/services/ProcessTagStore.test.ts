import fs from 'fs'
import os from 'os'
import path from 'path'
import Store from 'electron-store'
import { describe, expect, it } from 'vitest'
import type { ProcessTag } from '@shared/schemas/r8-runtime'
import { ProcessTagStore, makeProcessTagKey } from './ProcessTagStore'

function createStore() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'devhub-process-tags-'))
  return new Store<{ tags: Record<string, ProcessTag> }>({
    cwd,
    name: 'process-tags-test',
    defaults: { tags: {} },
  })
}

describe('ProcessTagStore', () => {
  it('persists tags by exe and cwd identity rather than pid', () => {
    const store = new ProcessTagStore(createStore())
    const saved = store.set({
      exe: 'codex.exe',
      cwd: 'D:/repo/myapp',
      tag: 'myapp-codex',
      color: 'accent',
    })

    expect(saved.key).toBe(makeProcessTagKey('codex.exe', 'D:/repo/myapp'))
    expect(store.get('codex.exe', 'D:\\repo\\myapp')?.tag).toBe('myapp-codex')
    expect(store.get('codex.exe', 'D:/repo/other')).toBeNull()
  })

  it('round-trips exported JSON and truncates overlong labels at the contract limit', () => {
    const source = new ProcessTagStore(createStore())
    source.set({ exe: 'node.exe', cwd: 'D:/repo/devhub', tag: 'x'.repeat(100), color: 'warning', pinned: true })

    const target = new ProcessTagStore(createStore())
    const imported = target.importJson(source.exportJson())

    expect(imported).toMatchObject({ success: true, imported: 1, skipped: 0 })
    const tag = target.get('node.exe', 'D:/repo/devhub')
    expect(tag?.tag).toHaveLength(64)
    expect(tag?.pinned).toBe(true)
    expect(tag?.color).toBe('warning')
  })
})
