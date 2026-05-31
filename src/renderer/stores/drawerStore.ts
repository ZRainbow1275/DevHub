import { create } from 'zustand'
import type { DrawerLayoutRecord, DrawerSlot, DrawerState } from '@shared/schemas/r8-runtime'
import {
  createDefaultDrawerStateMap,
  drawerStatesToMap,
  updateDrawerOpen,
  updateDrawerSize
} from '../components/drawer/drawer-model'

interface DrawerStore {
  states: Record<DrawerSlot, DrawerState>
  hydrated: boolean
  error: string | null
  hydrate: () => Promise<void>
  setDrawerState: (state: DrawerState) => Promise<DrawerState>
  setOpen: (slot: DrawerSlot, open: boolean) => Promise<DrawerState>
  setContent: (slot: DrawerSlot, contentId: string) => Promise<DrawerState>
  setPinned: (slot: DrawerSlot, pinned: boolean) => Promise<DrawerState>
  setSize: (slot: DrawerSlot, size: number) => Promise<DrawerState>
  saveLayout: (name: string) => Promise<DrawerLayoutRecord | null>
  loadLayout: (name: string) => Promise<DrawerLayoutRecord | null>
  morphToPopout: (slot: DrawerSlot) => Promise<{ popoutId: string } | null>
  morphFromPopout: (popoutId: string, slot: DrawerSlot) => Promise<{ drawerState: DrawerState } | null>
}

function getDrawerBridge() {
  return typeof window === 'undefined' ? undefined : window.devhub?.r8?.drawer
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function persistState(state: DrawerState): Promise<DrawerState> {
  const bridge = getDrawerBridge()
  if (!bridge?.setState) return state
  return bridge.setState(state)
}

export const useDrawerStore = create<DrawerStore>((set, get) => ({
  states: createDefaultDrawerStateMap(),
  hydrated: false,
  error: null,

  hydrate: async () => {
    const bridge = getDrawerBridge()
    if (!bridge?.getState) {
      set({ hydrated: true, error: null })
      return
    }
    try {
      const states = await bridge.getState()
      const mapped = drawerStatesToMap(states)
      set({ states: mapped, hydrated: true, error: null })
    } catch (error) {
      set({ hydrated: true, error: toErrorMessage(error) })
    }
  },

  setDrawerState: async (state) => {
    const current = get().states
    const optimistic = drawerStatesToMap([{ ...current[state.slot], ...state }])
    set({ states: { ...current, [state.slot]: optimistic[state.slot] }, error: null })
    try {
      const saved = await persistState(optimistic[state.slot])
      set(existing => ({ states: { ...existing.states, [saved.slot]: drawerStatesToMap([saved])[saved.slot] }, error: null }))
      return saved
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return optimistic[state.slot]
    }
  },

  setOpen: async (slot, open) => {
    const state = updateDrawerOpen(get().states[slot], open)
    return get().setDrawerState(state)
  },

  setContent: async (slot, contentId) => {
    const state = updateDrawerOpen(get().states[slot], true, contentId)
    return get().setDrawerState(state)
  },

  setPinned: async (slot, pinned) => {
    const state = { ...get().states[slot], pinned, updatedAt: Date.now() }
    return get().setDrawerState(state)
  },

  setSize: async (slot, size) => {
    const state = updateDrawerSize(get().states[slot], size)
    return get().setDrawerState(state)
  },

  saveLayout: async (name) => {
    const bridge = getDrawerBridge()
    if (!bridge?.saveLayout) return null
    try {
      return await bridge.saveLayout(name, get().states)
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return null
    }
  },

  loadLayout: async (name) => {
    const bridge = getDrawerBridge()
    if (!bridge?.loadLayout) return null
    try {
      const record = await bridge.loadLayout(name)
      set({ states: drawerStatesToMap(record.states), error: null })
      return record
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return null
    }
  },

  morphToPopout: async (slot) => {
    const state = get().states[slot]
    const bridge = getDrawerBridge()
    if (!bridge?.morphToPopout || !state.contentId) return null
    try {
      const result = await bridge.morphToPopout(slot, state.contentId)
      await get().setOpen(slot, false)
      return result
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return null
    }
  },

  morphFromPopout: async (popoutId, slot) => {
    const bridge = getDrawerBridge()
    if (!bridge?.morphFromPopout) return null
    try {
      const result = await bridge.morphFromPopout(popoutId, slot)
      set(existing => ({ states: { ...existing.states, [slot]: drawerStatesToMap([result.drawerState])[slot] }, error: null }))
      return result
    } catch (error) {
      set({ error: toErrorMessage(error) })
      return null
    }
  }
}))
