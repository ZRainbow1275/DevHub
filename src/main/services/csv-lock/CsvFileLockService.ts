import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import { csvLockResultSchema, csvLockStatusSchema, type CsvLockResult, type CsvLockStatus } from '@shared/schemas/dag-editor-state'
import type { CsvTaskRow18 } from '@shared/schemas/csv-task-row'

const lockFilePayloadSchema = z.strictObject({
  csvPath: z.string().min(1),
  lockPath: z.string().min(1),
  ownerPid: z.number().int(),
  owner: z.string().min(1),
  token: z.string().min(1),
  lockedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative()
})

type LockFilePayload = z.infer<typeof lockFilePayloadSchema>

export interface CsvFileLockServiceOptions {
  now?: () => number
  ownerPid?: number
  owner?: string
  ttlMs?: number
}

const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000

export class CsvFileLockService {
  private readonly now: () => number
  private readonly ownerPid: number
  private readonly owner: string
  private readonly ttlMs: number

  constructor(options: CsvFileLockServiceOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.ownerPid = options.ownerPid ?? process.pid
    this.owner = options.owner ?? 'devhub-r8-dag-editor'
    this.ttlMs = options.ttlMs ?? DEFAULT_LOCK_TTL_MS
  }

  async lock(csvPath: string, rows: readonly CsvTaskRow18[] = []): Promise<CsvLockResult> {
    const resolvedCsvPath = resolve(csvPath)
    await this.assertCsvFileExists(resolvedCsvPath)
    const lockPath = this.lockPathFor(resolvedCsvPath)
    await mkdir(dirname(lockPath), { recursive: true })
    const existing = await this.readLock(lockPath)
    if (existing && !this.isStale(existing)) {
      return csvLockResultSchema.parse({ ...await this.status(resolvedCsvPath), acquired: existing.ownerPid === this.ownerPid, rows: existing.ownerPid === this.ownerPid ? rows : [] })
    }
    if (existing) await this.unlinkIfExists(lockPath)

    const now = this.now()
    const payload = lockFilePayloadSchema.parse({
      csvPath: resolvedCsvPath,
      lockPath,
      ownerPid: this.ownerPid,
      owner: this.owner,
      token: randomUUID(),
      lockedAt: now,
      expiresAt: now + this.ttlMs
    })

    try {
      await writeFile(lockPath, JSON.stringify(payload, null, 2), { encoding: 'utf8', flag: 'wx' })
    } catch {
      const status = await this.status(resolvedCsvPath)
      return csvLockResultSchema.parse({ ...status, acquired: false, rows: [] })
    }

    return csvLockResultSchema.parse({ ...await this.status(resolvedCsvPath), acquired: true, rows })
  }

  async unlock(csvPath: string): Promise<{ released: boolean; status: CsvLockStatus }> {
    const resolvedCsvPath = resolve(csvPath)
    const lockPath = this.lockPathFor(resolvedCsvPath)
    const existing = await this.readLock(lockPath)
    if (!existing) return { released: false, status: await this.status(resolvedCsvPath) }
    if (existing.ownerPid !== this.ownerPid && !this.isStale(existing)) return { released: false, status: await this.status(resolvedCsvPath) }
    await this.unlinkIfExists(lockPath)
    return { released: true, status: await this.status(resolvedCsvPath) }
  }

  async status(csvPath: string): Promise<CsvLockStatus> {
    const resolvedCsvPath = resolve(csvPath)
    const lockPath = this.lockPathFor(resolvedCsvPath)
    const existing = await this.readLock(lockPath)
    const mtimeMs = await this.csvMtimeMs(resolvedCsvPath)
    if (!existing) {
      return csvLockStatusSchema.parse({
        csvPath: resolvedCsvPath,
        lockPath,
        locked: false,
        ownerPid: null,
        owner: null,
        lockedAt: null,
        expiresAt: null,
        stale: false,
        mtimeMs
      })
    }
    const stale = this.isStale(existing)
    return csvLockStatusSchema.parse({
      csvPath: resolvedCsvPath,
      lockPath,
      locked: !stale,
      ownerPid: existing.ownerPid,
      owner: existing.owner,
      lockedAt: existing.lockedAt,
      expiresAt: existing.expiresAt,
      stale,
      mtimeMs
    })
  }

  lockPathFor(csvPath: string): string {
    return `${resolve(csvPath)}.lock`
  }

  async assertOwned(csvPath: string): Promise<CsvLockStatus> {
    const status = await this.status(csvPath)
    if (!status.locked || status.ownerPid !== this.ownerPid) throw new Error('E_RUNTIME:CSV file must be locked by this DevHub process before save')
    return status
  }

  private async assertCsvFileExists(csvPath: string): Promise<void> {
    if (!existsSync(csvPath)) throw new Error(`E_NOT_FOUND:CSV file ${csvPath} does not exist`)
    const stats = await stat(csvPath)
    if (!stats.isFile()) throw new Error(`E_VALIDATION:CSV path ${csvPath} is not a file`)
  }

  private async csvMtimeMs(csvPath: string): Promise<number | null> {
    if (!existsSync(csvPath)) return null
    return Math.trunc((await stat(csvPath)).mtimeMs)
  }

  private async readLock(lockPath: string): Promise<LockFilePayload | null> {
    if (!existsSync(lockPath)) return null
    try {
      return lockFilePayloadSchema.parse(JSON.parse(await readFile(lockPath, 'utf8')))
    } catch {
      return null
    }
  }

  private isStale(payload: LockFilePayload): boolean {
    return payload.expiresAt <= this.now()
  }

  private async unlinkIfExists(path: string): Promise<void> {
    try {
      await unlink(path)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') return
      throw error
    }
  }
}
