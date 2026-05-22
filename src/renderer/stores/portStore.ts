import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type PortPopoutSettings,
  type PortPopoutTriggerSettings
} from '@shared/types'
import { PortInfo, PortFocusData, COMMON_DEV_PORTS } from '@shared/types-extended'
import { PORT_POPOUT_LIMITS, type PortPopout } from '../components/popout/port-popout-model'

interface PortConflict {
  port: number
  resolved: boolean
  timestamp: Date
}

type PortPopoutTriggerName = keyof PortPopoutTriggerSettings
type PortPopoutLayoutPresets = Record<string, PortPopout[]>

interface PortPopoutSettingsInput {
  triggerEnabled?: Partial<PortPopoutTriggerSettings>
  hoverDelayMs?: number
  dragThresholdPx?: number
}

interface PortPopoutSliceState {
  popouts: PortPopout[]
  triggerEnabled: PortPopoutTriggerSettings
  hoverDelayMs: number
  dragThresholdPx: number
  layoutPresets: PortPopoutLayoutPresets
}

interface PortState {
  ports: PortInfo[]
  conflicts: PortConflict[]
  isScanning: boolean
  lastScanTime: Date | null
  selectedPort: number | null
  popouts: PortPopout[]
  triggerEnabled: PortPopoutTriggerSettings
  hoverDelayMs: number
  dragThresholdPx: number
  layoutPresets: PortPopoutLayoutPresets

  // Actions
  setPorts: (ports: PortInfo[]) => void
  setScanning: (scanning: boolean) => void
  selectPort: (port: number | null) => void
  addConflict: (port: number) => void
  resolveConflict: (port: number) => void
  removePort: (port: number) => void

  // Port detail cache (port number -> PortFocusData)
  portDetails: Map<number, PortFocusData>
  updatePortDetail: (port: number, detail: PortFocusData) => void

  // R8.B Port popout slice
  setPopouts: (popouts: PortPopout[]) => void
  updatePopouts: (updater: (current: PortPopout[]) => PortPopout[]) => void
  resetPopoutSlice: () => void
  setPopoutSettings: (settings: PortPopoutSettingsInput | PortPopoutSettings | null | undefined) => void
  setPopoutTriggerEnabled: (trigger: PortPopoutTriggerName, enabled: boolean) => void
  setPopoutTiming: (timing: Pick<PortPopoutSettingsInput, 'hoverDelayMs' | 'dragThresholdPx'>) => void
  savePopoutLayoutPreset: (name: string, popouts?: PortPopout[]) => boolean
  applyPopoutLayoutPreset: (name: string) => boolean
  deletePopoutLayoutPreset: (name: string) => void

  // Computed
  getPortByNumber: (port: number) => PortInfo | undefined
  getCommonPorts: () => PortInfo[]
  getActiveConflicts: () => PortConflict[]
  isPortInUse: (port: number) => boolean
  getPopoutById: (id: string) => PortPopout | undefined
  getOpenPopoutCount: () => number
}

const DEFAULT_PORT_POPOUT_SETTINGS = DEFAULT_SETTINGS.window.portPopout
const POPOUT_LAYOUT_PRESET_NAME_MAX_LENGTH = 80

function cloneTriggerEnabled(triggerEnabled: PortPopoutTriggerSettings): PortPopoutTriggerSettings {
  return {
    hover: triggerEnabled.hover,
    click: triggerEnabled.click,
    drag: triggerEnabled.drag,
    contextMenu: triggerEnabled.contextMenu
  }
}

function clonePortPopouts(popouts: readonly PortPopout[]): PortPopout[] {
  return popouts.map(popout => ({
    ...popout,
    port: { ...popout.port },
    position: { ...popout.position },
    size: { ...popout.size },
    syncPolicy: { ...popout.syncPolicy }
  }))
}

function limitPortPopouts(popouts: readonly PortPopout[]): PortPopout[] {
  return clonePortPopouts(popouts).slice(0, PORT_POPOUT_LIMITS.MAX_TOTAL)
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizePopoutLayoutPresetName(name: string): string {
  return name.trim().slice(0, POPOUT_LAYOUT_PRESET_NAME_MAX_LENGTH)
}

function createDefaultPopoutSliceState(): PortPopoutSliceState {
  return {
    popouts: [],
    triggerEnabled: cloneTriggerEnabled(DEFAULT_PORT_POPOUT_SETTINGS.triggerEnabled),
    hoverDelayMs: DEFAULT_PORT_POPOUT_SETTINGS.hoverDelayMs,
    dragThresholdPx: DEFAULT_PORT_POPOUT_SETTINGS.dragThresholdPx,
    layoutPresets: {}
  }
}

function mergePopoutSettings(
  current: PortPopoutSliceState,
  settings: PortPopoutSettingsInput | PortPopoutSettings | null | undefined
): Pick<PortPopoutSliceState, 'triggerEnabled' | 'hoverDelayMs' | 'dragThresholdPx'> {
  const triggerEnabled = settings?.triggerEnabled ?? {}

  return {
    triggerEnabled: {
      hover: triggerEnabled.hover ?? current.triggerEnabled.hover,
      click: triggerEnabled.click ?? current.triggerEnabled.click,
      drag: triggerEnabled.drag ?? current.triggerEnabled.drag,
      contextMenu: triggerEnabled.contextMenu ?? current.triggerEnabled.contextMenu
    },
    hoverDelayMs: clampInteger(
      settings?.hoverDelayMs,
      200,
      3000,
      current.hoverDelayMs
    ),
    dragThresholdPx: clampInteger(
      settings?.dragThresholdPx,
      4,
      32,
      current.dragThresholdPx
    )
  }
}

export function getDefaultPortPopoutSliceState(): PortPopoutSliceState {
  return createDefaultPopoutSliceState()
}

export const usePortStore = create<PortState>((set, get) => ({
  ports: [],
  conflicts: [],
  isScanning: false,
  lastScanTime: null,
  selectedPort: null,
  ...createDefaultPopoutSliceState(),
  portDetails: new Map(),

  setPorts: (ports) =>
    set({
      ports,
      lastScanTime: new Date()
    }),

  setScanning: (isScanning) => set({ isScanning }),

  selectPort: (selectedPort) => set({ selectedPort }),

  addConflict: (port) =>
    set((state) => ({
      conflicts: [
        ...state.conflicts.filter((c) => c.port !== port),
        { port, resolved: false, timestamp: new Date() }
      ]
    })),

  resolveConflict: (port) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.port === port ? { ...c, resolved: true } : c
      )
    })),

  removePort: (port) =>
    set((state) => ({
      ports: state.ports.filter((p) => p.port !== port),
      selectedPort: state.selectedPort === port ? null : state.selectedPort
    })),

  updatePortDetail: (port, detail) =>
    set((state) => {
      const next = new Map(state.portDetails)
      next.set(port, detail)
      return { portDetails: next }
    }),

  setPopouts: (popouts) => set({ popouts: limitPortPopouts(popouts) }),

  updatePopouts: (updater) =>
    set((state) => ({
      popouts: limitPortPopouts(updater(state.popouts))
    })),

  resetPopoutSlice: () => set(createDefaultPopoutSliceState()),

  setPopoutSettings: (settings) =>
    set((state) => mergePopoutSettings(state, settings)),

  setPopoutTriggerEnabled: (trigger, enabled) =>
    set((state) => ({
      triggerEnabled: {
        ...state.triggerEnabled,
        [trigger]: enabled
      }
    })),

  setPopoutTiming: (timing) =>
    set((state) => ({
      hoverDelayMs: clampInteger(timing.hoverDelayMs, 200, 3000, state.hoverDelayMs),
      dragThresholdPx: clampInteger(timing.dragThresholdPx, 4, 32, state.dragThresholdPx)
    })),

  savePopoutLayoutPreset: (name, popouts) => {
    const normalizedName = normalizePopoutLayoutPresetName(name)
    if (!normalizedName) return false

    set((state) => ({
      layoutPresets: {
        ...state.layoutPresets,
        [normalizedName]: limitPortPopouts(popouts ?? state.popouts)
      }
    }))

    return true
  },

  applyPopoutLayoutPreset: (name) => {
    const normalizedName = normalizePopoutLayoutPresetName(name)
    const preset = get().layoutPresets[normalizedName]
    if (!preset) return false

    set({ popouts: limitPortPopouts(preset) })
    return true
  },

  deletePopoutLayoutPreset: (name) => {
    const normalizedName = normalizePopoutLayoutPresetName(name)
    if (!normalizedName) return

    set((state) => {
      const layoutPresets = { ...state.layoutPresets }
      delete layoutPresets[normalizedName]
      return { layoutPresets }
    })
  },

  getPortByNumber: (port) => {
    return get().ports.find((p) => p.port === port)
  },

  getCommonPorts: () => {
    return get().ports.filter((p) =>
      COMMON_DEV_PORTS.includes(p.port as typeof COMMON_DEV_PORTS[number])
    )
  },

  getActiveConflicts: () => {
    return get().conflicts.filter((c) => !c.resolved)
  },

  isPortInUse: (port) => {
    return get().ports.some((p) => p.port === port)
  },

  getPopoutById: (id) => {
    return get().popouts.find((popout) => popout.id === id)
  },

  getOpenPopoutCount: () => {
    return get().popouts.length
  }
}))
