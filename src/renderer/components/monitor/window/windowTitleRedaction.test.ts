import { describe, expect, it } from 'vitest'
import { redactWindowTitle } from './windowTitleRedaction'

describe('redactWindowTitle', () => {
  it('redacts common secret shapes from window titles without removing context', () => {
    const title = [
      'DevHub',
      'token=tok-secret123456',
      'api_key=sk-live123456789',
      'Bearer abcdefghijklmnopqrstuvwxyz',
      'AKIAABCDEFGHIJKLMNOP',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature12345',
    ].join(' ')

    const redacted = redactWindowTitle(title)

    expect(redacted).toContain('DevHub')
    expect(redacted).toContain('token=[REDACTED]')
    expect(redacted).toContain('api_key=[REDACTED]')
    expect(redacted).toContain('Bearer [REDACTED]')
    expect(redacted).toContain('AKIA[REDACTED]')
    expect(redacted).toContain('[REDACTED_JWT]')
    expect(redacted).not.toContain('tok-secret123456')
    expect(redacted).not.toContain('sk-live123456789')
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz')
  })
})
