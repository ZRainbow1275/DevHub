import type { PortInfo } from '@shared/types-extended'
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon, NetworkIcon, WindowIcon } from '../../icons'

export const PORT_MODULE_TOUR_STORAGE_KEY = 'devhub:port-module-tour:v1'

type PortModuleTourStepId = 'popout' | 'security' | 'relationship'
type PortModuleTourAction = 'popout' | 'security' | 'relationship'

interface PortModuleTourStep {
  id: PortModuleTourStepId
  title: string
  description: string
  action: PortModuleTourAction
  actionLabel: string
}

export interface PortModuleTourSecuritySummary {
  total: number
  local: number
  lan: number
  wanCapable: number
  suspicious: number
}

interface PortModuleTourProps {
  isOpen: boolean
  stepIndex: number
  portCount: number
  targetPort: PortInfo | null
  securitySummary: PortModuleTourSecuritySummary
  onStepChange: (stepIndex: number) => void
  onDismiss: () => void
  onOpenPopout: () => void
  onReviewSecurity: () => void
  onOpenRelationshipGraph: () => void
}

const PORT_MODULE_TOUR_STEPS: readonly PortModuleTourStep[] = [
  {
    id: 'popout',
    title: 'Pop-out 浮窗',
    description: '端口卡片可以通过按钮、右键、拖拽或长按菜单摘出，浮窗仍绑定当前真实端口状态。',
    action: 'popout',
    actionLabel: '打开当前端口浮窗',
  },
  {
    id: 'security',
    title: '安全分级',
    description: '每个端口都按真实监听地址与阻止列表归类为本机、局域网、公网可达或可疑端口。',
    action: 'security',
    actionLabel: '查看安全分级',
  },
  {
    id: 'relationship',
    title: '关系图入口',
    description: '卡片角标、顶部关系图模式与焦点面板都能进入端口关系图，展示 owns 与 connects 关系。',
    action: 'relationship',
    actionLabel: '打开关系图',
  },
] as const

const LAST_TOUR_STEP_INDEX = PORT_MODULE_TOUR_STEPS.length - 1

function normalizeStepIndex(stepIndex: number): number {
  if (!Number.isFinite(stepIndex)) return 0
  if (stepIndex < 0) return 0
  if (stepIndex > LAST_TOUR_STEP_INDEX) return LAST_TOUR_STEP_INDEX
  return Math.trunc(stepIndex)
}

function renderStepIcon(stepId: PortModuleTourStepId) {
  if (stepId === 'popout') return <WindowIcon size={16} />
  if (stepId === 'relationship') return <NetworkIcon size={16} />
  return <InfoIcon size={16} />
}

function targetPortText(targetPort: PortInfo | null): string {
  if (!targetPort) return '当前还没有扫描到真实端口'
  const processName = targetPort.processName || 'unknown'
  return `:${targetPort.port} / PID ${targetPort.pid} / ${processName}`
}

function SecuritySummary({ summary }: { summary: PortModuleTourSecuritySummary }) {
  return (
    <div
      data-testid="port-module-tour-security-summary"
      className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary"
    >
      <span className="flex items-center justify-between bg-surface-900 px-2 py-1 border-l-2 border-success/60 radius-sm">
        <span>本机</span>
        <span className="font-mono text-success">{summary.local}</span>
      </span>
      <span className="flex items-center justify-between bg-surface-900 px-2 py-1 border-l-2 border-warning/60 radius-sm">
        <span>局域网</span>
        <span className="font-mono text-warning">{summary.lan}</span>
      </span>
      <span className="flex items-center justify-between bg-surface-900 px-2 py-1 border-l-2 border-orange-500/70 radius-sm">
        <span>公网可达</span>
        <span className="font-mono text-orange-400">{summary.wanCapable}</span>
      </span>
      <span className="flex items-center justify-between bg-surface-900 px-2 py-1 border-l-2 border-error radius-sm">
        <span>可疑</span>
        <span className="font-mono text-error">{summary.suspicious}</span>
      </span>
    </div>
  )
}

export function PortModuleTour({
  isOpen,
  stepIndex,
  portCount,
  targetPort,
  securitySummary,
  onStepChange,
  onDismiss,
  onOpenPopout,
  onReviewSecurity,
  onOpenRelationshipGraph,
}: PortModuleTourProps) {
  if (!isOpen) return null

  const normalizedStepIndex = normalizeStepIndex(stepIndex)
  const step = PORT_MODULE_TOUR_STEPS[normalizedStepIndex]
  const isLastStep = normalizedStepIndex === LAST_TOUR_STEP_INDEX
  const actionDisabled = portCount === 0

  const handleAction = () => {
    if (actionDisabled) return
    if (step.action === 'popout') {
      onOpenPopout()
      return
    }
    if (step.action === 'relationship') {
      onOpenRelationshipGraph()
      return
    }
    onReviewSecurity()
  }

  return (
    <section
      data-testid="port-module-tour"
      data-tour-step-id={step.id}
      data-tour-step-index={normalizedStepIndex}
      data-tour-total-steps={PORT_MODULE_TOUR_STEPS.length}
      data-tour-real-port-count={portCount}
      aria-label="端口模块导览"
      aria-live="polite"
      className="mx-5 mt-3 max-h-28 overflow-y-auto border-l-4 border-accent bg-accent/10 px-4 py-3 text-sm text-text-primary radius-sm"
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
                端口导览 {normalizedStepIndex + 1}/{PORT_MODULE_TOUR_STEPS.length}
              </span>
              <span className="text-[10px] text-text-muted font-mono">
                {targetPortText(targetPort)}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-text-primary">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.description}</p>
            </div>
            {step.id === 'security' && <SecuritySummary summary={securitySummary} />}
            {actionDisabled && (
              <div
                data-testid="port-module-tour-no-port"
                className="flex items-center gap-1.5 text-[10px] text-warning"
              >
                <AlertIcon size={10} />
                <span>等待扫描到真实端口后启用动作，不创建示例端口。</span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          data-testid="port-module-tour-close"
          aria-label="关闭端口模块导览"
          onClick={onDismiss}
          className="btn-icon-sm text-text-muted hover:text-text-primary"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-testid={`port-module-tour-action-${step.id}`}
          disabled={actionDisabled}
          onClick={handleAction}
          className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step.action === 'security' ? <CheckIcon size={12} /> : renderStepIcon(step.id)}
          <span className="ml-1.5">{step.actionLabel}</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="port-module-tour-prev"
            disabled={normalizedStepIndex === 0}
            onClick={() => onStepChange(normalizedStepIndex - 1)}
            className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一步
          </button>
          <button
            type="button"
            data-testid="port-module-tour-next"
            disabled={isLastStep}
            onClick={() => onStepChange(normalizedStepIndex + 1)}
            className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步
          </button>
          <button
            type="button"
            data-testid="port-module-tour-done"
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
