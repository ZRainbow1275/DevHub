import { create } from 'zustand'
import { CodingTool } from '@shared/types'

interface ToolState {
  tools: CodingTool[]
  setTools: (tools: CodingTool[]) => void
  updateTool: (id: string, updates: Partial<CodingTool>) => void
}

export const useToolStore = create<ToolState>((set) => ({
  tools: [],

  setTools: (tools) => set({ tools }),

  updateTool: (id, updates) =>
    set((state) => ({
      tools: state.tools.map((t) => (t.id === id ? { ...t, ...updates } : t))
    }))
}))
