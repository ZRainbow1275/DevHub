const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('splashBridge', {
  onProgress: (callback) => ipcRenderer.on('splash:progress', (_, data) => callback(data)),
  onFadeOut: (callback) => ipcRenderer.on('splash:fadeOut', () => callback())
})
