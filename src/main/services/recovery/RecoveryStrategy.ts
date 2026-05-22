import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  recoveryReportSchema,
  recoverySnapshotSchema,
  type DirtyFinding,
  type DirtyKind,
  type RecoveryAppliedAction,
  type RecoveryReport,
  type RecoverySnapshot,
  type RecoverySnapshotFile
} from '@shared/schemas/recovery'

export interface RecoveryStrategyOptions {
  snapshotRoot: string
  recoverablePaths: () => string[]
  getFindings: () => DirtyFinding[] | Promise<DirtyFinding[]>
  now?: () => number
  killProcess?: (pid: number) => void
  writeAudit?: (action: string, target: Record<string, unknown>, success: boolean, reason?: string) => void
}

export interface ApplyRecoveryInput {
  kindsToRestore: DirtyKind[]
  snapshotId?: string
  userChoice: RecoveryReport['userChoice']
}

export class RecoveryStrategy {
  private readonly now: () => number

  constructor(private readonly options: RecoveryStrategyOptions) {
    this.now = options.now ?? (() => Date.now())
  }

  async listSnapshots(): Promise<RecoverySnapshot[]> {
    if (!existsSync(this.options.snapshotRoot)) return []
    const snapshots: RecoverySnapshot[] = []
    for (const entry of await readdir(this.options.snapshotRoot)) {
      const manifestPath = join(this.options.snapshotRoot, entry, 'snapshot.json')
      if (!existsSync(manifestPath)) continue
      try {
        const parsed = recoverySnapshotSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')))
        snapshots.push(parsed)
      } catch {
        continue
      }
    }
    return snapshots.sort((left, right) => right.takenAt - left.takenAt)
  }

  async createCheckpoint(reason: RecoverySnapshot['reason']): Promise<RecoverySnapshot> {
    return this.createSnapshot(reason)
  }

  async applyRecovery(input: ApplyRecoveryInput): Promise<RecoveryReport> {
    const startedAt = this.now()
    const preRecoverySnapshot = await this.createSnapshot('pre-recovery')
    const findings = (await this.options.getFindings()).filter(finding => input.kindsToRestore.includes(finding.kind))
    const appliedActions: RecoveryAppliedAction[] = []

    if (input.snapshotId) {
      const restoreResult = await this.restoreSnapshot(input.snapshotId)
      appliedActions.push({
        finding: 'unclean-shutdown',
        action: `restore-snapshot:${input.snapshotId}`,
        success: restoreResult.success,
        error: restoreResult.error
      })
    }

    for (const finding of findings) {
      appliedActions.push(await this.applyFinding(finding))
    }

    const completedAt = this.now()
    const report = recoveryReportSchema.parse({
      reportId: `recovery-${randomUUID()}`,
      scannedAt: startedAt,
      startedAt,
      completedAt,
      findings,
      snapshotsCreated: [preRecoverySnapshot],
      userChoice: input.userChoice,
      appliedActions,
      issues: findings.map(finding => ({
        kind: finding.kind,
        severity: finding.severity === 'critical' || finding.severity === 'high' ? 'error' : finding.severity === 'medium' ? 'warning' : 'info',
        count: typeof finding.details.count === 'number' ? finding.details.count : undefined
      }))
    })
    this.options.writeAudit?.('recovery:restore-state', {
      kindsToRestore: input.kindsToRestore,
      snapshotId: input.snapshotId ?? null,
      reportId: report.reportId
    }, appliedActions.every(action => action.success), appliedActions.find(action => !action.success)?.error ?? undefined)
    return report
  }

  async restoreSnapshot(snapshotId: string): Promise<{ success: boolean; error: string | null }> {
    const snapshot = (await this.listSnapshots()).find(item => item.snapshotId === snapshotId)
    if (!snapshot) return { success: false, error: 'E_NOT_FOUND:snapshot not found' }
    try {
      for (const file of snapshot.files) {
        await mkdir(dirname(file.sourcePath), { recursive: true })
        await cp(file.snapshotPath, file.sourcePath, { recursive: file.kind === 'directory', force: true })
      }
      this.options.writeAudit?.('recovery:restore-snapshot', { snapshotId }, true)
      return { success: true, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.options.writeAudit?.('recovery:restore-snapshot', { snapshotId }, false, message)
      return { success: false, error: message }
    }
  }

  private async createSnapshot(reason: RecoverySnapshot['reason']): Promise<RecoverySnapshot> {
    const snapshotId = randomUUID()
    const takenAt = this.now()
    const snapshotDir = join(this.options.snapshotRoot, snapshotId)
    await mkdir(snapshotDir, { recursive: true })
    const files: RecoverySnapshotFile[] = []
    for (const sourcePath of this.options.recoverablePaths()) {
      if (!existsSync(sourcePath)) continue
      const sourceStat = await stat(sourcePath)
      const kind = sourceStat.isDirectory() ? 'directory' : 'file'
      const snapshotPath = join(snapshotDir, `${files.length}-${basename(sourcePath)}`)
      await cp(sourcePath, snapshotPath, { recursive: kind === 'directory', force: true })
      files.push({
        sourcePath,
        snapshotPath,
        sizeBytes: await this.sizeOf(snapshotPath),
        kind
      })
    }
    const snapshot = recoverySnapshotSchema.parse({
      snapshotId,
      takenAt,
      reason,
      paths: files.map(file => file.sourcePath),
      sizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
      manifestPath: join(snapshotDir, 'snapshot.json'),
      files
    })
    await writeFile(snapshot.manifestPath ?? join(snapshotDir, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    this.options.writeAudit?.('recovery:create-checkpoint', { snapshotId, reason, files: files.length }, true)
    return snapshot
  }

  private async applyFinding(finding: DirtyFinding): Promise<RecoveryAppliedAction> {
    if (finding.kind === 'orphan-shim-processes') return this.killOrphanShims(finding)
    if (finding.kind === 'pending-tasks-in-queue') {
      return { finding: finding.kind, action: 'preserve-queued-tasks', success: true, error: null }
    }
    if (finding.kind === 'sqlite-integrity-fail') {
      return { finding: finding.kind, action: 'snapshot-retained-manual-sqlite-rebuild-required', success: false, error: 'E_INTERNAL:sqlite integrity failed; manual rebuild required after snapshot' }
    }
    return { finding: finding.kind, action: 'snapshot-retained-manual-review', success: true, error: null }
  }

  private killOrphanShims(finding: DirtyFinding): RecoveryAppliedAction {
    const processes = Array.isArray(finding.details.processes) ? finding.details.processes : []
    const killed: number[] = []
    const failures: string[] = []
    for (const processInfo of processes) {
      const pid = this.readPid(processInfo)
      if (!pid) continue
      try {
        this.killProcess(pid)
        killed.push(pid)
      } catch (error) {
        failures.push(`${pid}:${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return {
      finding: finding.kind,
      action: 'kill-orphan-shim-pids',
      success: failures.length === 0,
      error: failures.length === 0 ? null : failures.join('; ')
    }
  }

  private killProcess(pid: number): void {
    const killProcess = this.options.killProcess ?? ((targetPid: number) => process.kill(targetPid))
    killProcess(pid)
  }

  private readPid(value: unknown): number | null {
    if (typeof value !== 'object' || value === null) return null
    const pid = Number((value as Record<string, unknown>).pid)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  }

  private async sizeOf(path: string): Promise<number> {
    const itemStat = await stat(path)
    if (itemStat.isFile()) return itemStat.size
    if (!itemStat.isDirectory()) return 0
    let total = 0
    for (const entry of await readdir(path)) {
      total += await this.sizeOf(join(path, entry))
    }
    return total
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await rm(join(this.options.snapshotRoot, snapshotId), { recursive: true, force: true })
  }
}
