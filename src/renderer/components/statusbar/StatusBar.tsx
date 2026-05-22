import { useCallback, useState } from 'react'
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

  return (
    <footer
      className="relative flex shrink-0 items-center justify-between overflow-visible border-t-2 border-surface-700 bg-surface-950 px-3 text-xs"
      style={{ height: STATUSBAR_LIMITS.HEIGHT_PX }}
      data-testid="statusbar"
      data-r8b-statusbar-tiles={visibleTiles.length}
      data-r8b-statusbar-generated-at={aggregate.generatedAt}
    >
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-accent via-gold to-accent" />
      <div className="absolute inset-0 deco-diagonal opacity-20 pointer-events-none" />
      <ThemeDecoration config={decorationConfig} position="statusbar-background" />

      <div className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <div className="mr-1 flex shrink-0 items-center gap-1.5 text-text-tertiary" title={error ?? '状态栏聚合正常'}>
          <span className={`h-1.5 w-1.5 rounded-sm ${error ? 'bg-warning' : 'bg-success'}`} />
          <span className="font-medium uppercase tracking-wider" style={{ fontSize: '10px' }}>
            {error ? '降级' : '就绪'}
          </span>
        </div>

        {visibleTiles.map(tile => (
          <StatusBarSlot key={tile.id} tile={tile} onAction={handleTileAction} />
        ))}

        <StatusBarProcessHistoryWidget />

        {overflowTiles.length > 0 && (
          <div className="relative">
            <button
              type="button"
              className="h-[22px] border-l-2 border-surface-600 bg-surface-900/70 px-2 text-[10px] text-text-secondary hover:bg-surface-800 radius-sm"
              onClick={() => setOverflowOpen(open => !open)}
              data-testid="statusbar-overflow"
            >
              更多 {overflowTiles.length}
            </button>
            {overflowOpen && (
              <div className="absolute bottom-7 left-0 z-[1600] flex min-w-[220px] flex-col gap-1 border border-surface-700 bg-surface-950 p-2 shadow-xl radius-sm">
                {overflowTiles.map(tile => (
                  <StatusBarSlot key={tile.id} tile={tile} onAction={handleTileAction} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 ml-2 flex shrink-0 items-center gap-2">
        <button
          type="button"
          data-testid="topology-status-badge"
          data-active-process-count={activeProcessCount}
          className="hidden items-center gap-1 border-l-2 border-accent bg-accent/10 px-2 py-0.5 text-accent-300 hover:bg-accent/20 radius-sm sm:flex"
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
