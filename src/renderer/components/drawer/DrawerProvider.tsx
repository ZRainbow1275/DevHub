import { useEffect, type ReactNode } from 'react'
import type { DrawerSlot } from '@shared/schemas/r8-runtime'
import { DRAWER_SLOTS } from './drawer-model'
import { useDrawerStore } from '../../stores/drawerStore'

interface DrawerProviderProps {
  children: ReactNode
}

function isDrawerSlot(value: unknown): value is DrawerSlot {
  return DRAWER_SLOTS.includes(value as DrawerSlot)
}

export function DrawerProvider({ children }: DrawerProviderProps) {
  const hydrate = useDrawerStore(store => store.hydrate)
  const setContent = useDrawerStore(store => store.setContent)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const unsubscribe = window.devhub?.r8?.command?.onEvent?.((event) => {
      if (event.type !== 'drawer-open' || !isDrawerSlot(event.slot) || !event.contentId) return
      void setContent(event.slot, event.contentId)
    })
    return () => {
      unsubscribe?.()
    }
  }, [setContent])

  return <>{children}</>
}
