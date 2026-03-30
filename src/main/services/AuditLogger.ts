import { app } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'

interface AuditEntry {
  timestamp: string
  action: string
  target: Record<string, unknown>
  result: 'success' | 'refused' | 'error'
  reason?: string
}

class AuditLogger {
  private logPath: string

  constructor() {
    this.logPath = join(app.getPath('userData'), 'devhub-audit.log')
  }

  log(action: string, target: Record<string, unknown>, result: 'success' | 'refused' | 'error', reason?: string): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      target,
      result,
      reason
    }
    try {
      appendFileSync(this.logPath, JSON.stringify(entry) + '\n')
    } catch (err) {
      console.error('AuditLogger write failed:', err instanceof Error ? err.message : err)
    }
  }
}

export const auditLogger = new AuditLogger()
