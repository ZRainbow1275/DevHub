import {
  WINDOW_BATCH_LIMITS,
  windowBatchProgressSchema,
  windowBatchRequestSchema,
  windowBatchResultSchema,
  type WindowBatchAction,
  type WindowBatchProgress,
  type WindowBatchRequest,
  type WindowBatchResult
} from '@shared/schemas/r8-runtime'

interface SuccessLike {
  success: boolean
  error?: string
}

export interface WindowBatchRunOptions {
  delayMs?: number
  jobId?: string
  isCancelled?: () => boolean
  onProgress?: (progress: WindowBatchProgress) => void
}

export type WindowBatchHandler = (hwnd: number, request: WindowBatchRequest) => Promise<unknown> | unknown

function isSuccessLike(value: unknown): value is SuccessLike {
  return typeof value === 'object'
    && value !== null
    && 'success' in value
    && typeof (value as { success: unknown }).success === 'boolean'
}

function createJobId(): string {
  return globalThis.crypto.randomUUID()
}

function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, delayMs))
}

function buildWindowBatchProgress(
  jobId: string,
  total: number,
  results: WindowBatchResult[],
  state: WindowBatchProgress['state']
): WindowBatchProgress {
  const failed = results.filter(result => result.status === 'failed').length
  return windowBatchProgressSchema.parse({
    jobId,
    total,
    completed: results.length,
    failed,
    results,
    state
  })
}

export function normalizeBatchHwnds(hwnds: readonly number[]): number[] {
  const unique = new Set<number>()
  for (const hwnd of hwnds) {
    if (Number.isInteger(hwnd) && hwnd > 0) unique.add(hwnd)
  }
  return [...unique]
}

export function createWindowBatchRequest(
  action: WindowBatchAction,
  hwnds: readonly number[],
  patch: Partial<Omit<WindowBatchRequest, 'action' | 'hwnds'>> = {}
): WindowBatchRequest {
  return windowBatchRequestSchema.parse({
    action,
    hwnds: normalizeBatchHwnds(hwnds),
    ...patch
  })
}

export function requiresWindowBatchConfirmation(request: WindowBatchRequest): boolean {
  if (request.confirmed) return false
  if (request.action === 'inject-text') return WINDOW_BATCH_LIMITS.CONFIRM_REQUIRED_FOR_INJECT
  return request.action === 'close' && request.hwnds.length > WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE
}

function resultFromOutput(hwnd: number, output: unknown): WindowBatchResult {
  if (output === false) {
    return windowBatchResultSchema.parse({ hwnd, status: 'failed', error: 'operation returned false' })
  }
  if (isSuccessLike(output) && !output.success) {
    return windowBatchResultSchema.parse({ hwnd, status: 'failed', error: output.error ?? 'operation failed', output })
  }
  return windowBatchResultSchema.parse({ hwnd, status: 'ok', output })
}

export async function runSequentialWindowBatch(
  request: WindowBatchRequest,
  handler: WindowBatchHandler,
  options: WindowBatchRunOptions = {}
): Promise<WindowBatchProgress> {
  const results: WindowBatchResult[] = []
  const delayMs = options.delayMs ?? 0
  const jobId = options.jobId ?? createJobId()
  options.onProgress?.(buildWindowBatchProgress(jobId, request.hwnds.length, results, 'running'))

  for (const [index, hwnd] of request.hwnds.entries()) {
    if (options.isCancelled?.()) {
      for (const remainingHwnd of request.hwnds.slice(index)) {
        results.push(windowBatchResultSchema.parse({
          hwnd: remainingHwnd,
          status: 'skipped',
          output: { reason: 'cancelled-before-start' }
        }))
      }
      const cancelledProgress = buildWindowBatchProgress(jobId, request.hwnds.length, results, 'cancelled')
      options.onProgress?.(cancelledProgress)
      return cancelledProgress
    }

    if (request.dryRun) {
      results.push(windowBatchResultSchema.parse({ hwnd, status: 'skipped', output: { dryRun: true } }))
    } else {
      try {
        const output = await handler(hwnd, request)
        results.push(resultFromOutput(hwnd, output))
      } catch (error) {
        results.push(windowBatchResultSchema.parse({
          hwnd,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown error'
        }))
      }
    }

    options.onProgress?.(buildWindowBatchProgress(jobId, request.hwnds.length, results, 'running'))
    if (delayMs > 0 && index < request.hwnds.length - 1) await wait(delayMs)
  }

  const completedProgress = buildWindowBatchProgress(jobId, request.hwnds.length, results, 'completed')
  options.onProgress?.(completedProgress)
  return completedProgress
}

export function summarizeWindowBatchProgress(progress: WindowBatchProgress, actionLabel: string): string {
  if (progress.failed === 0) return `${actionLabel}完成：${progress.completed}/${progress.total}`
  return `${actionLabel}部分失败：成功 ${progress.completed - progress.failed}/${progress.total}，失败 ${progress.failed}`
}
