import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'

export type AuditResult = 'success' | 'refused' | 'error'

export interface AuditEntry {
  timestamp: string
  ts: number
  action: string
  op: string
  target: Record<string, unknown>
  result: AuditResult
  outcome: string
  reason?: string
}

export interface AuditLoggerOptions {
  logDir?: string
  retentionDays?: number
  now?: () => Date
}

const SECURITY_AUDIT_FILE = 'security-audit.log'
const ROTATED_AUDIT_PREFIX = 'security-audit-'
const DAY_IN_MS = 24 * 60 * 60 * 1000

function getDefaultLogDir(): string {
  try {
    return join(app.getPath('userData'), 'logs')
  } catch {
    return join(process.cwd(), 'logs')
  }
}

export class AuditLogger {
  private readonly configuredLogDir: string | null
  private readonly retentionDays: number
  private readonly now: () => Date

  constructor(options: AuditLoggerOptions = {}) {
    this.configuredLogDir = options.logDir ?? null
    this.retentionDays = options.retentionDays ?? 30
    this.now = options.now ?? (() => new Date())
  }

  getAuditLogPath(): string {
    return join(this.getLogDir(), SECURITY_AUDIT_FILE)
  }

  log(action: string, target: Record<string, unknown>, result: AuditResult, reason?: string): void {
    const timestamp = this.now()
    const entry: AuditEntry = {
      timestamp: timestamp.toISOString(),
      ts: Math.floor(timestamp.getTime() / 1000),
      action,
      op: action,
      target,
      result,
      outcome: this.formatOutcome(result, reason),
      reason
    }

    try {
      const logDir = this.getLogDir()
      const logPath = join(logDir, SECURITY_AUDIT_FILE)
      this.ensureLogDirectory(logDir)
      this.rotateStaleActiveLog(logPath, timestamp)
      this.pruneExpiredLogs(logDir, timestamp)
      appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8')
    } catch (err) {
      console.error('AuditLogger write failed:', err instanceof Error ? err.message : err)
    }
  }

  private getLogDir(): string {
    return this.configuredLogDir ?? getDefaultLogDir()
  }

  private ensureLogDirectory(logDir: string): void {
    mkdirSync(logDir, { recursive: true })
  }

  private rotateStaleActiveLog(logPath: string, now: Date): void {
    if (!existsSync(logPath)) return

    const stats = statSync(logPath)
    if (this.formatDay(stats.mtime) === this.formatDay(now)) return

    const rotatedPath = this.getRotatedLogPath(logPath, stats.mtime)
    renameSync(logPath, rotatedPath)
  }

  private pruneExpiredLogs(logDir: string, now: Date): void {
    const cutoff = now.getTime() - this.retentionDays * DAY_IN_MS

    for (const fileName of readdirSync(logDir)) {
      if (!fileName.startsWith(ROTATED_AUDIT_PREFIX) || !fileName.endsWith('.log')) continue

      const path = join(logDir, fileName)
      const stats = statSync(path)
      if (stats.mtime.getTime() < cutoff) {
        unlinkSync(path)
      }
    }
  }

  private getRotatedLogPath(logPath: string, date: Date): string {
    const day = this.formatDay(date)
    const logDir = dirname(logPath)
    const basePath = join(logDir, `${ROTATED_AUDIT_PREFIX}${day}.log`)
    if (!existsSync(basePath)) return basePath

    const timestamp = date.toISOString().replace(/[:.]/g, '-')
    return join(logDir, `${ROTATED_AUDIT_PREFIX}${day}-${timestamp}.log`)
  }

  private formatDay(date: Date): string {
    return date.toISOString().slice(0, 10)
  }

  private formatOutcome(result: AuditResult, reason?: string): string {
    return reason ? `${result}:${reason}` : result
  }
}

export const auditLogger = new AuditLogger()
