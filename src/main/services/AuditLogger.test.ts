import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AuditLogger, AuditEntry } from './AuditLogger'

function readAuditEntries(logPath: string): AuditEntry[] {
  return readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as AuditEntry)
}

describe('AuditLogger', () => {
  let tempRoot: string
  let logDir: string

  beforeEach(() => {
    tempRoot = mkdtempAuditRoot()
    logDir = join(tempRoot, 'logs')
  })

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true })
  })

  it('writes structured security audit entries to logs/security-audit.log', () => {
    const now = new Date('2026-04-29T08:30:15.000Z')
    const logger = new AuditLogger({ logDir, now: () => now })

    logger.log('process:kill', { pid: 1234, name: 'node.exe' }, 'success')

    expect(logger.getAuditLogPath()).toBe(join(logDir, 'security-audit.log'))
    const [entry] = readAuditEntries(logger.getAuditLogPath())

    expect(entry).toMatchObject({
      timestamp: '2026-04-29T08:30:15.000Z',
      ts: Math.floor(now.getTime() / 1000),
      action: 'process:kill',
      op: 'process:kill',
      target: { pid: 1234, name: 'node.exe' },
      result: 'success',
      outcome: 'success'
    })
  })

  it('rotates stale active logs by day and keeps the current day in security-audit.log', () => {
    mkdirSync(logDir, { recursive: true })
    const activeLog = join(logDir, 'security-audit.log')
    writeFileSync(activeLog, '{"op":"old"}\n', 'utf8')
    const staleDate = new Date('2026-04-28T22:00:00.000Z')
    utimesSync(activeLog, staleDate, staleDate)

    const logger = new AuditLogger({ logDir, now: () => new Date('2026-04-29T00:00:01.000Z') })
    logger.log('window:close', { hwnd: 42 }, 'success')

    expect(existsSync(join(logDir, 'security-audit-2026-04-28.log'))).toBe(true)
    const [entry] = readAuditEntries(activeLog)
    expect(entry.op).toBe('window:close')
    expect(entry.target).toEqual({ hwnd: 42 })
  })

  it('prunes rotated logs older than retention days', () => {
    mkdirSync(logDir, { recursive: true })
    const expiredLog = join(logDir, 'security-audit-2026-03-01.log')
    const retainedLog = join(logDir, 'security-audit-2026-04-10.log')
    writeFileSync(expiredLog, '{"op":"expired"}\n', 'utf8')
    writeFileSync(retainedLog, '{"op":"retained"}\n', 'utf8')
    const expiredDate = new Date('2026-03-01T00:00:00.000Z')
    const retainedDate = new Date('2026-04-10T00:00:00.000Z')
    utimesSync(expiredLog, expiredDate, expiredDate)
    utimesSync(retainedLog, retainedDate, retainedDate)

    const logger = new AuditLogger({ logDir, now: () => new Date('2026-04-29T00:00:00.000Z'), retentionDays: 30 })
    logger.log('port:release', { port: 3000 }, 'refused', 'protected process')

    expect(readdirSync(logDir)).not.toContain('security-audit-2026-03-01.log')
    expect(readdirSync(logDir)).toContain('security-audit-2026-04-10.log')
    const [entry] = readAuditEntries(logger.getAuditLogPath())
    expect(entry.outcome).toBe('refused:protected process')
  })
})

function mkdtempAuditRoot(): string {
  return mkdtempSync(join(tmpdir(), 'devhub-audit-'))
}
