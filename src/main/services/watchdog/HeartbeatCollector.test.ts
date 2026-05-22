import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PortInfo, ProcessInfo, ServiceResult } from '@shared/types-extended'
import type { NativeWindowSnapshot, Win32WindowEnumeratorLike } from '../integrations/Win32WindowEnumerator'
import { WatchdogHeartbeatCollector, type WatchdogEtwProbe, type WatchdogHungWindowProbe, type WatchdogProcessSource } from './HeartbeatCollector'
import type { WatchdogInstance } from './WatchdogEngine'

function instance(overrides: Partial<WatchdogInstance> = {}): WatchdogInstance {
  return {
    instanceId: 'collector-instance',
    pid: 4242,
    alias: 'collector-alias',
    tool: 'codex',
    mode: 'lenient',
    perPhase: {
      receivingInputMs: 600000,
      thinkingMs: 300000,
      runningMs: 120000,
      awaitingHumanMs: 1800000
    },
    enabledSources: ['marker-file', 'stdout', 'cpu-pulse', 'window-title', 'http-health', 'fs-activity', 'hung-window', 'network', 'etw'],
    graceUntil: 0,
    state: 'healthy',
    consecutiveStuckCount: 0,
    lastHeartbeatAt: 0,
    lastAcceptedHeartbeatAt: 0,
    actionPolicy: 'restart',
    phase: 'running',
    createdAt: 0,
    ...overrides
  }
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address === 'object' && address?.port) resolve(address.port)
      else reject(new Error('server did not expose a TCP port'))
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise(resolve => server.close(() => resolve()))
}

describe('WatchdogHeartbeatCollector', () => {
  it('collects real local marker, filesystem, stdout, and localhost health beats', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-watchdog-collector-'))
    const markerPath = join(root, 'heartbeat.json')
    const activityPath = join(root, 'activity.log')
    await writeFile(markerPath, '{"ok":true}\n', 'utf8')
    await writeFile(activityPath, 'real activity\n', 'utf8')
    const server = createServer((_request, response) => {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        Connection: 'close'
      })
      response.end()
    })
    const port = await listen(server)
    try {
      const now = Date.now()
      const collector = new WatchdogHeartbeatCollector()
      const result = await collector.collect({
        now,
        instances: [instance({ enabledSources: ['marker-file', 'fs-activity', 'stdout', 'http-health'] })],
        sourceConfigByInstanceId: {
          'collector-instance': {
            markerFilePath: markerPath,
            fsActivityPaths: [activityPath],
            httpHealthUrl: `http://127.0.0.1:${port}/health`,
            lastStdoutAt: now - 100,
            stdoutBytes: 18,
            maxAgeMs: 120000
          }
        }
      })

      expect(result.failures).toEqual([])
      expect(result.beats.map(beat => beat.source).sort()).toEqual(['fs-activity', 'http-health', 'marker-file', 'stdout'])
      expect(result.sourceCountByInstance['collector-instance']).toBe(4)
      expect(result.beats.find(beat => beat.source === 'http-health')?.detail).toMatchObject({ status: 204 })
    } finally {
      await closeServer(server)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('maps process, network, window-title, hung-window, and ETW adapters into heartbeats', async () => {
    const processSource: WatchdogProcessSource = {
      async listProcesses(): Promise<ServiceResult<ProcessInfo[]>> {
        return {
          success: true,
          data: [{
            pid: 4242,
            name: 'codex.exe',
            command: 'codex exec',
            cpu: 12.5,
            memory: 96,
            status: 'running',
            startTime: 1700000000000,
            type: 'ai-tool'
          }]
        }
      },
      async listNetworkPorts(): Promise<ServiceResult<PortInfo[]>> {
        return {
          success: true,
          data: [{
            port: 17777,
            pid: 4242,
            processName: 'codex.exe',
            state: 'ESTABLISHED',
            protocol: 'TCP',
            localAddress: '127.0.0.1:17777',
            foreignAddress: '127.0.0.1:18888',
            source: 'systeminformation'
          }]
        }
      }
    }
    const windowSource: Win32WindowEnumeratorLike = {
      async enumerateVisibleWindows(): Promise<ServiceResult<NativeWindowSnapshot[]>> {
        return {
          success: true,
          data: [{
            hwnd: 1001,
            pid: 4242,
            title: 'Sensitive Project Title',
            className: 'ConsoleWindowClass',
            x: 0,
            y: 0,
            width: 640,
            height: 480,
            isMinimized: false
          }]
        }
      }
    }
    const hungWindowProbe: WatchdogHungWindowProbe = {
      async checkHungWindow(hwnd: number): Promise<ServiceResult<{ hwnd: number; hung: boolean }>> {
        return { success: true, data: { hwnd, hung: false } }
      }
    }
    const etwProbe: WatchdogEtwProbe = {
      async probe(): Promise<ServiceResult<{ available: boolean; provider: string; eventCount?: number }>> {
        return { success: true, data: { available: true, provider: 'Microsoft-Windows-Kernel-Process', eventCount: 3 } }
      }
    }
    const collector = new WatchdogHeartbeatCollector({ processSource, windowSource, hungWindowProbe, etwProbe })
    const result = await collector.collect({ now: 1800000000000, instances: [instance()] })

    expect(result.failures).toEqual([])
    expect(result.beats.map(beat => beat.source).sort()).toEqual(['cpu-pulse', 'etw', 'hung-window', 'network', 'window-title'])
    expect(result.beats.find(beat => beat.source === 'window-title')?.detail).toMatchObject({
      hwnd: 1001,
      titleLength: 'Sensitive Project Title'.length,
      className: 'ConsoleWindowClass'
    })
    expect(result.beats.find(beat => beat.source === 'window-title')?.detail).not.toHaveProperty('title')
  })

  it('records truthful degraded source failures without fabricating heartbeats', async () => {
    const processSource: WatchdogProcessSource = {
      async listProcesses(): Promise<ServiceResult<ProcessInfo[]>> {
        return { success: false, error: 'SYSTEMINFORMATION_UNAVAILABLE' }
      },
      async listNetworkPorts(): Promise<ServiceResult<PortInfo[]>> {
        return { success: false, error: 'NETWORK_UNAVAILABLE' }
      }
    }
    const windowSource: Win32WindowEnumeratorLike = {
      async enumerateVisibleWindows(): Promise<ServiceResult<NativeWindowSnapshot[]>> {
        return { success: false, error: 'KOFFI_UNAVAILABLE' }
      }
    }
    const collector = new WatchdogHeartbeatCollector({ processSource, windowSource })
    const result = await collector.collect({ now: 1800000000000, instances: [instance()] })

    expect(result.beats).toEqual([])
    expect(result.failures.map(failure => failure.source).sort()).toEqual(['cpu-pulse', 'etw', 'hung-window', 'network', 'window-title'])
    expect(result.failures.every(failure => failure.instanceId === 'collector-instance')).toBe(true)
  })
})
