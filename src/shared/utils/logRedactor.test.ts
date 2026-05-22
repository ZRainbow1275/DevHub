import { describe, expect, it } from 'vitest'
import { redactLogEntry, redactLogMessage, redactLogText } from './logRedactor'

describe('logRedactor', () => {
  it('redacts secret assignments while preserving useful key context', () => {
    const redacted = redactLogMessage('OPENAI_API_KEY=sk-live123456789 token:tok-secret123456 password=hunter2')

    expect(redacted).toContain('OPENAI_API_KEY=[REDACTED]')
    expect(redacted).toContain('token:[REDACTED]')
    expect(redacted).toContain('password=[REDACTED]')
    expect(redacted).not.toContain('sk-live123456789')
    expect(redacted).not.toContain('tok-secret123456')
    expect(redacted).not.toContain('hunter2')
  })

  it('redacts standalone common token shapes in process output', () => {
    const text = [
      'Bearer abcdefghijklmnopqrstuvwxyz',
      'sk-prodabcdefghi',
      'tok-prodabcdef',
      'ghp_abcdefghijklmnopqrstuvwxyz',
      'AKIAABCDEFGHIJKLMNOP',
      'eyJheaderabc.eyJpayloadabc.signatureabc'
    ].join(' ')

    const result = redactLogText(text)

    expect(result.text).toContain('Bearer [REDACTED]')
    expect(result.text).toContain('[REDACTED:api-key]')
    expect(result.text).toContain('[REDACTED:token]')
    expect(result.text).toContain('[REDACTED:github-token]')
    expect(result.text).toContain('[REDACTED:aws-key]')
    expect(result.text).toContain('[REDACTED:jwt]')
    expect(result.redactionCount).toBe(6)
  })

  it('redacts URL credentials without removing the URL scheme marker', () => {
    const result = redactLogText('pulling https://alice:secret-password@example.com/repo.git')

    expect(result.text).toBe('pulling https://[REDACTED]@example.com/repo.git')
    expect(result.ruleCounts['url-credential']).toBe(1)
    expect(result.text).not.toContain('alice')
    expect(result.text).not.toContain('secret-password')
  })

  it('redacts log entry messages before they reach the renderer store', () => {
    const entry = {
      projectId: 'project-1',
      timestamp: 1_900_000,
      type: 'stdout' as const,
      message: 'tool emitted api_key=sk-test123456789'
    }

    const redacted = redactLogEntry(entry)

    expect(redacted).not.toBe(entry)
    expect(redacted).toMatchObject({
      projectId: entry.projectId,
      timestamp: entry.timestamp,
      type: entry.type,
      message: 'tool emitted api_key=[REDACTED]'
    })
  })

  it('returns the original entry object when no secret is present', () => {
    const entry = {
      projectId: 'project-1',
      timestamp: 1_900_001,
      type: 'system' as const,
      message: 'server started on port 5173'
    }

    expect(redactLogEntry(entry)).toBe(entry)
  })
})
