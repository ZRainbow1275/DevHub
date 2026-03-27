import { app, BrowserWindow, shell, Notification, Tray, Menu, nativeImage, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, cleanupIpcHandlers } from './ipc'
import { AppStore } from './store/AppStore'
import { ProcessManager } from './services/ProcessManager'
import { ToolMonitor } from './services/ToolMonitor'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Initialize services
const appStore = new AppStore()
const processManager = new ProcessManager()
const toolMonitor = new ToolMonitor()

function createWindow(): void {
  const preloadPath = join(__dirname, '../preload/index.cjs')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false, // Custom title bar
    backgroundColor: '#1A1A1A',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Invalid URL, ignore
    }
    return { action: 'deny' }
  })

  // Prevent navigation to untrusted origins
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow dev server in development
    if (is.dev && (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'))) {
      return
    }
    // Allow file:// for production
    if (url.startsWith('file://')) {
      return
    }
    event.preventDefault()
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口关闭行为 - 直接关闭，不最小化到托盘
  mainWindow.on('close', () => {
    // 正常关闭窗口，不阻止
  })
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 DevHub',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('DevHub - 开发项目管理器')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// App lifecycle
app.whenReady().then(() => {
  // Set app user model id for windows notifications
  electronApp.setAppUserModelId('com.devhub.app')

  // Optimize shortcuts
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Set Content Security Policy headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
        ]
      }
    })
  })

  createWindow()

  // Only create tray if minimizeToTray is enabled
  const settings = appStore.getSettings()
  if (settings.minimizeToTray) {
    createTray()
  }

  // Register IPC handlers AFTER window is created
  registerIpcHandlers(appStore, processManager, toolMonitor, () => mainWindow)
  if (settings.notificationEnabled) {
    toolMonitor.start(appStore.getTools(), settings.checkInterval, (tool) => {
      // Send notification
      new Notification({
        title: 'DevHub',
        body: `${tool.displayName} 任务已完成`,
        icon: join(__dirname, '../../resources/icon.png')
      }).show()

      // Notify renderer
      mainWindow?.webContents.send('tool:complete', tool)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up on quit
let isQuitting = false
app.on('before-quit', (event) => {
  if (isQuitting) return
  isQuitting = true
  event.preventDefault()
  Promise.all([
    processManager.stopAll()
  ]).finally(() => {
    toolMonitor.stop()
    cleanupIpcHandlers()
    app.exit(0)
  })
})
