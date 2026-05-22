import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { PortPopout, PortPopoutPosition, PortPopoutResizeDirection } from './port-popout-model'
import { PORT_POPOUT_LIMITS } from './port-popout-model'
import { PortPopoutCard } from './PortPopoutCard'

interface PortPopoutHostProps {
  popouts: PortPopout[]
  onClose: (id: string) => void
  onMinimize: (id: string, minimized: boolean) => void
  onThemeIsolate: (id: string, themeIsolated: boolean) => void
  onPin: (id: string, pinned: boolean) => void
  onMove: (id: string, position: PortPopoutPosition) => void
  onResize: (
    id: string,
    direction: PortPopoutResizeDirection,
    delta: PortPopoutPosition,
    origin: Pick<PortPopout, 'position' | 'size'>
  ) => void
  onPromote: (popout: PortPopout) => Promise<{ ok: boolean; windowId?: string; reason?: string }>
}

export function PortPopoutHost({
  popouts,
  onClose,
  onMinimize,
  onThemeIsolate,
  onPin,
  onMove,
  onResize,
  onPromote
}: PortPopoutHostProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  if (popouts.length === 0 || !portalTarget) return null

  return createPortal(
    <div
      data-testid="port-popout-host"
      data-r8b-popout-host="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: PORT_POPOUT_LIMITS.Z_INDEX_BASE }}
    >
      {popouts.map(popout => (
        <PortPopoutCard
          key={popout.id}
          popout={popout}
          onClose={onClose}
          onMinimize={onMinimize}
          onThemeIsolate={onThemeIsolate}
          onPin={onPin}
          onMove={onMove}
          onResize={onResize}
          onPromote={onPromote}
        />
      ))}
    </div>,
    portalTarget
  )
}
