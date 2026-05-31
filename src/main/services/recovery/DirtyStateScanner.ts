import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { loadBetterSqlite } from '../sqlite/betterSqliteLoader'
import {
  dirtyFindingSchema,
  type AppLifecycleMarker,
  type DirtyFinding,
  type DirtyKind,
  type DirtySeverity
} from '@shared/schemas/recovery'
import type { TaskRun } from '@shared/schemas/r8-runtime'
import { AppLifecycle } from '../AppLifecycle'

export interface DirtyStateProcess {
  pid: number
  parentPid: number
  name: string
  commandLine: string | null
}

export interface DirtyStateScannerOptions {
  userDataRoot: string
  recoveryRoot: string
  lifecycle: AppLifecycle
  auditLogPath: string
  listTasks: () => TaskRun[]
  getStoreSnapshot: () => Record<string, unknown>
  sqlitePaths?: () => string[] | Promise<string[]>
  processProbe?: () => Promise<DirtyStateProcess[]>
  now?: () => number
}

const ACTIVE_TASK_STATES = new Set<TaskRun['status']>([
  'pending',
  'queued',
  'running',
  'waiting-dependency',
  'paused',
  'retrying',
  'awaiting-human'
])

const DIRTY_STORE_SUFFIXES = ['.tmp', '.pending', '.dirty'] as const

export class DirtyStateScanner {
  private readonly now: () => number

  constructor(private readonly options: DirtyStateScannerOptions) {
    this.now = options.now ?? (() => Date.now())
  }

  readLifecycleMarker(): AppLifecycleMarker | null {
    return this.options.lifecycle.readMarker()
  }

  markRunning(): AppLifecycleMarker {
    return this.options.lifecycle.markRunning()
  }

  markCleanShutdown(): AppLifecycleMarker {
    return this.options.lifecycle.markCleanShutdown()
  }

  async scan(): Promise<DirtyFinding[]> {
    const scanners: Array<() => Promise<DirtyFinding[]>> = [
      () => this.scanLifecycle(),
      () => this.scanPendingTasks(),
      () => this.scanOrphanShimProcesses(),
      () => this.scanUnsavedStore(),
      () => this.scanTruncatedAuditLog(),
      () => this.scanStateMachine(),
      () => this.scanSqliteIntegrity()
    ]
    const findings: DirtyFinding[] = []
    for (const scanner of scanners) {
      findings.push(...await this.runIsolated(scanner))
    }
    return this.filterDismissed(findings)
  }

  private async runIsolated(scanner: () => Promise<DirtyFinding[]>): Promise<DirtyFinding[]> {
    try {
      return await scanner()
    } catch (error) {
      return [this.finding('inconsistent-state-machine', 'medium', {
        scannerError: error instanceof Error ? error.message : String(error)
      }, 'manual-review')]
    }
  }

  private async scanLifecycle(): Promise<DirtyFinding[]> {
    const marker = this.readLifecycleMarker()
    if (!marker) return []
    if (marker.status === 'clean-shutdown') return []
    if (marker.pid === process.pid) return []
    return [this.finding('unclean-shutdown', 'high', {
      previousPid: marker.pid,
      previousBootId: marker.bootId,
      markerUpdatedAt: marker.updatedAt
    }, 'restore')]
  }

  private async scanPendingTasks(): Promise<DirtyFinding[]> {
    const activeTasks = this.options.listTasks().filter(task => ACTIVE_TASK_STATES.has(task.status))
    if (activeTasks.length === 0) return []
    return [this.finding('pending-tasks-in-queue', 'medium', {
      count: activeTasks.length,
      runIds: activeTasks.slice(0, 20).map(task => task.runId),
      statuses: this.countBy(activeTasks.map(task => task.status))
    }, 'restore')]
  }

  private async scanOrphanShimProcesses(): Promise<DirtyFinding[]> {
    const processes = this.options.processProbe ? await this.options.processProbe() : await this.probeWindowsProcesses()
    const allPids = new Set(processes.map(processInfo => processInfo.pid))
    const orphanShims = processes.filter(processInfo => this.isShimProcess(processInfo) && processInfo.parentPid > 0 && !allPids.has(processInfo.parentPid))
    if (orphanShims.length === 0) return []
    return [this.finding('orphan-shim-processes', 'high', {
      count: orphanShims.length,
      processes: orphanShims.map(processInfo => ({
        pid: processInfo.pid,
        parentPid: processInfo.parentPid,
        name: processInfo.name,
        commandLine: processInfo.commandLine
      }))
    }, 'backup-and-clean')]
  }

  private async scanUnsavedStore(): Promise<DirtyFinding[]> {
    const dirtyFiles = await this.listDirtyStoreFiles()
    if (dirtyFiles.length === 0) return []
    return [this.finding('unsaved-store', 'medium', {
      count: dirtyFiles.length,
      files: dirtyFiles
    }, 'backup-and-clean')]
  }

  private async scanTruncatedAuditLog(): Promise<DirtyFinding[]> {
    if (!existsSync(this.options.auditLogPath)) return []
    const auditStats = await stat(this.options.auditLogPath)
    if (auditStats.size === 0) return []
    const content = await readFile(this.options.auditLogPath, 'utf8')
    if (content.endsWith('\n')) return []
    const lastLine = content.split(/\r?\n/).at(-1) ?? ''
    return [this.finding('truncated-audit-log', 'medium', {
      path: this.options.auditLogPath,
      sizeBytes: auditStats.size,
      lastLinePreview: lastLine.slice(0, 120)
    }, 'manual-review')]
  }

  private async scanStateMachine(): Promise<DirtyFinding[]> {
    const snapshot = this.options.getStoreSnapshot()
    const rawStates = snapshot.signalStates
    if (typeof rawStates !== 'object' || rawStates === null) return []
    const inconsistentKeys: string[] = []
    for (const [key, value] of Object.entries(rawStates)) {
      if (!this.isStateMachineRecord(value)) inconsistentKeys.push(key)
    }
    if (inconsistentKeys.length === 0) return []
    return [this.finding('inconsistent-state-machine', 'high', {
      count: inconsistentKeys.length,
      keys: inconsistentKeys.slice(0, 20)
    }, 'manual-review')]
  }

  private async scanSqliteIntegrity(): Promise<DirtyFinding[]> {
    const paths = await this.resolveSqlitePaths()
    const failures: Array<{ path: string; error: string }> = []
    for (const dbPath of paths) {
      if (!existsSync(dbPath)) continue
      try {
        const Database = loadBetterSqlite()
        const db = new Database(dbPath, { readonly: true, fileMustExist: true })
        try {
          const result = db.pragma('integrity_check') as unknown
          const ok = Array.isArray(result)
            ? result.every(item => this.sqliteIntegrityRowIsOk(item))
            : result === 'ok'
          if (!ok) failures.push({ path: dbPath, error: JSON.stringify(result).slice(0, 500) })
        } finally {
          db.close()
        }
      } catch (error) {
        failures.push({ path: dbPath, error: error instanceof Error ? error.message : String(error) })
      }
    }
    if (failures.length === 0) return []
    return [this.finding('sqlite-integrity-fail', 'critical', {
      count: failures.length,
      failures
    }, 'backup-and-clean')]
  }

  private filterDismissed(findings: DirtyFinding[]): DirtyFinding[] {
    const dismissed = this.options.getStoreSnapshot().recoveryDismissals
    if (typeof dismissed !== 'object' || dismissed === null) return findings
    const now = this.now()
    return findings.filter(finding => {
      const dismissedUntil = (dismissed as Record<string, unknown>)[finding.kind]
      return typeof dismissedUntil !== 'number' || dismissedUntil <= now
    })
  }

  private async listDirtyStoreFiles(): Promise<string[]> {
    const candidates = [
      join(this.options.userDataRoot, 'devhub-config.json.tmp'),
      join(this.options.userDataRoot, 'devhub-r8-runtime.json.tmp'),
      join(this.options.recoveryRoot, 'store-dirty.json'),
      join(this.options.recoveryRoot, 'store-pending')
    ]
    const dirtyFiles: string[] = []
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue
      const candidateStat = await stat(candidate)
      if (candidateStat.isFile()) {
        dirtyFiles.push(candidate)
      } else if (candidateStat.isDirectory()) {
        for (const entry of await readdir(candidate)) {
          if (DIRTY_STORE_SUFFIXES.some(suffix => entry.endsWith(suffix))) dirtyFiles.push(join(candidate, entry))
        }
      }
    }
    return dirtyFiles
  }

  private async resolveSqlitePaths(): Promise<string[]> {
    const configured = await this.options.sqlitePaths?.()
    if (configured) return configured
    const roots = [
      this.options.userDataRoot,
      join(this.options.userDataRoot, 'tasks'),
      join(this.options.userDataRoot, 'feedback')
    ]
    const paths: string[] = []
    for (const root of roots) {
      if (!existsSync(root)) continue
      for (const entry of await readdir(root)) {
        const path = join(root, entry)
        const entryStat = await stat(path)
        if (entryStat.isFile() && /\.(db|sqlite|sqlite3)$/i.test(entry)) paths.push(path)
      }
    }
    return paths
  }

  private async probeWindowsProcesses(): Promise<DirtyStateProcess[]> {
    if (process.platform !== 'win32') return []
    const command = [
      'Get-CimInstance Win32_Process |',
      'Select-Object ProcessId,ParentProcessId,Name,CommandLine |',
      'ConvertTo-Json -Compress'
    ].join(' ')
    return new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile', '-Command', command], {
        timeout: 2000,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024
      }, (_error, stdout) => {
        resolve(this.parseWindowsProcessJson(String(stdout)))
      })
    })
  }

  private parseWindowsProcessJson(stdout: string): DirtyStateProcess[] {
    if (!stdout.trim()) return []
    try {
      const parsed: unknown = JSON.parse(stdout)
      const rows = Array.isArray(parsed) ? parsed : [parsed]
      return rows.flatMap(row => this.parseWindowsProcessRow(row))
    } catch {
      return []
    }
  }

  private parseWindowsProcessRow(row: unknown): DirtyStateProcess[] {
    if (typeof row !== 'object' || row === null) return []
    const record = row as Record<string, unknown>
    const pid = Number(record.ProcessId)
    const parentPid = Number(record.ParentProcessId)
    const name = typeof record.Name === 'string' ? record.Name : ''
    const commandLine = typeof record.CommandLine === 'string' ? record.CommandLine : null
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(parentPid)) return []
    return [{ pid, parentPid, name, commandLine }]
  }

  private isShimProcess(processInfo: DirtyStateProcess): boolean {
    const name = processInfo.name.toLowerCase()
    const commandLine = processInfo.commandLine?.toLowerCase() ?? ''
    return name.endsWith('-shim.exe')
      || name === 'devhub-shim.exe'
      || commandLine.includes('devhub-shim')
      || commandLine.includes(`${basename(this.options.userDataRoot).toLowerCase()}\\shims`)
  }

  private sqliteIntegrityRowIsOk(row: unknown): boolean {
    if (typeof row === 'string') return row === 'ok'
    if (typeof row !== 'object' || row === null) return false
    return Object.values(row as Record<string, unknown>).every(value => value === 'ok')
  }

  private isStateMachineRecord(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false
    const record = value as Record<string, unknown>
    return typeof record.instanceId === 'string'
      && typeof record.system === 'string'
      && typeof record.task === 'string'
      && typeof record.ui === 'string'
  }

  private finding(
    kind: DirtyKind,
    severity: DirtySeverity,
    details: Record<string, unknown>,
    recommendedAction: DirtyFinding['recommendedAction']
  ): DirtyFinding {
    return dirtyFindingSchema.parse({
      kind,
      severity,
      detectedAt: this.now(),
      details,
      recommendedAction
    })
  }

  private countBy(values: string[]): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const value of values) counts[value] = (counts[value] ?? 0) + 1
    return counts
  }
}

export function defaultRecoveryBootId(): string {
  return randomUUID()
}
