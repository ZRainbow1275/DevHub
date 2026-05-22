import type { ProcessInfo } from '@shared/types-extended'
import type { ProcessViewMode } from '@shared/schemas/r8-runtime'
import { AlertIcon, CloseIcon, EyeIcon, InfoIcon, ListIcon, TreeIcon } from '../../icons'

interface ProcessModuleHelpProps {
  isOpen: boolean
  processCount: number
  targetProcess: ProcessInfo | null
  currentViewMode: ProcessViewMode
  onClose: () => void
}

function targetProcessText(targetProcess: ProcessInfo | null): string {
  if (!targetProcess) return '当前没有真实进程目标'
  return `PID ${targetProcess.pid} / ${targetProcess.name}`
}

export function ProcessModuleHelp({
  isOpen,
  processCount,
  targetProcess,
  currentViewMode,
  onClose,
}: ProcessModuleHelpProps) {
  if (!isOpen) return null

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="process-module-help-title"
      data-testid="process-module-help-dialog"
      data-help-scope="process"
      data-help-shortcut="F1"
      data-real-process-count={processCount}
      data-current-view={currentViewMode}
      className="mx-5 mt-3 border-l-4 border-info bg-info/10 px-4 py-3 text-sm text-text-primary radius-sm"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center bg-surface-900 text-info radius-sm">
            <InfoIcon size={16} />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-info">
                F1 上下文帮助
              </span>
              <span className="text-[10px] text-text-muted font-mono">
                {targetProcessText(targetProcess)}
              </span>
            </div>
            <div>
              <h3 id="process-module-help-title" className="font-bold text-text-primary">
                进程模块帮助
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                这里说明当前进程模块的真实入口、真实数据来源和安全操作边界；内容内嵌在应用内，不依赖外网帮助页。
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-info/60 radius-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <ListIcon size={12} />
                  视图与数据
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
                  当前视图为 {currentViewMode}；列表、卡片、Tree、Treemap 和分组视图都读取 SystemProcessScanner 返回的真实进程集合。
                </p>
              </div>
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-accent/60 radius-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <TreeIcon size={12} />
                  关系图入口
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
                  卡片右上角、详情顶部按钮和关系 Tab 都会使用当前 PID 打开拓扑视图，不会创建示例进程。
                </p>
              </div>
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-warning/60 radius-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <AlertIcon size={12} />
                  操作安全
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
                  右键菜单提供复制 PID、打开目录、进程树和终止进程；终止进程仍走二次确认，避免误操作。
                </p>
              </div>
              <div className="bg-surface-900 px-3 py-2 border-l-2 border-surface-600 radius-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <EyeIcon size={12} />
                  当前上下文
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
                  已扫描真实进程 {processCount} 个；没有真实进程时帮助仍可打开，但所有操作等待扫描结果，不生成样例数据。
                </p>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          data-testid="process-module-help-close"
          aria-label="关闭进程模块帮助"
          onClick={onClose}
          className="btn-icon-sm text-text-muted hover:text-text-primary"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </section>
  )
}
