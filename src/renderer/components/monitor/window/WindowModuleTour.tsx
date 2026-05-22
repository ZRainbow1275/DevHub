import type { WindowInfo } from '@shared/types-extended'
import { AlertIcon, CheckIcon, CloseIcon, EyeIcon, GearIcon, WindowIcon } from '../../icons'

export const WINDOW_MODULE_TOUR_STORAGE_KEY = 'devhub:window-module-tour:v1'

type WindowModuleTourStepId = 'identity' | 'operations' | 'topmost'
type WindowModuleTourAction = 'relationship' | 'operations' | 'topmost'

interface WindowModuleTourStep {
  id: WindowModuleTourStepId
  title: string
  description: string
  action: WindowModuleTourAction
  actionLabel: string
}

interface WindowModuleTourProps {
  isOpen: boolean
  stepIndex: number
  windowCount: number
  operationCount: number
  targetWindow: WindowInfo | null
  isTargetTopmost: boolean
  onStepChange: (stepIndex: number) => void
  onDismiss: () => void
  onOpenRelationshipView: () => void
  onShowOperationMatrix: () => void
  onToggleTopmost: () => void
}

const WINDOW_MODULE_TOUR_STEPS: readonly WindowModuleTourStep[] = [
  {
    id: 'identity',
    title: '实例消歧',
    description: '多个同名 Chrome、VS Code 或终端窗口通过 HWND、PID、进程名、标题与尺寸绑定到具体实例。',
    action: 'relationship',
    actionLabel: '打开窗口关系视图',
  },
  {
    id: 'operations',
    title: '操作矩阵',
    description: '选中真实窗口后会显示 focus、minimize、maximize、close、截图、跳转进程等操作矩阵。',
    action: 'operations',
    actionLabel: '显示操作矩阵',
  },
  {
    id: 'topmost',
    title: 'Always-on-top',
    description: '置顶切换走真实 WINDOW_SET_TOPMOST 路径，结果通过窗口状态与 toast 反馈给用户。',
    action: 'topmost',
    actionLabel: '切换当前窗口置顶',
  },
] as const

const LAST_WINDOW_TOUR_STEP_INDEX = WINDOW_MODULE_TOUR_STEPS.length - 1

function normalizeStepIndex(stepIndex: number): number {
  if (!Number.isFinite(stepIndex)) return 0
  if (stepIndex < 0) return 0
  if (stepIndex > LAST_WINDOW_TOUR_STEP_INDEX) return LAST_WINDOW_TOUR_STEP_INDEX
  return Math.trunc(stepIndex)
}

function renderStepIcon(stepId: WindowModuleTourStepId) {
  if (stepId === 'identity') return <WindowIcon size={16} />
  if (stepId === 'operations') return <CheckIcon size={16} />
  return <GearIcon size={16} />
}

function targetWindowText(targetWindow: WindowInfo | null): string {
  if (!targetWindow) return '当前还没有扫描到真实窗口'
  return `HWND ${targetWindow.hwnd} / PID ${targetWindow.pid} / ${targetWindow.processName}`
}

export function WindowModuleTour({
  isOpen,
  stepIndex,
  windowCount,
  operationCount,
  targetWindow,
  isTargetTopmost,
  onStepChange,
  onDismiss,
  onOpenRelationshipView,
  onShowOperationMatrix,
  onToggleTopmost,
}: WindowModuleTourProps) {
  if (!isOpen) return null

  const normalizedStepIndex = normalizeStepIndex(stepIndex)
  const step = WINDOW_MODULE_TOUR_STEPS[normalizedStepIndex]
  const isLastStep = normalizedStepIndex === LAST_WINDOW_TOUR_STEP_INDEX
  const actionDisabled = windowCount === 0

  const handleAction = () => {
    if (actionDisabled) return
    if (step.action === 'relationship') {
      onOpenRelationshipView()
      return
    }
    if (step.action === 'topmost') {
      onToggleTopmost()
      return
    }
    onShowOperationMatrix()
  }

  return (
    <section
      data-testid="window-module-tour"
      data-tour-step-id={step.id}
      data-tour-step-index={normalizedStepIndex}
      data-tour-total-steps={WINDOW_MODULE_TOUR_STEPS.length}
      data-tour-real-window-count={windowCount}
      data-tour-operation-count={operationCount}
      data-tour-target-topmost={String(isTargetTopmost)}
      aria-label="窗口模块导览"
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
                窗口导览 {normalizedStepIndex + 1}/{WINDOW_MODULE_TOUR_STEPS.length}
              </span>
              <span className="text-[10px] text-text-muted font-mono">
                {targetWindowText(targetWindow)}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-text-primary">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-secondary">
              <span className="bg-surface-900 px-2 py-1 border-l-2 border-surface-600 radius-sm">
                真实窗口 {windowCount}
              </span>
              <span className="bg-surface-900 px-2 py-1 border-l-2 border-surface-600 radius-sm">
                操作项 {operationCount}
              </span>
              <span className={`bg-surface-900 px-2 py-1 border-l-2 radius-sm ${isTargetTopmost ? 'border-warning text-warning' : 'border-surface-600'}`}>
                置顶 {isTargetTopmost ? '开启' : '关闭'}
              </span>
            </div>
            {actionDisabled && (
              <div
                data-testid="window-module-tour-no-window"
                className="flex items-center gap-1.5 text-[10px] text-warning"
              >
                <AlertIcon size={10} />
                <span>等待扫描到真实窗口后启用动作，不创建示例窗口。</span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          data-testid="window-module-tour-close"
          aria-label="关闭窗口模块导览"
          onClick={onDismiss}
          className="btn-icon-sm text-text-muted hover:text-text-primary"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-testid={`window-module-tour-action-${step.id}`}
          disabled={actionDisabled}
          onClick={handleAction}
          className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step.action === 'relationship' ? <EyeIcon size={12} /> : renderStepIcon(step.id)}
          <span className="ml-1.5">{step.actionLabel}</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="window-module-tour-prev"
            disabled={normalizedStepIndex === 0}
            onClick={() => onStepChange(normalizedStepIndex - 1)}
            className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一步
          </button>
          <button
            type="button"
            data-testid="window-module-tour-next"
            disabled={isLastStep}
            onClick={() => onStepChange(normalizedStepIndex + 1)}
            className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步
          </button>
          <button
            type="button"
            data-testid="window-module-tour-done"
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
