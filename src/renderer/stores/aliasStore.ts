import { create } from 'zustand'
import { AIWindowAlias } from '@shared/types-extended'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

interface AliasState {
  aliases: AIWindowAlias[]
  setAliases: (aliases: AIWindowAlias[]) => void
  addOrUpdateAlias: (alias: AIWindowAlias) => void
  removeAlias: (aliasId: string) => void
  fetchAliases: () => Promise<void>
  saveAlias: (alias: AIWindowAlias) => Promise<boolean>
  deleteAlias: (aliasId: string) => Promise<boolean>
}

export const useAliasStore = create<AliasState>((set, get) => ({
  aliases: [],

  setAliases: (aliases) => set({ aliases }),

  addOrUpdateAlias: (alias) =>
    set((state) => {
      const index = state.aliases.findIndex((a) => a.id === alias.id)
      if (index >= 0) {
        const updated = [...state.aliases]
        updated[index] = alias
        return { aliases: updated }
      }
      return { aliases: [...state.aliases, alias] }
    }),

  removeAlias: (aliasId) =>
    set((state) => ({
      aliases: state.aliases.filter((a) => a.id !== aliasId)
    })),

  fetchAliases: async () => {
    if (!isElectron) return
    try {
      const aliases = await window.devhub.aiAlias.getAll()
      set({ aliases })
    } catch (error) {
      console.warn('Failed to fetch aliases:', error instanceof Error ? error.message : 'Unknown error')
    }
  },

  saveAlias: async (alias) => {
    if (!isElectron) return false
    try {
      const result = await window.devhub.aiAlias.set(alias)
      if (result) {
        get().addOrUpdateAlias(alias)
      }
      return result
    } catch (error) {
      console.warn('Failed to save alias:', error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  },

  deleteAlias: async (aliasId) => {
    if (!isElectron) return false
    try {
      const result = await window.devhub.aiAlias.remove(aliasId)
      if (result) {
        get().removeAlias(aliasId)
      }
      return result
    } catch (error) {
      console.warn('Failed to delete alias:', error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }
}))
