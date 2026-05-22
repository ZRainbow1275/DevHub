import { app, ipcMain } from 'electron'
import type {
  ExportDiagnosticBundleRequest,
  ExportDiagnosticBundleResponse,
  IpcThrottleReport,
  ResetRuntimeMetricsResponse,
  RuntimeMetricsResetScope,
  RuntimeMetricsSnapshot
} from '@shared/observability'
import { DEV_OBS_CHANNELS } from '@shared/observability'
import type { SharedMonitorRuntime } from './runtimeBundle'
import { getRateLimitReport } from '../utils/rateLimiter'

export function isDevObservabilityEnabled(): boolean {
  return !app.isPackaged
    || process.env.ENABLE_DEV_OBS === '1'
    || process.argv.includes('--enable-dev-obs')
}

function ensureDevObservabilityEnabled(): void {
  if (!isDevObservabilityEnabled()) {
    throw new Error('DEV_OBS_DISABLED')
  }
}

function getMetricsCollector(runtime?: SharedMonitorRuntime) {
  ensureDevObservabilityEnabled()

  const metricsCollector = runtime?.metricsCollector
  if (!metricsCollector) {
    throw new Error('DEV_OBS_UNAVAILABLE')
  }

  return metricsCollector
}

export function setupDevObservabilityHandlers(runtime?: SharedMonitorRuntime): void {
  cleanupDevObservabilityHandlers()

  ipcMain.handle(
    DEV_OBS_CHANNELS.GET_RUNTIME_METRICS,
    async (): Promise<RuntimeMetricsSnapshot> => getMetricsCollector(runtime).getSnapshot()
  )

  ipcMain.handle(
    DEV_OBS_CHANNELS.RESET_RUNTIME_METRICS,
    async (_event, scopes?: readonly RuntimeMetricsResetScope[]): Promise<ResetRuntimeMetricsResponse> => ({
      cleared: getMetricsCollector(runtime).reset(scopes)
    })
  )

  ipcMain.handle(
    DEV_OBS_CHANNELS.EXPORT_DIAGNOSTIC_BUNDLE,
    async (
      _event,
      request?: ExportDiagnosticBundleRequest
    ): Promise<ExportDiagnosticBundleResponse> => getMetricsCollector(runtime).exportBundle(request)
  )

  ipcMain.handle(
    DEV_OBS_CHANNELS.GET_THROTTLE_REPORT,
    async (): Promise<IpcThrottleReport> => {
      ensureDevObservabilityEnabled()
      return getRateLimitReport()
    }
  )
}

export function cleanupDevObservabilityHandlers(): void {
  ipcMain.removeHandler(DEV_OBS_CHANNELS.GET_RUNTIME_METRICS)
  ipcMain.removeHandler(DEV_OBS_CHANNELS.RESET_RUNTIME_METRICS)
  ipcMain.removeHandler(DEV_OBS_CHANNELS.EXPORT_DIAGNOSTIC_BUNDLE)
  ipcMain.removeHandler(DEV_OBS_CHANNELS.GET_THROTTLE_REPORT)
}
