import { describe, it, expect } from 'vitest'
import { formatBytes, formatPID, formatCompact } from './formatNumber'

describe('formatBytes', () => {
  it('should format zero as 0MB', () => {
    expect(formatBytes(0)).toBe('0MB')
  })

  it('should format negative values as 0MB', () => {
    expect(formatBytes(-100)).toBe('0MB')
  })

  it('should format values under 1024 as MB', () => {
    expect(formatBytes(512)).toBe('512MB')
    expect(formatBytes(1)).toBe('1MB')
    expect(formatBytes(999)).toBe('999MB')
    expect(formatBytes(1023)).toBe('1023MB')
  })

  it('should round MB values to integers', () => {
    expect(formatBytes(512.7)).toBe('513MB')
    expect(formatBytes(0.4)).toBe('0MB')
  })

  it('should format values >= 1024 as GB', () => {
    expect(formatBytes(1024)).toBe('1.0GB')
    expect(formatBytes(1445)).toBe('1.4GB')
    expect(formatBytes(2048)).toBe('2.0GB')
    expect(formatBytes(1536)).toBe('1.5GB')
  })

  it('should format very large values as TB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0TB')
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5TB')
  })
})

describe('formatPID', () => {
  it('should format small PIDs without separator', () => {
    expect(formatPID(42)).toBe('42')
    expect(formatPID(999)).toBe('999')
  })

  it('should format 4-digit PIDs with thousands separator', () => {
    expect(formatPID(1234)).toBe('1,234')
  })

  it('should format 5-digit PIDs with thousands separator', () => {
    expect(formatPID(47156)).toBe('47,156')
  })

  it('should format 6-digit PIDs with thousands separator', () => {
    expect(formatPID(123456)).toBe('123,456')
  })

  it('should handle string PIDs', () => {
    expect(formatPID('47156')).toBe('47,156')
    expect(formatPID('1234')).toBe('1,234')
  })

  it('should handle invalid string PIDs gracefully', () => {
    expect(formatPID('not-a-number')).toBe('not-a-number')
  })

  it('should handle zero', () => {
    expect(formatPID(0)).toBe('0')
  })
})

describe('formatCompact', () => {
  it('should return raw number for values under 1000', () => {
    expect(formatCompact(0)).toBe('0')
    expect(formatCompact(42)).toBe('42')
    expect(formatCompact(999)).toBe('999')
  })

  it('should format thousands as K', () => {
    expect(formatCompact(1000)).toBe('1.0K')
    expect(formatCompact(1234)).toBe('1.2K')
    expect(formatCompact(47156)).toBe('47.2K')
    expect(formatCompact(999999)).toBe('1000.0K')
  })

  it('should format millions as M', () => {
    expect(formatCompact(1000000)).toBe('1.0M')
    expect(formatCompact(2500000)).toBe('2.5M')
  })
})
