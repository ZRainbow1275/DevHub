import type { ProcessInfo } from '@shared/types-extended'
import { AlertIcon, CloseIcon, EyeIcon, GridIcon, ListIcon, TreeIcon } from '../../icons'

export const PROCESS_MODULE_TOUR_STORAGE_KEY = 'devhub:process-module-tour:v1'

type ProcessModuleTourStepId = 'view-switch' | 'relationship' | 'operation-menu'
type ProcessModuleTourAction = 'switch-view' | 'relationship' | 'operation-menu'

interface ProcessModuleTourStep {
  id: ProcessModuleTourStepId
  title: string
  description: string
  action: ProcessModuleTourAction
  actionLabel: string
}

interface ProcessModuleTourProps {
  isOpen: boolean
  stepIndex: number
  processCount: number
  targetProcess: ProcessInfo | null
  currentViewMode: string
  onStepChange: (stepIndex: number) => void
  onDismiss: () => void
  onSwitchCardList: () => void
  onOpenRelationship: () => void
  onOpenOperationMenu: () => void
}

const PROCESS_MODULE_TOUR_STEPS: readonly ProcessModuleTourStep[] = [
  {
    id: 'view-switch',
    title: 'Card / List 切换',
    description: '进程模块保留列表、卡片、树、Treemap 与分组视图；Tour 先用真实进程验证卡片与列表切换。',
    action: 'switch-view',
    actionLabel: '切换卡片 / 列表',
  },
  {
    id: 'relationship',
    title: '关系图入口',
    description: '卡片角标、详情顶部按钮和详情关系 Tab 都绑定当前真实 PID 的拓扑与流图。',
    action: 'relationship',
    actionLabel: '打开当前进程关系图',
  },
  {
    id: 'operation-menu',
    title: '操作菜单',
    description: '真实进程卡片右键菜单提供查看详情、打开目录、复制 PID、复制命令、进程树与终止进程。',
    action: 'operation-menu',
    actionLabel: '打开当前进程操作菜单',
  },
] as const

const LAST_PROCESS_TOUR_STEP_INDEX = PROCESS_MODULE_TOUR_STEPS.length - 1

function normalizeStepIndex(stepIndex: number): number {
  if (!Number.isFinite(stepIndex)) return 0
  if (stepIndex < 0) return 0
  if (stepIndex > LAST_PROCESS_TOUR_STEP_INDEX) return LAST_PROCESS_TOUR_STEP_INDEX
  return Math.trunc(stepIndex)
}

function renderStepIcon(stepId: ProcessModuleTourStepId) {
  if (stepId === 'view-switch') return <ListIcon size={16} />
  if (stepId === 'relationship') return <TreeIcon size={16} />
  return <EyeIcon size={16} />
}

function targetProcessText(targetProcess: ProcessInfo | null): string {
  if (!targetProcess) return '当前还没有扫描到真实进程'
  return `PID ${targetProcess.pid} / ${targetProcess.name}`
}

export function ProcessModuleTour({
  isOpen,
  stepIndex,
  processCount,
  targetProcess,
  currentViewMode,
  onStepChange,
  onDismiss,
  onSwitchCardList,
  onOpenRelationship,
  onOpenOperationMenu,
}: ProcessModuleTourProps) {
  if (!isOpen) return null

  const normalizedStepIndex = normalizeStepIndex(stepIndex)
  const step = PROCESS_MODULE_TOUR_STEPS[normalizedStepIndex]
  const isLastStep = normalizedStepIndex === LAST_PROCESS_TOUR_STEP_INDEX
  const actionDisabled = processCount === 0

  const handleAction = () => {
    if (actionDisabled) return
    if (step.action === 'relationship') {
      onOpenRelationship()
      return
    }
    if (step.action === 'operation-menu') {
      onOpenOperationMenu()
      return
    }
    onSwitchCardList()
  }

  return (
    <section
      data-testid="process-module-tour"
      data-tour-step-id={step.id}
      data-tour-step-index={normalizedStepIndex}
      data-tour-total-steps={PROCESS_MODULE_TOUR_STEPS.length}
      data-tour-real-process-count={processCount}
      data-tour-current-view={currentViewMode}
      aria-label="进程模块导览"
      aria-live="polite"
      className="mx-5 mt-3 border-l-4 border-accent bg-accent/10 px-4 py-3 text-sm text-text-primary radius-sm"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDismiss()
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center bg-surface-900 text-accent radius-sm">
            {renderStepIcon(step.id)}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                进程导览 {normalizedStepIndex + 1}/{PROCESS_MODULE_TOUR_STEPS.length}
              </span>
              <span className="text-[10px] text-text-muted font-mono">
                {targetProcessText(targetProcess)}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-text-primary">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-secondary">
              <span className="bg-surface-900 px-2 py-1 border-l-2 border-surface-600 radius-sm">
                真实进程 {processCount}
              </span>
              <span className="bg-surface-900 px-2 py-1 border-l-2 border-surface-600 radius-sm">
                当前视图 {currentViewMode}
              </span>
            </div>
            {actionDisabled && (
              <div
                data-testid="process-module-tour-no-process"
                className="flex items-center gap-1.5 text-[10px] text-warning"
              >
                <AlertIcon size={10} />
                <span>等待扫描到真实进程后启用动作，不创建示例进程。</span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          data-testid="process-module-tour-close"
          aria-label="关闭进程模块导览"
          onClick={onDismiss}
          className="btn-icon-sm text-text-muted hover:text-text-primary"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-testid={`process-module-tour-action-${step.id}`}
          disabled={actionDisabled}
          onClick={handleAction}
          className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step.action === 'switch-view' ? <GridIcon size={12} /> : renderStepIcon(step.id)}
          <span className="ml-1.5">{step.actionLabel}</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="process-module-tour-prev"
            disabled={normalizedStepIndex === 0}
            onClick={() => onStepChange(normalizedStepIndex - 1)}
            className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一步
          </button>
          <button
            type="button"
            data-testid="process-module-tour-next"
            disabled={isLastStep}
            onClick={() => onStepChange(normalizedStepIndex + 1)}
            className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步
          </button>
          <button
            type="button"
            data-testid="process-module-tour-done"
            onClick={onDismiss}
            className="btn-primary px-3 py-1.5 text-xs"
          >
            {isLastStep ? '完成导览' : '跳过导览'}
          </button>
        </div>
      </div>
    </section>
  )
}
