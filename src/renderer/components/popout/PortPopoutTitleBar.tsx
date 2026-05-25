import { CloseIcon, MinimizeIcon, PaletteIcon, PortIcon, WindowIcon } from '../icons'
import type { PortPopout, PortPopoutPosition } from './port-popout-model'
import { useT } from '../../hooks/useT'

interface PortPopoutTitleBarProps {
  popout: PortPopout
  promoteState: 'idle' | 'working' | 'done' | 'unavailable' | 'failed'
  onStartDrag: (pointer: PortPopoutPosition) => void
  onMinimize: (id: string, minimized: boolean) => void
  onThemeIsolate: (id: string, themeIsolated: boolean) => void
  onPin: (id: string, pinned: boolean) => void
  onPromote: () => void
  onClose: (id: string) => void
}

export function PortPopoutTitleBar({
  popout,
  promoteState,
  onStartDrag,
  onMinimize,
  onThemeIsolate,
  onPin,
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
        <span className="font-mono text-sm font-bold text-accent">:{popout.port.port}</span>
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {popout.trigger}
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
          data-testid={`port-popout-pin-${popout.port.port}-${popout.port.pid}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onPin(popout.id, !popout.pinned)}
          className={`btn-icon-sm ${popout.pinned ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary'}`}
          title={popout.pinned ? t('popout.unpin', 'Unpin popout') : t('popout.pin', 'Pin popout')}
          aria-label={popout.pinned ? t('popout.unpin', 'Unpin popout') : t('popout.pin', 'Pin popout')}
        >
          <WindowIcon size={13} />
        </button>
        <button
          type="button"
          data-testid={`port-popout-promote-${popout.port.port}-${popout.port.pid}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onPromote}
          className="btn-icon-sm text-text-muted hover:text-text-primary"
          title={t('popout.promote', 'Promote to BrowserWindow')}
          aria-label={t('popout.promote', 'Promote to BrowserWindow')}
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
