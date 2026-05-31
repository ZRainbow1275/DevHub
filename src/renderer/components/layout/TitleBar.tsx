import type { ThemeDecorationConfig } from '@shared/types'
import { GearIcon, MinimizeIcon, MaximizeIcon, CloseIcon } from '../icons'
import { ThemeDecoration } from '../ui/ThemeDecoration'
import { NotificationCenter } from '../notify/NotificationCenter'

interface TitleBarProps {
  decorationConfig?: ThemeDecorationConfig
}

export function TitleBar({ decorationConfig }: TitleBarProps) {
  const handleMinimize = () => {
    const devhub = window.devhub
    if (devhub?.window?.minimize) {
      devhub.window.minimize()
    }
  }
  const handleMaximize = () => {
    const devhub = window.devhub
    if (devhub?.window?.maximize) {
      devhub.window.maximize()
    }
  }
  const handleClose = () => {
    const devhub = window.devhub
    if (devhub?.window?.close) {
      devhub.window.close()
    }
  }

  return (
    <header className="h-[clamp(2.25rem,2.75rem,3rem)] bg-surface-950 flex items-center justify-between drag-region relative">
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />

      {/* Diagonal stripe decoration */}
      <div className="absolute inset-0 deco-diagonal pointer-events-none" />
      <ThemeDecoration config={decorationConfig} position="header" />

      {/* Logo and Title */}
      <div className="flex items-center gap-3 pl-4 no-drag relative z-10 flex-shrink-0 min-w-0">
        {/* Industrial Gear Logo */}
        <div className="text-accent flex-shrink-0">
          <GearIcon size={18} className="animate-gear-spin" style={{ animationDuration: '8s' }} />
        </div>

        {/* Tilted Title - Constructivist Style */}
        <div className="flex items-baseline gap-2 overflow-visible">
          <span
            className="text-accent font-bold tracking-wider uppercase whitespace-nowrap"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(0.875rem, 1.1vw + 0.5rem, 1.125rem)',
              transform: 'rotate(-8deg)',
              transformOrigin: 'left center'
            }}
          >
            DEVHUB
          </span>
          <span className="text-text-muted text-xs font-mono whitespace-nowrap">
            v1.0
          </span>
        </div>
      </div>

      {/* Decorative Center Element */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden min-[820px]:flex items-center gap-1 pointer-events-none">
        <div className="w-8 h-[2px] bg-surface-600 transform -rotate-12" />
        <div className="w-2 h-2 border border-surface-600 transform rotate-45" />
        <div className="w-8 h-[2px] bg-surface-600 transform rotate-12" />
      </div>

      {/* Window Controls */}
      <div className="flex items-center no-drag relative z-10 flex-shrink-0">
        <NotificationCenter />
        <div className="mx-0.5 h-4 w-px bg-surface-700" aria-hidden="true" />
        <button
          onClick={handleMinimize}
          className="w-[2.25rem] h-[2.25rem] flex-shrink-0 flex items-center justify-center text-text-tertiary hover:bg-surface-800 hover:text-text-primary transition-colors"
          title="最小化窗口"
          aria-label="最小化窗口"
        >
          <MinimizeIcon size={13} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-[2.25rem] h-[2.25rem] flex-shrink-0 flex items-center justify-center text-text-tertiary hover:bg-surface-800 hover:text-text-primary transition-colors"
          title="最大化/还原"
          aria-label="最大化或还原窗口"
        >
          <MaximizeIcon size={13} />
        </button>
        <button
          onClick={handleClose}
          className="w-[2.25rem] h-[2.25rem] flex-shrink-0 flex items-center justify-center text-text-tertiary hover:bg-accent hover:text-white transition-colors"
          title="关闭"
          aria-label="关闭窗口"
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </header>
  )
}
