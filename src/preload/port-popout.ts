import { contextBridge, ipcRenderer } from 'electron'
import type {
  BrowserPopout,
  PopoutBridgeMessage,
  PopoutScreenEvent
} from '../shared/schemas/r8-runtime'

const portPopoutApi = {
  r8: {
    popout: {
      close: (windowId: string): Promise<{ success: boolean; windowId: string }> => ipcRenderer.invoke('popout:close', { windowId }),
      list: (): Promise<BrowserPopout[]> => ipcRenderer.invoke('popout:list'),
      bridgeMessage: (message: PopoutBridgeMessage) => ipcRenderer.invoke('popout:bridge-message', message),
      onBridgeMessage: (callback: (message: PopoutBridgeMessage) => void) => {
        const handler = (_: unknown, message: PopoutBridgeMessage) => callback(message)
        ipcRenderer.on('popout:bridge-message', handler)
        return () => ipcRenderer.removeListener('popout:bridge-message', handler)
      },
      onScreenEvent: (callback: (event: PopoutScreenEvent) => void) => {
        const handler = (_: unknown, event: PopoutScreenEvent) => callback(event)
        ipcRenderer.on('popout:screen-event', handler)
        return () => ipcRenderer.removeListener('popout:screen-event', handler)
      },
      pin: (windowId: string, pinned: boolean) => ipcRenderer.invoke('popout:pin', { windowId, pinned }),
      demote: (windowId: string) => ipcRenderer.invoke('popout:demote', { windowId })
    }
  }
}

contextBridge.exposeInMainWorld('devhub', portPopoutApi)
