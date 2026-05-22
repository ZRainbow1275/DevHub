import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { WatchdogEngine, type WatchdogStore } from './WatchdogEngine'

class MemoryWatchdogStore implements WatchdogStore {
  private readonly data = new Map<string, unknown>()

  get(key: string, defaultValue?: unknown): unknown {
    return this.data.has(key) ? this.data.get(key) : defaultValue
  }

  set(key: string, value: unknown): void {
    this.data.set(key, value)
  }
}

function engine(clock: { now: number }): WatchdogEngine {
  return new WatchdogEngine(new MemoryWatchdogStore(), () => clock.now)
}

function percentile(values: readonly number[], percent: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percent) - 1))
  return sorted[index]
}

describe('WatchdogEngine', () => {
  it('registers all heartbeat sources and respects per-source disable gates', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    const registered = watchdog.registerInstance({ instanceId: 'sources-1', pid: 99, tool: 'codex', mode: 'lenient', graceMs: 0 })
    expect(registered.enabledSources).toEqual(['marker-file', 'stdout', 'cpu-pulse', 'window-title', 'http-health', 'fs-activity', 'hung-window', 'network', 'etw'])

    watchdog.configure({ instanceId: 'sources-1', patch: { enabledSources: ['marker-file'], perPhase: { runningMs: 5000 } } })
    clock.now = 4000
    watchdog.recordHeartbeat({ instanceId: 'sources-1', source: 'cpu-pulse', weight: 0.8, ts: clock.now })
    clock.now = 6001

    expect(watchdog.evaluate({ now: clock.now }).monitoredInstances[0].state).toBe('suspect')
  })

  it('records disabled-source heartbeats for audit without refreshing health', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.registerInstance({ instanceId: 'disabled-source-1', pid: 98, tool: 'codex', mode: 'lenient', graceMs: 0 })
    watchdog.configure({ instanceId: 'disabled-source-1', patch: { enabledSources: ['marker-file'], perPhase: { runningMs: 5000 } } })
    clock.now = 6001
    const suspect = watchdog.evaluate({ now: clock.now }).monitoredInstances[0]
    expect(suspect.state).toBe('suspect')

    watchdog.recordHeartbeat({ instanceId: 'disabled-source-1', source: 'cpu-pulse', weight: 0.8, ts: 6500 })
    const afterDisabledBeat = watchdog.status().monitoredInstances[0]

    expect(afterDisabledBeat.state).toBe('suspect')
    expect(afterDisabledBeat.lastHeartbeatAt).toBe(suspect.lastHeartbeatAt)
    expect(watchdog.history({ instanceId: 'disabled-source-1' })[0]).toMatchObject({
      type: 'heartbeat',
      data: { source: 'cpu-pulse', accepted: false }
    })
  })

  it('keeps lenient CPU heartbeat healthy without taking action', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.registerInstance({ instanceId: 'codex-1', pid: 100, tool: 'codex', mode: 'lenient', graceMs: 0 })
    watchdog.configure({ instanceId: 'codex-1', patch: { perPhase: { runningMs: 5000 } } })
    clock.now = 4000
    watchdog.recordHeartbeat({ instanceId: 'codex-1', source: 'cpu-pulse', weight: 0.4, ts: clock.now })
    clock.now = 8000

    const status = watchdog.evaluate({ now: clock.now })

    expect(status.monitoredInstances[0].state).toBe('healthy')
    expect(watchdog.history().some(event => event.type === 'action-taken')).toBe(false)
  })

  it('uses highest-weight heartbeat fusion in lenient mode', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.registerInstance({ instanceId: 'fusion-1', pid: 100, tool: 'codex', mode: 'lenient', graceMs: 0 })
    watchdog.configure({ instanceId: 'fusion-1', patch: { perPhase: { runningMs: 5000 } } })
    watchdog.recordHeartbeat({ instanceId: 'fusion-1', source: 'cpu-pulse', weight: 0.2, ts: 4000 })
    watchdog.recordHeartbeat({ instanceId: 'fusion-1', source: 'stdout', weight: 0.8, ts: 3000 })
    clock.now = 4500

    const status = watchdog.evaluate({ now: clock.now })

    expect(status.monitoredInstances[0].state).toBe('healthy')
    expect(status.monitoredInstances[0].lastAcceptedHeartbeatAt).toBe(3000)
  })

  it('accepts high-trust primary heartbeat in strict mode', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.registerInstance({ instanceId: 'strict-primary-1', pid: 101, tool: 'codex', mode: 'strict', graceMs: 0 })
    watchdog.configure({ instanceId: 'strict-primary-1', patch: { perPhase: { runningMs: 5000 } } })
    clock.now = 4000
    watchdog.recordHeartbeat({ instanceId: 'strict-primary-1', source: 'marker-file', weight: 0.9, ts: clock.now })
    clock.now = 8000

    expect(watchdog.evaluate({ now: clock.now }).monitoredInstances[0].state).toBe('healthy')
  })

  it('treats CPU-only strict heartbeat as suspect and then restart-requested', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.registerInstance({ instanceId: 'strict-1', pid: 101, tool: 'codex', mode: 'strict', graceMs: 0 })
    watchdog.configure({ instanceId: 'strict-1', patch: { perPhase: { runningMs: 5000 } } })
    clock.now = 1000
    watchdog.recordHeartbeat({ instanceId: 'strict-1', source: 'cpu-pulse', weight: 0.4, ts: clock.now })

    clock.now = 6001
    expect(watchdog.evaluate({ now: clock.now }).monitoredInstances[0].state).toBe('suspect')
    clock.now = 9000
    const restarted = watchdog.evaluate({ now: clock.now })
    expect(restarted.monitoredInstances[0].state).toBe('restarting')
    expect(watchdog.history().some(event => event.type === 'action-taken' && event.data.action === 'restart')).toBe(true)
    const stateChanges = watchdog.history({ instanceId: 'strict-1' })
      .filter(event => event.type === 'state-change')
      .map(event => event.data.next)
    expect(stateChanges).toEqual(expect.arrayContaining(['suspect', 'stuck', 'restarting']))
  })

  it('honors startup grace and phase-aware thinking timeout', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.registerInstance({ instanceId: 'thinking-1', pid: 102, tool: 'claude', phase: 'thinking', graceMs: 30000 })

    clock.now = 25000
    expect(watchdog.evaluate({ now: clock.now }).monitoredInstances[0].state).toBe('healthy')
    clock.now = 240000
    expect(watchdog.evaluate({ now: clock.now }).monitoredInstances[0].state).toBe('healthy')
  })

  it('blocks the sixth restart in one hour as a storm', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.configure({ maxRestartsPerHour: 5 })

    for (let index = 0; index < 6; index += 1) {
      const instanceId = `storm-${index}`
      watchdog.registerInstance({ instanceId, pid: 200 + index, tool: 'gemini', graceMs: 0 })
      watchdog.configure({ instanceId, patch: { perPhase: { runningMs: 5000 } } })
      clock.now += 9000
      watchdog.evaluate({ instanceId, now: clock.now })
    }

    const status = watchdog.status()
    expect(status.restartStormActive).toBe(true)
    expect(status.monitoredInstances.find(instance => instance.instanceId === 'storm-5')?.state).toBe('human-pending')
    expect(watchdog.history().some(event => event.type === 'storm-detected' && event.instanceId === 'storm-5')).toBe(true)
  })

  it('applies startup and restart grace extensions under high resource load', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    const registered = watchdog.registerInstance({ instanceId: 'startup-grace-1', pid: 300, tool: 'codex', resourceLoad: { cpuPct: 81 } })
    expect(registered.graceUntil).toBe(45000)

    watchdog.registerInstance({ instanceId: 'restart-grace-1', pid: 301, tool: 'codex', mode: 'strict', graceMs: 0 })
    watchdog.configure({ instanceId: 'restart-grace-1', patch: { perPhase: { runningMs: 5000 } } })
    watchdog.recordHeartbeat({ instanceId: 'restart-grace-1', source: 'marker-file', weight: 0.9, ts: 1000, detail: { ioPct: 82 } })
    clock.now = 9000

    const status = watchdog.evaluate({ instanceId: 'restart-grace-1', now: clock.now })

    expect(status.monitoredInstances.find(instance => instance.instanceId === 'restart-grace-1')?.state).toBe('restarting')
    expect(status.monitoredInstances.find(instance => instance.instanceId === 'restart-grace-1')?.graceUntil).toBe(99000)
  })

  it('requests restart when latest process memory heartbeat exceeds configured max-memory threshold', () => {
    const clock = { now: 0 }
    const watchdog = engine(clock)
    watchdog.configure({ memoryRestartMb: 256, maxRestartsPerHour: 5 })
    watchdog.registerInstance({ instanceId: 'memory-limit-1', pid: 302, tool: 'codex', mode: 'lenient', graceMs: 120_000 })
    watchdog.recordHeartbeat({
      instanceId: 'memory-limit-1',
      source: 'cpu-pulse',
      weight: 0.4,
      ts: 1000,
      detail: { cpuPct: 5, memoryMb: 384 }
    })

    const status = watchdog.evaluate({ instanceId: 'memory-limit-1', now: 1500 })
    const history = watchdog.history({ instanceId: 'memory-limit-1' })

    expect(status.monitoredInstances.find(instance => instance.instanceId === 'memory-limit-1')?.state).toBe('restarting')
    expect(history.some(event => event.type === 'state-change' && event.data.reason === 'memory-over-limit')).toBe(true)
    expect(history.some(event => event.type === 'action-taken' && event.data.action === 'restart' && event.data.reason === 'memory-over-limit' && event.data.memoryMb === 384 && event.data.memoryRestartMb === 256)).toBe(true)
  })

  it('updates self-check timestamp for outer watchdog handoff', () => {
    const clock = { now: 12345 }
    const watchdog = engine(clock)

    expect(watchdog.selfCheck().lastSelfCheckAt).toBe(12345)
    expect(watchdog.history().some(event => event.type === 'self-check')).toBe(true)
  })

  it('keeps 16-instance watchdog benchmark within CPU budget', () => {
    const instanceCount = 16
    const sweepCount = 240
    const heartbeatIntervalMs = 30_000
    const clock = { now: 0 }
    const watchdog = engine(clock)
    const instanceIds = Array.from({ length: instanceCount }, (_value, index) => `bench-${index}`)

    for (const [index, instanceId] of instanceIds.entries()) {
      watchdog.registerInstance({ instanceId, pid: 1000 + index, tool: 'codex', mode: 'lenient', graceMs: 0 })
      watchdog.configure({ instanceId, patch: { perPhase: { runningMs: 120_000 } } })
    }

    const durations: number[] = []
    const cpuStart = process.cpuUsage()
    const wallStart = performance.now()

    for (let sweep = 0; sweep < sweepCount; sweep += 1) {
      clock.now += heartbeatIntervalMs
      for (const instanceId of instanceIds) {
        watchdog.recordHeartbeat({ instanceId, source: 'cpu-pulse', weight: 0.4, ts: clock.now, detail: { cpuPct: 12 } })
      }
      const sweepStartedAt = performance.now()
      const status = watchdog.evaluate({ now: clock.now })
      durations.push(performance.now() - sweepStartedAt)
      expect(status.monitoredInstances).toHaveLength(instanceCount)
    }

    const wallElapsedMs = performance.now() - wallStart
    const cpu = process.cpuUsage(cpuStart)
    const cpuUs = cpu.user + cpu.system
    const averageCpuUsPerSweep = cpuUs / sweepCount
    const estimatedCpuPctAt30sInterval = (averageCpuUsPerSweep / (heartbeatIntervalMs * 1000 * Math.max(cpus().length, 1))) * 100
    const report = {
      benchmark: 'watchdog-16-instance',
      instanceCount,
      sweepCount,
      heartbeatIntervalMs,
      wallElapsedMs: Number(wallElapsedMs.toFixed(3)),
      totalCpuUs: cpuUs,
      averageCpuUsPerSweep: Number(averageCpuUsPerSweep.toFixed(3)),
      estimatedCpuPctAt30sInterval: Number(estimatedCpuPctAt30sInterval.toFixed(6)),
      p95SweepMs: Number(percentile(durations, 0.95).toFixed(3)),
      p99SweepMs: Number(percentile(durations, 0.99).toFixed(3)),
      maxSweepMs: Number(Math.max(...durations).toFixed(3)),
      budget: {
        cpuPctAt30sIntervalLt: 1,
        sweepP95MsLt: 480
      }
    }

    mkdirSync(join(process.cwd(), 'perf-reports'), { recursive: true })
    writeFileSync(join(process.cwd(), 'perf-reports', 'watchdog-16-benchmark.json'), JSON.stringify(report, null, 2) + '\n')

    expect(report.estimatedCpuPctAt30sInterval).toBeLessThan(1)
    expect(report.p95SweepMs).toBeLessThan(480)
  })
})
