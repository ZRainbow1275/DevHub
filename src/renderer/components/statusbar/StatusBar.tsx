import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { STATUSBAR_LIMITS, type DrawerSlot, type StatusTile } from '@shared/schemas/r8-runtime'
import type { ThemeDecorationConfig } from '@shared/types'
import { useStatusBarAggregate } from '../../hooks/useStatusBarAggregate'
import { useDrawerStore } from '../../stores/drawerStore'
import { useProcessStore } from '../../stores/processStore'
import { NetworkIcon } from '../icons'
import { ThemeDecoration } from '../ui/ThemeDecoration'
import { StatusBarProcessHistoryWidget } from './StatusBarProcessHistoryWidget'
import { StatusBarSlot } from './StatusBarSlot'

interface StatusBarProps {
  onTopologyClick?: () => void
  decorationConfig?: ThemeDecorationConfig
}

// gap-1.5 in the left flex row equals 6px between every child.
const ROW_GAP_PX = 6

function isDrawerSlot(value: unknown): value is DrawerSlot {
  return ['top', 'right', 'bottom', 'floating', 'statusbar'].includes(String(value))
}

function stringArg(args: Record<string, unknown>, key: string): string | null {
  const value = args[key]
  return typeof value === 'string' ? value : null
}

export function StatusBar({ onTopologyClick, decorationConfig }: StatusBarProps) {
  const { aggregate, visibleTiles, overflowTiles, error } = useStatusBarAggregate()
  const setContent = useDrawerStore(state => state.setContent)
  const activeProcessCount = useProcessStore(state => state.processes.filter(process => process.status === 'running').length)
  const [overflowOpen, setOverflowOpen] = useState(false)
  // The overflow popover must escape the left group's `overflow-hidden`, so it
  // is rendered with position:fixed using coords captured from the button rect
  // (same pattern as the Sidebar drawer flyout). The popover sits just ABOVE
  // the button, anchored by `bottom`.
  const [overflowPos, setOverflowPos] = useState<{ left: number; bottom: number } | null>(null)
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null)
  const overflowPopoverRef = useRef<HTMLDivElement | null>(null)

  // The hook keeps a count-based split for legacy reasons; here we treat the
  // status bar as one ordered list and decide visibility purely by width.
  const allTiles = useMemo(() => [...visibleTiles, ...overflowTiles], [visibleTiles, overflowTiles])

  const leftRef = useRef<HTMLDivElement | null>(null)
  const measureRowRef = useRef<HTMLDivElement | null>(null)
  const statusIndicatorRef = useRef<HTMLDivElement | null>(null)
  const processHistoryMeasureRef = useRef<HTMLDivElement | null>(null)
  const overflowButtonMeasureRef = useRef<HTMLDivElement | null>(null)
  const tileMeasureRefs = useRef<Array<HTMLDivElement | null>>([])

  // Default to showing everything; the layout effect narrows this down once it
  // can actually measure widths. This keeps the initial paint (and jsdom, where
  // every offset/client width is 0) showing all tiles.
  const [visibleCount, setVisibleCount] = useState(allTiles.length)

  // The hidden measurement row renders real StatusBarSlot / process-history
  // components so widths match exactly, but those components hard-code
  // data-testid attributes. Strip them from the off-screen clones so
  // testing-library getByTestId (and any DOM query) only ever sees the real row.
  const stripMeasurementTestIds = useCallback(() => {
    const row = measureRowRef.current
    if (!row) return
    for (const node of row.querySelectorAll('[data-testid]')) {
      node.removeAttribute('data-testid')
    }
  }, [])

  const computeVisibleCount = useCallback(() => {
    const container = leftRef.current
    if (!container) return

    const available = container.clientWidth
    // Zero width means the element is not laid out yet (initial mount, jsdom,
    // display:none ancestor). Show everything and recompute when real layout
    // information arrives via the ResizeObserver.
    if (available <= 0) {
      setVisibleCount(prev => (prev === allTiles.length ? prev : allTiles.length))
      return
    }

    const reserveStatus = statusIndicatorRef.current?.offsetWidth ?? 0
    const reserveProcessHistory = processHistoryMeasureRef.current?.offsetWidth ?? 0
    const reserveOverflowButton = overflowButtonMeasureRef.current?.offsetWidth ?? 0

    const tileWidths = allTiles.map((_, index) => tileMeasureRefs.current[index]?.offsetWidth ?? 0)

    // Fixed reservations that are always present in the real row: the status
    // indicator and the process-history widget (it is lg:hidden below lg, in
    // which case its measured width is 0 and reserves nothing).
    const fixedReserve =
      reserveStatus +
      (reserveStatus > 0 ? ROW_GAP_PX : 0) +
      reserveProcessHistory +
      (reserveProcessHistory > 0 ? ROW_GAP_PX : 0)

    // Greedily fit tiles. First pass assumes the overflow button will be needed.
    const fitTiles = (extraReserve: number): number => {
      let used = fixedReserve + extraReserve
      let count = 0
      for (let index = 0; index < tileWidths.length; index += 1) {
        const next = used + tileWidths[index] + ROW_GAP_PX
        if (next > available) break
        used = next
        count += 1
      }
      return count
    }

    const overflowReserve = reserveOverflowButton + (reserveOverflowButton > 0 ? ROW_GAP_PX : 0)
    let next = fitTiles(overflowReserve)

    // If reserving the overflow button still let every tile fit, the button is
    // unnecessary; recompute without that reserve so we never needlessly drop a
    // tile into an overflow popover that would then be empty.
    if (next >= allTiles.length) {
      next = allTiles.length
    } else {
      const withoutButton = fitTiles(0)
      if (withoutButton >= allTiles.length) next = allTiles.length
    }

    const clamped = Math.max(0, Math.min(next, allTiles.length))
    setVisibleCount(prev => (prev === clamped ? prev : clamped))
  }, [allTiles])

  useLayoutEffect(() => {
    stripMeasurementTestIds()
    computeVisibleCount()
    const container = leftRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      stripMeasurementTestIds()
      computeVisibleCount()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [computeVisibleCount, stripMeasurementTestIds])

  const handleTileAction = useCallback((tile: StatusTile) => {
    const action = tile.clickAction
    if (!action) return

    if (action.type === 'open-cmdk') {
      window.dispatchEvent(new CustomEvent('devhub:open-command-palette'))
      return
    }

    if (action.type === 'invoke-cmd') {
      const commandId = stringArg(action.args, 'commandId')
      if (commandId) void window.devhub?.r8?.command?.invoke?.(commandId)
      return
    }

    if (action.type === 'open-drawer' || action.type === 'open-popout') {
      const slot = stringArg(action.args, 'slot')
      const contentId = stringArg(action.args, 'contentId')
      if (isDrawerSlot(slot) && contentId) void setContent(slot, contentId)
      const monitorTab = stringArg(action.args, 'monitorTab')
      if (monitorTab) {
        window.dispatchEvent(new CustomEvent('devhub:open-monitor'))
        window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab: monitorTab } }))
      }
      return
    }

    if (action.type === 'navigate') {
      const route = stringArg(action.args, 'route')
      const tab = stringArg(action.args, 'tab')
      if (route === 'monitor') {
        window.dispatchEvent(new CustomEvent('devhub:open-monitor'))
        if (tab) window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', { detail: { tab } }))
      }
      if (route === 'projects') {
        window.history.replaceState(null, '', '#/projects')
      }
    }
  }, [setContent])

  // Toggle the overflow popover. On open, recompute the button rect every time
  // so the fixed-position popover anchors to the current layout (the row width
  // adapts, so the button can move between opens).
  const toggleOverflow = useCallback(() => {
    setOverflowOpen(open => {
      const next = !open
      if (next) {
        const btn = overflowButtonRef.current
        if (btn) {
          const rect = btn.getBoundingClientRect()
          // Sit just above the button: anchor by `bottom` measured from the
          // viewport bottom, plus a 4px gap.
          setOverflowPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 })
        }
      }
      return next
    })
  }, [])

  // Selecting a tile inside the overflow popover should close it.
  const handleOverflowTileAction = useCallback((tile: StatusTile) => {
    handleTileAction(tile)
    setOverflowOpen(false)
  }, [handleTileAction])

  // Dismiss the popover on Escape or a pointerdown outside the popover+button.
  // The flyout is anchored at fixed coords captured on open; if the window is
  // resized while it is open those coords go stale, so close it too.
  useEffect(() => {
    if (!overflowOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverflowOpen(false)
    }
    const handlePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const popover = overflowPopoverRef.current
      if (popover && popover.contains(target)) return
      const btn = overflowButtonRef.current
      if (btn && btn.contains(target)) return
      setOverflowOpen(false)
    }
    const handleResize = () => setOverflowOpen(false)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handlePointer)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handlePointer)
      window.removeEventListener('resize', handleResize)
    }
  }, [overflowOpen])

  const mainRowTiles = allTiles.slice(0, visibleCount)
  const hiddenTiles = allTiles.slice(visibleCount)

  return (
    <footer
      className="relative flex shrink-0 items-center justify-between overflow-visible border-t-2 border-surface-700 bg-surface-950 px-3 text-xs"
      style={{ height: STATUSBAR_LIMITS.HEIGHT_PX }}
      data-testid="statusbar"
      data-r8b-statusbar-tiles={mainRowTiles.length}
      data-r8b-statusbar-generated-at={aggregate.generatedAt}
    >
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-accent via-gold to-accent" />
      <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />
      <ThemeDecoration config={decorationConfig} position="statusbar-background" />

      {/* Hidden measurement row: lays out every tile and fixed piece off-screen
          so we can read real per-element widths without a visible flash. It is
          aria-hidden + pointer-events-none and uses visibility:hidden (still
          laid out, unlike display:none). */}
      <div
        ref={measureRowRef}
        aria-hidden
        className="pointer-events-none flex items-center gap-1.5"
        style={{ position: 'absolute', visibility: 'hidden', left: 0, top: 0 }}
      >
        <div ref={statusIndicatorRef} className="mr-1 flex shrink-0 items-center gap-1.5 text-text-tertiary">
          <span className="h-1.5 w-1.5 rounded-sm bg-success" />
          <span className="whitespace-nowrap font-medium uppercase tracking-wider" style={{ fontSize: '10px' }}>
            {error ? '降级' : '就绪'}
          </span>
        </div>
        {allTiles.map((tile, index) => (
          <div
            key={tile.id}
            ref={node => {
              tileMeasureRefs.current[index] = node
            }}
            className="shrink-0"
          >
            <StatusBarSlot tile={tile} onAction={() => undefined} />
          </div>
        ))}
        <div ref={processHistoryMeasureRef} className="shrink-0">
          <StatusBarProcessHistoryWidget />
        </div>
        <div
          ref={overflowButtonMeasureRef}
          className="h-[22px] shrink-0 whitespace-nowrap border-l-2 border-surface-600 bg-surface-900/70 px-2 text-[10px] text-text-secondary radius-sm"
        >
          更多 0
        </div>
      </div>

      <div ref={leftRef} className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <div className="mr-1 flex shrink-0 items-center gap-1.5 text-text-tertiary" title={error ?? '状态栏聚合正常'}>
          <span className={`h-1.5 w-1.5 rounded-sm ${error ? 'bg-warning' : 'bg-success'}`} />
          <span className="whitespace-nowrap font-medium uppercase tracking-wider" style={{ fontSize: '10px' }}>
            {error ? '降级' : '就绪'}
          </span>
        </div>

        {mainRowTiles.map(tile => (
          <StatusBarSlot key={tile.id} tile={tile} onAction={handleTileAction} />
        ))}

        <StatusBarProcessHistoryWidget />

        {hiddenTiles.length > 0 && (
          <div className="relative">
            <button
              ref={overflowButtonRef}
              type="button"
              className="h-[22px] shrink-0 whitespace-nowrap border-l-2 border-surface-600 bg-surface-900/70 px-2 text-[10px] text-text-secondary hover:bg-surface-800 radius-sm"
              onClick={toggleOverflow}
              aria-expanded={overflowOpen}
              aria-haspopup="menu"
              data-testid="statusbar-overflow"
            >
              更多 {hiddenTiles.length}
            </button>
            {overflowOpen && (
              <div
                ref={overflowPopoverRef}
                className="fixed z-[1600] flex min-w-[220px] flex-col gap-1 border border-surface-700 bg-surface-950 p-2 shadow-xl radius-sm"
                style={overflowPos ? { left: overflowPos.left, bottom: overflowPos.bottom } : undefined}
              >
                {hiddenTiles.map(tile => (
                  <StatusBarSlot key={tile.id} tile={tile} onAction={handleOverflowTileAction} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 ml-2 flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          data-testid="topology-status-badge"
          data-active-process-count={activeProcessCount}
          className="hidden h-[22px] items-center gap-1 border-l-2 border-accent bg-accent/10 px-2 text-accent-300 hover:bg-accent/20 radius-sm sm:flex"
          onClick={onTopologyClick ?? (() => window.dispatchEvent(new CustomEvent('devhub:open-topology-global')))}
          title={`打开全局拓扑，当前活跃进程 ${activeProcessCount}`}
        >
          <NetworkIcon size={12} />
          <span style={{ fontSize: '10px' }}>拓扑</span>
          <span className="font-mono text-[10px]" data-testid="topology-status-active-process-count">{activeProcessCount}</span>
        </button>
        <div className="h-4 w-px bg-surface-700" />
        <span className="font-mono text-[10px] text-text-muted">DEVHUB v1.0</span>
      </div>
    </footer>
  )
}
