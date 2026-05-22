import type { InjectResult, TaskRun } from '@shared/schemas/r8-runtime'
import type { NotifyEmitResponse } from '@shared/schemas/notification'
import type { WatchdogEvent, WatchdogInstance } from './WatchdogEngine'

type WatchdogExecutableAction = 'restart' | 'fallback-tool' | 'escalate-model' | 'human-intervention' | 'log-only'
type WatchdogActionStepKind = 'task-queue' | 'inject' | 'notify'
type WatchdogActionStepStatus = 'success' | 'skipped' | 'failed'

export interface WatchdogActionStep {
  kind: WatchdogActionStepKind
  status: WatchdogActionStepStatus
  message: string
  targetId?: string
}

export interface WatchdogActionExecutionResult {
  eventId: string
  instanceId: string
  action: WatchdogExecutableAction
  status: 'completed' | 'partial' | 'skipped' | 'failed'
  taskRunId: string | null
  taskStatus: TaskRun['status'] | null
  injectActionId: string | null
  notificationId: string | null
  steps: WatchdogActionStep[]
  errors: string[]
  executedAt: number
}

export interface WatchdogActionExecutorAdapters {
  listTasks: () => TaskRun[]
  completeTaskRun: (input: { runId: string; exitCode: number; errorCode: string; errorMessage: string }) => TaskRun
  markTaskAwaitingHuman: (input: { runId: string; reason: string; confirmedBy: string }) => TaskRun | null
  executeInject: (input: unknown) => Promise<InjectResult>
  emitNotification: (input: unknown) => Promise<NotifyEmitResponse>
  now?: () => number
}

export class WatchdogActionExecutor {
  private readonly now: () => number

  constructor(private readonly adapters: WatchdogActionExecutorAdapters) {
    this.now = adapters.now ?? (() => Date.now())
  }

  async execute(event: WatchdogEvent, instances: readonly WatchdogInstance[]): Promise<WatchdogActionExecutionResult> {
    const action = this.parseAction(event)
    const instance = event.instanceId ? instances.find(item => item.instanceId === event.instanceId) ?? null : null
    const steps: WatchdogActionStep[] = []
    const errors: string[] = []
    let taskRunId: string | null = null
    let taskStatus: TaskRun['status'] | null = null
    let injectActionId: string | null = null
    let notificationId: string | null = null

    if (!action || !event.instanceId || !instance) {
      return this.result({
        event,
        action: action ?? 'log-only',
        status: 'skipped',
        taskRunId,
        taskStatus,
        injectActionId,
        notificationId,
        steps: [{ kind: 'task-queue', status: 'skipped', message: 'watchdog action event has no resolved instance' }],
        errors
      })
    }

    const task = this.findTaskForInstance(instance)
    if (task) {
      const taskStep = this.applyTaskAction(action, task, event)
      taskRunId = taskStep.task?.runId ?? task.runId
      taskStatus = taskStep.task?.status ?? task.status
      steps.push(taskStep.step)
      if (taskStep.error) errors.push(taskStep.error)
    } else {
      steps.push({ kind: 'task-queue', status: 'skipped', message: 'no unambiguous task queue run matched watchdog instance' })
    }

    const shouldInject = action === 'restart' && task?.row.allow_inject === true
    if (shouldInject) {
      const injectStep = await this.executeRestartResumeInject(instance, task)
      injectActionId = injectStep.result?.actionId ?? null
      steps.push(injectStep.step)
      if (injectStep.error) errors.push(injectStep.error)
    }

    const notifyStep = await this.emitActionNotification(action, instance, event)
    notificationId = notifyStep.result?.id ?? null
    steps.push(notifyStep.step)
    if (notifyStep.error) errors.push(notifyStep.error)

    return this.result({
      event,
      action,
      status: this.statusFromSteps(steps),
      taskRunId,
      taskStatus,
      injectActionId,
      notificationId,
      steps,
      errors
    })
  }

  private parseAction(event: WatchdogEvent): WatchdogExecutableAction | null {
    const value = event.data.action
    if (value === 'restart' || value === 'fallback-tool' || value === 'escalate-model' || value === 'human-intervention' || value === 'log-only') return value
    return null
  }

  private findTaskForInstance(instance: WatchdogInstance): TaskRun | null {
    const keys = new Set([instance.instanceId, instance.alias].filter((value): value is string => typeof value === 'string' && value.length > 0))
    const tasks = this.adapters.listTasks()
    const exactCandidates = tasks
      .filter(task => keys.has(task.runId) || keys.has(task.taskId ?? task.row.id) || keys.has(task.row.id))
      .sort((left, right) => right.queuedAt - left.queuedAt)
    const exactRunning = exactCandidates.find(task => task.status === 'running')
    if (exactRunning) return exactRunning
    const exact = exactCandidates[0]
    if (exact) return exact

    const runningForTool = tasks.filter(task => task.status === 'running' && task.row.tool === instance.tool)
    return runningForTool.length === 1 ? runningForTool[0] : null
  }

  private applyTaskAction(action: WatchdogExecutableAction, task: TaskRun, event: WatchdogEvent): { step: WatchdogActionStep; task: TaskRun | null; error: string | null } {
    if (action === 'log-only') {
      return { step: { kind: 'task-queue', status: 'skipped', targetId: task.runId, message: 'log-only policy leaves task queue unchanged' }, task, error: null }
    }

    if (task.status !== 'running') {
      return { step: { kind: 'task-queue', status: 'skipped', targetId: task.runId, message: `matched task is ${task.status}; watchdog does not force invalid queue transitions` }, task, error: null }
    }

    try {
      if (action === 'human-intervention' || action === 'fallback-tool' || action === 'escalate-model') {
        const next = this.adapters.markTaskAwaitingHuman({
          runId: task.runId,
          reason: this.taskReason(action, event),
          confirmedBy: 'watchdog-action-executor'
        })
        return {
          step: { kind: 'task-queue', status: next ? 'success' : 'skipped', targetId: task.runId, message: next ? `task moved to ${next.status}` : 'task queue did not return an updated run' },
          task: next,
          error: null
        }
      }

      const next = this.adapters.completeTaskRun({
        runId: task.runId,
        exitCode: 124,
        errorCode: 'E_WATCHDOG_RESTART',
        errorMessage: this.taskReason(action, event)
      })
      return {
        step: { kind: 'task-queue', status: 'success', targetId: task.runId, message: `task moved to ${next.status}` },
        task: next,
        error: null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: { kind: 'task-queue', status: 'failed', targetId: task.runId, message }, task, error: message }
    }
  }

  private async executeRestartResumeInject(instance: WatchdogInstance, task: TaskRun): Promise<{ step: WatchdogActionStep; result: InjectResult | null; error: string | null }> {
    try {
      const result = await this.adapters.executeInject({
        scenario: 'watchdog-restart-resume',
        targetAlias: instance.alias ?? instance.instanceId,
        target: { selector: 'alias', aliasOrId: instance.alias ?? instance.instanceId },
        text: 'continue',
        mode: 'sendinput',
        modeFallback: ['clipboard-paste', 'uia'],
        confirmedBy: 'watchdog-action-executor',
        taskId: task.taskId ?? task.row.id
      })
      return {
        step: { kind: 'inject', status: result.success ? 'success' : 'failed', targetId: result.actionId, message: result.success ? 'restart-resume inject executed' : result.error ?? 'inject failed' },
        result,
        error: result.success ? null : result.error ?? 'E_RUNTIME:inject failed'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: { kind: 'inject', status: 'failed', message }, result: null, error: message }
    }
  }

  private async emitActionNotification(action: WatchdogExecutableAction, instance: WatchdogInstance, event: WatchdogEvent): Promise<{ step: WatchdogActionStep; result: NotifyEmitResponse | null; error: string | null }> {
    try {
      const result = await this.adapters.emitNotification({
        level: this.notificationLevel(action, event),
        source: 'watchdog',
        instanceId: instance.instanceId,
        title: this.notificationTitle(action),
        body: this.notificationBody(action, instance, event),
        actions: action === 'human-intervention' ? [{ label: 'Open Watchdog', actionId: 'watchdog.open' }] : []
      })
      return { step: { kind: 'notify', status: 'success', targetId: result.id, message: 'watchdog notification emitted' }, result, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { step: { kind: 'notify', status: 'failed', message }, result: null, error: message }
    }
  }

  private notificationLevel(action: WatchdogExecutableAction, event: WatchdogEvent): 'INFO' | 'WARN' | 'ERROR' | 'FATAL' {
    if (event.data.reason === 'restart-storm') return 'FATAL'
    if (action === 'restart') return 'WARN'
    if (action === 'log-only') return 'INFO'
    return 'ERROR'
  }

  private notificationTitle(action: WatchdogExecutableAction): string {
    if (action === 'restart') return 'Watchdog restart requested'
    if (action === 'fallback-tool') return 'Watchdog fallback requested'
    if (action === 'escalate-model') return 'Watchdog model escalation requested'
    if (action === 'human-intervention') return 'Watchdog needs human intervention'
    return 'Watchdog event logged'
  }

  private notificationBody(action: WatchdogExecutableAction, instance: WatchdogInstance, event: WatchdogEvent): string {
    return `Instance ${instance.instanceId} (${instance.tool}, pid ${instance.pid}) triggered ${action}: ${String(event.data.reason ?? 'watchdog action')}`
  }

  private taskReason(action: WatchdogExecutableAction, event: WatchdogEvent): string {
    return `watchdog-${action}:${String(event.data.reason ?? 'watchdog-stuck')}`
  }

  private statusFromSteps(steps: readonly WatchdogActionStep[]): WatchdogActionExecutionResult['status'] {
    if (steps.length === 0 || steps.every(step => step.status === 'skipped')) return 'skipped'
    if (steps.every(step => step.status === 'success' || step.status === 'skipped')) return 'completed'
    if (steps.some(step => step.status === 'success')) return 'partial'
    return 'failed'
  }

  private result(input: {
    event: WatchdogEvent
    action: WatchdogExecutableAction
    status: WatchdogActionExecutionResult['status']
    taskRunId: string | null
    taskStatus: TaskRun['status'] | null
    injectActionId: string | null
    notificationId: string | null
    steps: WatchdogActionStep[]
    errors: string[]
  }): WatchdogActionExecutionResult {
    return {
      eventId: input.event.eventId,
      instanceId: input.event.instanceId ?? '',
      action: input.action,
      status: input.status,
      taskRunId: input.taskRunId,
      taskStatus: input.taskStatus,
      injectActionId: input.injectActionId,
      notificationId: input.notificationId,
      steps: input.steps,
      errors: input.errors,
      executedAt: this.now()
    }
  }
}
