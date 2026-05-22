import { contextBridge, ipcRenderer } from 'electron'
import type {
  MonitorPopout,
  MonitorPopoutLayout,
  MonitorSnapshot,
  MonitorTool,
  MonitorWindowState,
  ToolMonitorCard
} from '@shared/schemas/r8-runtime'

const monitorApi = {
  close: () => ipcRenderer.invoke('monitor:close'),
  snapshot: (): Promise<MonitorSnapshot> => ipcRenderer.invoke('monitor:snapshot'),
  setWindowPrefs: (input: { alwaysOnTop?: boolean; opacity?: number; bounds?: MonitorWindowState['bounds']; confirmedBy?: string }) =>
    ipcRenderer.invoke('monitor:set-window-prefs', input),
  focusInstance: (tool: MonitorTool, instanceId: string) => ipcRenderer.invoke('monitor:focus-instance', { tool, instanceId }),
  openPopout: (tool: MonitorTool, layout?: MonitorPopoutLayout): Promise<{ success: boolean; popoutId: string; popout: MonitorPopout }> =>
    ipcRenderer.invoke('monitor:popout-open', { tool, layout }),
  closePopout: (popoutId: string) => ipcRenderer.invoke('monitor:popout-close', { popoutId }),
  listPopouts: (): Promise<MonitorPopout[]> => ipcRenderer.invoke('monitor:popout-list'),
  returnPopoutToMain: (popoutId: string) => ipcRenderer.invoke('monitor:popout-return-to-main', { popoutId }),
  setPopoutLayout: (popoutId: string, layout: MonitorPopoutLayout): Promise<{ success: boolean; popoutId: string; layout: MonitorPopoutLayout; popout: MonitorPopout; updatedAt: number }> =>
    ipcRenderer.invoke('monitor:popout-set-layout', { popoutId, layout }),
  onSnapshotStream: (callback: (snapshot: MonitorSnapshot) => void) => {
    const handler = (_: unknown, snapshot: MonitorSnapshot) => callback(snapshot)
    ipcRenderer.on('monitor:snapshot-stream', handler)
    return () => ipcRenderer.removeListener('monitor:snapshot-stream', handler)
  },
  onPopoutSnapshotStream: (callback: (card: ToolMonitorCard) => void) => {
    const handler = (_: unknown, card: ToolMonitorCard) => callback(card)
    ipcRenderer.on('monitor:popout-snapshot-stream', handler)
    return () => ipcRenderer.removeListener('monitor:popout-snapshot-stream', handler)
  }
}

contextBridge.exposeInMainWorld('devhub', {
  r8: {
    monitor: monitorApi
  }
})
