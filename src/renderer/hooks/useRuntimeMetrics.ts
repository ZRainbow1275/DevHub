import { useCallback, useEffect, useState } from 'react'
import type {
  ExportDiagnosticBundleRequest,
  ExportDiagnosticBundleResponse,
  IpcThrottleReport,
  ReactCommitReport,
  ResetRuntimeMetricsResponse,
  RuntimeMetricsResetScope,
  RuntimeMetricsSnapshot
} from '@shared/observability'
import type {
  ObservabilityExportSnapshotResponse,
  ObservabilityMetricSample,
  ObservabilitySnapshot
} from '@shared/schemas/r8-runtime'

interface UseRuntimeMetricsOptions {
  enabled: boolean
  getReactCommitReport: () => ReactCommitReport
  pollIntervalMs?: number
  resetReactCommitReport: () => void
}

interface UseRuntimeMetricsResult {
  error: string | null
  exportBundle: (request?: Omit<ExportDiagnosticBundleRequest, 'reactCommits'>) => Promise<ExportDiagnosticBundleResponse>
  exportSnapshot: (format: 'json' | 'csv') => Promise<ObservabilityExportSnapshotResponse>
  isRefreshing: boolean
  observabilitySnapshot: ObservabilitySnapshot | null
  refresh: () => Promise<RuntimeMetricsSnapshot | null>
  resetMetrics: (scopes?: readonly RuntimeMetricsResetScope[]) => Promise<ResetRuntimeMetricsResponse>
  snapshot: RuntimeMetricsSnapshot | null
  subscribeObservability: (listener: (samples: ObservabilityMetricSample[]) => void) => () => void
  throttleReport: IpcThrottleReport | null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '获取运行时指标失败'
}

export function useRuntimeMetrics({
  enabled,
  getReactCommitReport,
  pollIntervalMs = 1000,
  resetReactCommitReport
}: UseRuntimeMetricsOptions): UseRuntimeMetricsResult {
  const [snapshot, setSnapshot] = useState<RuntimeMetricsSnapshot | null>(null)
  const [observabilitySnapshot, setObservabilitySnapshot] = useState<ObservabilitySnapshot | null>(null)
  const [throttleReport, setThrottleReport] = useState<IpcThrottleReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const mergeSnapshot = useCallback((mainSnapshot: RuntimeMetricsSnapshot): RuntimeMetricsSnapshot => ({
    ...mainSnapshot,
    reactCommits: getReactCommitReport()
  }), [getReactCommitReport])

  const refresh = useCallback(async (): Promise<RuntimeMetricsSnapshot | null> => {
    if (!enabled || (!window.devhub?.devObs && !window.devhub?.r8?.obs)) {
      setSnapshot(null)
      setObservabilitySnapshot(null)
      setThrottleReport(null)
      setError(null)
      return null
    }

    setIsRefreshing(true)
    try {
      const [mainSnapshot, nextThrottleReport, nextObservabilitySnapshot] = await Promise.all([
        window.devhub.devObs?.getRuntimeMetrics() ?? Promise.resolve(null),
        window.devhub.devObs?.getThrottleReport() ?? Promise.resolve(null),
        window.devhub.r8?.obs?.getSnapshot() ?? Promise.resolve(null)
      ])
      const merged = mainSnapshot ? mergeSnapshot(mainSnapshot) : null
      setSnapshot(merged)
      setThrottleReport(nextThrottleReport)
      setObservabilitySnapshot(nextObservabilitySnapshot)
      setError(null)
      return merged
    } catch (refreshError) {
      setError(getErrorMessage(refreshError))
      return null
    } finally {
      setIsRefreshing(false)
    }
  }, [enabled, mergeSnapshot])

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null)
      setObservabilitySnapshot(null)
      setThrottleReport(null)
      setError(null)
      return
    }

    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, pollIntervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [enabled, pollIntervalMs, refresh])

  const resetMetrics = useCallback(async (
    scopes?: readonly RuntimeMetricsResetScope[]
  ): Promise<ResetRuntimeMetricsResponse> => {
    if (!enabled || !window.devhub?.devObs) {
      return { cleared: [] }
    }

    const response = await window.devhub.devObs.resetMetrics(scopes)
    if (!scopes || scopes.length === 0 || scopes.includes('all')) {
      resetReactCommitReport()
    }

    await refresh()
    return response
  }, [enabled, refresh, resetReactCommitReport])

  const exportBundle = useCallback(async (
    request?: Omit<ExportDiagnosticBundleRequest, 'reactCommits'>
  ): Promise<ExportDiagnosticBundleResponse> => {
    if (!enabled || !window.devhub?.devObs) {
      throw new Error('DEV_OBS_DISABLED')
    }

    return window.devhub.devObs.exportDiagnosticBundle({
      ...request,
      reactCommits: getReactCommitReport()
    })
  }, [enabled, getReactCommitReport])

  const exportSnapshot = useCallback(async (
    format: 'json' | 'csv'
  ): Promise<ObservabilityExportSnapshotResponse> => {
    if (!enabled || !window.devhub?.r8?.obs) {
      throw new Error('OBS_DISABLED')
    }

    return window.devhub.r8.obs.exportSnapshot({ format })
  }, [enabled])

  const subscribeObservability = useCallback((
    listener: (samples: ObservabilityMetricSample[]) => void
  ): (() => void) => {
    if (!enabled || !window.devhub?.r8?.obs) {
      return () => undefined
    }

    return window.devhub.r8.obs.subscribe(listener)
  }, [enabled])

  return {
    error,
    exportBundle,
    exportSnapshot,
    isRefreshing,
    observabilitySnapshot,
    refresh,
    resetMetrics,
    snapshot,
    subscribeObservability,
    throttleReport
  }
}
