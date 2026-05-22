export const TAG_HISTORY_LIMITS = {
  TAG_MAX_LEN: 64,
  HISTORY_WINDOW_HOURS: 24,
  SAMPLE_INTERVAL_S: 60,
  MAX_POINTS_PER_KEY: 1440,
  SQLITE_RETENTION_DAYS: 7,
} as const

export const PROCESS_TAG_COLOR_VALUES = [
  'accent',
  'info',
  'success',
  'warning',
  'gold',
  'steel',
  'error',
] as const

export type ProcessTagColor = typeof PROCESS_TAG_COLOR_VALUES[number]

export function normalizeProcessIdentityPart(value: string | undefined): string {
  return (value ?? '').trim().replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase()
}

export function normalizeProcessTagText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, TAG_HISTORY_LIMITS.TAG_MAX_LEN)
}

export function buildProcessIdentityPair(exe: string, cwd?: string): string {
  return `${normalizeProcessIdentityPart(exe)}|${normalizeProcessIdentityPart(cwd)}`
}
