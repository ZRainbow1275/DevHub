import type { CSSProperties } from 'react'
import type { DrawerSlot as DrawerSlotName } from '@shared/schemas/r8-runtime'
import { useDrawer } from '../../hooks/useDrawer'
import { DrawerContentRegistry } from './DrawerContentRegistry'
import { DrawerHeader } from './DrawerHeader'
import { DrawerResizeHandle } from './DrawerResizeHandle'

interface DrawerSlotProps {
  slot: DrawerSlotName
}

function getSlotStyle(slot: DrawerSlotName, size: number, zIndex: number): CSSProperties {
  if (slot === 'top') return { height: size, zIndex }
  if (slot === 'right') return { width: size, zIndex }
  if (slot === 'bottom') return { height: size, zIndex }
  if (slot === 'statusbar') return { height: size, zIndex }
  return { width: size, minHeight: 240, zIndex }
}

function getSlotClassName(slot: DrawerSlotName): string {
  if (slot === 'top') return 'absolute left-0 right-0 top-0 border-b-2 border-accent/50'
  if (slot === 'right') return 'absolute right-0 top-0 bottom-0 border-l-2 border-accent/50'
  if (slot === 'bottom') return 'absolute left-0 right-0 bottom-0 border-t-2 border-accent/50'
  if (slot === 'statusbar') return 'absolute left-0 right-0 bottom-0 border-t-2 border-accent/50'
  return 'absolute right-4 top-14 border-2 border-accent/50 shadow-2xl'
}

export function DrawerSlot({ slot }: DrawerSlotProps) {
  const { state } = useDrawer(slot)
  if (!state.open) return null

  const size = state.size ?? state.width ?? state.height ?? 0
  const zIndex = state.zIndex ?? (slot === 'floating' ? 4000 : slot === 'statusbar' ? 1500 : 2000)

  return (
    <aside
      data-testid={`drawer-${slot}`}
      data-r8b-drawer-slot={slot}
      data-r8b-drawer-z-index={zIndex}
      className={`${getSlotClassName(slot)} flex flex-col overflow-hidden bg-surface-900 text-text-primary radius-sm`}
      style={getSlotStyle(slot, size, zIndex)}
    >
      <DrawerHeader slot={slot} />
      <div className="flex-1 overflow-y-auto p-3">
        <DrawerContentRegistry slot={slot} contentId={state.contentId} />
      </div>
      <DrawerResizeHandle slot={slot} />
    </aside>
  )
}
