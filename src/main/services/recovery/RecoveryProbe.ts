import { randomUUID } from 'node:crypto'
import {
  recoveryCheckDirtyResponseSchema,
  recoveryProbeSummarySchema,
  recoveryReportSchema,
  type DirtyFinding,
  type RecoveryCheckDirtyResponse,
  type RecoveryProbeSummary,
  type RecoveryReport
} from '@shared/schemas/recovery'
import { DirtyStateScanner } from './DirtyStateScanner'
import { RecoveryStrategy } from './RecoveryStrategy'

export interface RecoveryProbeOptions {
  scanner: DirtyStateScanner
  strategy: RecoveryStrategy
  timeoutMs?: number
  now?: () => number
  persistReport?: (report: RecoveryReport) => void
}

// Must exceed the scanner's own 2s Windows process probe budget so slow
// optional detectors do not mask cheap recoverable findings on loaded systems.
export const DEFAULT_RECOVERY_PROBE_TIMEOUT_MS = 6_000

export class RecoveryProbe {
  private readonly timeoutMs: number
  private readonly now: () => number

  constructor(private readonly options: RecoveryProbeOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_RECOVERY_PROBE_TIMEOUT_MS
    this.now = options.now ?? (() => Date.now())
  }

  async runStartupProbe(): Promise<RecoveryCheckDirtyResponse> {
    const response = await this.checkDirty()
    this.options.scanner.markRunning()
    return response
  }

  async checkDirty(): Promise<RecoveryCheckDirtyResponse> {
    const startedAt = this.now()
    const probeId = randomUUID()
    const scanResult = await this.withTimeout(this.options.scanner.scan())
    const completedAt = this.now()
    const probe = recoveryProbeSummarySchema.parse({
      probeId,
      startedAt,
      completedAt,
      durationMs: Math.max(completedAt - startedAt, 0),
      timedOut: scanResult.timedOut,
      findingsCount: scanResult.findings.length
    })
    const findings = scanResult.timedOut
      ? [
          ...scanResult.findings,
          {
            kind: 'inconsistent-state-machine' as const,
            severity: 'medium' as const,
            detectedAt: completedAt,
            details: { error: 'E_TIMEOUT:RecoveryProbe timed out', timeoutMs: this.timeoutMs },
            recommendedAction: 'manual-review' as const
          }
        ]
      : scanResult.findings
    const report = this.toReport(startedAt, completedAt, findings)
    this.options.persistReport?.(report)
    return recoveryCheckDirtyResponseSchema.parse({ findings, report, probe: { ...probe, findingsCount: findings.length } })
  }

  markCleanShutdown(): void {
    this.options.scanner.markCleanShutdown()
  }

  get strategy(): RecoveryStrategy {
    return this.options.strategy
  }

  private toReport(startedAt: number, completedAt: number, findings: DirtyFinding[]): RecoveryReport {
    return recoveryReportSchema.parse({
      reportId: `recovery-${randomUUID()}`,
      scannedAt: startedAt,
      startedAt,
      completedAt,
      findings,
      snapshotsCreated: [],
      userChoice: null,
      appliedActions: [],
      issues: findings.map(finding => ({
        kind: finding.kind,
        severity: finding.severity === 'critical' || finding.severity === 'high' ? 'error' : finding.severity === 'medium' ? 'warning' : 'info',
        count: typeof finding.details.count === 'number' ? finding.details.count : undefined
      }))
    })
  }

  private async withTimeout(scanPromise: Promise<DirtyFinding[]>): Promise<{ findings: DirtyFinding[]; timedOut: boolean }> {
    let timeout: NodeJS.Timeout | null = null
    let timedOut = false
    const timeoutPromise = new Promise<DirtyFinding[]>(resolve => {
      timeout = setTimeout(() => {
        timedOut = true
        resolve([])
      }, this.timeoutMs)
      timeout.unref?.()
    })
    const findings = await Promise.race([scanPromise, timeoutPromise])
    if (timeout) clearTimeout(timeout)
    return { findings, timedOut }
  }
}

export type { RecoveryProbeSummary }
