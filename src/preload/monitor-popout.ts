import { contextBridge, ipcRenderer } from 'electron'
import type {
  MonitorPopout,
  MonitorPopoutLayout,
  MonitorSnapshot,
  MonitorTool,
  ToolMonitorCard
} from '@shared/schemas/r8-runtime'

const monitorPopoutApi = {
  snapshot: (): Promise<MonitorSnapshot> => ipcRenderer.invoke('monitor:snapshot'),
  focusInstance: (tool: MonitorTool, instanceId: string) => ipcRenderer.invoke('monitor:focus-instance', { tool, instanceId }),
  closePopout: (popoutId: string) => ipcRenderer.invoke('monitor:popout-close', { popoutId }),
  listPopouts: (): Promise<MonitorPopout[]> => ipcRenderer.invoke('monitor:popout-list'),
  returnPopoutToMain: (popoutId: string) => ipcRenderer.invoke('monitor:popout-return-to-main', { popoutId }),
  setPopoutLayout: (popoutId: string, layout: MonitorPopoutLayout): Promise<{ success: boolean; popoutId: string; layout: MonitorPopoutLayout; popout: MonitorPopout; updatedAt: number }> =>
    ipcRenderer.invoke('monitor:popout-set-layout', { popoutId, layout }),
  onPopoutSnapshotStream: (callback: (card: ToolMonitorCard) => void) => {
    const handler = (_: unknown, card: ToolMonitorCard) => callback(card)
    ipcRenderer.on('monitor:popout-snapshot-stream', handler)
    return () => ipcRenderer.removeListener('monitor:popout-snapshot-stream', handler)
  }
}

contextBridge.exposeInMainWorld('devhub', {
  r8: {
    monitor: monitorPopoutApi
  }
})
