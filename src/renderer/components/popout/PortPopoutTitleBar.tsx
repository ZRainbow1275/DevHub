import { CloseIcon, MinimizeIcon, PaletteIcon, PortIcon, WindowIcon } from '../icons'
import type { PortPopout, PortPopoutPosition, PortPopoutTrigger } from './port-popout-model'
import { useT } from '../../hooks/useT'

// Map the raw popout trigger slug onto a friendlier zh label so the title bar
// reads as intent ("悬停" / "右键") instead of leaking the internal enum value.
const TRIGGER_LABELS: Record<PortPopoutTrigger, string> = {
  'hover': '悬停',
  'click': '点击',
  'drag': '拖拽',
  'context-menu': '右键',
  'cmdk': '命令面板',
  'api': '接口'
}

interface PortPopoutTitleBarProps {
  popout: PortPopout
  promoteState: 'idle' | 'working' | 'done' | 'unavailable' | 'failed'
  onStartDrag: (pointer: PortPopoutPosition) => void
  onMinimize: (id: string, minimized: boolean) => void
  onThemeIsolate: (id: string, themeIsolated: boolean) => void
  onPromote: () => void
  onClose: (id: string) => void
}

export function PortPopoutTitleBar({
  popout,
  promoteState,
  onStartDrag,
  onMinimize,
  onThemeIsolate,
  onPromote,
  onClose
}: PortPopoutTitleBarProps) {
  const { t } = useT()
  return (
    <header
      data-testid={`port-popout-titlebar-${popout.port.port}-${popout.port.pid}`}
      className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-800 border-b border-surface-700 cursor-move select-none"
      onPointerDown={(event) => {
        onStartDrag({ x: event.clientX, y: event.clientY })
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <PortIcon size={15} className="text-accent flex-shrink-0" />
        <span className="font-mono text-sm font-bold text-accent flex-shrink-0">:{popout.port.port}</span>
        <span className="min-w-0 truncate text-xs text-text-secondary">
          {popout.port.processName}
          <span className="ml-1 font-mono text-text-muted">#{popout.port.pid}</span>
        </span>
        <span className="flex-shrink-0 text-[10px] uppercase tracking-wider text-text-muted">
          {TRIGGER_LABELS[popout.trigger] ?? popout.trigger}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid={`port-popout-minimize-${popout.port.port}-${popout.port.pid}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onMinimize(popout.id, !popout.minimized)}
          className={`btn-icon-sm ${popout.minimized ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary'}`}
          title={popout.minimized ? 'Restore popout' : 'Minimize popout'}
          aria-label={popout.minimized ? 'Restore popout' : 'Minimize popout'}
          aria-pressed={popout.minimized}
        >
          <MinimizeIcon size={13} />
        </button>
        <button
          type="button"
          data-testid={`port-popout-theme-isolate-${popout.port.port}-${popout.port.pid}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onThemeIsolate(popout.id, !popout.themeIsolated)}
          className={`btn-icon-sm ${popout.themeIsolated ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary'}`}
          title={popout.themeIsolated ? 'Sync theme with main view' : 'Isolate popout theme'}
          aria-label={popout.themeIsolated ? 'Sync theme with main view' : 'Isolate popout theme'}
          aria-pressed={popout.themeIsolated}
        >
          <PaletteIcon size={13} />
        </button>
        <button
          type="button"
          data-testid={`port-popout-promote-${popout.port.port}-${popout.port.pid}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onPromote}
          className="btn-icon-sm text-text-muted hover:text-text-primary"
          title={t('popout.float', '悬浮到所有应用之上')}
          aria-label={t('popout.float', '悬浮')}
          disabled={promoteState === 'working'}
        >
          <WindowIcon size={13} />
        </button>
        <button
          type="button"
          data-testid={`port-popout-close-${popout.port.port}-${popout.port.pid}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onClose(popout.id)}
          className="btn-icon-sm text-error/70 hover:text-error"
          title={t('popout.close', 'Close popout')}
          aria-label={t('popout.close', 'Close popout')}
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </header>
  )
}
