import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { resetRateLimits } from '../utils/rateLimiter'

const { ipcMainMock } = vi.hoisted(() => ({
  ipcMainMock: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn()
  }
}))

vi.mock('electron', () => ({
  ipcMain: ipcMainMock
}))

import { cleanupScannerHandlers, setupScannerHandlers } from './scannerHandlers'

describe('scannerHandlers', () => {
  beforeEach(() => {
    cleanupScannerHandlers()
    vi.clearAllMocks()
    resetRateLimits()
  })

  it('pushes snapshot payload with channel seq baselines on subscribe', () => {
    const snapshot = {
      processes: { data: [], lastUpdated: 0, isScanning: false, error: null },
      ports: { data: [], lastUpdated: 0, isScanning: false, error: null },
      windows: { data: [], lastUpdated: 0, isScanning: false, error: null },
      aiTasks: { data: [], lastUpdated: 0, isScanning: false, error: null },
      systemSummary: {
        processCount: 0,
        activePortCount: 0,
        windowCount: 0,
        aiToolCount: 0,
        cpuTotal: 0,
        memoryUsedPercent: 0
      }
    }
    const prepareChannelsForSnapshot = vi.fn()
    const manager = {
      getCache: () => ({ getSnapshot: () => snapshot }),
      getChannelSeqSnapshot: () => ({
        'scanner:processes:diff': 4
      }),
      prepareChannelsForSnapshot,
      ackChannelSeq: vi.fn(() => ({
        accepted: true,
        channel: 'scanner:processes:diff',
        ackedSeq: 4,
        lastSentSeq: 4,
        pendingSeq: null
      })),
      retryScanner: vi.fn(),
      isActive: vi.fn(() => true)
    } as never

    setupScannerHandlers({} as BrowserWindow, manager)

    const subscribeHandler = ipcMainMock.on.mock.calls.find(([channel]) => channel === 'scanner:subscribe')?.[1]
    expect(subscribeHandler).toBeTypeOf('function')

    const send = vi.fn()
    subscribeHandler({
      sender: {
        isDestroyed: () => false,
        send,
        on: vi.fn()
      }
    })

    expect(send).toHaveBeenCalledWith('scanner:snapshot:push', {
      snapshot,
      channelSeqs: {
        'scanner:processes:diff': 4
      }
    })
    expect(prepareChannelsForSnapshot).toHaveBeenCalledWith({
      'scanner:processes:diff': 4
    })
  })

  it('handles ipc:request-resync by pushing a fresh snapshot', () => {
    const snapshot = {
      processes: { data: [], lastUpdated: 1, isScanning: false, error: null },
      ports: { data: [], lastUpdated: 1, isScanning: false, error: null },
      windows: { data: [], lastUpdated: 1, isScanning: false, error: null },
      aiTasks: { data: [], lastUpdated: 1, isScanning: false, error: null },
      systemSummary: {
        processCount: 0,
        activePortCount: 0,
        windowCount: 0,
        aiToolCount: 0,
        cpuTotal: 0,
        memoryUsedPercent: 0
      }
    }
    const prepareChannelsForSnapshot = vi.fn()
    const manager = {
      getCache: () => ({ getSnapshot: () => snapshot }),
      getChannelSeqSnapshot: () => ({
        'scanner:processes:diff': 7
      }),
      prepareChannelsForSnapshot,
      ackChannelSeq: vi.fn(() => ({
        accepted: true,
        channel: 'scanner:processes:diff',
        ackedSeq: 7,
        lastSentSeq: 7,
        pendingSeq: null
      })),
      retryScanner: vi.fn(),
      isActive: vi.fn(() => true)
    } as never

    setupScannerHandlers({} as BrowserWindow, manager)

    const requestResyncHandler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'ipc:request-resync')?.[1]
    expect(requestResyncHandler).toBeTypeOf('function')

    const send = vi.fn()
    const result = requestResyncHandler(
      {
        sender: {
          isDestroyed: () => false,
          send
        }
      },
      'scanner:processes:diff'
    )

    expect(result).toEqual({
      accepted: true,
      channel: 'scanner:processes:diff',
      snapshotPushed: true
    })
    expect(send).toHaveBeenCalledWith('scanner:snapshot:push', {
      snapshot,
      channelSeqs: {
        'scanner:processes:diff': 7
      }
    })
    expect(prepareChannelsForSnapshot).toHaveBeenCalledWith({
      'scanner:processes:diff': 7
    })
  })

  it('handles ipc:ack-seq by delegating renderer acknowledgements to the scanner manager', () => {
    const ackChannelSeq = vi.fn(() => ({
      accepted: true,
      channel: 'scanner:processes:diff',
      ackedSeq: 11,
      lastSentSeq: 11,
      pendingSeq: null
    }))
    const manager = {
      getCache: () => ({ getSnapshot: () => null }),
      getChannelSeqSnapshot: () => ({}),
      prepareChannelsForSnapshot: vi.fn(),
      ackChannelSeq,
      retryScanner: vi.fn(),
      isActive: vi.fn(() => true)
    } as never

    setupScannerHandlers({} as BrowserWindow, manager)

    const ackHandler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'ipc:ack-seq')?.[1]
    expect(ackHandler).toBeTypeOf('function')

    const result = ackHandler({ sender: { isDestroyed: () => false } }, {
      channel: 'scanner:processes:diff',
      seq: 11,
      source: 'diff'
    })

    expect(ackChannelSeq).toHaveBeenCalledWith('scanner:processes:diff', 11)
    expect(result).toEqual({
      accepted: true,
      channel: 'scanner:processes:diff',
      ackedSeq: 11,
      lastSentSeq: 11,
      pendingSeq: null
    })
  })

  it('handles batched ipc:ack-seq requests with one handler invocation', () => {
    const ackChannelSeq = vi.fn((channel: string, seq: number) => ({
      accepted: true,
      channel,
      ackedSeq: seq,
      lastSentSeq: seq,
      pendingSeq: null
    }))
    const manager = {
      getCache: () => ({ getSnapshot: () => null }),
      getChannelSeqSnapshot: () => ({}),
      prepareChannelsForSnapshot: vi.fn(),
      ackChannelSeq,
      retryScanner: vi.fn(),
      isActive: vi.fn(() => true)
    } as never

    setupScannerHandlers({} as BrowserWindow, manager)

    const ackHandler = ipcMainMock.handle.mock.calls.find(([channel]) => channel === 'ipc:ack-seq')?.[1]
    expect(ackHandler).toBeTypeOf('function')

    const result = ackHandler({ sender: { isDestroyed: () => false } }, [
      { channel: 'scanner:processes:diff', seq: 11, source: 'diff' },
      { channel: 'scanner:windows:diff', seq: 3, source: 'snapshot' }
    ])

    expect(ackChannelSeq).toHaveBeenCalledTimes(2)
    expect(ackChannelSeq).toHaveBeenNthCalledWith(1, 'scanner:processes:diff', 11)
    expect(ackChannelSeq).toHaveBeenNthCalledWith(2, 'scanner:windows:diff', 3)
    expect(result).toEqual([
      {
        accepted: true,
        channel: 'scanner:processes:diff',
        ackedSeq: 11,
        lastSentSeq: 11,
        pendingSeq: null
      },
      {
        accepted: true,
        channel: 'scanner:windows:diff',
        ackedSeq: 3,
        lastSentSeq: 3,
        pendingSeq: null
      }
    ])
  })
})
