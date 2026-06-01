import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup after each test for React 18
afterEach(() => {
  cleanup()
})

// Fix for React 18 + jsdom compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// Mock ResizeObserver (not available in jsdom)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock

// Mock IntersectionObserver (not available in jsdom)
class IntersectionObserverMock {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.IntersectionObserver = IntersectionObserverMock as any

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class BrowserWindowMock {
  static instances: BrowserWindowMock[] = []
  readonly webContents = {
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    send: vi.fn()
  }

  private destroyed = false
  private readonly onceHandlers = new Map<string, () => void>()
  readonly options: unknown
  readonly show = vi.fn()
  readonly focus = vi.fn()
  readonly setAlwaysOnTop = vi.fn()
  readonly setOpacity = vi.fn()
  readonly setBounds = vi.fn()
  readonly loadURL = vi.fn(async () => undefined)
  readonly loadFile = vi.fn(async () => undefined)

  constructor(options: unknown) {
    this.options = options
    BrowserWindowMock.instances.push(this)
  }

  once(event: string, handler: () => void) {
    this.onceHandlers.set(event, handler)
    if (event === 'ready-to-show') queueMicrotask(handler)
    return this
  }

  close() {
    this.destroyed = true
    this.onceHandlers.get('closed')?.()
  }

  isDestroyed() {
    return this.destroyed
  }
}

// Mock electron modules
const createSessionMock = (partition: string) => ({
  partition,
  webRequest: {
    onHeadersReceived: vi.fn()
  }
})

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => process.cwd()),
    isDefaultProtocolClient: vi.fn(() => false),
    removeAsDefaultProtocolClient: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(() => true)
  },
  BrowserWindow: BrowserWindowMock,
  session: {
    fromPartition: vi.fn(createSessionMock),
    defaultSession: {
      webRequest: {
        onHeadersReceived: vi.fn()
      }
    }
  },
  screen: {
    getAllDisplays: vi.fn(() => [
      { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
      { id: 2, workArea: { x: 1920, y: 0, width: 1920, height: 1080 } }
    ])
  },
  shell: {
    openExternal: vi.fn()
  },
  clipboard: {
    writeText: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((plainText: string) => Buffer.from(`encrypted:${plainText}`, 'utf8')),
    decryptString: vi.fn((encrypted: Buffer) => encrypted.toString('utf8').replace(/^encrypted:/, ''))
  },
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  }
}))

// Mock window.devhub API
const mockDevhub = {
  projects: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    scan: vi.fn(),
    scanDirectory: vi.fn(),
    discover: vi.fn()
  },
  process: {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(),
    onStatusChange: vi.fn()
  },
  logs: {
    subscribe: vi.fn(),
    onEntry: vi.fn(),
    clear: vi.fn()
  },
  scanner: {
    subscribe: vi.fn(),
    getSnapshot: vi.fn(),
    getStatus: vi.fn(),
    retryScanner: vi.fn(),
    requestResync: vi.fn(),
    onProcessesDiff: vi.fn(),
    onPortsDiff: vi.fn(),
    onWindowsDiff: vi.fn(),
    onAiTasksDiff: vi.fn(),
    onSummaryUpdate: vi.fn(),
    onSnapshotPush: vi.fn(),
    onScannerFailed: vi.fn()
  },
  topology: {
    buildScopedGraph: vi.fn(),
    buildScopedFlow: vi.fn(),
    warmScope: vi.fn()
  },
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    hideToTray: vi.fn(),
    forceClose: vi.fn(),
    onCloseConfirm: vi.fn()
  },
  devObs: {
    getRuntimeMetrics: vi.fn(),
    getThrottleReport: vi.fn(),
    resetMetrics: vi.fn(),
    exportDiagnosticBundle: vi.fn()
  }
}

Object.defineProperty(window, 'devhub', {
  value: mockDevhub,
  writable: true,
  configurable: true
})
