import type { TaskRun } from '@shared/schemas/r8-runtime'

export type OnFailAction = 'next' | 'abort' | 'retry' | 'fallback-tool' | 'escalate-model' | 'human' | 'execute-skill'

export interface OnFailDecisionInput {
  task: TaskRun
  completedAt: number
  nextAttemptCount: number
  exitCode: number
  errorCode: string
  errorMessage: string
}

export interface OnFailDecision {
  action: OnFailAction
  nextStatus: TaskRun['status']
  reason: string
  abortSession: boolean
  patch: Partial<TaskRun>
}

export interface OnFailHandlerOptions {
  executeSkillAvailable?: boolean
}

export class OnFailHandler {
  constructor(private readonly options: OnFailHandlerOptions = {}) {}

  decide(input: OnFailDecisionInput): OnFailDecision {
    const action = this.resolveAction(input.task)
    if (action === 'next') return this.skipAndContinue(input)
    if (action === 'abort') return this.abortBatch(input)
    if (action === 'fallback-tool') return this.fallbackTool(input)
    if (action === 'escalate-model') return this.escalateModel(input)
    if (action === 'human') return this.awaitHuman(input, 'on-fail-human', 'E_ON_FAIL_HUMAN')
    if (action === 'execute-skill') return this.executeSkillBoundary(input)
    return this.retryOrFail(input, 'on-fail-retry')
  }

  private resolveAction(task: TaskRun): OnFailAction {
    return task.row.on_fail ?? 'retry'
  }

  private retryOrFail(input: OnFailDecisionInput, reason: string): OnFailDecision {
    if (input.task.attemptCount < input.task.maxRetry) {
      return {
        action: 'retry',
        nextStatus: 'retrying',
        reason,
        abortSession: false,
        patch: {}
      }
    }
    return {
      action: 'retry',
      nextStatus: 'failed',
      reason: 'on-fail-retry-exhausted',
      abortSession: false,
      patch: {}
    }
  }

  private skipAndContinue(input: OnFailDecisionInput): OnFailDecision {
    return {
      action: 'next',
      nextStatus: 'skipped',
      reason: 'on-fail-next',
      abortSession: false,
      patch: {
        errorCode: 'ON_FAIL_NEXT',
        errorMessage: `task failed with ${input.errorCode}; on_fail=next skipped it so downstream completed-dependency tasks can continue`
      }
    }
  }

  private abortBatch(input: OnFailDecisionInput): OnFailDecision {
    return {
      action: 'abort',
      nextStatus: 'failed',
      reason: 'on-fail-abort',
      abortSession: true,
      patch: {
        errorCode: input.errorCode,
        errorMessage: input.errorMessage
      }
    }
  }

  private fallbackTool(input: OnFailDecisionInput): OnFailDecision {
    const fallbackTool = input.task.row.fallback_tool
    if (fallbackTool && fallbackTool !== input.task.row.tool) {
      return {
        action: 'fallback-tool',
        nextStatus: 'retrying',
        reason: 'on-fail-fallback-tool',
        abortSession: false,
        patch: {
          row: { ...input.task.row, tool: fallbackTool },
          retryBackoffMs: 0,
          nextRetryAt: input.completedAt,
          errorCode: 'ON_FAIL_FALLBACK_TOOL',
          errorMessage: `task failed with ${input.errorCode}; switched tool from ${input.task.row.tool} to ${fallbackTool}`
        }
      }
    }
    return this.awaitHuman(input, 'on-fail-fallback-tool-unavailable', 'E_FALLBACK_TOOL_UNAVAILABLE')
  }

  private escalateModel(input: OnFailDecisionInput): OnFailDecision {
    return {
      action: 'escalate-model',
      nextStatus: 'awaiting-human',
      reason: 'on-fail-escalate-model',
      abortSession: false,
      patch: {
        row: { ...input.task.row, needs_bigger_model: true },
        errorCode: 'ON_FAIL_ESCALATE_MODEL',
        errorMessage: `task failed with ${input.errorCode}; marked needs_bigger_model for operator model escalation`
      }
    }
  }

  private executeSkillBoundary(input: OnFailDecisionInput): OnFailDecision {
    const skill = input.task.row.execute_skill
    if (skill && this.options.executeSkillAvailable) {
      return {
        action: 'execute-skill',
        nextStatus: 'awaiting-human',
        reason: 'on-fail-execute-skill',
        abortSession: false,
        patch: {
          errorCode: 'ON_FAIL_EXECUTE_SKILL_RUNNING',
          errorMessage: `task failed with ${input.errorCode}; executing on_fail skill ${skill}`
        }
      }
    }
    return this.awaitHuman(
      input,
      skill ? 'on-fail-execute-skill-unsupported' : 'on-fail-execute-skill-missing',
      skill ? 'E_SKILL_EXECUTOR_UNAVAILABLE' : 'E_SKILL_NOT_CONFIGURED'
    )
  }

  private awaitHuman(input: OnFailDecisionInput, reason: string, errorCode: string): OnFailDecision {
    return {
      action: input.task.row.on_fail ?? 'human',
      nextStatus: 'awaiting-human',
      reason,
      abortSession: false,
      patch: {
        errorCode,
        errorMessage: `task failed with ${input.errorCode}; ${reason}`
      }
    }
  }
}
