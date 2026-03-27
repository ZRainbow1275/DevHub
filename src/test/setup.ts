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

// Mock electron modules
vi.mock('electron', () => ({
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
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    hideToTray: vi.fn(),
    forceClose: vi.fn(),
    onCloseConfirm: vi.fn()
  }
}

Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    devhub: mockDevhub
  },
  writable: true
})
