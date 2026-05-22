import type { CSSProperties, ReactNode } from 'react'
import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import { BellIcon, GridIcon, InfoIcon, TerminalIcon, WindowIcon } from '../icons'
import { useDrawerStore } from '../../stores/drawerStore'
import { DRAWER_CONTENT_REGISTRY, DRAWER_SLOTS } from './drawer-model'
import { DrawerBottom } from './DrawerBottom'
import { DrawerFloating } from './DrawerFloating'
import { DrawerRight } from './DrawerRight'
import { DrawerStatusbar } from './DrawerStatusbar'
import { DrawerTop } from './DrawerTop'

interface DrawerSystemHostProps {
  children: ReactNode
}

const SLOT_LABELS: Record<DrawerSlot, string> = {
  top: 'TOP',
  right: 'RIGHT',
  bottom: 'BOTTOM',
  floating: 'FLOAT',
  statusbar: 'STATUS'
}

function slotIcon(slot: DrawerSlot) {
  if (slot === 'top') return <BellIcon size={12} />
  if (slot === 'right') return <InfoIcon size={12} />
  if (slot === 'bottom') return <TerminalIcon size={12} />
  if (slot === 'floating') return <WindowIcon size={12} />
  return <GridIcon size={12} />
}

function getDefaultContentId(slot: DrawerSlot): string {
  return DRAWER_CONTENT_REGISTRY.find(definition => definition.defaultSlot === slot)?.id ?? 'statusbar.aggregate'
}

function DrawerLauncherRail() {
  const setContent = useDrawerStore(store => store.setContent)
  return (
    <nav
      aria-label="R8 drawer launchers"
      className="absolute right-3 top-3 z-[2100] flex flex-col gap-1 pointer-events-auto"
      data-testid="drawer-launcher-rail"
    >
      {DRAWER_SLOTS.map(slot => (
        <button
          key={slot}
          type="button"
          data-testid={`open-drawer-${slot}`}
          className="flex items-center gap-1 border border-surface-600 bg-surface-950/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary shadow-elevated hover:border-accent hover:text-accent radius-sm"
          onClick={() => { void setContent(slot, getDefaultContentId(slot)) }}
        >
          {slotIcon(slot)}
          {SLOT_LABELS[slot]}
        </button>
      ))}
    </nav>
  )
}

function useDrawerShellStyle(): CSSProperties {
  const top = useDrawerStore(store => store.states.top)
  const right = useDrawerStore(store => store.states.right)
  const bottom = useDrawerStore(store => store.states.bottom)
  return {
    '--drawer-top': top.open ? `${top.size ?? top.height ?? 0}px` : '0px',
    '--drawer-right': right.open ? `${right.size ?? right.width ?? 0}px` : '0px',
    '--drawer-bottom': bottom.open ? `${bottom.size ?? bottom.height ?? 0}px` : '0px',
    '--motion-drawer': '200ms'
  } as CSSProperties
}

export function DrawerSystemHost({ children }: DrawerSystemHostProps) {
  const shellStyle = useDrawerShellStyle()

  return (
    <div className="r8-drawer-shell relative flex-1 min-h-0 overflow-hidden" style={shellStyle} data-testid="drawer-system-host">
      <div className="r8-drawer-main flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
      <DrawerTop />
      <DrawerRight />
      <DrawerBottom />
      <DrawerFloating />
      <DrawerStatusbar />
      <DrawerLauncherRail />
    </div>
  )
}
