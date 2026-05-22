import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import { useDrawerStore } from '../stores/drawerStore'

export function useDrawer(slot: DrawerSlot) {
  const state = useDrawerStore(store => store.states[slot])
  const hydrated = useDrawerStore(store => store.hydrated)
  const error = useDrawerStore(store => store.error)
  const setOpen = useDrawerStore(store => store.setOpen)
  const setContent = useDrawerStore(store => store.setContent)
  const setPinned = useDrawerStore(store => store.setPinned)
  const setSize = useDrawerStore(store => store.setSize)
  const morphToPopout = useDrawerStore(store => store.morphToPopout)
  const morphFromPopout = useDrawerStore(store => store.morphFromPopout)

  return {
    state,
    hydrated,
    error,
    setOpen: (open: boolean) => setOpen(slot, open),
    setContent: (contentId: string) => setContent(slot, contentId),
    setPinned: (pinned: boolean) => setPinned(slot, pinned),
    setSize: (size: number) => setSize(slot, size),
    morphToPopout: () => morphToPopout(slot),
    morphFromPopout: (popoutId: string) => morphFromPopout(popoutId, slot)
  }
}
