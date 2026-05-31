import { useCallback, useEffect, useRef, useState } from 'react'
import type { PortInfo } from '@shared/types-extended'
import { ProcessIcon } from '../icons'
import { TruncatedText } from '../ui/TruncatedText'
import {
  PORT_POPOUT_LIMITS,
  type PortPopout,
  type PortPopoutPosition,
  type PortPopoutResizeDirection
} from './port-popout-model'
import { PortPopoutResizeHandles } from './PortPopoutResizeHandles'
import { PortPopoutTitleBar } from './PortPopoutTitleBar'

interface PortPopoutCardProps {
  popout: PortPopout
  onClose: (id: string) => void
  onMinimize: (id: string, minimized: boolean) => void
  onThemeIsolate: (id: string, themeIsolated: boolean) => void
  onMove: (id: string, position: PortPopoutPosition) => void
  onResize: (
    id: string,
    direction: PortPopoutResizeDirection,
    delta: PortPopoutPosition,
    origin: Pick<PortPopout, 'position' | 'size'>
  ) => void
  onPromote: (popout: PortPopout) => Promise<{ ok: boolean; windowId?: string; reason?: string }>
}

function formatPortAddress(port: PortInfo): string {
  return `${port.protocol} ${port.localAddress}`
}

export function PortPopoutCard({ popout, onClose, onMinimize, onThemeIsolate, onMove, onResize, onPromote }: PortPopoutCardProps) {
  const [dragStart, setDragStart] = useState<{ pointer: PortPopoutPosition; origin: PortPopoutPosition } | null>(null)
  const [resizeStart, setResizeStart] = useState<{
    direction: PortPopoutResizeDirection
    pointer: PortPopoutPosition
    origin: Pick<PortPopout, 'position' | 'size'>
  } | null>(null)
  const [promoteState, setPromoteState] = useState<'idle' | 'working' | 'done' | 'unavailable' | 'failed'>('idle')
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!dragStart) return

    const handlePointerMove = (event: PointerEvent) => {
      onMove(popout.id, {
        x: dragStart.origin.x + event.clientX - dragStart.pointer.x,
        y: dragStart.origin.y + event.clientY - dragStart.pointer.y
      })
    }

    const handlePointerUp = () => setDragStart(null)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragStart, onMove, popout.id])

  useEffect(() => {
    if (!resizeStart) return

    const handlePointerMove = (event: PointerEvent) => {
      onResize(
        popout.id,
        resizeStart.direction,
        {
          x: event.clientX - resizeStart.pointer.x,
          y: event.clientY - resizeStart.pointer.y
        },
        resizeStart.origin
      )
    }

    const handlePointerUp = () => setResizeStart(null)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [onResize, popout.id, resizeStart])

  const handlePromote = useCallback(async () => {
    setPromoteState('working')
    const result = await onPromote(popout)
    if (result.ok) {
      setPromoteState('done')
      return
    }
    setPromoteState(result.reason === 'unavailable' ? 'unavailable' : 'failed')
  }, [onPromote, popout])

  return (
    <article
      ref={cardRef}
      data-testid={`port-popout-card-${popout.port.port}-${popout.port.pid}`}
      data-r8b-port-popout="floating"
      data-r8b-popout-state={popout.minimized ? 'minimized' : 'expanded'}
      data-r8b-popout-trigger={popout.trigger}
      data-r8b-popout-minimized={String(popout.minimized)}
      data-r8b-popout-theme-isolated={String(popout.themeIsolated)}
      data-r8b-popout-sync-direction={popout.syncPolicy.direction}
      data-r8b-popout-sync-theme={String(popout.syncPolicy.theme)}
      data-r8b-popout-z-index={popout.zIndex}
      className="fixed bg-surface-900 border-l-4 border-accent shadow-2xl pointer-events-auto radius-sm overflow-hidden"
      style={{
        left: popout.position.x,
        top: popout.position.y,
        width: Math.max(PORT_POPOUT_LIMITS.CARD_MIN_W, popout.size.width),
        height: popout.minimized ? 'auto' : Math.max(PORT_POPOUT_LIMITS.CARD_MIN_H, popout.size.height),
        minHeight: popout.minimized ? undefined : PORT_POPOUT_LIMITS.CARD_MIN_H,
        zIndex: popout.zIndex
      }}
    >
      <PortPopoutTitleBar
        popout={popout}
        promoteState={promoteState}
        onStartDrag={(pointer) => {
          setDragStart({
            pointer,
            origin: popout.position
          })
        }}
        onMinimize={onMinimize}
        onThemeIsolate={onThemeIsolate}
        onPromote={() => void handlePromote()}
        onClose={onClose}
      />

      {!popout.minimized && (
        <div
          data-testid={`port-popout-body-${popout.port.port}-${popout.port.pid}`}
          className="p-3 space-y-3 h-[calc(100%-2.5rem)] overflow-auto"
        >
          <section className="bg-surface-950 p-3 border-l-2 border-surface-600 radius-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-surface-700 flex items-center justify-center radius-sm">
                <ProcessIcon size={15} className="text-text-muted" />
              </div>
              <div className="min-w-0">
                <TruncatedText text={popout.port.processName} className="text-sm font-bold text-text-primary" />
                <div className="text-xs text-text-muted font-mono">PID: {popout.port.pid}</div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-surface-800 p-2 border-l-2 border-surface-600 radius-sm">
              <div className="text-text-tertiary uppercase tracking-wider mb-1">State</div>
              <div className="font-mono text-text-primary">{popout.port.state}</div>
            </div>
            <div className="bg-surface-800 p-2 border-l-2 border-surface-600 radius-sm">
              <div className="text-text-tertiary uppercase tracking-wider mb-1">Address</div>
              <TruncatedText text={formatPortAddress(popout.port)} className="font-mono text-text-primary" />
            </div>
          </section>

          {popout.port.foreignAddress && popout.port.foreignAddress !== '*:*' && popout.port.foreignAddress !== '0.0.0.0:0' && (
            <section className="bg-surface-800 p-2 border-l-2 border-warning/50 radius-sm">
              <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Remote</div>
              <TruncatedText text={popout.port.foreignAddress} className="text-xs text-warning/80 font-mono" />
            </section>
          )}

          {promoteState !== 'idle' && (
            <div
              data-testid={`port-popout-promote-state-${popout.port.port}-${popout.port.pid}`}
              className="text-[10px] text-text-muted uppercase tracking-wider"
            >
              Promote: {promoteState}
            </div>
          )}
        </div>
      )}
      {!popout.minimized && (
        <PortPopoutResizeHandles
          popout={popout}
          onStartResize={(direction, pointer) => {
            setResizeStart({
              direction,
              pointer,
              origin: {
                position: popout.position,
                size: popout.size
              }
            })
          }}
        />
      )}
    </article>
  )
}
