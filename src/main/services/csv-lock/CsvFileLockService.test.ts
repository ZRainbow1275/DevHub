import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CSV_TASK_ROW_SCHEMA_VERSION } from '@shared/schemas/csv-task-row'
import { CsvFileLockService } from './CsvFileLockService'

const row = {
  schemaVersion: CSV_TASK_ROW_SCHEMA_VERSION,
  taskId: 'A',
  taskName: 'A task',
  priority: 'P1',
  status: 'pending',
  tool: 'codex',
  skill: 'code-review',
  inputFile: 'src/app.ts',
  inputArgs: '{}',
  outputDir: 'out',
  outputFormat: 'md',
  tags: '',
  dependsOn: '',
  timeoutMs: 60000,
  retries: 1,
  concurrencyKey: '',
  createdAt: '2026-05-03T08:00:00Z',
  scheduledAt: 'now',
  note: ''
} as const

describe('CsvFileLockService', () => {
  it('uses a real lock file, reports contention, expires stale locks, and releases ownership', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'devhub-lock-'))
    const csvPath = join(dir, 'tasks.csv')
    await writeFile(csvPath, 'taskId\nA\n', 'utf8')
    try {
      let now = 1000
      const ownerA = new CsvFileLockService({ ownerPid: 101, owner: 'owner-a', ttlMs: 100, now: () => now })
      const ownerB = new CsvFileLockService({ ownerPid: 202, owner: 'owner-b', ttlMs: 100, now: () => now })

      const first = await ownerA.lock(csvPath, [row])
      expect(first.acquired).toBe(true)
      expect(first.rows).toHaveLength(1)
      expect(JSON.parse(await readFile(first.lockPath, 'utf8')).ownerPid).toBe(101)

      const blocked = await ownerB.lock(csvPath)
      expect(blocked.acquired).toBe(false)
      expect(blocked.ownerPid).toBe(101)

      now = 1200
      const reclaimed = await ownerB.lock(csvPath)
      expect(reclaimed.acquired).toBe(true)
      expect(reclaimed.ownerPid).toBe(202)

      const release = await ownerB.unlock(csvPath)
      expect(release.released).toBe(true)
      expect((await ownerB.status(csvPath)).locked).toBe(false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
