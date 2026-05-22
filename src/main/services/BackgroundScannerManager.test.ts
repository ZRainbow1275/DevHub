import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { AITask, IPCEnvelope, ProcessInfo, ScannerDiff } from '@shared/types-extended'
import { BackgroundScannerManager } from './BackgroundScannerManager'
import { ScannerCache } from './ScannerCache'
import type { AITaskTracker } from './AITaskTracker'
import type { SystemProcessScanner } from './SystemProcessScanner'

const PROCESS_DIFF_CHANNEL = 'scanner:processes:diff' as const

interface BackgroundScannerManagerInternals {
  dispatchDiffEnvelope: (
    channel: typeof PROCESS_DIFF_CHANNEL,
    envelope: IPCEnvelope<ScannerDiff<ProcessInfo>>
  ) => void
  scanAITasks: () => Promise<void>
  setupCacheEventForwarding: () => void
}

function createManagerHarness() {
  const cache = new ScannerCache()
  const manager = new BackgroundScannerManager(cache)
  const send = vi.fn()
  const fakeWindow = {
    isDestroyed: () => false,
    webContents: { send }
  } as unknown as BrowserWindow

  manager.setMainWindowGetter(() => fakeWindow)
  ;(manager as unknown as BackgroundScannerManagerInternals).setupCacheEventForwarding()

  return {
    cache,
    manager,
    send,
    internals: manager as unknown as BackgroundScannerManagerInternals
  }
}

function createProcessEnvelope(seq: number): IPCEnvelope<ScannerDiff<ProcessInfo>> {
  return {
    channel: PROCESS_DIFF_CHANNEL,
    seq,
    timestamp: seq * 1_000,
    batch: false,
    partial: true,
    payload: {
      hasChanges: true,
      added: [{ pid: seq, cpu: 1, memory: 10 } as ProcessInfo],
      removed: [],
      updated: []
    }
  }
}

describe('BackgroundScannerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('refreshes the process scanner before AI task detection and syncs cache', async () => {
    const { cache, manager, internals } = createManagerHarness()
    const staleProcess = { pid: 1, cpu: 1, memory: 10 } as ProcessInfo
    const freshProcess = {
      pid: 2,
      name: 'claude.exe',
      command: 'claude -p --name p4-active',
      cpu: 3,
      memory: 64,
      startTime: Date.now(),
      type: 'ai-tool',
      status: 'running',
      workingDir: 'D:/Desktop/CREATOR ONE/devhub'
    } as ProcessInfo
    const activeTask = {
      id: 'alias:p4-active',
      pid: freshProcess.pid,
      toolType: 'claude-code'
    } as AITask
    const processScanner = {
      getAll: vi.fn().mockResolvedValue([freshProcess])
    } as unknown as SystemProcessScanner
    const aiTaskTracker = {
      scanForAITasks: vi.fn().mockResolvedValue([activeTask]),
      getActiveTasks: vi.fn().mockReturnValue([activeTask])
    } as unknown as AITaskTracker

    cache.updateProcesses([staleProcess])
    manager.setScanners({ processScanner, aiTaskTracker })

    await internals.scanAITasks()

    expect(processScanner.getAll).toHaveBeenCalledWith({ refresh: true })
    expect(aiTaskTracker.scanForAITasks).toHaveBeenCalledWith([freshProcess], [])
    expect(cache.getProcesses()).toEqual([freshProcess])
    expect(cache.getAITasks()).toEqual([activeTask])
  })

  it('batches process diff broadcasts before sending them to the renderer', async () => {
    const { cache, manager, send } = createManagerHarness()

    cache.updateProcesses([{ pid: 1, cpu: 1, memory: 10 } as ProcessInfo])
    cache.updateProcesses([{ pid: 1, cpu: 2, memory: 10 } as ProcessInfo])

    const processDiffCallsBeforeFlush = send.mock.calls.filter(
      (call) => call[0] === PROCESS_DIFF_CHANNEL
    )
    expect(processDiffCallsBeforeFlush).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(200)

    const processDiffCalls = send.mock.calls.filter(
      (call) => call[0] === PROCESS_DIFF_CHANNEL
    )
    expect(processDiffCalls).toHaveLength(1)

    const envelope = processDiffCalls[0][1] as IPCEnvelope<ScannerDiff<ProcessInfo>[]>
    expect(envelope.channel).toBe(PROCESS_DIFF_CHANNEL)
    expect(envelope.batch).toBe(true)
    expect(envelope.partial).toBe(true)
    expect(Array.isArray(envelope.payload)).toBe(true)
    expect(envelope.payload).toHaveLength(2)
    expect(manager.getChannelSeqSnapshot()).toEqual({
      [PROCESS_DIFF_CHANNEL]: 1
    })
  })

  it('tracks renderer acknowledgements for diff envelopes', async () => {
    const { cache, manager } = createManagerHarness()

    cache.updateProcesses([{ pid: 1, cpu: 1, memory: 10 } as ProcessInfo])
    await vi.advanceTimersByTimeAsync(200)

    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        droppedEnvelopes: 0,
        lastSentSeq: 1,
        lastAckedSeq: null,
        pendingSeq: 1,
        queuedEnvelopes: 0,
        suspended: false,
        timedOut: false,
        timeoutCount: 0
      })
    ])

    expect(manager.ackChannelSeq(PROCESS_DIFF_CHANNEL, 1)).toEqual({
      accepted: true,
      channel: PROCESS_DIFF_CHANNEL,
      ackedSeq: 1,
      lastSentSeq: 1,
      pendingSeq: null
    })

    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        lastSentSeq: 1,
        lastAckedSeq: 1,
        pendingSeq: null,
        queuedEnvelopes: 0,
        timedOut: false
      })
    ])
  })

  it('marks scanner diff channels as timed out when renderer acks do not arrive', async () => {
    const { cache, manager } = createManagerHarness()

    cache.updateProcesses([{ pid: 1, cpu: 1, memory: 10 } as ProcessInfo])
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        pendingSeq: 1,
        queuedEnvelopes: 0,
        suspended: false,
        timedOut: true,
        timeoutCount: 1
      })
    ])
  })

  it('queues newer envelopes behind the current pending ack without postponing timeout', async () => {
    const { cache, manager, send } = createManagerHarness()

    cache.updateProcesses([{ pid: 1, cpu: 1, memory: 10 } as ProcessInfo])
    await vi.advanceTimersByTimeAsync(200)

    await vi.advanceTimersByTimeAsync(9_000)
    cache.updateProcesses([{ pid: 2, cpu: 1, memory: 10 } as ProcessInfo])
    await vi.advanceTimersByTimeAsync(200)

    await vi.advanceTimersByTimeAsync(800)

    const processDiffCalls = send.mock.calls.filter(
      (call) => call[0] === PROCESS_DIFF_CHANNEL
    )
    expect(processDiffCalls).toHaveLength(1)

    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        pendingSeq: 1,
        lastSentSeq: 1,
        queuedEnvelopes: 1,
        timedOut: true,
        timeoutCount: 1
      })
    ])
  })

  it('drops the oldest queued envelope once the diff queue reaches capacity and marks the next delivery as truncated', () => {
    const { manager, send, internals } = createManagerHarness()

    internals.dispatchDiffEnvelope(PROCESS_DIFF_CHANNEL, createProcessEnvelope(1))
    for (let seq = 2; seq <= 258; seq += 1) {
      internals.dispatchDiffEnvelope(PROCESS_DIFF_CHANNEL, createProcessEnvelope(seq))
    }

    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        pendingSeq: 1,
        queuedEnvelopes: 256,
        droppedEnvelopes: 1
      })
    ])

    expect(send.mock.calls.filter((call) => call[0] === PROCESS_DIFF_CHANNEL)).toHaveLength(1)

    expect(manager.ackChannelSeq(PROCESS_DIFF_CHANNEL, 1)).toEqual({
      accepted: true,
      channel: PROCESS_DIFF_CHANNEL,
      ackedSeq: 1,
      lastSentSeq: 3,
      pendingSeq: 3
    })

    const processDiffCalls = send.mock.calls.filter(
      (call) => call[0] === PROCESS_DIFF_CHANNEL
    )
    expect(processDiffCalls).toHaveLength(2)

    const flushedEnvelope = processDiffCalls[1][1] as IPCEnvelope<ScannerDiff<ProcessInfo>>
    expect(flushedEnvelope.seq).toBe(3)
    expect(flushedEnvelope.meta).toEqual({
      causedBy: 'backpressure-drop-oldest',
      truncated: true
    })
  })

  it('suspends a channel after three consecutive ack timeouts and resets it through snapshot preparation', async () => {
    const { manager, send, internals } = createManagerHarness()

    internals.dispatchDiffEnvelope(PROCESS_DIFF_CHANNEL, createProcessEnvelope(1))
    internals.dispatchDiffEnvelope(PROCESS_DIFF_CHANNEL, createProcessEnvelope(2))

    await vi.advanceTimersByTimeAsync(30_000)

    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        pendingSeq: 1,
        queuedEnvelopes: 1,
        suspended: true,
        timeoutCount: 3
      })
    ])

    manager.prepareChannelsForSnapshot({
      [PROCESS_DIFF_CHANNEL]: 1
    })

    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        pendingSeq: 1,
        queuedEnvelopes: 0,
        suspended: false,
        timedOut: false
      })
    ])

    expect(manager.ackChannelSeq(PROCESS_DIFF_CHANNEL, 1)).toEqual({
      accepted: true,
      channel: PROCESS_DIFF_CHANNEL,
      ackedSeq: 1,
      lastSentSeq: 1,
      pendingSeq: null
    })

    internals.dispatchDiffEnvelope(PROCESS_DIFF_CHANNEL, createProcessEnvelope(3))

    const processDiffCalls = send.mock.calls.filter(
      (call) => call[0] === PROCESS_DIFF_CHANNEL
    )
    expect(processDiffCalls).toHaveLength(2)

    const resumedEnvelope = processDiffCalls[1][1] as IPCEnvelope<ScannerDiff<ProcessInfo>>
    expect(resumedEnvelope.seq).toBe(3)
    expect(manager.getChannelAckSnapshot()).toEqual([
      expect.objectContaining({
        channel: PROCESS_DIFF_CHANNEL,
        pendingSeq: 3,
        queuedEnvelopes: 0,
        suspended: false
      })
    ])
  })
})
