import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { processHistoryPointSchema } from '@shared/schemas/r8-runtime'
import { makeProcessTagKey } from './ProcessTagStore'
import { ProcessHistorySampler } from './ProcessHistorySampler'
import { ProcessHistoryStore } from './ProcessHistoryStore'

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devhub-process-history-'))
  return path.join(dir, 'history.sqlite3')
}

describe('ProcessHistoryStore', () => {
  it('stores real SQLite samples and returns 24h history by exe and cwd key', () => {
    const store = new ProcessHistoryStore(tempDbPath())
    const key = makeProcessTagKey('node.exe', 'D:/repo/devhub')
    store.insert(key, processHistoryPointSchema.parse({ ts: 1_000, cpu: 12.5, rssMb: 512 }))

    const history = store.historyFor('node.exe', 'D:/repo/devhub', 2_000)

    expect(history.key).toBe(key)
    expect(history.points).toEqual([
      expect.objectContaining({ ts: 1_000, cpu: 12.5, rssMb: 512, missing: false }),
    ])
    store.close()
  })

  it('marks clock gaps as missing points without fabricating metric values', () => {
    const store = new ProcessHistoryStore(tempDbPath())
    const key = makeProcessTagKey('codex.exe', 'D:/repo/myapp')
    store.insert(key, processHistoryPointSchema.parse({ ts: 60_000, cpu: 10, rssMb: 100 }))
    store.insert(key, processHistoryPointSchema.parse({ ts: 240_000, cpu: 20, rssMb: 140 }))

    const history = store.historyFor('codex.exe', 'D:/repo/myapp', 300_000)

    expect(history.points.some(point => point.missing && point.cpu === null && point.rssMb === null)).toBe(true)
    store.close()
  })
})

describe('ProcessHistorySampler', () => {
  it('samples the same exe and cwd at most once per minute', () => {
    let now = 1_000
    const sampler = new ProcessHistorySampler(new ProcessHistoryStore(tempDbPath()), () => now)
    const process = {
      pid: 101,
      name: 'node.exe',
      command: 'node server.js',
      cpu: 3,
      memory: 256,
      status: 'running' as const,
      startTime: 1,
      type: 'dev-server' as const,
      workingDir: 'D:/repo/devhub',
    }

    expect(sampler.sampleProcess(process)).toBe(true)
    now += 10_000
    expect(sampler.sampleProcess({ ...process, pid: 102, cpu: 9 })).toBe(false)
    now += 60_000
    expect(sampler.sampleProcess({ ...process, pid: 103, cpu: 11 })).toBe(true)

    const history = sampler.historyFor('node.exe', 'D:/repo/devhub')
    expect(history.points.map(point => point.cpu)).toEqual([3, 11])
    sampler.close()
  })
})
