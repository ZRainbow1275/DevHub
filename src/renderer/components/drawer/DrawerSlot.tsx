import type { CSSProperties } from 'react'
import type { DrawerSlot as DrawerSlotName } from '@shared/schemas/r8-runtime'
import { useDrawer } from '../../hooks/useDrawer'
import { DRAWER_LIMITS } from './drawer-model'
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
  // floating: clamp to the viewport so a wide saved size cannot push the panel
  // off-screen, and use rem-based floors so it scales with root font-size on zoom.
  return {
    width: `min(${size}px, calc(100vw - 2rem))`,
    maxHeight: 'calc(100vh - 5rem)',
    minHeight: 'min(15rem, 60vh)',
    zIndex
  }
}

function getSlotClassName(slot: DrawerSlotName): string {
  if (slot === 'top') return 'absolute left-0 right-0 top-0 border-b border-surface-700'
  if (slot === 'right') return 'absolute right-0 top-0 bottom-0 border-l border-surface-700'
  if (slot === 'bottom') return 'absolute left-0 right-0 bottom-0 border-t border-surface-700'
  if (slot === 'statusbar') return 'absolute left-0 right-0 bottom-0 border-t border-surface-700'
  return 'absolute right-4 top-14 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] border border-surface-700 shadow-2xl'
}

// Direction-aware padding leaves room for the DrawerResizeHandle so the last line
// of content is not clipped behind the handle's hover background.
function getScrollPadding(slot: DrawerSlotName): string {
  if (slot === 'right') return 'flex-1 overflow-y-auto p-3 pl-5'
  if (slot === 'bottom' || slot === 'statusbar') return 'flex-1 overflow-y-auto p-3 pt-5'
  return 'flex-1 overflow-y-auto p-3 pb-5'
}

export function DrawerSlot({ slot }: DrawerSlotProps) {
  const { state } = useDrawer(slot)
  if (!state.open) return null

  // Floor against the per-slot minimum (drawer-model DRAWER_LIMITS) so a bad
  // persisted value or a drag-to-zero can never collapse a slot to an invisible,
  // unrecoverable state, while thin slots (statusbar/top) keep their design size.
  const limits = DRAWER_LIMITS[slot]
  const rawSize = state.size ?? state.width ?? state.height ?? limits.defaultSize
  const size = Math.max(limits.min, rawSize)
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
      <div className={getScrollPadding(slot)}>
        <DrawerContentRegistry slot={slot} contentId={state.contentId} />
      </div>
      <DrawerResizeHandle slot={slot} />
    </aside>
  )
}
