import { createHash, randomUUID } from 'node:crypto'
import { queueStatsSchema, taskRunSchema, type QueueStats, type TaskRun } from '@shared/schemas/r8-runtime'
import type { DagSnapshot } from '@shared/schemas/dag'
import type { RuntimeCsvTaskRow } from '../csv'
import { DagOrchestrator } from '../dag'
import { OnFailHandler } from './OnFailHandler'

const RETRY_BACKOFF_BASE_MS = 2_000
const RETRY_BACKOFF_FACTOR = 2
const RETRY_BACKOFF_MAX_MS = 60_000
const RETRY_BACKOFF_JITTER_RATIO = 0.2

class ParallelGroupController {
  private readonly runningByGroup = new Map<string, number>()

  constructor(
    runningTasks: readonly TaskRun[],
    private readonly limitsByGroup: Readonly<Record<string, number>>
  ) {
    for (const task of runningTasks) {
      if (!task.parallelGroup) continue
      this.runningByGroup.set(task.parallelGroup, (this.runningByGroup.get(task.parallelGroup) ?? 0) + 1)
    }
  }

  tryAcquire(task: TaskRun): boolean {
    const group = task.parallelGroup
    if (!group) return true
    const limit = this.limitsByGroup[group]
    if (typeof limit !== 'number') return true
    const running = this.runningByGroup.get(group) ?? 0
    if (running >= limit) return false
    this.runningByGroup.set(group, running + 1)
    return true
  }
}

export interface TaskQueueStore {
  get(key: string, defaultValue?: unknown): unknown
  set(key: string, value: unknown): void
}

export interface TaskStateTransition {
  transitionId: string
  runId: string
  taskId: string
  sessionId: string | null
  prev: TaskRun['status']
  next: TaskRun['status']
  at: number
  reason: string
}

export interface EnqueueRowsInput {
  sessionId: string
  rows: RuntimeCsvTaskRow[]
  concurrent?: number
  resume?: boolean
  forceRerun?: string[]
  parallelGroupOverrides?: Record<string, number>
}

export interface StartReadyInput {
  sessionId: string
  concurrent?: number
  parallelGroupOverrides?: Record<string, number>
}

export interface CompleteTaskInput {
  runId: string
  exitCode: number
  errorCode?: string | null
  errorMessage?: string | null
}

export interface RecordOnFailSkillResultInput {
  runId: string
  success: boolean
  artifactPath: string
  exitCode: number | null
  errorCode: string
  errorMessage: string
}

export interface AttachRecordingInput {
  runId: string
  recordingId: string
}

export interface AttachInjectActionInput {
  runId: string
  injectActionId: string
}

export interface TaskQueueServiceOptions {
  onFailSkillExecutorAvailable?: boolean
}

export class StoreBackedTaskQueueService {
  private readonly dagOrchestrator = new DagOrchestrator()
  private readonly onFailHandler: OnFailHandler

  constructor(
    private readonly store: TaskQueueStore,
    private readonly hashRow: (row: RuntimeCsvTaskRow) => string,
    private readonly now: () => number = () => Date.now(),
    options: TaskQueueServiceOptions = {}
  ) {
    this.onFailHandler = new OnFailHandler({ executeSkillAvailable: options.onFailSkillExecutorAvailable === true })
  }

  enqueueRows(input: EnqueueRowsInput): { taskRunIds: string[]; tasks: TaskRun[]; skipped: number; rerunChanged: number } {
    this.validateConcurrent(input.concurrent ?? 3, 'concurrent')
    this.validateParallelGroupOverrides(input.parallelGroupOverrides ?? {})
    const forceRerun = new Set(input.forceRerun ?? [])
    const normalizedRows = input.rows.map(row => ({ ...row, group: input.sessionId }))
    this.assertUniqueTaskIds(normalizedRows)
    this.assertKnownForceRerun(forceRerun, normalizedRows)
    const rows = this.sortRowsByTopologicalOrder(normalizedRows)

    const existing = this.listTasks()
    const existingByTaskId = new Map<string, TaskRun>()
    for (const task of existing) {
      if (task.sessionId === input.sessionId && !existingByTaskId.has(this.taskIdOf(task))) existingByTaskId.set(this.taskIdOf(task), task)
    }
    const queuedAt = this.now()
    const tasks = rows.map(row => {
      const taskId = row.id
      const rowHash = this.hashRow(row)
      const previous = existingByTaskId.get(taskId)
      const shouldResumeSkip = input.resume === true && previous?.status === 'succeeded' && previous.rowHash === rowHash && !forceRerun.has(taskId)
      const rerunChanged = input.resume === true && previous?.status === 'succeeded' && previous.rowHash !== rowHash
      return taskRunSchema.parse({
        runId: `task-${taskId}-${randomUUID()}`,
        taskId,
        sessionId: input.sessionId,
        row,
        status: shouldResumeSkip ? 'skipped' : row.dependency ? 'waiting-dependency' : 'queued',
        attempts: 0,
        attemptCount: 0,
        maxRetry: row.retries,
        rowHash,
        queuedAt,
        startedAt: null,
        endedAt: shouldResumeSkip ? queuedAt : null,
        retryBackoffMs: null,
        nextRetryAt: null,
        exitCode: shouldResumeSkip ? 0 : null,
        error: row.dry_run ? 'dry_run queued; external CLI launch requires explicit executor' : null,
        errorCode: shouldResumeSkip ? 'RESUME_SKIPPED' : row.dry_run ? 'DRY_RUN' : rerunChanged ? 'ROW_HASH_CHANGED' : null,
        errorMessage: shouldResumeSkip
          ? 'resume skipped because previous succeeded rowHash still matches'
          : row.dry_run ? 'dry_run queued; external CLI launch requires explicit executor' : rerunChanged ? 'rowHash changed since previous succeeded run; queued for rerun' : null,
        parallelGroup: row.parallel_group ?? null,
        artifactsPath: row.output_path ?? null,
        injectActionId: null,
        recordingId: null
      })
    })

    const promoted = this.promoteWaitingDependencies([...tasks, ...existing], input.sessionId)
    this.persistTasks(promoted)
    return {
      taskRunIds: tasks.map(task => task.runId),
      tasks: tasks.map(task => promoted.find(item => item.runId === task.runId) ?? task),
      skipped: tasks.filter(task => task.status === 'skipped').length,
      rerunChanged: tasks.filter(task => task.errorCode === 'ROW_HASH_CHANGED').length
    }
  }

  listTasks(input: { sessionId?: string } = {}): TaskRun[] {
    const tasks = this.parseTasks(this.store.get('tasks', []))
    return input.sessionId ? tasks.filter(task => task.sessionId === input.sessionId) : tasks
  }

  getStats(input: { sessionId?: string; concurrent?: number } = {}): QueueStats {
    const tasks = this.listTasks(input)
    const firstQueuedAt = tasks.length > 0 ? Math.min(...tasks.map(task => task.queuedAt)) : this.now()
    const completed = tasks.filter(task => ['succeeded', 'failed', 'skipped', 'cancelled'].includes(task.status)).length
    const elapsedMinutes = Math.max((this.now() - firstQueuedAt) / 60_000, 1 / 60)
    return queueStatsSchema.parse({
      sessionId: input.sessionId ?? null,
      pending: tasks.filter(task => task.status === 'pending').length,
      queued: tasks.filter(task => task.status === 'queued' || task.status === 'waiting-dependency' || task.status === 'paused').length,
      running: tasks.filter(task => task.status === 'running').length,
      succeeded: tasks.filter(task => task.status === 'succeeded').length,
      failed: tasks.filter(task => task.status === 'failed').length,
      skipped: tasks.filter(task => task.status === 'skipped').length,
      awaitingHuman: tasks.filter(task => task.status === 'awaiting-human').length,
      retrying: tasks.filter(task => task.status === 'retrying').length,
      cancelled: tasks.filter(task => task.status === 'cancelled').length,
      total: tasks.length,
      concurrent: input.concurrent ?? 3,
      throughputPerMin: completed / elapsedMinutes,
      estimatedSecondsRemaining: null
    })
  }

  startReadyTasks(input: StartReadyInput): { started: TaskRun[]; tasks: TaskRun[] } {
    const concurrent = this.validateConcurrent(input.concurrent ?? 3, 'concurrent')
    const parallelGroupOverrides = this.validateParallelGroupOverrides(input.parallelGroupOverrides ?? {})
    const retryPromoted = this.promoteReadyRetries(this.listTasks(), input.sessionId)
    const promoted = this.promoteWaitingDependencies(retryPromoted, input.sessionId)
    const running = promoted.filter(task => task.sessionId === input.sessionId && task.status === 'running')
    const parallelGroups = new ParallelGroupController(running, parallelGroupOverrides)
    let available = Math.max(concurrent - running.length, 0)
    const startedIds = new Set<string>()
    const sortedQueued = promoted
      .filter(task => task.sessionId === input.sessionId && task.status === 'queued')
      .sort((left, right) => (right.row.priority ?? 50) - (left.row.priority ?? 50) || left.queuedAt - right.queuedAt)

    for (const task of sortedQueued) {
      if (available <= 0) break
      if (!parallelGroups.tryAcquire(task)) continue
      startedIds.add(task.runId)
      available -= 1
    }

    const at = this.now()
    const nextTasks = promoted.map(task => startedIds.has(task.runId)
      ? this.transitionTask(task, 'running', 'scheduler-start', { startedAt: at, error: null, errorCode: null, errorMessage: null })
      : task)
    this.persistTasks(nextTasks)
    return { started: nextTasks.filter(task => startedIds.has(task.runId)), tasks: nextTasks }
  }

  completeTask(input: CompleteTaskInput): TaskRun {
    const tasks = this.listTasks()
    const index = tasks.findIndex(task => task.runId === input.runId)
    if (index < 0) throw new Error('E_NOT_FOUND:task run not found')
    const task = tasks[index]
    const success = input.exitCode === 0
    const completedAt = this.now()
    const nextAttemptCount = success ? task.attemptCount : task.attemptCount + 1
    const failure = success ? null : this.onFailHandler.decide({
      task,
      completedAt,
      nextAttemptCount,
      exitCode: input.exitCode,
      errorCode: input.errorCode ?? 'E_RUNTIME',
      errorMessage: input.errorMessage ?? 'task failed'
    })
    const nextStatus: TaskRun['status'] = success ? 'succeeded' : failure?.nextStatus ?? 'failed'
    const retryBackoffMs = nextStatus === 'retrying'
      ? failure?.patch.retryBackoffMs ?? this.calculateRetryBackoffMs(task, nextAttemptCount)
      : null
    const completed = this.transitionTask(task, nextStatus, success ? 'executor-success' : failure?.reason ?? 'executor-failure', {
      endedAt: completedAt,
      exitCode: input.exitCode,
      attempts: success ? task.attempts : task.attempts + 1,
      attemptCount: nextAttemptCount,
      retryBackoffMs,
      nextRetryAt: retryBackoffMs === null ? null : completedAt + retryBackoffMs,
      error: success ? null : input.errorMessage ?? 'task failed',
      errorCode: success ? null : input.errorCode ?? 'E_RUNTIME',
      errorMessage: success ? null : input.errorMessage ?? 'task failed',
      ...(failure?.patch ?? {})
    })
    tasks[index] = completed
    const withAbort = failure?.abortSession ? this.cancelPendingSessionTasks(tasks, completed) : tasks
    const promoted = this.promoteWaitingDependencies(withAbort, completed.sessionId ?? undefined)
    this.persistTasks(promoted)
    return promoted.find(item => item.runId === completed.runId) ?? completed
  }

  attachRecording(input: AttachRecordingInput): TaskRun {
    const tasks = this.listTasks()
    const index = tasks.findIndex(task => task.runId === input.runId)
    if (index < 0) throw new Error('E_NOT_FOUND:task run not found')
    const task = tasks[index]
    const updated = taskRunSchema.parse({ ...task, recordingId: input.recordingId })
    tasks[index] = updated
    this.persistTasks(tasks)
    return updated
  }

  attachInjectAction(input: AttachInjectActionInput): TaskRun {
    const tasks = this.listTasks()
    const index = tasks.findIndex(task => task.runId === input.runId)
    if (index < 0) throw new Error('E_NOT_FOUND:task run not found')
    const task = tasks[index]
    const updated = taskRunSchema.parse({ ...task, injectActionId: input.injectActionId })
    tasks[index] = updated
    this.persistTasks(tasks)
    return updated
  }

  recordOnFailSkillResult(input: RecordOnFailSkillResultInput): TaskRun {
    const tasks = this.listTasks()
    const index = tasks.findIndex(task => task.runId === input.runId)
    if (index < 0) throw new Error('E_NOT_FOUND:task run not found')
    const task = tasks[index]
    if (task.row.on_fail !== 'execute-skill') throw new Error('E_VALIDATION:task is not configured for on_fail=execute-skill')
    if (task.status !== 'awaiting-human') throw new Error(`E_STATE_TRANSITION:cannot record on_fail skill result for task in ${task.status}`)
    if (input.success) {
      const queued = this.transitionTask(task, 'queued', 'on-fail-execute-skill-success', {
        startedAt: null,
        endedAt: null,
        retryBackoffMs: 0,
        nextRetryAt: this.now(),
        exitCode: null,
        error: 'on_fail skill executed; task queued for retry',
        errorCode: 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED',
        errorMessage: input.errorMessage,
        artifactsPath: input.artifactPath
      })
      tasks[index] = queued
      this.persistTasks(tasks)
      return queued
    }
    const updated = this.transitionTask(task, 'awaiting-human', 'on-fail-execute-skill-failed', {
      endedAt: this.now(),
      exitCode: input.exitCode,
      error: input.errorMessage,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      artifactsPath: input.artifactPath
    })
    tasks[index] = updated
    this.persistTasks(tasks)
    return updated
  }

  retry(input: { runId?: string; taskIds?: string[]; sessionId?: string; confirmedBy?: string }): TaskRun[] {
    this.assertConfirmed(input.confirmedBy)
    const ids = this.targetIds(input)
    const tasks = this.listTasks().map(task => this.matchesTask(task, ids, input.sessionId) ? this.retryTask(task) : task)
    this.persistTasks(tasks)
    return tasks.filter(task => this.matchesTask(task, ids, input.sessionId))
  }

  skip(input: { runId?: string; taskIds?: string[]; sessionId?: string; confirmedBy?: string }): TaskRun[] {
    this.assertConfirmed(input.confirmedBy)
    const ids = this.targetIds(input)
    const tasks = this.listTasks().map(task => this.matchesTask(task, ids, input.sessionId)
      ? this.transitionTask(task, 'skipped', 'operator-skip', { endedAt: this.now(), error: 'skipped by confirmed operator', errorCode: 'SKIPPED', errorMessage: 'skipped by confirmed operator' })
      : task)
    const promoted = this.promoteWaitingDependencies(tasks, input.sessionId)
    this.persistTasks(promoted)
    return promoted.filter(task => this.matchesTask(task, ids, input.sessionId))
  }

  markAwaitingHuman(input: { runId?: string; taskIds?: string[]; sessionId?: string; reason: string; confirmedBy?: string }): TaskRun[] {
    this.assertConfirmed(input.confirmedBy)
    const ids = this.targetIds(input)
    const tasks = this.listTasks().map(task => this.matchesTask(task, ids, input.sessionId) && task.status === 'running'
      ? this.transitionTask(task, 'awaiting-human', input.reason, { error: input.reason, errorCode: 'E_WATCHDOG_HUMAN_REQUIRED', errorMessage: input.reason })
      : task)
    this.persistTasks(tasks)
    return tasks.filter(task => this.matchesTask(task, ids, input.sessionId))
  }

  pauseSession(input: { sessionId: string; confirmedBy?: string }): void {
    this.assertConfirmed(input.confirmedBy)
    const tasks = this.listTasks().map(task => task.sessionId === input.sessionId && task.status === 'queued' ? this.transitionTask(task, 'paused', 'operator-pause') : task)
    this.persistTasks(tasks)
  }

  resumeSession(input: { sessionId: string; confirmedBy?: string }): void {
    this.assertConfirmed(input.confirmedBy)
    const tasks = this.listTasks().map(task => task.sessionId === input.sessionId && task.status === 'paused' ? this.transitionTask(task, 'queued', 'operator-resume') : task)
    this.persistTasks(tasks)
  }

  abortSession(input: { sessionId: string; confirmedBy?: string }): void {
    this.assertConfirmed(input.confirmedBy)
    const tasks = this.listTasks().map(task => task.sessionId === input.sessionId && ['queued', 'paused', 'waiting-dependency', 'retrying'].includes(task.status)
      ? this.transitionTask(task, 'cancelled', 'operator-abort', { endedAt: this.now(), error: 'cancelled by confirmed operator', errorCode: 'CANCELLED', errorMessage: 'cancelled by confirmed operator' })
      : task)
    this.persistTasks(tasks)
  }

  listTransitions(input: { sessionId?: string } = {}): TaskStateTransition[] {
    const transitions = this.parseTransitions(this.store.get('taskStateTransitions', []))
    return input.sessionId ? transitions.filter(item => item.sessionId === input.sessionId) : transitions
  }

  private promoteWaitingDependencies(tasks: TaskRun[], sessionId?: string): TaskRun[] {
    const evaluationBySession = new Map<string, { completed: Set<string>; failed: Set<string>; snapshot: DagSnapshot }>()
    for (const current of tasks) {
      if (!current.sessionId || (sessionId && current.sessionId !== sessionId) || evaluationBySession.has(current.sessionId)) continue
      const sessionTasks = tasks.filter(task => task.sessionId === current.sessionId)
      evaluationBySession.set(current.sessionId, {
        completed: this.completedTaskIds(sessionTasks),
        failed: this.failedTaskIds(sessionTasks),
        snapshot: this.snapshotForTasks(current.sessionId, sessionTasks)
      })
    }
    return tasks.map(task => {
      if (task.status !== 'waiting-dependency' || !task.sessionId || (sessionId && task.sessionId !== sessionId)) return task
      const evaluation = evaluationBySession.get(task.sessionId)
      if (!evaluation) return task
      const ready = this.dagOrchestrator.isReady(evaluation.snapshot, this.taskIdOf(task), evaluation.completed, evaluation.failed)
      return ready.ready ? this.transitionTask(task, 'queued', 'dag-orchestrator-ready') : task
    })
  }

  private transitionTask(task: TaskRun, next: TaskRun['status'], reason: string, patch: Partial<TaskRun> = {}): TaskRun {
    if (task.status !== next) {
      this.assertAllowedTransition(task.status, next, reason)
      this.appendTransition({
      transitionId: `transition-${randomUUID()}`,
      runId: task.runId,
      taskId: this.taskIdOf(task),
      sessionId: task.sessionId ?? null,
      prev: task.status,
      next,
      at: this.now(),
      reason
      })
    }
    return taskRunSchema.parse({ ...task, ...patch, status: next })
  }

  private promoteReadyRetries(tasks: TaskRun[], sessionId?: string): TaskRun[] {
    const at = this.now()
    return tasks.map(task => {
      if (task.status !== 'retrying' || !task.sessionId || (sessionId && task.sessionId !== sessionId)) return task
      if ((task.nextRetryAt ?? at) > at) return task
      return this.transitionTask(task, 'queued', 'retry-backoff-elapsed', {
        startedAt: null,
        endedAt: null,
        retryBackoffMs: null,
        nextRetryAt: null,
        exitCode: null,
        error: null,
        errorCode: null,
        errorMessage: null
      })
    })
  }

  private cancelPendingSessionTasks(tasks: TaskRun[], completed: TaskRun): TaskRun[] {
    return tasks.map(task => {
      if (task.runId === completed.runId || task.sessionId !== completed.sessionId) return task
      if (!['queued', 'paused', 'waiting-dependency', 'retrying'].includes(task.status)) return task
      return this.transitionTask(task, 'cancelled', 'on-fail-abort-session', {
        endedAt: this.now(),
        error: `cancelled because ${this.taskIdOf(completed)} failed with on_fail=abort`,
        errorCode: 'ON_FAIL_ABORT',
        errorMessage: `cancelled because ${this.taskIdOf(completed)} failed with on_fail=abort`
      })
    })
  }

  private retryTask(task: TaskRun): TaskRun {
    if (task.status === 'failed') {
      const retrying = this.transitionTask(task, 'retrying', 'operator-retry', {
        attempts: task.attempts + 1,
        attemptCount: task.attemptCount + 1
      })
      return this.transitionTask(retrying, 'queued', 'operator-retry-ready', {
        startedAt: null,
        endedAt: null,
        retryBackoffMs: null,
        nextRetryAt: null,
        error: null,
        errorCode: null,
        errorMessage: null
      })
    }
    if (task.status === 'retrying') {
      return this.transitionTask(task, 'queued', 'operator-retry-ready', {
        startedAt: null,
        endedAt: null,
        retryBackoffMs: null,
        nextRetryAt: null,
        error: null,
        errorCode: null,
        errorMessage: null
      })
    }
    throw new Error(`E_STATE_TRANSITION:cannot retry task in ${task.status}`)
  }

  private assertAllowedTransition(prev: TaskRun['status'], next: TaskRun['status'], reason: string): void {
    const allowedTransitions: Record<TaskRun['status'], ReadonlySet<TaskRun['status']>> = {
      pending: new Set(['queued', 'skipped', 'cancelled']),
      queued: new Set(['running', 'paused', 'skipped', 'cancelled']),
      running: new Set(['succeeded', 'failed', 'skipped', 'retrying', 'cancelled', 'awaiting-human']),
      succeeded: new Set([]),
      failed: new Set(['retrying', 'skipped', 'cancelled']),
      skipped: new Set([]),
      paused: new Set(['queued', 'skipped', 'cancelled']),
      'waiting-dependency': new Set(['queued', 'skipped', 'cancelled']),
      cancelled: new Set([]),
      'awaiting-human': new Set(['queued', 'failed', 'skipped', 'cancelled']),
      retrying: new Set(['queued', 'failed', 'skipped', 'cancelled']),
    }
    if (!allowedTransitions[prev].has(next)) {
      throw new Error(`E_STATE_TRANSITION:${prev} -> ${next} blocked for ${reason}`)
    }
  }

  private calculateRetryBackoffMs(task: TaskRun, attemptCount: number): number {
    const exponent = Math.max(attemptCount - 1, 0)
    const baseDelay = Math.min(RETRY_BACKOFF_BASE_MS * RETRY_BACKOFF_FACTOR ** exponent, RETRY_BACKOFF_MAX_MS)
    const jitterMultiplier = 1 + this.retryJitterRatio(`${task.runId}:${attemptCount}`)
    return Math.min(RETRY_BACKOFF_MAX_MS, Math.max(0, Math.round(baseDelay * jitterMultiplier)))
  }

  private retryJitterRatio(seed: string): number {
    const digest = createHash('sha256').update(seed).digest('hex').slice(0, 8)
    const bucket = Number.parseInt(digest, 16) / 0xffffffff
    return (bucket * 2 - 1) * RETRY_BACKOFF_JITTER_RATIO
  }

  private appendTransition(transition: TaskStateTransition): void {
    const transitions = this.parseTransitions(this.store.get('taskStateTransitions', []))
    this.store.set('taskStateTransitions', [transition, ...transitions].slice(0, 5000))
  }

  private persistTasks(tasks: TaskRun[]): void {
    this.store.set('tasks', tasks.slice(0, 5000))
  }

  private parseTasks(value: unknown): TaskRun[] {
    return Array.isArray(value) ? value.map(item => taskRunSchema.parse(item)) : []
  }

  private parseTransitions(value: unknown): TaskStateTransition[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is TaskStateTransition => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Partial<TaskStateTransition>
      return typeof candidate.transitionId === 'string' && typeof candidate.runId === 'string' && typeof candidate.taskId === 'string'
    })
  }

  private validateConcurrent(value: number, label: string): number {
    if (!Number.isInteger(value) || value < 1 || value > 16) throw new Error(`E_VALIDATION:${label} must be between 1 and 16`)
    return value
  }

  private validateParallelGroupOverrides(value: Record<string, number>): Record<string, number> {
    for (const [group, limit] of Object.entries(value)) this.validateConcurrent(limit, `parallelGroupOverrides.${group}`)
    return value
  }

  private assertUniqueTaskIds(rows: RuntimeCsvTaskRow[]): void {
    const seen = new Set<string>()
    for (const row of rows) {
      if (seen.has(row.id)) throw new Error(`E_VALIDATION:duplicate taskId ${row.id}`)
      seen.add(row.id)
    }
  }

  private assertKnownForceRerun(forceRerun: ReadonlySet<string>, rows: RuntimeCsvTaskRow[]): void {
    const ids = new Set(rows.map(row => row.id))
    for (const taskId of forceRerun) {
      if (!ids.has(taskId)) throw new Error(`E_VALIDATION:forceRerun contains unknown taskId ${taskId}`)
    }
  }

  private sortRowsByTopologicalOrder(rows: RuntimeCsvTaskRow[]): RuntimeCsvTaskRow[] {
    const snapshot = this.dagOrchestrator.build({ rows })
    const orderedIds = snapshot.layers.flat()
    const rowById = new Map(rows.map(row => [row.id, row]))
    const orderedRows: RuntimeCsvTaskRow[] = []
    for (const taskId of orderedIds) {
      const row = rowById.get(taskId)
      if (row) orderedRows.push(row)
    }
    return orderedRows
  }

  private assertConfirmed(confirmedBy?: string): void {
    if (!confirmedBy || confirmedBy.length < 3) throw new Error('E_PERMISSION:confirmedBy required')
  }

  private targetIds(input: { runId?: string; taskIds?: string[] }): Set<string> {
    return new Set(input.taskIds ?? (input.runId ? [input.runId] : []))
  }

  private matchesTask(task: TaskRun, ids: ReadonlySet<string>, sessionId?: string): boolean {
    if (sessionId && task.sessionId !== sessionId) return false
    return ids.has(task.runId) || ids.has(this.taskIdOf(task))
  }

  private taskIdOf(task: TaskRun): string {
    return task.taskId ?? task.row.id
  }

  private snapshotForTasks(sessionId: string, tasks: readonly TaskRun[]): DagSnapshot {
    const latestByTaskId = new Map<string, TaskRun>()
    for (const task of tasks) {
      const taskId = this.taskIdOf(task)
      const existing = latestByTaskId.get(taskId)
      if (!existing || task.queuedAt >= existing.queuedAt) latestByTaskId.set(taskId, task)
    }
    return this.dagOrchestrator.build({ sessionId, rows: [...latestByTaskId.values()].map(task => task.row) })
  }

  private completedTaskIds(tasks: readonly TaskRun[]): Set<string> {
    return new Set(tasks.filter(task => task.status === 'succeeded' || task.status === 'skipped').map(task => this.taskIdOf(task)))
  }

  private failedTaskIds(tasks: readonly TaskRun[]): Set<string> {
    return new Set(tasks.filter(task => task.status === 'failed' || task.status === 'cancelled').map(task => this.taskIdOf(task)))
  }
}
