import {
  PROCESS_BATCH_LIMITS,
  processBatchProgressSchema,
  processBatchRequestSchema,
  processBatchResultSchema,
  type ProcessBatchAction,
  type ProcessBatchProgress,
  type ProcessBatchRequest,
  type ProcessBatchResult
} from '@shared/schemas/r8-runtime'

interface SuccessLike {
  success: boolean
  error?: string
}

interface SkippedLike {
  skipped: boolean
  reason?: string
}

export interface ProcessBatchRunOptions {
  delayMs?: number
  jobId?: string
}

export type ProcessBatchHandler = (pid: number, request: ProcessBatchRequest) => Promise<unknown> | unknown

export const PROCESS_BATCH_ACTION_LABELS: Record<ProcessBatchAction, string> = {
  kill: '批量终止',
  focus: '批量聚焦',
  'inject-text': '批量注入',
  tag: '批量标签',
  'add-watchdog': '加入 Watchdog',
  'export-diag': '导出诊断'
}

function isSuccessLike(value: unknown): value is SuccessLike {
  return typeof value === 'object'
    && value !== null
    && 'success' in value
    && typeof (value as { success: unknown }).success === 'boolean'
}

function isSkippedLike(value: unknown): value is SkippedLike {
  return typeof value === 'object'
    && value !== null
    && 'skipped' in value
    && (value as { skipped: unknown }).skipped === true
}

function createJobId(): string {
  return globalThis.crypto.randomUUID()
}

function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, delayMs))
}

export function normalizeBatchPids(pids: readonly number[]): number[] {
  const unique = new Set<number>()
  for (const pid of pids) {
    if (Number.isInteger(pid) && pid > 0) unique.add(pid)
  }
  return [...unique]
}

export function createProcessBatchRequest(
  action: ProcessBatchAction,
  pids: readonly number[],
  patch: Partial<Omit<ProcessBatchRequest, 'action' | 'pids'>> = {}
): ProcessBatchRequest {
  return processBatchRequestSchema.parse({
    action,
    pids: normalizeBatchPids(pids),
    ...patch
  })
}

export function getBlockedSystemKillPids(request: ProcessBatchRequest): number[] {
  if (request.action !== 'kill') return []
  return request.pids.filter(pid => pid < PROCESS_BATCH_LIMITS.SYSTEM_PID_THRESHOLD)
}

export function requiresProcessBatchConfirmation(request: ProcessBatchRequest): boolean {
  if (request.confirmed) return false
  if (request.action === 'inject-text') return PROCESS_BATCH_LIMITS.CONFIRM_REQUIRED_FOR_INJECT
  if (request.action === 'add-watchdog') return PROCESS_BATCH_LIMITS.CONFIRM_REQUIRED_FOR_WATCHDOG
  if (request.action !== 'kill') return false
  return request.pids.length > PROCESS_BATCH_LIMITS.CONFIRM_THRESHOLD_KILL
    || getBlockedSystemKillPids(request).length > 0
}

export function buildProcessBatchConfirmMessage(request: ProcessBatchRequest): string {
  const label = PROCESS_BATCH_ACTION_LABELS[request.action]
  if (request.action === 'kill') {
    const blocked = getBlockedSystemKillPids(request)
    if (blocked.length > 0) {
      return `系统 PID ${blocked.join(', ')} 不允许批量终止。`
    }
    return `将终止 ${request.pids.length} 个进程。该操作不可撤销，确认继续？`
  }
  if (request.action === 'inject-text') {
    const text = typeof request.args.text === 'string' ? request.args.text : ''
    return `将向 ${request.pids.length} 个进程注入文本。预览：${text.slice(0, 80)}`
  }
  if (request.action === 'add-watchdog') {
    return `将 ${request.pids.length} 个进程加入 Watchdog 监控，确认继续？`
  }
  return `${label}：${request.pids.length} 个进程，确认继续？`
}

function resultFromOutput(pid: number, output: unknown): ProcessBatchResult {
  if (output === false) {
    return processBatchResultSchema.parse({ pid, status: 'failed', error: 'operation returned false' })
  }
  if (isSkippedLike(output)) {
    return processBatchResultSchema.parse({
      pid,
      status: 'skipped',
      error: output.reason ?? 'operation skipped',
      output
    })
  }
  if (isSuccessLike(output) && !output.success) {
    return processBatchResultSchema.parse({ pid, status: 'failed', error: output.error ?? 'operation failed', output })
  }
  return processBatchResultSchema.parse({ pid, status: 'ok', output })
}

export async function runSequentialProcessBatch(
  request: ProcessBatchRequest,
  handler: ProcessBatchHandler,
  options: ProcessBatchRunOptions = {}
): Promise<ProcessBatchProgress> {
  const results: ProcessBatchResult[] = []
  const delayMs = options.delayMs ?? 0
  for (const pid of request.pids) {
    if (request.dryRun) {
      results.push(processBatchResultSchema.parse({ pid, status: 'skipped', output: { dryRun: true } }))
      continue
    }
    try {
      const output = await handler(pid, request)
      results.push(resultFromOutput(pid, output))
    } catch (error) {
      results.push(processBatchResultSchema.parse({
        pid,
        status: 'failed',
        error: error instanceof Error ? error.message : 'unknown error'
      }))
    }
    if (delayMs > 0) await wait(delayMs)
  }
  const failed = results.filter(result => result.status === 'failed').length
  return processBatchProgressSchema.parse({
    jobId: options.jobId ?? createJobId(),
    total: request.pids.length,
    completed: results.length,
    failed,
    results,
    state: 'completed'
  })
}

export function summarizeProcessBatchProgress(progress: ProcessBatchProgress, actionLabel: string): string {
  const skipped = progress.results.filter(result => result.status === 'skipped').length
  if (progress.failed === 0 && skipped === 0) return `${actionLabel}完成：${progress.completed}/${progress.total}`
  if (progress.failed === 0) return `${actionLabel}完成：成功 ${progress.completed - skipped}/${progress.total}，跳过 ${skipped}`
  return `${actionLabel}部分失败：成功 ${progress.completed - progress.failed - skipped}/${progress.total}，失败 ${progress.failed}，跳过 ${skipped}`
}
