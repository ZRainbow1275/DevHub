import { ipcMain } from 'electron'
import {
  iconResolveRequestSchema,
  type IconListLibrariesResponse,
  type IconResolveResponse,
} from '@shared/schemas/r8-runtime'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { IconRegistryService } from '../services/IconRegistryService'

let iconRegistryService: IconRegistryService | null = null

export function setupIconHandlers(service: IconRegistryService = new IconRegistryService()): void {
  cleanupIconHandlers()
  iconRegistryService = service

  ipcMain.handle('icon:list-libraries', withRateLimit(
    'icon:list-libraries',
    RATE_LIMITS.QUERY,
    async (): Promise<IconListLibrariesResponse> => (
      iconRegistryService ?? new IconRegistryService()
    ).listLibraries()
  ))

  ipcMain.handle('icon:resolve-token', withRateLimit(
    'icon:resolve-token',
    RATE_LIMITS.QUERY,
    async (_event, input: unknown): Promise<IconResolveResponse> => {
      const parsed = iconResolveRequestSchema.parse(input)
      return (iconRegistryService ?? new IconRegistryService()).resolveToken(parsed.token)
    }
  ))
}

export function cleanupIconHandlers(): void {
  iconRegistryService = null
  ipcMain.removeHandler('icon:list-libraries')
  ipcMain.removeHandler('icon:resolve-token')
}
