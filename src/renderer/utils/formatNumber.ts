/**
 * Format byte values to human-readable string with auto unit selection.
 * Input is in MB (as used by the monitor components).
 *
 * @example
 * formatBytes(512)   // "512MB"
 * formatBytes(1445)  // "1.4GB"
 * formatBytes(2048)  // "2.0GB"
 * formatBytes(0)     // "0MB"
 */
export function formatBytes(mb: number): string {
  if (mb < 0) return '0MB'
  if (mb < 1024) return `${Math.round(mb)}MB`
  const gb = mb / 1024
  if (gb < 1024) return `${gb.toFixed(1)}GB`
  const tb = gb / 1024
  return `${tb.toFixed(1)}TB`
}

/**
 * Format PID with thousands separator for improved readability.
 *
 * @example
 * formatPID(1234)   // "1,234"
 * formatPID(47156)  // "47,156"
 * formatPID(123456) // "123,456"
 * formatPID(42)     // "42"
 */
export function formatPID(pid: number | string): string {
  const numPid = typeof pid === 'string' ? parseInt(pid, 10) : pid
  if (isNaN(numPid)) return String(pid)
  return numPid.toLocaleString('en-US')
}

/**
 * Format a generic number with compact notation for display in constrained spaces.
 *
 * @example
 * formatCompact(1234)    // "1.2K"
 * formatCompact(47156)   // "47.2K"
 * formatCompact(999)     // "999"
 * formatCompact(1000000) // "1.0M"
 */
export function formatCompact(num: number): string {
  if (num < 1000) return String(num)
  if (num < 1_000_000) {
    const k = num / 1000
    return `${k.toFixed(1)}K`
  }
  const m = num / 1_000_000
  return `${m.toFixed(1)}M`
}
