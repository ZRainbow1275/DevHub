import { createHash } from 'node:crypto'
import { stat as statFile } from 'node:fs/promises'
import type { ServiceResult, PortInfo, ProcessInfo } from '@shared/types-extended'
import { SystemInformationAdapter } from '../integrations/SystemInformationAdapter'
import { Win32WindowEnumerator, type NativeWindowSnapshot, type Win32WindowEnumeratorLike } from '../integrations/Win32WindowEnumerator'
import { getPowerShellGateway, type PowerShellGateway } from '../runtime/PowerShellGateway'
import type { HeartbeatBeat, HeartbeatSource, WatchdogInstance } from './WatchdogEngine'

export interface WatchdogCollectorSourceConfig {
  markerFilePath?: string
  fsActivityPaths?: readonly string[]
  httpHealthUrl?: string
  lastStdoutAt?: number
  stdoutBytes?: number
  maxAgeMs?: number
}

export interface WatchdogCollectorFailure {
  instanceId: string
  source: HeartbeatSource
  errorCode: string
  message: string
  at: number
  detail?: Record<string, unknown>
}

export interface WatchdogHeartbeatCollectorResult {
  collectedAt: number
  beats: HeartbeatBeat[]
  failures: WatchdogCollectorFailure[]
  sourceCountByInstance: Record<string, number>
}

export interface WatchdogHeartbeatCollectorInput {
  instances: readonly WatchdogInstance[]
  sourceConfigByInstanceId?: Record<string, WatchdogCollectorSourceConfig>
  now?: number
}

export interface WatchdogProcessSource {
  listProcesses(): Promise<ServiceResult<ProcessInfo[]>>
  listNetworkPorts(): Promise<ServiceResult<PortInfo[]>>
}

export interface WatchdogHungWindowProbe {
  checkHungWindow(hwnd: number): Promise<ServiceResult<{ hwnd: number; hung: boolean }>>
}

export interface WatchdogEtwProbe {
  probe(instance: WatchdogInstance): Promise<ServiceResult<{ available: boolean; provider: string; eventCount?: number }>>
}

export interface WatchdogHeartbeatCollectorOptions {
  processSource?: WatchdogProcessSource
  windowSource?: Win32WindowEnumeratorLike
  hungWindowProbe?: WatchdogHungWindowProbe
  etwProbe?: WatchdogEtwProbe
  fetchImpl?: typeof fetch
}

const HEARTBEAT_WEIGHTS: Record<HeartbeatSource, number> = {
  'marker-file': 1,
  stdout: 0.7,
  'cpu-pulse': 0.4,
  'window-title': 0.5,
  'http-health': 0.9,
  'fs-activity': 0.5,
  'hung-window': 0.6,
  network: 0.4,
  etw: 0.7
}

const DEFAULT_MAX_AGE_MS = 120_000
const HTTP_HEALTH_TIMEOUT_MS = 1000

export class WatchdogHeartbeatCollector {
  private readonly processSource: WatchdogProcessSource
  private readonly windowSource: Win32WindowEnumeratorLike
  private readonly hungWindowProbe: WatchdogHungWindowProbe
  private readonly etwProbe: WatchdogEtwProbe
  private readonly fetchImpl: typeof fetch

  constructor(options: WatchdogHeartbeatCollectorOptions = {}) {
    const systemInformation = new SystemInformationAdapter()
    this.processSource = options.processSource ?? systemInformation
    this.windowSource = options.windowSource ?? new Win32WindowEnumerator()
    this.hungWindowProbe = options.hungWindowProbe ?? new PowerShellHungWindowProbe()
    this.etwProbe = options.etwProbe ?? new PowerShellEtwProbe()
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async collect(input: WatchdogHeartbeatCollectorInput): Promise<WatchdogHeartbeatCollectorResult> {
    const collectedAt = input.now ?? Date.now()
    const failures: WatchdogCollectorFailure[] = []
    const beats: HeartbeatBeat[] = []
    const sourceCountByInstance: Record<string, number> = {}
    const instances = input.instances.filter(instance => instance.state !== 'dead')
    const needsProcesses = instances.some(instance => this.sourceEnabled(instance, 'cpu-pulse') || this.sourceEnabled(instance, 'etw'))
    const needsNetwork = instances.some(instance => this.sourceEnabled(instance, 'network'))
    const needsWindows = instances.some(instance => this.sourceEnabled(instance, 'window-title') || this.sourceEnabled(instance, 'hung-window'))
    const processRows = needsProcesses ? await this.safeProcesses(instances, failures, collectedAt) : []
    const networkRows = needsNetwork ? await this.safeNetworkPorts(instances, failures, collectedAt) : []
    const windowRows = needsWindows ? await this.safeWindows(instances, failures, collectedAt) : []
    const processesByPid = new Map(processRows.map(row => [row.pid, row]))
    const portsByPid = this.groupByPid(networkRows)
    const windowsByPid = this.groupWindowsByPid(windowRows)

    for (const instance of instances) {
      const config = input.sourceConfigByInstanceId?.[instance.instanceId] ?? {}
      const maxAgeMs = this.maxAge(config)
      const initialCount = beats.length
      this.collectProcessBeat(instance, processesByPid.get(instance.pid), collectedAt, beats)
      this.collectNetworkBeat(instance, portsByPid.get(instance.pid) ?? [], collectedAt, beats)
      this.collectWindowTitleBeat(instance, windowsByPid.get(instance.pid) ?? [], collectedAt, beats)
      await this.collectHungWindowBeat(instance, windowsByPid.get(instance.pid) ?? [], collectedAt, beats, failures)
      await this.collectMarkerFileBeat(instance, config, collectedAt, maxAgeMs, beats, failures)
      await this.collectFsActivityBeat(instance, config, collectedAt, maxAgeMs, beats, failures)
      await this.collectHttpHealthBeat(instance, config, collectedAt, beats, failures)
      this.collectStdoutBeat(instance, config, collectedAt, maxAgeMs, beats)
      await this.collectEtwBeat(instance, processesByPid.has(instance.pid), collectedAt, beats, failures)
      sourceCountByInstance[instance.instanceId] = beats.length - initialCount
    }

    return { collectedAt, beats, failures, sourceCountByInstance }
  }

  private sourceEnabled(instance: WatchdogInstance, source: HeartbeatSource): boolean {
    return instance.enabledSources.includes(source)
  }

  private maxAge(config: WatchdogCollectorSourceConfig): number {
    return Number.isInteger(config.maxAgeMs) && Number(config.maxAgeMs) > 0 ? Number(config.maxAgeMs) : DEFAULT_MAX_AGE_MS
  }

  private async safeProcesses(instances: readonly WatchdogInstance[], failures: WatchdogCollectorFailure[], at: number): Promise<ProcessInfo[]> {
    const result = await this.processSource.listProcesses()
    if (result.success && result.data) return result.data
    this.recordFailureForEnabled(instances, 'cpu-pulse', result.error ?? 'SYSTEMINFORMATION_PROCESSES_UNAVAILABLE', failures, at)
    this.recordFailureForEnabled(instances, 'etw', result.error ?? 'SYSTEMINFORMATION_PROCESSES_UNAVAILABLE', failures, at)
    return []
  }

  private async safeNetworkPorts(instances: readonly WatchdogInstance[], failures: WatchdogCollectorFailure[], at: number): Promise<PortInfo[]> {
    const result = await this.processSource.listNetworkPorts()
    if (result.success && result.data) return result.data
    this.recordFailureForEnabled(instances, 'network', result.error ?? 'SYSTEMINFORMATION_NETWORK_UNAVAILABLE', failures, at)
    return []
  }

  private async safeWindows(instances: readonly WatchdogInstance[], failures: WatchdogCollectorFailure[], at: number): Promise<NativeWindowSnapshot[]> {
    const result = await this.windowSource.enumerateVisibleWindows()
    if (result.success && result.data) return result.data
    this.recordFailureForEnabled(instances, 'window-title', result.error ?? 'WINDOW_ENUMERATION_UNAVAILABLE', failures, at)
    this.recordFailureForEnabled(instances, 'hung-window', result.error ?? 'WINDOW_ENUMERATION_UNAVAILABLE', failures, at)
    return []
  }

  private collectProcessBeat(instance: WatchdogInstance, processInfo: ProcessInfo | undefined, at: number, beats: HeartbeatBeat[]): void {
    if (!this.sourceEnabled(instance, 'cpu-pulse') || !processInfo) return
    if (processInfo.cpu <= 0) return
    beats.push(this.beat(instance, 'cpu-pulse', at, {
      cpuPct: processInfo.cpu,
      memoryMb: processInfo.memory,
      processName: processInfo.name
    }))
  }

  private collectNetworkBeat(instance: WatchdogInstance, ports: readonly PortInfo[], at: number, beats: HeartbeatBeat[]): void {
    if (!this.sourceEnabled(instance, 'network') || ports.length === 0) return
    beats.push(this.beat(instance, 'network', at, {
      portCount: ports.length,
      states: this.uniqueStrings(ports.map(port => port.state)),
      protocols: this.uniqueStrings(ports.map(port => port.protocol)),
      ports: ports.map(port => port.port).slice(0, 10)
    }))
  }

  private collectWindowTitleBeat(instance: WatchdogInstance, windows: readonly NativeWindowSnapshot[], at: number, beats: HeartbeatBeat[]): void {
    if (!this.sourceEnabled(instance, 'window-title') || windows.length === 0) return
    const window = windows.find(item => item.title.length > 0)
    if (!window) return
    beats.push(this.beat(instance, 'window-title', at, {
      hwnd: window.hwnd,
      titleHash: createHash('sha256').update(window.title).digest('hex'),
      titleLength: window.title.length,
      className: window.className
    }))
  }

  private async collectHungWindowBeat(instance: WatchdogInstance, windows: readonly NativeWindowSnapshot[], at: number, beats: HeartbeatBeat[], failures: WatchdogCollectorFailure[]): Promise<void> {
    if (!this.sourceEnabled(instance, 'hung-window') || windows.length === 0) return
    const window = windows[0]
    const result = await this.hungWindowProbe.checkHungWindow(window.hwnd)
    if (result.success && result.data && !result.data.hung) {
      beats.push(this.beat(instance, 'hung-window', at, { hwnd: window.hwnd, hung: false }))
      return
    }
    failures.push(this.failure(instance, 'hung-window', result.error ?? 'E_WINDOW_HUNG', at, { hwnd: window.hwnd, hung: result.data?.hung ?? null }))
  }

  private async collectMarkerFileBeat(instance: WatchdogInstance, config: WatchdogCollectorSourceConfig, at: number, maxAgeMs: number, beats: HeartbeatBeat[], failures: WatchdogCollectorFailure[]): Promise<void> {
    if (!this.sourceEnabled(instance, 'marker-file') || !config.markerFilePath) return
    const mtimeMs = await this.readMtime(config.markerFilePath, instance, 'marker-file', at, failures)
    if (mtimeMs === null || at - mtimeMs > maxAgeMs) return
    beats.push(this.beat(instance, 'marker-file', at, { markerAgeMs: Math.max(0, at - mtimeMs) }))
  }

  private async collectFsActivityBeat(instance: WatchdogInstance, config: WatchdogCollectorSourceConfig, at: number, maxAgeMs: number, beats: HeartbeatBeat[], failures: WatchdogCollectorFailure[]): Promise<void> {
    if (!this.sourceEnabled(instance, 'fs-activity') || !config.fsActivityPaths || config.fsActivityPaths.length === 0) return
    const mtimes = await Promise.all(config.fsActivityPaths.map(filePath => this.readMtime(filePath, instance, 'fs-activity', at, failures)))
    const latest = mtimes.filter((mtime): mtime is number => mtime !== null).sort((left, right) => right - left)[0]
    if (typeof latest !== 'number' || at - latest > maxAgeMs) return
    beats.push(this.beat(instance, 'fs-activity', at, { pathCount: config.fsActivityPaths.length, latestAgeMs: Math.max(0, at - latest) }))
  }

  private async collectHttpHealthBeat(instance: WatchdogInstance, config: WatchdogCollectorSourceConfig, at: number, beats: HeartbeatBeat[], failures: WatchdogCollectorFailure[]): Promise<void> {
    if (!this.sourceEnabled(instance, 'http-health') || !config.httpHealthUrl) return
    const url = this.parseLocalUrl(config.httpHealthUrl)
    if (!url) {
      failures.push(this.failure(instance, 'http-health', 'E_VALIDATION:http-health URL must be localhost', at))
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HTTP_HEALTH_TIMEOUT_MS)
    timeout.unref?.()
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal })
      if (response.ok) {
        beats.push(this.beat(instance, 'http-health', at, { status: response.status, url: this.redactedUrl(url) }))
      } else {
        failures.push(this.failure(instance, 'http-health', `E_HTTP_HEALTH_STATUS:${response.status}`, at, { status: response.status }))
      }
    } catch (error) {
      failures.push(this.failure(instance, 'http-health', error instanceof Error ? error.message : String(error), at))
    } finally {
      clearTimeout(timeout)
    }
  }

  private collectStdoutBeat(instance: WatchdogInstance, config: WatchdogCollectorSourceConfig, at: number, maxAgeMs: number, beats: HeartbeatBeat[]): void {
    if (!this.sourceEnabled(instance, 'stdout') || typeof config.lastStdoutAt !== 'number') return
    if (at - config.lastStdoutAt > maxAgeMs) return
    beats.push(this.beat(instance, 'stdout', at, {
      stdoutAgeMs: Math.max(0, at - config.lastStdoutAt),
      stdoutBytes: Number.isInteger(config.stdoutBytes) && Number(config.stdoutBytes) >= 0 ? Number(config.stdoutBytes) : null
    }))
  }

  private async collectEtwBeat(instance: WatchdogInstance, processKnown: boolean, at: number, beats: HeartbeatBeat[], failures: WatchdogCollectorFailure[]): Promise<void> {
    if (!this.sourceEnabled(instance, 'etw')) return
    if (!processKnown) return
    const result = await this.etwProbe.probe(instance)
    if (result.success && result.data?.available) {
      beats.push(this.beat(instance, 'etw', at, {
        provider: result.data.provider,
        eventCount: result.data.eventCount ?? null
      }))
      return
    }
    failures.push(this.failure(instance, 'etw', result.error ?? 'E_PERMISSION_DENIED:ETW unavailable', at))
  }

  private async readMtime(filePath: string, instance: WatchdogInstance, source: HeartbeatSource, at: number, failures: WatchdogCollectorFailure[]): Promise<number | null> {
    try {
      const stats = await statFile(filePath)
      return stats.mtimeMs
    } catch (error) {
      failures.push(this.failure(instance, source, error instanceof Error ? error.message : String(error), at))
      return null
    }
  }

  private beat(instance: WatchdogInstance, source: HeartbeatSource, ts: number, detail: Record<string, unknown>): HeartbeatBeat {
    return {
      ts,
      instanceId: instance.instanceId,
      source,
      weight: HEARTBEAT_WEIGHTS[source],
      detail
    }
  }

  private failure(instance: WatchdogInstance, source: HeartbeatSource, message: string, at: number, detail?: Record<string, unknown>): WatchdogCollectorFailure {
    return {
      instanceId: instance.instanceId,
      source,
      errorCode: this.errorCode(message),
      message,
      at,
      detail
    }
  }

  private errorCode(message: string): string {
    const [code] = message.split(':')
    return code && code.startsWith('E_') ? code : 'E_RUNTIME'
  }

  private recordFailureForEnabled(instances: readonly WatchdogInstance[], source: HeartbeatSource, message: string, failures: WatchdogCollectorFailure[], at: number): void {
    for (const instance of instances) {
      if (this.sourceEnabled(instance, source)) failures.push(this.failure(instance, source, message, at))
    }
  }

  private groupByPid(ports: readonly PortInfo[]): Map<number, PortInfo[]> {
    const grouped = new Map<number, PortInfo[]>()
    for (const port of ports) {
      const current = grouped.get(port.pid) ?? []
      current.push(port)
      grouped.set(port.pid, current)
    }
    return grouped
  }

  private groupWindowsByPid(windows: readonly NativeWindowSnapshot[]): Map<number, NativeWindowSnapshot[]> {
    const grouped = new Map<number, NativeWindowSnapshot[]>()
    for (const window of windows) {
      const current = grouped.get(window.pid) ?? []
      current.push(window)
      grouped.set(window.pid, current)
    }
    return grouped
  }

  private uniqueStrings(values: readonly string[]): string[] {
    return Array.from(new Set(values)).sort()
  }

  private parseLocalUrl(value: string): URL | null {
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
      if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) return null
      return url
    } catch {
      return null
    }
  }

  private redactedUrl(url: URL): string {
    return `${url.protocol}//${url.host}${url.pathname}`
  }
}

class PowerShellHungWindowProbe implements WatchdogHungWindowProbe {
  constructor(private readonly gateway: Pick<PowerShellGateway, 'execute'> = getPowerShellGateway()) {}

  async checkHungWindow(hwnd: number): Promise<ServiceResult<{ hwnd: number; hung: boolean }>> {
    if (process.platform !== 'win32') return { success: false, error: 'E_UNSUPPORTED_PLATFORM:IsHungAppWindow requires Windows' }
    if (!Number.isSafeInteger(hwnd) || hwnd <= 0) return { success: false, error: 'E_VALIDATION:hwnd must be positive' }
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class DevHubWatchdogHungWindow {
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsHungAppWindow(IntPtr hWnd);
}
"@
$hwnd = [IntPtr]${hwnd}
if (-not [DevHubWatchdogHungWindow]::IsWindow($hwnd)) {
  Write-Output '{"success":false,"error":"E_WINDOW_NOT_FOUND"}'
  exit 0
}
$hung = [DevHubWatchdogHungWindow]::IsHungAppWindow($hwnd)
Write-Output (@{ success = $true; hwnd = ${hwnd}; hung = [bool]$hung } | ConvertTo-Json -Compress)
`
    try {
      return await this.gateway.execute(script, {
        label: 'watchdog-hung-window',
        timeoutMs: 15000,
        parser: stdout => {
          const parsed = JSON.parse(stdout.trim()) as { success?: boolean; error?: string; hwnd?: number; hung?: boolean }
          if (!parsed.success) return { success: false, error: parsed.error ?? 'E_RUNTIME:IsHungAppWindow failed' }
          return { success: true, data: { hwnd, hung: parsed.hung === true } }
        }
      })
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

class PowerShellEtwProbe implements WatchdogEtwProbe {
  constructor(private readonly gateway: Pick<PowerShellGateway, 'execute'> = getPowerShellGateway()) {}

  async probe(_instance: WatchdogInstance): Promise<ServiceResult<{ available: boolean; provider: string; eventCount?: number }>> {
    if (process.platform !== 'win32') return { success: false, error: 'E_UNSUPPORTED_PLATFORM:ETW requires Windows' }
    const script = `
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Output (@{ success = $false; error = 'E_PERMISSION_DENIED:ETW collector requires administrator' } | ConvertTo-Json -Compress)
  exit 0
}
$sessions = (& logman query -ets 2>$null | Out-String)
if ($LASTEXITCODE -ne 0) {
  Write-Output (@{ success = $false; error = 'E_RUNTIME:logman query -ets failed' } | ConvertTo-Json -Compress)
  exit 0
}
Write-Output (@{ success = $true; provider = 'Microsoft-Windows-Kernel-Process'; eventCount = (($sessions -split [Environment]::NewLine) | Where-Object { $_.Trim().Length -gt 0 }).Count } | ConvertTo-Json -Compress)
`
    try {
      return await this.gateway.execute(script, {
        label: 'watchdog-etw-probe',
        timeoutMs: 15000,
        parser: stdout => {
          const parsed = JSON.parse(stdout.trim()) as { success?: boolean; error?: string; provider?: string; eventCount?: number }
          if (!parsed.success) return { success: false, error: parsed.error ?? 'E_PERMISSION_DENIED:ETW unavailable' }
          return {
            success: true,
            data: {
              available: true,
              provider: typeof parsed.provider === 'string' ? parsed.provider : 'Microsoft-Windows-Kernel-Process',
              eventCount: Number.isFinite(parsed.eventCount) ? Number(parsed.eventCount) : undefined
            }
          }
        }
      })
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
