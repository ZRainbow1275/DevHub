export const PROCESS_MODULE_R8_RELEASE_DATE_ISO = '2026-05-16T00:00:00+08:00'
export const PROCESS_MODULE_NEW_BADGE_WINDOW_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface ProcessModuleNewBadgeState {
  isActive: boolean
  daysRemaining: number
  elapsedDays: number
}

export function getProcessModuleNewBadgeState(now: Date = new Date()): ProcessModuleNewBadgeState {
  const releaseDate = new Date(PROCESS_MODULE_R8_RELEASE_DATE_ISO)
  const elapsedMs = now.getTime() - releaseDate.getTime()

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return {
      isActive: false,
      daysRemaining: PROCESS_MODULE_NEW_BADGE_WINDOW_DAYS,
      elapsedDays: 0,
    }
  }

  const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY)
  const daysRemaining = Math.max(PROCESS_MODULE_NEW_BADGE_WINDOW_DAYS - elapsedDays, 0)

  return {
    isActive: elapsedDays < PROCESS_MODULE_NEW_BADGE_WINDOW_DAYS,
    daysRemaining,
    elapsedDays,
  }
}
