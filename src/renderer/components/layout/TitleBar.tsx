import { GearIcon, MinimizeIcon, MaximizeIcon, CloseIcon } from '../icons'

export function TitleBar() {
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
    <header className="h-9 bg-surface-950 flex items-center justify-between drag-region relative">
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />

      {/* Diagonal stripe decoration */}
      <div className="absolute inset-0 deco-diagonal pointer-events-none" />

      {/* Logo and Title */}
      <div className="flex items-center gap-3 pl-4 no-drag relative z-10">
        {/* Industrial Gear Logo */}
        <div className="text-accent">
          <GearIcon size={18} className="animate-gear-spin" style={{ animationDuration: '8s' }} />
        </div>

        {/* Tilted Title - Constructivist Style */}
        <div className="flex items-baseline gap-2">
          <span
            className="text-accent font-bold tracking-wider uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              transform: 'rotate(-8deg)',
              transformOrigin: 'left center'
            }}
          >
            DEVHUB
          </span>
          <span className="text-text-muted text-xs font-mono">
            v1.0
          </span>
        </div>
      </div>

      {/* Decorative Center Element */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
        <div className="w-8 h-[2px] bg-surface-600 transform -rotate-12" />
        <div className="w-2 h-2 border border-surface-600 transform rotate-45" />
        <div className="w-8 h-[2px] bg-surface-600 transform rotate-12" />
      </div>

      {/* Window Controls */}
      <div className="flex items-center no-drag relative z-10">
        <button
          onClick={handleMinimize}
          className="w-12 h-9 flex items-center justify-center text-text-tertiary hover:bg-surface-800 hover:text-text-primary transition-colors"
          aria-label="Minimize"
        >
          <MinimizeIcon size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-12 h-9 flex items-center justify-center text-text-tertiary hover:bg-surface-800 hover:text-text-primary transition-colors"
          aria-label="Maximize"
        >
          <MaximizeIcon size={14} />
        </button>
        <button
          onClick={handleClose}
          className="w-12 h-9 flex items-center justify-center text-text-tertiary hover:bg-accent hover:text-white transition-colors"
          aria-label="Close"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </header>
  )
}
