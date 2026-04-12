import { app, BrowserWindow, shell, Tray, Menu, nativeImage, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, cleanupIpcHandlers } from './ipc'
import { AppStore } from './store/AppStore'
import { ProcessManager } from './services/ProcessManager'
import { ToolMonitor } from './services/ToolMonitor'
import { ProjectScanner } from './services/ProjectScanner'
import { getNotificationService } from './services/NotificationService'
import { BackgroundScannerManager } from './services/BackgroundScannerManager'
import { ScannerCache } from './services/ScannerCache'
import { SystemProcessScanner } from './services/SystemProcessScanner'
import { PortScanner } from './services/PortScanner'
import { WindowManager as WindowManagerService } from './services/WindowManager'
import { AITaskTracker } from './services/AITaskTracker'
import { AIAliasManager } from './services/AIAliasManager'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 单实例锁：防止启动多个窗口
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// Initialize services
const appStore = new AppStore()
const processManager = new ProcessManager()
const toolMonitor = new ToolMonitor()

// Initialize background scanner infrastructure
const scannerCache = new ScannerCache()
const scannerPortScanner = new PortScanner()
const scannerProcessScanner = new SystemProcessScanner(scannerPortScanner)
const scannerWindowManager = new WindowManagerService()
const scannerAliasManager = new AIAliasManager()
const scannerAITaskTracker = new AITaskTracker(scannerProcessScanner, scannerAliasManager)

const scannerManager = new BackgroundScannerManager(scannerCache)
scannerManager.setScanners({
  processScanner: scannerProcessScanner,
  portScanner: scannerPortScanner,
  windowManager: scannerWindowManager,
  aiTaskTracker: scannerAITaskTracker
})

// ============ Splash Window ============

function sendSplashProgress(percent: number, text: string): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:progress', { percent, text })
  }
}

function createSplashWindow(): void {
  const splashPreloadPath = join(__dirname, '../../resources/splash-preload.js')
  const splashHtmlPath = join(__dirname, '../../resources/splash.html')

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: splashPreloadPath
    }
  })

  splashWindow.loadFile(splashHtmlPath)
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })
}

function closeSplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:fadeOut')
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy()
      }
      splashWindow = null
    }, 250)
  }
}

// ============ Main Window ============

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

  // Note: show is handled by the splash→main transition in app.whenReady()
  // mainWindow.show() is called after splash closes

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
    const currentSettings = appStore.getSettings()
    if (currentSettings.window.saveLayoutOnExit && !mainWindow!.isMinimized()) {
      const bounds = mainWindow!.getBounds()
      // Persist bounds so next launch can restore window position/size
      appStore.saveBounds(bounds)
    }
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

// 第二实例尝试启动时聚焦已有窗口
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// App lifecycle
app.whenReady().then(async () => {
  // Set app user model id for windows notifications
  electronApp.setAppUserModelId('com.devhub.app')

  // Stage 1: Show splash immediately
  createSplashWindow()
  sendSplashProgress(10, 'Initializing application...')

  // Optimize shortcuts
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Set Content Security Policy headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = is.dev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // Stage 2: Load configuration
  sendSplashProgress(25, 'Loading configuration...')
  const settings = appStore.getSettings()

  // Stage 3: Create main window (hidden) and init scanners
  sendSplashProgress(40, 'Starting scan engine...')
  createWindow()

  // Only create tray if minimizeToTray is enabled
  if (settings.advanced.minimizeToTray) {
    createTray()
  }

  // Register IPC handlers AFTER window is created
  scannerManager.setMainWindowGetter(() => mainWindow)
  registerIpcHandlers(appStore, processManager, toolMonitor, () => mainWindow, scannerManager)

  // Wire up splash progress reporting from scanner manager (MUST be before startAll)
  scannerManager.onProgress((_stage: string, percent: number, text: string) => {
    sendSplashProgress(percent, text)
  })

  // Start background scanners (non-blocking) — onProgress registered above before this call
  scannerManager.startAll().catch((err) => {
    console.error('Failed to start background scanners:', err)
  })

  // Stage 7: Wait for main window ready-to-show, then transition
  mainWindow?.once('ready-to-show', () => {
    sendSplashProgress(100, 'Ready')
    // Small delay so the user sees "Ready" before transition
    setTimeout(() => {
      closeSplashWindow()
      mainWindow?.show()
    }, 300)
  })

  // Auto-discover projects on first launch
  if (appStore.getProjects().length === 0 && !settings.firstLaunchDone) {
    const projectScanner = new ProjectScanner()
    mainWindow!.webContents.once('did-finish-load', () => {
      // 延迟发送，确保 React useEffect listener 已挂载
      setTimeout(() => {
        projectScanner.scanCommonLocations(settings.scan.scanDrives).then((results) => {
          if (results.length > 0 && mainWindow) {
            mainWindow.webContents.send('projects:auto-discovered', results)
          }
          appStore.updateSettings({ firstLaunchDone: true })
        }).catch((err) => {
          console.error('Auto-discovery failed:', err)
          appStore.updateSettings({ firstLaunchDone: true })
        })
      }, 1000)
    })
  }

  if (settings.notification.enabled) {
    toolMonitor.start(appStore.getTools(), settings.scan.checkInterval, (tool) => {
      // 通过 NotificationService 发送通知（自动去重，与 AITaskTracker 协调）
      const notificationService = getNotificationService()
      notificationService.notify(
        'task-complete',
        'DevHub',
        `${tool.displayName} 任务已完成`,
        {
          icon: join(__dirname, '../../resources/icon.png'),
          dedupKey: `task-complete:${tool.displayName}`
        }
      )

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

  // 关键：先停止 toolMonitor 和 background scanners，
  // 避免 processManager.stopAll() 终止进程时被误判为"任务正常完成"
  toolMonitor.stop()
  scannerManager.stopAll()
  scannerAITaskTracker.cleanup()
  scannerWindowManager.cleanup()

  Promise.all([
    processManager.stopAll(),
    cleanupIpcHandlers()
  ]).finally(() => {
    app.exit(0)
  })
})
