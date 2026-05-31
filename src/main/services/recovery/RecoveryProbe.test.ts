import { performance } from 'node:perf_hooks'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { DirtyFinding } from '@shared/schemas/recovery'
import type { TaskRun } from '@shared/schemas/r8-runtime'
import { AppLifecycle } from '../AppLifecycle'
import { DirtyStateScanner, type DirtyStateProcess } from './DirtyStateScanner'
import { DEFAULT_RECOVERY_PROBE_TIMEOUT_MS, RecoveryProbe } from './RecoveryProbe'
import { RecoveryStrategy } from './RecoveryStrategy'

function taskRun(runId: string, status: TaskRun['status']): TaskRun {
  return {
    runId,
    taskId: `task-${runId}`,
    sessionId: 'recovery-vitest',
    row: {
      id: `row-${runId}`,
      tool: 'codex',
      prompt: `recover ${runId}`,
      priority: 50,
      retries: 0,
      dry_run: false,
      allow_inject: false
    },
    status,
    attempts: 0,
    attemptCount: 0,
    maxRetry: 0,
    rowHash: `hash-${runId}`,
    queuedAt: 1,
    startedAt: status === 'running' ? 2 : null,
    endedAt: null,
    retryBackoffMs: null,
    nextRetryAt: null,
    exitCode: null,
    error: null,
    errorCode: null,
    errorMessage: null,
    parallelGroup: null,
    artifactsPath: null,
    injectActionId: null,
    recordingId: null
  }
}

function finding(kind: DirtyFinding['kind'], details: Record<string, unknown> = {}): DirtyFinding {
  return {
    kind,
    severity: kind === 'sqlite-integrity-fail' ? 'critical' : 'medium',
    detectedAt: 10,
    details,
    recommendedAction: kind === 'sqlite-integrity-fail' ? 'backup-and-clean' : 'restore'
  }
}

interface HarnessOptions {
  marker?: 'running' | 'clean-shutdown' | 'none'
  tasks?: TaskRun[]
  processes?: DirtyStateProcess[]
  sqlitePaths?: string[]
  storeSnapshot?: Record<string, unknown>
  processProbe?: () => Promise<DirtyStateProcess[]>
  recoverablePaths?: string[]
  timeoutMs?: number
}

async function createHarness(options: HarnessOptions = {}) {
  const userDataRoot = await mkdtemp(join(tmpdir(), 'devhub-recovery-'))
  const recoveryRoot = join(userDataRoot, 'r8-recovery')
  const markerPath = join(recoveryRoot, 'lifecycle.json')
  const now = () => 1_700_000_000_000
  await mkdir(recoveryRoot, { recursive: true })

  if (options.marker && options.marker !== 'none') {
    const previousLifecycle = new AppLifecycle(markerPath, 'previous-boot', now, 987_654_321)
    if (options.marker === 'running') {
      previousLifecycle.markRunning()
    } else {
      previousLifecycle.markCleanShutdown()
    }
  }

  const lifecycle = new AppLifecycle(markerPath, 'current-boot', now, process.pid)
  const scanner = new DirtyStateScanner({
    userDataRoot,
    recoveryRoot,
    lifecycle,
    auditLogPath: join(userDataRoot, 'audit.log'),
    listTasks: () => options.tasks ?? [],
    getStoreSnapshot: () => options.storeSnapshot ?? {},
    sqlitePaths: () => options.sqlitePaths ?? [],
    processProbe: options.processProbe ?? (async () => options.processes ?? []),
    now
  })
  const strategy = new RecoveryStrategy({
    snapshotRoot: join(recoveryRoot, 'snapshots'),
    recoverablePaths: () => options.recoverablePaths ?? [],
    getFindings: () => scanner.scan(),
    now,
    killProcess: () => undefined
  })
  const reports: DirtyFinding[][] = []
  const probe = new RecoveryProbe({
    scanner,
    strategy,
    timeoutMs: options.timeoutMs ?? 100,
    now,
    persistReport: report => reports.push(report.findings)
  })

  return {
    userDataRoot,
    recoveryRoot,
    markerPath,
    lifecycle,
    scanner,
    strategy,
    probe,
    reports,
    cleanup: () => rm(userDataRoot, { recursive: true, force: true })
  }
}

describe('RecoveryProbe', () => {
  it('keeps a clean startup non-blocking and records the current running marker', async () => {
    const harness = await createHarness({ marker: 'clean-shutdown' })
    try {
      const response = await harness.probe.runStartupProbe()

      expect(response.findings).toEqual([])
      expect(response.probe.timedOut).toBe(false)
      expect(response.report.findings).toEqual([])
      expect(harness.lifecycle.readMarker()).toMatchObject({
        status: 'running',
        pid: process.pid,
        bootId: 'current-boot'
      })
    } finally {
      await harness.cleanup()
    }
  })

  it('detects unclean shutdown, queued work, and orphan shim processes from real scanner inputs', async () => {
    const processes: DirtyStateProcess[] = [
      { pid: 4201, parentPid: 999_001, name: 'codex-shim.exe', commandLine: 'C:\\Users\\HP\\AppData\\Roaming\\DevHub\\shims\\codex-shim.exe' },
      { pid: 4301, parentPid: 4201, name: 'node.exe', commandLine: 'node worker.js' }
    ]
    const harness = await createHarness({
      marker: 'running',
      tasks: [taskRun('queued-1', 'queued'), taskRun('running-1', 'running')],
      processes
    })

    try {
      const response = await harness.probe.checkDirty()
      const kinds = response.findings.map(item => item.kind).sort()

      expect(kinds).toEqual(['orphan-shim-processes', 'pending-tasks-in-queue', 'unclean-shutdown'])
      expect(response.findings.find(item => item.kind === 'pending-tasks-in-queue')?.details).toMatchObject({ count: 2 })
      expect(response.findings.find(item => item.kind === 'orphan-shim-processes')?.details).toMatchObject({ count: 1 })
      expect(harness.reports).toHaveLength(1)
    } finally {
      await harness.cleanup()
    }
  })

  it('keeps dirty scanners isolated when one detector fails', async () => {
    const harness = await createHarness({
      marker: 'running',
      tasks: [taskRun('queued-1', 'queued')],
      processProbe: async () => {
        throw new Error('process probe unavailable')
      }
    })

    try {
      const response = await harness.probe.checkDirty()
      const kinds = response.findings.map(item => item.kind)

      expect(kinds).toContain('unclean-shutdown')
      expect(kinds).toContain('pending-tasks-in-queue')
      expect(response.findings).toContainEqual(expect.objectContaining({
        kind: 'inconsistent-state-machine',
        recommendedAction: 'manual-review',
        details: expect.objectContaining({ scannerError: 'process probe unavailable' })
      }))
    } finally {
      await harness.cleanup()
    }
  })

  it('creates a pre-recovery snapshot before applying recovery actions', async () => {
    const harness = await createHarness()
    const recoverablePath = join(harness.userDataRoot, 'devhub-r8-runtime.json')
    await writeFile(recoverablePath, '{"state":"before"}\n', 'utf8')
    const strategy = new RecoveryStrategy({
      snapshotRoot: join(harness.recoveryRoot, 'snapshots'),
      recoverablePaths: () => [recoverablePath],
      getFindings: () => [finding('pending-tasks-in-queue', { count: 1 })],
      now: () => 1_700_000_000_000
    })

    try {
      const report = await strategy.applyRecovery({
        kindsToRestore: ['pending-tasks-in-queue'],
        userChoice: 'restore-all'
      })

      expect(report.snapshotsCreated).toHaveLength(1)
      expect(report.snapshotsCreated[0]).toMatchObject({
        reason: 'pre-recovery',
        paths: [recoverablePath]
      })
      expect(report.appliedActions).toContainEqual(expect.objectContaining({
        finding: 'pending-tasks-in-queue',
        action: 'preserve-queued-tasks',
        success: true
      }))
      const manifest = JSON.parse(await readFile(report.snapshotsCreated[0].manifestPath ?? '', 'utf8')) as { files: Array<{ sourcePath: string }> }
      expect(manifest.files).toEqual([expect.objectContaining({ sourcePath: recoverablePath })])
    } finally {
      await harness.cleanup()
    }
  })

  it('audits checkpoint creation and recovery application through the injected audit sink', async () => {
    const harness = await createHarness()
    const recoverablePath = join(harness.userDataRoot, 'audited-recovery.json')
    const writeAudit = vi.fn()
    await writeFile(recoverablePath, '{"state":"before"}\n', 'utf8')
    const strategy = new RecoveryStrategy({
      snapshotRoot: join(harness.recoveryRoot, 'snapshots'),
      recoverablePaths: () => [recoverablePath],
      getFindings: () => [finding('pending-tasks-in-queue', { count: 1 })],
      now: () => 1_700_000_000_000,
      writeAudit
    })

    try {
      const report = await strategy.applyRecovery({
        kindsToRestore: ['pending-tasks-in-queue'],
        userChoice: 'restore-all'
      })

      expect(report.appliedActions).toContainEqual(expect.objectContaining({
        finding: 'pending-tasks-in-queue',
        success: true
      }))
      expect(writeAudit).toHaveBeenCalledWith('recovery:create-checkpoint', expect.objectContaining({ reason: 'pre-recovery', files: 1 }), true)
      expect(writeAudit).toHaveBeenCalledWith('recovery:restore-state', expect.objectContaining({
        kindsToRestore: ['pending-tasks-in-queue'],
        reportId: report.reportId
      }), true, undefined)
    } finally {
      await harness.cleanup()
    }
  })

  it('restores a checkpoint snapshot back to the original file path', async () => {
    const harness = await createHarness()
    const recoverablePath = join(harness.userDataRoot, 'devhub-config.json')
    await writeFile(recoverablePath, '{"value":"old"}\n', 'utf8')
    const strategy = new RecoveryStrategy({
      snapshotRoot: join(harness.recoveryRoot, 'snapshots'),
      recoverablePaths: () => [recoverablePath],
      getFindings: () => [],
      now: () => 1_700_000_000_000
    })

    try {
      const snapshot = await strategy.createCheckpoint('user-explicit')
      await writeFile(recoverablePath, '{"value":"new"}\n', 'utf8')
      const result = await strategy.restoreSnapshot(snapshot.snapshotId)

      expect(result).toEqual({ success: true, error: null })
      await expect(readFile(recoverablePath, 'utf8')).resolves.toBe('{"value":"old"}\n')
    } finally {
      await harness.cleanup()
    }
  })

  it('classifies invalid SQLite files as critical integrity failures without pretending to repair them', async () => {
    const harness = await createHarness()
    const brokenDb = join(harness.userDataRoot, 'broken.sqlite')
    await writeFile(brokenDb, 'not a sqlite database', 'utf8')
    const scanner = new DirtyStateScanner({
      userDataRoot: harness.userDataRoot,
      recoveryRoot: harness.recoveryRoot,
      lifecycle: harness.lifecycle,
      auditLogPath: join(harness.userDataRoot, 'audit.log'),
      listTasks: () => [],
      getStoreSnapshot: () => ({}),
      sqlitePaths: () => [brokenDb],
      processProbe: async () => [],
      now: () => 1_700_000_000_000
    })

    try {
      const findings = await scanner.scan()
      const sqliteFinding = findings.find(item => item.kind === 'sqlite-integrity-fail')

      expect(sqliteFinding).toMatchObject({
        severity: 'critical',
        recommendedAction: 'backup-and-clean'
      })
      expect(sqliteFinding?.details).toMatchObject({ count: 1 })
    } finally {
      await harness.cleanup()
    }
  })

  it('returns a timeout finding when the startup scan exceeds the probe budget', async () => {
    const harness = await createHarness({
      timeoutMs: 1,
      processProbe: () => new Promise(resolve => setTimeout(() => resolve([]), 50))
    })

    try {
      const response = await harness.probe.checkDirty()

      expect(response.probe.timedOut).toBe(true)
      expect(response.findings).toContainEqual(expect.objectContaining({
        kind: 'inconsistent-state-machine',
        recommendedAction: 'manual-review'
      }))
      expect(response.findings.find(item => item.kind === 'inconsistent-state-machine')?.details).toMatchObject({
        error: 'E_TIMEOUT:RecoveryProbe timed out',
        timeoutMs: 1
      })
    } finally {
      await harness.cleanup()
    }
  })

  it('keeps recoverable findings when the Windows process probe exceeds the legacy two second budget', async () => {
    const harness = await createHarness({
      marker: 'running',
      tasks: [taskRun('queued-1', 'queued')],
      timeoutMs: DEFAULT_RECOVERY_PROBE_TIMEOUT_MS,
      processProbe: () => new Promise(resolve => setTimeout(() => resolve([]), 2_200))
    })
    await writeFile(join(harness.userDataRoot, 'devhub-r8-runtime.json.tmp'), '{"dirty":true}\n', 'utf8')

    try {
      const response = await harness.probe.checkDirty()
      const kinds = response.findings.map(item => item.kind).sort()

      expect(response.probe.timedOut).toBe(false)
      expect(kinds).toEqual(['pending-tasks-in-queue', 'unclean-shutdown', 'unsaved-store'])
    } finally {
      await harness.cleanup()
    }
  })

  it('keeps the default startup probe budget bounded for startup work', () => {
    expect(DEFAULT_RECOVERY_PROBE_TIMEOUT_MS).toBe(6_000)
  })

  it('keeps real filesystem startup probe p95 under the default budget across ten samples', async () => {
    const harness = await createHarness({
      marker: 'clean-shutdown',
      timeoutMs: DEFAULT_RECOVERY_PROBE_TIMEOUT_MS
    })

    try {
      const samples: number[] = []
      for (let sampleIndex = 0; sampleIndex < 10; sampleIndex += 1) {
        const startedAt = performance.now()
        const response = await harness.probe.checkDirty()
        samples.push(performance.now() - startedAt)

        expect(response.findings).toEqual([])
        expect(response.probe.timedOut).toBe(false)
      }

      const sortedSamples = [...samples].sort((left, right) => left - right)
      const p95Index = Math.min(sortedSamples.length - 1, Math.ceil(sortedSamples.length * 0.95) - 1)
      const p95 = sortedSamples[p95Index]

      expect(samples).toHaveLength(10)
      expect(p95).toBeLessThan(DEFAULT_RECOVERY_PROBE_TIMEOUT_MS)
    } finally {
      await harness.cleanup()
    }
  })
})
