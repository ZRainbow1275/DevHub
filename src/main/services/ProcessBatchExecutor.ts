import { randomUUID } from 'node:crypto'
import PQueue from 'p-queue'
import type { ProcessInfo, ServiceResult, WindowInfo } from '@shared/types-extended'
import { isProtectedProcess } from '@shared/types-extended'
import {
  PROCESS_BATCH_LIMITS,
  processBatchCancelResponseSchema,
  processBatchJobRequestSchema,
  processBatchProgressSchema,
  processBatchResultSchema,
  processBatchStartResponseSchema,
  processBatchTagArgsSchema,
  processBatchUndoResponseSchema,
  type ProcessBatchCancelResponse,
  type ProcessBatchProgress,
  type ProcessBatchRequest,
  type ProcessBatchResult,
  type ProcessBatchStartResponse,
  type ProcessBatchUndoResponse,
  type ProcessTag
} from '@shared/schemas/r8-runtime'
import type { ProcessTagStore } from './ProcessTagStore'
import { InjectTextService, type InjectTextWindowManager } from './inject/InjectTextService'

export type ProcessBatchWatchdogTool = 'codex' | 'claude' | 'gemini' | 'cursor' | 'copilot'

export type ProcessBatchScanner = {
  getAll: (options?: { refresh?: boolean }) => Promise<ProcessInfo[]>
  lookupProcessByPid: (pid: number) => Promise<ProcessInfo | null>
  killProcess: (pid: number, force?: boolean) => Promise<boolean>
}

export type ProcessBatchWindowManager = {
  scanWindows: (includeSystemWindows?: boolean) => Promise<ServiceResult<WindowInfo[]>>
  focusWindow: (hwnd: number) => Promise<ServiceResult>
  sendTextToWindow: (hwnd: number, text: string) => Promise<ServiceResult<{ characters: number; mode: string }>>
} & InjectTextWindowManager

export type ProcessBatchRuntimeService = {
  exportDiagnosticPack: (input?: unknown) => Promise<unknown>
  registerWatchdogInstance: (input: {
    instanceId: string
    pid: number
    tool: ProcessBatchWatchdogTool
    alias?: string
    mode?: 'lenient' | 'strict'
    graceMs?: number
    phase?: 'receiving-input' | 'thinking' | 'running' | 'awaiting-human'
    actionPolicy?: 'restart' | 'fallback-tool' | 'escalate-model' | 'human-intervention' | 'log-only'
  }) => unknown
}

type ProcessBatchTagStore = Pick<ProcessTagStore, 'get' | 'set' | 'remove'>
type ProgressPublisher = (progress: ProcessBatchProgress) => void

interface ProcessBatchExecutorOptions {
  tagStore?: ProcessBatchTagStore
  windowManager?: ProcessBatchWindowManager
  runtimeService?: ProcessBatchRuntimeService
  now?: () => number
}

interface ProcessBatchTagUndoSnapshot {
  process: ProcessInfo
  previousTag: ProcessTag | null
}

interface ProcessBatchJob {
  jobId: string
  request: ProcessBatchRequest
  queue: PQueue
  pendingPids: Set<number>
  results: ProcessBatchResult[]
  cancelled: boolean
  completed: boolean
  createdAt: number
  completedAt: number | null
  undoDeadlineAt: number | null
  publishTimer: ReturnType<typeof setTimeout> | null
  lastPublishedAt: number
  undoablePids: Set<number>
  previousTags: Map<number, ProcessBatchTagUndoSnapshot>
}

interface ServiceResultLike {
  success: boolean
  data?: unknown
  error?: string
}

interface SkippedLike {
  skipped: true
  reason?: string
  output?: unknown
}

const WATCHDOG_TOOLS: ReadonlySet<ProcessBatchWatchdogTool> = new Set(['codex', 'claude', 'gemini', 'cursor', 'copilot'])

export class ProcessBatchExecutionError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`)
    this.name = 'ProcessBatchExecutionError'
  }
}

function isServiceResultLike(value: unknown): value is ServiceResultLike {
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

function serviceFailure<T = unknown>(error: string): ServiceResult<T> {
  return { success: false, error }
}

function skipped(reason: string, output?: unknown): SkippedLike {
  return { skipped: true, reason, output }
}

function extractStringArg(args: Record<string, unknown>, key: string): string | null {
  const value = args[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function inferWatchdogTool(processInfo: ProcessInfo, args: Record<string, unknown>): ProcessBatchWatchdogTool | null {
  const tool = args.tool
  if (typeof tool === 'string' && WATCHDOG_TOOLS.has(tool as ProcessBatchWatchdogTool)) {
    return tool as ProcessBatchWatchdogTool
  }

  const haystack = `${processInfo.name} ${processInfo.command ?? ''}`.toLowerCase()
  if (haystack.includes('claude')) return 'claude'
  if (haystack.includes('gemini')) return 'gemini'
  if (haystack.includes('cursor')) return 'cursor'
  if (haystack.includes('copilot')) return 'copilot'
  if (haystack.includes('codex')) return 'codex'
  return null
}

export class ProcessBatchExecutor {
  private readonly jobs = new Map<string, ProcessBatchJob>()
  private readonly now: () => number
  private readonly injectTextService: InjectTextService | null

  constructor(
    private readonly scanner: ProcessBatchScanner,
    private readonly publish: ProgressPublisher,
    private readonly options: ProcessBatchExecutorOptions = {}
  ) {
    this.now = options.now ?? (() => Date.now())
    this.injectTextService = options.windowManager ? new InjectTextService(options.windowManager) : null
  }

  run(request: ProcessBatchRequest): ProcessBatchStartResponse {
    this.assertConfirmation(request)

    const jobId = randomUUID()
    const job: ProcessBatchJob = {
      jobId,
      request,
      queue: new PQueue({ concurrency: request.action === 'focus' ? 1 : PROCESS_BATCH_LIMITS.PARALLEL }),
      pendingPids: new Set(request.pids),
      results: [],
      cancelled: false,
      completed: false,
      createdAt: this.now(),
      completedAt: null,
      undoDeadlineAt: null,
      publishTimer: null,
      lastPublishedAt: 0,
      undoablePids: new Set(),
      previousTags: new Map()
    }

    this.jobs.set(jobId, job)
    this.publishProgress(job, 'running', true)

    for (const pid of request.pids) {
      void job.queue.add(() => this.runOne(job, pid))
    }

    void job.queue.onIdle().then(() => {
      this.completeJob(job)
    })

    return processBatchStartResponseSchema.parse({ jobId })
  }

  cancel(input: unknown): ProcessBatchCancelResponse {
    const request = processBatchJobRequestSchema.parse(input)
    const job = this.requireJob(request.jobId)
    if (job.completed) {
      return processBatchCancelResponseSchema.parse({ jobId: request.jobId, cancelled: false, skipped: 0 })
    }

    job.cancelled = true
    job.queue.clear()
    const pending = [...job.pendingPids]
    job.pendingPids.clear()
    for (const pid of pending) {
      this.recordResult(job, processBatchResultSchema.parse({
        pid,
        status: 'skipped',
        error: 'E_CANCELLED: batch job was cancelled before this PID started'
      }))
    }
    this.publishProgress(job, 'cancelled', true)
    return processBatchCancelResponseSchema.parse({ jobId: request.jobId, cancelled: true, skipped: pending.length })
  }

  async undo(input: unknown): Promise<ProcessBatchUndoResponse> {
    const request = processBatchJobRequestSchema.parse(input)
    const job = this.requireJob(request.jobId)
    if (!job.completed) {
      throw new ProcessBatchExecutionError('E_JOB_RUNNING', `Batch job is still running: ${request.jobId}`)
    }
    if (job.request.action !== 'tag') {
      return processBatchUndoResponseSchema.parse({ jobId: request.jobId, undone: 0, results: [] })
    }
    if (job.undoDeadlineAt === null || this.now() > job.undoDeadlineAt) {
      throw new ProcessBatchExecutionError('E_TIMEOUT', `Undo window expired for batch job: ${request.jobId}`)
    }

    const tagStore = this.options.tagStore
    if (!tagStore) {
      return processBatchUndoResponseSchema.parse({ jobId: request.jobId, undone: 0, results: [] })
    }

    const undoQueue = new PQueue({ concurrency: PROCESS_BATCH_LIMITS.PARALLEL })
    const targets = job.results
      .filter(result => result.status === 'ok' && job.undoablePids.has(result.pid))
      .map(result => result.pid)

    const undoResults: ProcessBatchResult[] = []
    await Promise.all(targets.map(pid => undoQueue.add(async () => {
      const snapshot = job.previousTags.get(pid)
      if (!snapshot) {
        undoResults.push(processBatchResultSchema.parse({ pid, status: 'failed', error: 'E_NOT_FOUND: missing tag undo snapshot' }))
        return
      }

      try {
        if (snapshot.previousTag) {
          const tag = tagStore.set({
            exe: snapshot.process.name,
            cwd: snapshot.process.workingDir,
            tag: snapshot.previousTag.tag,
            color: snapshot.previousTag.color,
            pinned: snapshot.previousTag.pinned
          })
          undoResults.push(processBatchResultSchema.parse({ pid, status: 'rolled-back', output: tag }))
        } else {
          const removed = tagStore.remove(snapshot.process.name, snapshot.process.workingDir)
          undoResults.push(processBatchResultSchema.parse({ pid, status: removed.success ? 'rolled-back' : 'failed', error: removed.success ? undefined : 'E_ROLLBACK_FAILED: tag remove failed', output: removed }))
        }
      } catch (error) {
        undoResults.push(processBatchResultSchema.parse({
          pid,
          status: 'failed',
          error: error instanceof Error ? error.message : 'tag undo failed'
        }))
      }
    })))

    const byPid = new Map(undoResults.map(result => [result.pid, result]))
    job.results = job.results.map(result => byPid.get(result.pid) ?? result)
    this.publishProgress(job, 'completed', true)

    return processBatchUndoResponseSchema.parse({
      jobId: request.jobId,
      undone: undoResults.filter(result => result.status === 'rolled-back').length,
      results: undoResults
    })
  }

  async waitForIdle(jobId: string): Promise<ProcessBatchProgress> {
    const job = this.requireJob(jobId)
    await job.queue.onIdle()
    return this.buildProgress(job, job.cancelled ? 'cancelled' : 'completed')
  }

  getProgress(jobId: string): ProcessBatchProgress {
    const job = this.requireJob(jobId)
    return this.buildProgress(job, job.cancelled ? 'cancelled' : job.completed ? 'completed' : 'running')
  }

  dispose(): void {
    for (const job of this.jobs.values()) {
      job.queue.clear()
      if (job.publishTimer) {
        clearTimeout(job.publishTimer)
      }
    }
    this.jobs.clear()
  }

  private assertConfirmation(request: ProcessBatchRequest): void {
    if (request.confirmed) return
    if (request.action === 'inject-text') {
      throw new ProcessBatchExecutionError('E_NEEDS_CONFIRM', 'inject-text requires explicit confirmation')
    }
    if (request.action === 'add-watchdog') {
      throw new ProcessBatchExecutionError('E_NEEDS_CONFIRM', 'add-watchdog requires explicit confirmation')
    }
    if (request.action === 'kill' && request.pids.length > PROCESS_BATCH_LIMITS.CONFIRM_THRESHOLD_KILL) {
      throw new ProcessBatchExecutionError('E_NEEDS_CONFIRM', `killing ${request.pids.length} processes requires explicit confirmation`)
    }
  }

  private async runOne(job: ProcessBatchJob, pid: number): Promise<void> {
    job.pendingPids.delete(pid)
    if (job.cancelled) {
      this.recordResult(job, processBatchResultSchema.parse({
        pid,
        status: 'skipped',
        error: 'E_CANCELLED: batch job was cancelled'
      }))
      this.publishProgress(job, 'cancelled')
      return
    }

    if (job.request.dryRun) {
      this.recordResult(job, processBatchResultSchema.parse({
        pid,
        status: 'skipped',
        output: { dryRun: true, action: job.request.action }
      }))
      this.publishProgress(job, 'running')
      return
    }

    try {
      const output = await this.performProcessAction(job, pid)
      this.recordResult(job, this.toBatchResult(pid, output))
    } catch (error) {
      this.recordResult(job, processBatchResultSchema.parse({
        pid,
        status: 'failed',
        error: error instanceof Error ? error.message : 'unknown error'
      }))
    }
    this.publishProgress(job, job.cancelled ? 'cancelled' : 'running')
  }

  private async performProcessAction(job: ProcessBatchJob, pid: number): Promise<unknown> {
    switch (job.request.action) {
      case 'kill':
        return this.performKillAction(pid)
      case 'focus':
        return this.performFocusAction(job.request, pid)
      case 'inject-text':
        return this.performInjectAction(job.request, pid)
      case 'tag':
        return this.performTagAction(job, pid)
      case 'add-watchdog':
        return this.performWatchdogAction(job.request, pid)
      case 'export-diag':
        return this.performDiagnosticExport(pid)
      default:
        return serviceFailure(`E_VALIDATION: unsupported process batch action ${String(job.request.action)}`)
    }
  }

  private async performKillAction(pid: number): Promise<ServiceResult<{ killed: boolean; pid: number }>> {
    if (pid < PROCESS_BATCH_LIMITS.SYSTEM_PID_THRESHOLD) {
      return serviceFailure(`E_PROTECTED_PID: PID ${pid} is below ${PROCESS_BATCH_LIMITS.SYSTEM_PID_THRESHOLD} and is not eligible for batch kill`)
    }

    const processInfo = await this.resolveProcessInfo(pid)
    if (!processInfo) {
      return serviceFailure(`E_NOT_FOUND: PID ${pid} is not present in the latest process scan`)
    }
    if (isProtectedProcess(processInfo.name)) {
      return serviceFailure(`E_PROTECTED_PROCESS: ${processInfo.name} is protected`)
    }

    const killed = await this.scanner.killProcess(pid)
    return killed
      ? { success: true, data: { killed: true, pid } }
      : serviceFailure(`E_KILL_FAILED: process scanner could not terminate PID ${pid}`)
  }

  private async performFocusAction(request: ProcessBatchRequest, pid: number): Promise<unknown> {
    const targetWindow = await this.findWindowForPid(pid, request.args)
    if (!targetWindow) return skipped(`E_WINDOW_NOT_FOUND: no visible window for PID ${pid}`)
    return this.options.windowManager?.focusWindow(targetWindow.hwnd) ?? serviceFailure('E_WINDOW_MANAGER_UNAVAILABLE: focus requires WindowManager')
  }

  private async performInjectAction(request: ProcessBatchRequest, pid: number): Promise<unknown> {
    const text = extractStringArg(request.args, 'text')
    if (!text) return serviceFailure('E_VALIDATION: inject-text requires args.text')
    const targetWindow = await this.findWindowForPid(pid, request.args)
    if (!targetWindow) return skipped(`E_WINDOW_NOT_FOUND: no visible window for PID ${pid}`)
    return this.injectTextService?.execute({
      hwnd: targetWindow.hwnd,
      args: { ...request.args, text },
      allowSafeKeys: false
    }) ?? serviceFailure('E_WINDOW_MANAGER_UNAVAILABLE: inject-text requires WindowManager')
  }

  private async performTagAction(job: ProcessBatchJob, pid: number): Promise<unknown> {
    const tagStore = this.options.tagStore
    if (!tagStore) return serviceFailure('E_TAG_STORE_UNAVAILABLE: tag operation requires ProcessTagStore')

    const args = processBatchTagArgsSchema.parse(job.request.args)
    const processInfo = await this.resolveProcessInfo(pid)
    if (!processInfo) return skipped(`E_NOT_FOUND: PID ${pid} is not present in the latest process scan`)

    const previousTag = tagStore.get(processInfo.name, processInfo.workingDir)
    const tag = tagStore.set({
      exe: processInfo.name,
      cwd: processInfo.workingDir,
      tag: args.tag,
      color: args.color,
      pinned: args.pinned
    })
    job.previousTags.set(pid, { process: processInfo, previousTag })
    job.undoablePids.add(pid)
    return { success: true, data: tag }
  }

  private async performWatchdogAction(request: ProcessBatchRequest, pid: number): Promise<unknown> {
    const runtimeService = this.options.runtimeService
    if (!runtimeService) return serviceFailure('E_WATCHDOG_UNAVAILABLE: runtime watchdog service is not registered')

    const processInfo = await this.resolveProcessInfo(pid)
    if (!processInfo) return skipped(`E_NOT_FOUND: PID ${pid} is not present in the latest process scan`)

    const tool = inferWatchdogTool(processInfo, request.args)
    if (!tool) return serviceFailure(`E_UNSUPPORTED_TOOL: cannot infer watchdog tool for PID ${pid}; pass args.tool`)

    const mode = request.args.mode === 'strict' || request.args.mode === 'lenient' ? request.args.mode : undefined
    const actionPolicy = typeof request.args.actionPolicy === 'string' ? request.args.actionPolicy : undefined
    const instance = runtimeService.registerWatchdogInstance({
      instanceId: `process-${pid}`,
      pid,
      tool,
      alias: processInfo.name,
      mode,
      actionPolicy: actionPolicy === 'restart'
        || actionPolicy === 'fallback-tool'
        || actionPolicy === 'escalate-model'
        || actionPolicy === 'human-intervention'
        || actionPolicy === 'log-only'
        ? actionPolicy
        : undefined
    })
    return { success: true, data: instance }
  }

  private async performDiagnosticExport(pid: number): Promise<unknown> {
    const runtimeService = this.options.runtimeService
    if (!runtimeService) return serviceFailure('E_DIAGNOSTIC_UNAVAILABLE: diagnostic export service is not registered')
    const manifest = await runtimeService.exportDiagnosticPack({
      sectionsIncluded: ['system-info', 'feature-flags', 'recovery-report'],
      includeScreenshots: false,
      redactionLevel: 'aggressive'
    })
    return { success: true, data: { pid, manifest } }
  }

  private async resolveProcessInfo(pid: number): Promise<ProcessInfo | null> {
    const cached = await this.scanner.lookupProcessByPid(pid)
    if (cached) return cached
    const processes = await this.scanner.getAll({ refresh: true })
    return processes.find(processInfo => processInfo.pid === pid) ?? null
  }

  private async findWindowForPid(pid: number, args: Record<string, unknown>): Promise<WindowInfo | null> {
    const windowManager = this.options.windowManager
    if (!windowManager) return null
    const scan = await windowManager.scanWindows(false)
    if (!scan.success) return null
    const requestedHwnd = args.hwnd
    if (typeof requestedHwnd === 'number' && Number.isInteger(requestedHwnd) && requestedHwnd > 0) {
      return scan.data?.find(windowInfo =>
        windowInfo.hwnd === requestedHwnd
        && windowInfo.pid === pid
        && windowInfo.isVisible
      ) ?? null
    }
    return scan.data?.find(windowInfo => windowInfo.pid === pid && windowInfo.isVisible && !windowInfo.isMinimized)
      ?? scan.data?.find(windowInfo => windowInfo.pid === pid && windowInfo.isVisible)
      ?? null
  }

  private toBatchResult(pid: number, output: unknown): ProcessBatchResult {
    if (isSkippedLike(output)) {
      return processBatchResultSchema.parse({
        pid,
        status: 'skipped',
        error: output.reason ?? 'operation skipped',
        output: output.output
      })
    }

    if (isServiceResultLike(output)) {
      if (!output.success) {
        return processBatchResultSchema.parse({
          pid,
          status: 'failed',
          error: output.error ?? 'operation failed',
          output
        })
      }
      return processBatchResultSchema.parse({
        pid,
        status: 'ok',
        output: output.data ?? { success: true }
      })
    }

    if (output === false) {
      return processBatchResultSchema.parse({ pid, status: 'failed', error: 'operation returned false' })
    }

    return processBatchResultSchema.parse({ pid, status: 'ok', output })
  }

  private recordResult(job: ProcessBatchJob, result: ProcessBatchResult): void {
    const existingIndex = job.results.findIndex(candidate => candidate.pid === result.pid)
    if (existingIndex >= 0) {
      job.results[existingIndex] = result
    } else {
      job.results.push(result)
    }
  }

  private completeJob(job: ProcessBatchJob): void {
    if (job.completed) return
    job.completed = true
    job.completedAt = this.now()
    if (job.undoablePids.size > 0) {
      job.undoDeadlineAt = job.completedAt + PROCESS_BATCH_LIMITS.UNDO_WINDOW_MS
    }
    this.publishProgress(job, job.cancelled ? 'cancelled' : 'completed', true)
  }

  private publishProgress(job: ProcessBatchJob, state: ProcessBatchProgress['state'], force = false): void {
    if (job.publishTimer) {
      clearTimeout(job.publishTimer)
      job.publishTimer = null
    }

    const now = this.now()
    const elapsed = now - job.lastPublishedAt
    if (force || elapsed >= PROCESS_BATCH_LIMITS.PROGRESS_PUSH_INTERVAL_MS) {
      job.lastPublishedAt = now
      this.publish(this.buildProgress(job, state))
      return
    }

    job.publishTimer = setTimeout(() => {
      job.publishTimer = null
      job.lastPublishedAt = this.now()
      this.publish(this.buildProgress(job, state))
    }, PROCESS_BATCH_LIMITS.PROGRESS_PUSH_INTERVAL_MS - elapsed)
  }

  private buildProgress(job: ProcessBatchJob, state: ProcessBatchProgress['state']): ProcessBatchProgress {
    const failed = job.results.filter(result => result.status === 'failed').length
    return processBatchProgressSchema.parse({
      jobId: job.jobId,
      total: job.request.pids.length,
      completed: job.results.length,
      failed,
      results: job.results,
      state
    })
  }

  private requireJob(jobId: string): ProcessBatchJob {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new ProcessBatchExecutionError('E_NOT_FOUND', `Batch job not found: ${jobId}`)
    }
    return job
  }
}
