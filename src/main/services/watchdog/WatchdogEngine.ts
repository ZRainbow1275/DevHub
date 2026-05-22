export type WatchdogTool = 'codex' | 'claude' | 'gemini' | 'cursor' | 'copilot'
export type HeartbeatSource = 'marker-file' | 'stdout' | 'cpu-pulse' | 'window-title' | 'http-health' | 'fs-activity' | 'hung-window' | 'network' | 'etw'
export type WatchdogMode = 'lenient' | 'strict'
export type WatchdogActionPolicy = 'restart' | 'fallback-tool' | 'escalate-model' | 'human-intervention' | 'log-only'
export type WatchdogPhase = 'receiving-input' | 'thinking' | 'running' | 'awaiting-human'
export type WatchdogInstanceState = 'healthy' | 'suspect' | 'stuck' | 'restarting' | 'fallback-pending' | 'human-pending' | 'dead'
export type PidLivenessState = 'alive' | 'dead' | 'unknown'
export type PidLivenessProbe = (pid: number) => PidLivenessState

export interface WatchdogStore {
  get(key: string, defaultValue?: unknown): unknown
  set(key: string, value: unknown): void
}

export interface TaskPhaseTimeouts {
  receivingInputMs: number
  thinkingMs: number
  runningMs: number
  awaitingHumanMs: number
}

export interface WatchdogResourceLoad {
  cpuPct?: number
  ioPct?: number
  memoryMb?: number
}

export interface HeartbeatBeat {
  ts: number
  instanceId: string
  source: HeartbeatSource
  weight: number
  detail?: Record<string, unknown>
}

export interface WatchdogInstance {
  instanceId: string
  pid: number
  alias?: string
  tool: WatchdogTool
  mode: WatchdogMode
  perPhase: TaskPhaseTimeouts
  enabledSources: HeartbeatSource[]
  graceUntil: number
  state: WatchdogInstanceState
  consecutiveStuckCount: number
  lastHeartbeatAt: number
  lastAcceptedHeartbeatAt: number
  actionPolicy: WatchdogActionPolicy
  phase: WatchdogPhase
  createdAt: number
}

export interface WatchdogEvent {
  eventId: string
  type: 'heartbeat' | 'state-change' | 'action-taken' | 'storm-detected' | 'configure' | 'self-check' | 'manual-restart-override'
  at: number
  instanceId?: string
  data: Record<string, unknown>
}

export interface WatchdogStatusSnapshot {
  enabled: boolean
  heartbeatTimeoutMs: number
  restartCount: number
  lastHeartbeatAt: number | null
  state: 'idle' | 'watching' | 'restarting' | 'failed' | 'healthy' | 'suspect' | 'stuck' | 'dead' | 'fallback-pending' | 'human-pending'
  isHealthy: boolean
  monitoredInstances: WatchdogInstance[]
  lastSelfCheckAt: number | null
  totalRestarts24h: number
  totalFallbacks24h: number
  restartStormActive: boolean
}

interface WatchdogConfig {
  enabled: boolean
  heartbeatTimeoutMs: number
  maxRestartsPerHour: number
  cooldownAfterStormMs: number
  startupGraceMs: number
  restartGraceMs: number
  memoryRestartMb: number
}

const DEFAULT_PHASE_TIMEOUTS: TaskPhaseTimeouts = {
  receivingInputMs: 600_000,
  thinkingMs: 300_000,
  runningMs: 120_000,
  awaitingHumanMs: 1_800_000
}

const DEFAULT_SOURCES: HeartbeatSource[] = ['marker-file', 'stdout', 'cpu-pulse', 'window-title', 'http-health', 'fs-activity', 'hung-window', 'network', 'etw']
const PRIMARY_SOURCES = new Set<HeartbeatSource>(['marker-file', 'stdout', 'http-health'])
const ONE_HOUR_MS = 3_600_000
const ONE_DAY_MS = 86_400_000

export class WatchdogEngine {
  constructor(
    private readonly store: WatchdogStore,
    private readonly now: () => number = () => Date.now(),
    private readonly pidLiveness: PidLivenessProbe = () => 'unknown'
  ) {}

  status(): WatchdogStatusSnapshot {
    const config = this.config()
    const instances = this.listInstances()
    const events = this.events()
    const now = this.now()
    const restartCount = this.restartEvents(now, ONE_HOUR_MS).length
    const state = this.aggregateState(instances)
    return {
      enabled: config.enabled,
      heartbeatTimeoutMs: config.heartbeatTimeoutMs,
      restartCount,
      lastHeartbeatAt: instances.reduce<number | null>((latest, instance) => latest === null ? instance.lastHeartbeatAt : Math.max(latest, instance.lastHeartbeatAt), null),
      state,
      isHealthy: config.enabled && instances.every(instance => ['healthy', 'restarting'].includes(instance.state)),
      monitoredInstances: instances,
      lastSelfCheckAt: this.selfCheckAt(),
      totalRestarts24h: events.filter(event => event.type === 'action-taken' && event.data.action === 'restart' && now - event.at <= ONE_DAY_MS).length,
      totalFallbacks24h: events.filter(event => event.type === 'action-taken' && event.data.action === 'fallback-tool' && now - event.at <= ONE_DAY_MS).length,
      restartStormActive: events.some(event => event.type === 'storm-detected' && now - event.at <= config.cooldownAfterStormMs)
    }
  }

  configure(input: unknown): WatchdogStatusSnapshot {
    const value = this.objectInput(input)
    if (typeof value.instanceId === 'string' && value.patch && typeof value.patch === 'object') {
      this.configureInstance(value.instanceId, value.patch as Record<string, unknown>)
    } else {
      this.configureGlobal(value)
    }
    this.appendEvent({ type: 'configure', data: { input: value } })
    return this.status()
  }

  registerInstance(input: { instanceId: string; pid: number; tool: WatchdogTool; alias?: string; mode?: WatchdogMode; graceMs?: number; phase?: WatchdogPhase; actionPolicy?: WatchdogActionPolicy; resourceLoad?: WatchdogResourceLoad }): WatchdogInstance {
    if (!Number.isInteger(input.pid) || input.pid <= 0) throw new Error('E_VALIDATION:pid must be positive')
    const config = this.config()
    const now = this.now()
    const instance: WatchdogInstance = {
      instanceId: input.instanceId,
      pid: input.pid,
      alias: input.alias,
      tool: input.tool,
      mode: input.mode ?? 'lenient',
      perPhase: DEFAULT_PHASE_TIMEOUTS,
      enabledSources: DEFAULT_SOURCES,
      graceUntil: now + this.adjustedGraceMs(input.graceMs ?? config.startupGraceMs, input.resourceLoad),
      state: 'healthy',
      consecutiveStuckCount: 0,
      lastHeartbeatAt: now,
      lastAcceptedHeartbeatAt: now,
      actionPolicy: input.actionPolicy ?? 'restart',
      phase: input.phase ?? 'running',
      createdAt: now
    }
    this.persistInstances([instance, ...this.listInstances().filter(item => item.instanceId !== input.instanceId)])
    this.appendEvent({ type: 'state-change', instanceId: input.instanceId, data: { next: 'healthy', reason: 'register' } })
    return instance
  }

  recordHeartbeat(input: HeartbeatBeat): HeartbeatBeat {
    const beat = this.parseHeartbeat(input)
    const instances = this.listInstances()
    const index = instances.findIndex(instance => instance.instanceId === beat.instanceId)
    if (index < 0) throw new Error('E_NOT_FOUND:watchdog instance not found')
    const instance = instances[index]
    const acceptedBySourceGate = instance.enabledSources.includes(beat.source)
    instances[index] = acceptedBySourceGate ? { ...instance, lastHeartbeatAt: beat.ts, state: 'healthy' } : instance
    this.persistInstances(instances)
    this.store.set('watchdogBeats', [beat, ...this.beats()].slice(0, 5000))
    this.appendEvent({ type: 'heartbeat', instanceId: beat.instanceId, data: { source: beat.source, weight: beat.weight, ts: beat.ts, accepted: acceptedBySourceGate } })
    return beat
  }

  evaluate(input: { instanceId?: string; now?: number } = {}): WatchdogStatusSnapshot {
    const config = this.config()
    if (!config.enabled) return this.status()
    const now = input.now ?? this.now()
    const instances = this.listInstances().map(instance => input.instanceId && instance.instanceId !== input.instanceId ? instance : this.evaluateInstance(instance, now, config))
    this.persistInstances(instances)
    return this.status()
  }

  selfCheck(): WatchdogStatusSnapshot {
    this.store.set('watchdogSelfCheckAt', this.now())
    this.appendEvent({ type: 'self-check', data: { ok: true } })
    return this.status()
  }

  overrideRestart(input: { reason?: string; confirmedBy?: string }): WatchdogEvent {
    const event = this.appendEvent({ type: 'manual-restart-override', data: { reason: input.reason ?? 'operator', confirmedBy: input.confirmedBy ?? null } })
    this.store.set('watchdogManualRestartCount', Number(this.store.get('watchdogManualRestartCount', 0) ?? 0) + 1)
    return event
  }

  history(input: { instanceId?: string; sinceTs?: number } = {}): WatchdogEvent[] {
    return this.events().filter(event => (!input.instanceId || event.instanceId === input.instanceId) && (!input.sinceTs || event.at >= input.sinceTs))
  }

  private evaluateInstance(instance: WatchdogInstance, now: number, config: WatchdogConfig): WatchdogInstance {
    if (this.pidLiveness(instance.pid) === 'dead' && !['restarting', 'fallback-pending', 'human-pending', 'dead'].includes(instance.state)) {
      const stuck = this.setInstanceState({ ...instance, consecutiveStuckCount: instance.consecutiveStuckCount + 1 }, 'stuck', 'pid-exited')
      return this.applyAction(stuck, now, config)
    }
    const memoryOverLimit = this.memoryOverLimit(instance.instanceId, config.memoryRestartMb)
    if (memoryOverLimit && !['restarting', 'fallback-pending', 'human-pending', 'dead'].includes(instance.state)) {
      const stuck = this.setInstanceState({ ...instance, consecutiveStuckCount: instance.consecutiveStuckCount + 1 }, 'stuck', 'memory-over-limit')
      return this.applyAction(stuck, now, config, 'memory-over-limit', memoryOverLimit)
    }
    if (now <= instance.graceUntil) return this.setInstanceState(instance, 'healthy', 'startup-grace')
    const timeoutMs = this.phaseTimeout(instance, config.heartbeatTimeoutMs)
    const acceptedAt = this.acceptedHeartbeatAt(instance, now, timeoutMs)
    if (acceptedAt !== null) {
      return this.setInstanceState({ ...instance, lastAcceptedHeartbeatAt: acceptedAt, consecutiveStuckCount: 0 }, 'healthy', 'heartbeat-accepted')
    }
    const elapsed = now - instance.lastAcceptedHeartbeatAt
    if (elapsed <= timeoutMs) return this.setInstanceState(instance, 'healthy', 'within-timeout')
    if (elapsed <= timeoutMs + Math.floor(timeoutMs / 2)) return this.setInstanceState(instance, 'suspect', 'heartbeat-timeout')
    const stuck = this.setInstanceState({ ...instance, consecutiveStuckCount: instance.consecutiveStuckCount + 1 }, 'stuck', 'heartbeat-timeout-final')
    return this.applyAction(stuck, now, config)
  }

  private acceptedHeartbeatAt(instance: WatchdogInstance, now: number, timeoutMs: number): number | null {
    const recent = this.beats()
      .filter(beat => beat.instanceId === instance.instanceId && instance.enabledSources.includes(beat.source) && now - beat.ts <= timeoutMs)
      .sort((left, right) => right.ts - left.ts)
    if (recent.length === 0) return null
    if (instance.mode === 'lenient') return this.highestWeightBeat(recent).ts
    const primary = recent.some(beat => PRIMARY_SOURCES.has(beat.source))
    const sourceCount = new Set(recent.map(beat => beat.source)).size
    const highTrust = recent.some(beat => beat.weight >= 0.9)
    return primary && (sourceCount >= 2 || highTrust) ? recent[0].ts : null
  }

  private applyAction(instance: WatchdogInstance, now: number, config: WatchdogConfig, reason = 'watchdog-stuck', context: Record<string, unknown> = {}): WatchdogInstance {
    const recentRestarts = this.restartEvents(now, ONE_HOUR_MS)
    if (recentRestarts.length >= config.maxRestartsPerHour) {
      this.appendEvent({ type: 'storm-detected', instanceId: instance.instanceId, data: { maxRestartsPerHour: config.maxRestartsPerHour, recentRestarts: recentRestarts.length, reason, ...context } })
      const fallbackState: WatchdogInstanceState = instance.actionPolicy === 'fallback-tool' ? 'fallback-pending' : 'human-pending'
      this.appendEvent({ type: 'action-taken', instanceId: instance.instanceId, data: { action: fallbackState === 'fallback-pending' ? 'fallback-tool' : 'human-intervention', reason: 'restart-storm', sourceReason: reason, ...context } })
      return this.setInstanceState({ ...instance, actionPolicy: fallbackState === 'fallback-pending' ? 'fallback-tool' : 'human-intervention' }, fallbackState, 'restart-storm')
    }
    if (instance.actionPolicy === 'log-only') {
      this.appendEvent({ type: 'action-taken', instanceId: instance.instanceId, data: { action: 'log-only', reason, ...context } })
      return this.setInstanceState(instance, 'stuck', 'log-only')
    }
    if (instance.actionPolicy === 'human-intervention') {
      this.appendEvent({ type: 'action-taken', instanceId: instance.instanceId, data: { action: 'human-intervention', reason, ...context } })
      return this.setInstanceState(instance, 'human-pending', 'human-intervention')
    }
    if (instance.actionPolicy === 'fallback-tool' || instance.actionPolicy === 'escalate-model') {
      this.appendEvent({ type: 'action-taken', instanceId: instance.instanceId, data: { action: instance.actionPolicy, reason, ...context } })
      return this.setInstanceState(instance, 'fallback-pending', instance.actionPolicy)
    }
    this.appendEvent({ type: 'action-taken', instanceId: instance.instanceId, data: { action: 'restart', reason, ...context } })
    return this.setInstanceState({ ...instance, graceUntil: now + this.adjustedGraceMs(config.restartGraceMs, this.latestResourceLoad(instance.instanceId)) }, 'restarting', reason === 'memory-over-limit' ? 'memory-over-limit-restart-requested' : 'restart-requested')
  }

  private setInstanceState(instance: WatchdogInstance, next: WatchdogInstanceState, reason: string): WatchdogInstance {
    if (instance.state !== next) this.appendEvent({ type: 'state-change', instanceId: instance.instanceId, data: { prev: instance.state, next, reason } })
    return { ...instance, state: next }
  }

  private configureGlobal(input: Record<string, unknown>): void {
    const current = this.config()
    const next: WatchdogConfig = {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
      heartbeatTimeoutMs: this.positiveInt(input.heartbeatTimeoutMs, current.heartbeatTimeoutMs, 'heartbeatTimeoutMs'),
      maxRestartsPerHour: this.positiveInt(input.maxRestartsPerHour, current.maxRestartsPerHour, 'maxRestartsPerHour'),
      cooldownAfterStormMs: this.positiveInt(input.cooldownAfterStormMs, current.cooldownAfterStormMs, 'cooldownAfterStormMs'),
      startupGraceMs: this.positiveInt(input.startupGraceMs, current.startupGraceMs, 'startupGraceMs'),
      restartGraceMs: this.positiveInt(input.restartGraceMs, current.restartGraceMs, 'restartGraceMs'),
      memoryRestartMb: this.nonnegativeInt(input.memoryRestartMb, current.memoryRestartMb, 'memoryRestartMb')
    }
    if (next.heartbeatTimeoutMs < 5000) throw new Error('E_VALIDATION:heartbeatTimeoutMs must be at least 5000')
    this.store.set('watchdogConfig', next)
  }

  private configureInstance(instanceId: string, patch: Record<string, unknown>): void {
    const instances = this.listInstances()
    const index = instances.findIndex(instance => instance.instanceId === instanceId)
    if (index < 0) throw new Error('E_NOT_FOUND:watchdog instance not found')
    const current = instances[index]
    instances[index] = {
      ...current,
      mode: patch.mode === 'strict' || patch.mode === 'lenient' ? patch.mode : current.mode,
      perPhase: patch.perPhase && typeof patch.perPhase === 'object' ? this.mergePerPhase(current.perPhase, patch.perPhase as Record<string, unknown>) : current.perPhase,
      enabledSources: Array.isArray(patch.enabledSources) ? this.parseSources(patch.enabledSources) : current.enabledSources,
      actionPolicy: this.parseActionPolicy(patch.actionPolicy, current.actionPolicy),
      phase: this.parsePhase(patch.phase, current.phase)
    }
    this.persistInstances(instances)
  }

  private mergePerPhase(current: TaskPhaseTimeouts, patch: Record<string, unknown>): TaskPhaseTimeouts {
    return {
      receivingInputMs: this.positiveInt(patch.receivingInputMs, current.receivingInputMs, 'receivingInputMs'),
      thinkingMs: this.positiveInt(patch.thinkingMs, current.thinkingMs, 'thinkingMs'),
      runningMs: this.positiveInt(patch.runningMs, current.runningMs, 'runningMs'),
      awaitingHumanMs: this.positiveInt(patch.awaitingHumanMs, current.awaitingHumanMs, 'awaitingHumanMs')
    }
  }

  private parseSources(values: unknown[]): HeartbeatSource[] {
    return values.map(value => {
      if (typeof value !== 'string' || !DEFAULT_SOURCES.includes(value as HeartbeatSource)) throw new Error('E_VALIDATION:unknown heartbeat source')
      return value as HeartbeatSource
    })
  }

  private parseActionPolicy(value: unknown, fallback: WatchdogActionPolicy): WatchdogActionPolicy {
    const policies: WatchdogActionPolicy[] = ['restart', 'fallback-tool', 'escalate-model', 'human-intervention', 'log-only']
    return typeof value === 'string' && policies.includes(value as WatchdogActionPolicy) ? value as WatchdogActionPolicy : fallback
  }

  private parsePhase(value: unknown, fallback: WatchdogPhase): WatchdogPhase {
    const phases: WatchdogPhase[] = ['receiving-input', 'thinking', 'running', 'awaiting-human']
    return typeof value === 'string' && phases.includes(value as WatchdogPhase) ? value as WatchdogPhase : fallback
  }

  private phaseTimeout(instance: WatchdogInstance, fallback: number): number {
    if (instance.phase === 'receiving-input') return instance.perPhase.receivingInputMs
    if (instance.phase === 'thinking') return instance.perPhase.thinkingMs
    if (instance.phase === 'awaiting-human') return instance.perPhase.awaitingHumanMs
    return instance.perPhase.runningMs || fallback
  }

  private highestWeightBeat(beats: HeartbeatBeat[]): HeartbeatBeat {
    return beats.reduce((best, beat) => {
      if (beat.weight > best.weight) return beat
      if (beat.weight === best.weight && beat.ts > best.ts) return beat
      return best
    }, beats[0])
  }

  private adjustedGraceMs(baseMs: number, resourceLoad?: WatchdogResourceLoad): number {
    return this.hasHighResourceLoad(resourceLoad) ? Math.ceil(baseMs * 1.5) : baseMs
  }

  private latestResourceLoad(instanceId: string): WatchdogResourceLoad | undefined {
    const latestBeat = this.beats()
      .filter(beat => beat.instanceId === instanceId && beat.detail && typeof beat.detail === 'object')
      .sort((left, right) => right.ts - left.ts)[0]
    if (!latestBeat?.detail) return undefined
    return {
      cpuPct: this.resourcePct(latestBeat.detail.cpuPct),
      ioPct: this.resourcePct(latestBeat.detail.ioPct),
      memoryMb: this.resourceAmount(latestBeat.detail.memoryMb)
    }
  }

  private memoryOverLimit(instanceId: string, memoryRestartMb: number): Record<string, unknown> | null {
    if (memoryRestartMb <= 0) return null
    const load = this.latestResourceLoad(instanceId)
    if (typeof load?.memoryMb !== 'number' || load.memoryMb <= memoryRestartMb) return null
    return {
      memoryMb: load.memoryMb,
      memoryRestartMb
    }
  }

  private hasHighResourceLoad(resourceLoad?: WatchdogResourceLoad): boolean {
    return (typeof resourceLoad?.cpuPct === 'number' && resourceLoad.cpuPct > 80) || (typeof resourceLoad?.ioPct === 'number' && resourceLoad.ioPct > 80)
  }

  private resourcePct(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  private resourceAmount(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
  }

  private config(): WatchdogConfig {
    const raw = this.objectInput(this.store.get('watchdogConfig', {}))
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      heartbeatTimeoutMs: this.positiveInt(raw.heartbeatTimeoutMs, 120_000, 'heartbeatTimeoutMs'),
      maxRestartsPerHour: this.positiveInt(raw.maxRestartsPerHour, 5, 'maxRestartsPerHour'),
      cooldownAfterStormMs: this.positiveInt(raw.cooldownAfterStormMs, 1_800_000, 'cooldownAfterStormMs'),
      startupGraceMs: this.positiveInt(raw.startupGraceMs, 30_000, 'startupGraceMs'),
      restartGraceMs: this.positiveInt(raw.restartGraceMs, 60_000, 'restartGraceMs'),
      memoryRestartMb: this.nonnegativeInt(raw.memoryRestartMb, 0, 'memoryRestartMb')
    }
  }

  private positiveInt(value: unknown, fallback: number, label: string): number {
    if (value === undefined || value === null) return fallback
    if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`E_VALIDATION:${label} must be a positive integer`)
    return Number(value)
  }

  private nonnegativeInt(value: unknown, fallback: number, label: string): number {
    if (value === undefined || value === null) return fallback
    if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`E_VALIDATION:${label} must be a nonnegative integer`)
    return Number(value)
  }

  private parseHeartbeat(input: HeartbeatBeat): HeartbeatBeat {
    if (!Number.isInteger(input.ts) || input.ts < 0) throw new Error('E_VALIDATION:heartbeat ts must be nonnegative integer')
    if (typeof input.instanceId !== 'string' || input.instanceId.length === 0) throw new Error('E_VALIDATION:instanceId is required')
    if (!DEFAULT_SOURCES.includes(input.source)) throw new Error('E_VALIDATION:unknown heartbeat source')
    if (typeof input.weight !== 'number' || input.weight < 0 || input.weight > 1) throw new Error('E_VALIDATION:heartbeat weight must be between 0 and 1')
    return input
  }

  private listInstances(): WatchdogInstance[] {
    const value = this.store.get('watchdogInstances', [])
    return Array.isArray(value) ? value.filter((item): item is WatchdogInstance => this.isInstance(item)) : []
  }

  private persistInstances(instances: WatchdogInstance[]): void {
    this.store.set('watchdogInstances', instances)
  }

  private beats(): HeartbeatBeat[] {
    const value = this.store.get('watchdogBeats', [])
    return Array.isArray(value) ? value.filter((item): item is HeartbeatBeat => this.isBeat(item)) : []
  }

  private events(): WatchdogEvent[] {
    const value = this.store.get('watchdogHistory', [])
    return Array.isArray(value) ? value.filter((item): item is WatchdogEvent => this.isEvent(item)) : []
  }

  private appendEvent(input: Omit<WatchdogEvent, 'eventId' | 'at'> & { at?: number }): WatchdogEvent {
    const event: WatchdogEvent = { eventId: `watchdog-${Math.random().toString(36).slice(2)}`, at: input.at ?? this.now(), type: input.type, instanceId: input.instanceId, data: input.data }
    this.store.set('watchdogHistory', [event, ...this.events()].slice(0, 5000))
    return event
  }

  private restartEvents(now: number, windowMs: number): WatchdogEvent[] {
    return this.events().filter(event => event.type === 'action-taken' && event.data.action === 'restart' && now - event.at <= windowMs)
  }

  private selfCheckAt(): number | null {
    const value = this.store.get('watchdogSelfCheckAt', null)
    return typeof value === 'number' ? value : null
  }

  private aggregateState(instances: WatchdogInstance[]): WatchdogStatusSnapshot['state'] {
    if (instances.length === 0) return 'idle'
    if (instances.some(instance => instance.state === 'dead')) return 'dead'
    if (instances.some(instance => instance.state === 'fallback-pending')) return 'fallback-pending'
    if (instances.some(instance => instance.state === 'human-pending')) return 'human-pending'
    if (instances.some(instance => instance.state === 'restarting')) return 'restarting'
    if (instances.some(instance => instance.state === 'stuck')) return 'stuck'
    if (instances.some(instance => instance.state === 'suspect')) return 'suspect'
    return 'watching'
  }

  private objectInput(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
  }

  private isInstance(value: unknown): value is WatchdogInstance {
    if (!value || typeof value !== 'object') return false
    const item = value as Partial<WatchdogInstance>
    return typeof item.instanceId === 'string' && typeof item.pid === 'number' && typeof item.tool === 'string' && typeof item.state === 'string'
  }

  private isBeat(value: unknown): value is HeartbeatBeat {
    if (!value || typeof value !== 'object') return false
    const item = value as Partial<HeartbeatBeat>
    return typeof item.ts === 'number' && typeof item.instanceId === 'string' && typeof item.source === 'string' && typeof item.weight === 'number'
  }

  private isEvent(value: unknown): value is WatchdogEvent {
    if (!value || typeof value !== 'object') return false
    const item = value as Partial<WatchdogEvent>
    return typeof item.eventId === 'string' && typeof item.type === 'string' && typeof item.at === 'number' && typeof item.data === 'object'
  }
}
