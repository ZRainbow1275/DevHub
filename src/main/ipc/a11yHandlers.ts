import { ipcMain } from 'electron'
import {
  type A11yOsPrefs,
  type A11yPrefs,
  type A11ySelfCheckResult,
} from '@shared/schemas/r8-runtime'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { A11ySelfCheck } from '../services/A11ySelfCheck'

let a11ySelfCheck: A11ySelfCheck | null = null

export function setupA11yHandlers(service: A11ySelfCheck = new A11ySelfCheck()): void {
  cleanupA11yHandlers()
  a11ySelfCheck = service

  ipcMain.handle('a11y:get-prefs', withRateLimit(
    'a11y:get-prefs',
    RATE_LIMITS.QUERY,
    async (): Promise<A11yPrefs> => a11ySelfCheck?.getPrefs() ?? new A11ySelfCheck().getPrefs()
  ))

  ipcMain.handle('a11y:set-prefs', withRateLimit(
    'a11y:set-prefs',
    RATE_LIMITS.ACTION,
    async (_event, input: unknown): Promise<A11yPrefs> => {
      if (!a11ySelfCheck) {
        a11ySelfCheck = new A11ySelfCheck()
      }
      return a11ySelfCheck.setPrefs(input)
    }
  ))

  ipcMain.handle('a11y:os-prefs', withRateLimit(
    'a11y:os-prefs',
    RATE_LIMITS.QUERY,
    async (): Promise<A11yOsPrefs> => a11ySelfCheck?.getOsPrefs() ?? new A11ySelfCheck().getOsPrefs()
  ))

  ipcMain.handle('a11y:run-self-check', withRateLimit(
    'a11y:run-self-check',
    RATE_LIMITS.ACTION,
    async (): Promise<A11ySelfCheckResult> => a11ySelfCheck?.runSelfCheck() ?? new A11ySelfCheck().runSelfCheck()
  ))
}

export function cleanupA11yHandlers(): void {
  a11ySelfCheck = null
  ipcMain.removeHandler('a11y:get-prefs')
  ipcMain.removeHandler('a11y:set-prefs')
  ipcMain.removeHandler('a11y:os-prefs')
  ipcMain.removeHandler('a11y:run-self-check')
}
