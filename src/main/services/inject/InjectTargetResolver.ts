import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import {
  injectCountdownConfigSchema,
  injectReadyPoolInstanceSchema,
  injectResolveTargetInputSchema,
  injectResolveTargetResultSchema,
  injectStrictModeConfigSchema,
  type InjectCountdownConfig,
  type InjectReadyPoolInstance,
  type InjectResolveTargetInput,
  type InjectResolveTargetResult,
  type InjectScenario,
  type InjectStrictModeConfig,
  type InjectTool,
  type InjectWhitelistEntry,
  type ResolvedInjectTarget
} from '@shared/schemas/inject'

export interface InjectTargetRecord {
  alias: string
  pid?: number | null
  hwnd?: number | null
  tool?: InjectTool | null
  cwd?: string | null
  ready?: boolean
  state?: string | null
  taskId?: string | null
  rowAlias?: string | null
  lastReadyAt?: number | null
}

export interface InjectTargetResolverOptions {
  records: () => InjectTargetRecord[]
  whitelistEntries: () => InjectWhitelistEntry[]
  strictMode: () => InjectStrictModeConfig
  countdown: () => InjectCountdownConfig
  now?: () => number
}

type TargetSelection =
  | { target: ResolvedInjectTarget }
  | { errorCode: 'E_NOT_FOUND' | 'E_VALIDATION'; reason: string }

const ANY_ALIAS_PREFIX = 'any-'

export function hashInjectWhitelistPattern(scope: string, pattern: string): string {
  return createHash('sha256').update(`${scope}:${normalizePattern(pattern)}`).digest('hex')
}

export function expiresAtForDuration(duration: InjectWhitelistEntry['duration'], createdAt: number): number | null {
  if (duration === 'permanent') return null
  if (duration === 'session') return null
  if (duration === '24h') return createdAt + 24 * 60 * 60 * 1000
  return createdAt + 7 * 24 * 60 * 60 * 1000
}

export class InjectTargetResolver {
  private readonly now: () => number

  constructor(private readonly options: InjectTargetResolverOptions) {
    this.now = options.now ?? (() => Date.now())
  }

  resolve(rawInput: unknown): InjectResolveTargetResult {
    const input = injectResolveTargetInputSchema.parse(rawInput)
    const selected = this.selectTarget(input)
    if ('errorCode' in selected) {
      return injectResolveTargetResultSchema.parse({
        ok: false,
        target: null,
        whitelistGate: 'denied-not-listed',
        strictModeGate: 'allowed',
        countdownMs: 0,
        reason: selected.reason,
        errorCode: selected.errorCode,
        resolvedAt: this.now()
      })
    }

    const whitelistGate = this.whitelistGate(selected.target, input.scenario)
    const strictModeGate = this.strictModeGate(input)
    const ok = whitelistGate === 'allowed' && strictModeGate === 'allowed'
    return injectResolveTargetResultSchema.parse({
      ok,
      target: selected.target,
      whitelistGate,
      strictModeGate,
      countdownMs: this.countdownMs(input.scenario, whitelistGate, strictModeGate),
      reason: ok ? undefined : this.blockReason(whitelistGate, strictModeGate),
      errorCode: ok ? null : whitelistGate === 'first-time-needed' ? 'E_PERMISSION_DENIED' : 'E_INJECT_BLOCKED',
      resolvedAt: this.now()
    })
  }

  readyPool(rawInput: Partial<InjectResolveTargetInput> = {}): InjectReadyPoolInstance[] {
    const records = this.records().filter(record => this.isReady(record))
    return records
      .map(record => this.toResolved(record, { selector: 'ready-pool', aliasOrId: rawInput.aliasOrId ?? record.alias, scenario: rawInput.scenario ?? 'manual-template' }))
      .filter((target): target is ResolvedInjectTarget => Boolean(target))
      .map(target => injectReadyPoolInstanceSchema.parse({ ...target, resolvedAlias: target.resolvedAlias ?? target.aliasOrId, ready: true, lastReadyAt: target.lastReadyAt ?? this.now() }))
      .sort((left, right) => right.lastReadyAt - left.lastReadyAt)
  }

  private selectTarget(input: InjectResolveTargetInput): TargetSelection {
    if (input.selector === 'ready-pool') return this.selectReadyPool(input)
    if (input.selector === 'pid' || input.selector === 'window-handle') return this.selectPidHwnd(input)
    const matches = this.records().filter(record => {
      if (input.selector === 'csv-row-alias') return record.rowAlias === input.aliasOrId
      return record.alias === input.aliasOrId
    })
    return this.singleMatch(matches, input, input.selector === 'csv-row-alias' ? 'csv row alias target not found' : 'alias target not found')
  }

  private selectReadyPool(input: InjectResolveTargetInput): TargetSelection {
    const token = input.aliasOrId.toLowerCase()
    const preferredTool = token.startsWith(ANY_ALIAS_PREFIX) ? token.slice(ANY_ALIAS_PREFIX.length) : token
    const candidates = this.records()
      .filter(record => this.isReady(record))
      .filter(record => token === 'any' || record.alias.toLowerCase() === token || record.tool === preferredTool || record.alias.toLowerCase().includes(token))
      .sort((left, right) => (right.lastReadyAt ?? 0) - (left.lastReadyAt ?? 0))
    if (candidates.length === 0) return { errorCode: 'E_NOT_FOUND', reason: 'ready-pool target not found' }
    const target = this.toResolved(candidates[0], input)
    return target ? { target } : { errorCode: 'E_NOT_FOUND', reason: 'ready-pool target not found' }
  }

  private selectPidHwnd(input: InjectResolveTargetInput): TargetSelection {
    if (input.selector === 'pid' && input.pid === undefined) {
      return { errorCode: 'E_VALIDATION', reason: 'pid selector requires pid' }
    }
    if (input.selector === 'window-handle' && input.hwnd === undefined) {
      return { errorCode: 'E_VALIDATION', reason: 'window-handle selector requires hwnd' }
    }
    const matches = this.records().filter(record => {
      const pidMatch = input.pid === undefined || record.pid === input.pid
      const hwndMatch = input.hwnd === undefined || record.hwnd === input.hwnd
      return pidMatch && hwndMatch
    })
    return this.singleMatch(matches, input, 'pid/window target not found')
  }

  private singleMatch(records: InjectTargetRecord[], input: InjectResolveTargetInput, notFoundReason: string): TargetSelection {
    if (records.length === 0) return { errorCode: 'E_NOT_FOUND', reason: notFoundReason }
    if (records.length > 1) return { errorCode: 'E_VALIDATION', reason: 'target alias collision' }
    const target = this.toResolved(records[0], input)
    if (!target) return { errorCode: 'E_NOT_FOUND', reason: notFoundReason }
    if ((input.selector === 'pid' || input.selector === 'window-handle') && input.aliasOrId !== target.resolvedAlias) {
      return { errorCode: 'E_VALIDATION', reason: 'pid/window alias mismatch' }
    }
    return { target }
  }

  private toResolved(record: InjectTargetRecord, input: InjectResolveTargetInput): ResolvedInjectTarget | null {
    if (!record.alias) return null
    return {
      selector: input.selector,
      aliasOrId: input.aliasOrId,
      pid: input.pid,
      hwnd: input.hwnd,
      cwd: record.cwd ?? input.cwd ?? null,
      taskId: input.taskId,
      resolvedPid: record.pid ?? null,
      resolvedHwnd: record.hwnd ?? null,
      resolvedAlias: record.alias,
      resolvedTool: record.tool ?? null,
      ready: this.isReady(record),
      lastReadyAt: record.lastReadyAt ?? null
    }
  }

  private whitelistGate(target: ResolvedInjectTarget, scenario: InjectScenario): InjectResolveTargetResult['whitelistGate'] {
    const matches = this.options.whitelistEntries().filter(entry => this.matchesWhitelist(entry, target, scenario))
    const active = matches.find(entry => entry.enabled && !this.isExpired(entry))
    if (active) return 'allowed'
    if (matches.some(entry => this.isExpired(entry))) return 'denied-expired'
    return scenario === 'manual-template' ? 'first-time-needed' : 'denied-not-listed'
  }

  private strictModeGate(input: InjectResolveTargetInput): InjectResolveTargetResult['strictModeGate'] {
    const config = injectStrictModeConfigSchema.parse(this.options.strictMode())
    if (!config.enabled) return 'allowed'
    if (input.scenario === 'csv-task-driven' && config.bypassForCsvMode) return 'allowed'
    return config.applyToScenarios.includes(input.scenario) && !input.confirmedBy ? 'requires-explicit-confirm' : 'allowed'
  }

  private countdownMs(scenario: InjectScenario, whitelistGate: InjectResolveTargetResult['whitelistGate'], strictModeGate: InjectResolveTargetResult['strictModeGate']): number {
    if (scenario === 'csv-task-driven' && whitelistGate === 'allowed' && strictModeGate === 'allowed') return 0
    const config = injectCountdownConfigSchema.parse(this.options.countdown())
    return config.perScenarioMs[scenario] ?? config.defaultMs
  }

  private matchesWhitelist(entry: InjectWhitelistEntry, target: ResolvedInjectTarget, scenario: InjectScenario): boolean {
    if (!entry.scenarios.includes(scenario)) return false
    if (entry.scope === 'instance') return normalizePattern(entry.pattern) === normalizePattern(target.resolvedAlias ?? target.aliasOrId)
    if (entry.scope === 'tool') return Boolean(target.resolvedTool && normalizePattern(entry.pattern) === target.resolvedTool)
    if (!target.cwd) return false
    return pathMatchesPrefix(target.cwd, entry.pattern)
  }

  private isExpired(entry: InjectWhitelistEntry): boolean {
    return typeof entry.expiresAt === 'number' && entry.expiresAt <= this.now()
  }

  private isReady(record: InjectTargetRecord): boolean {
    return Boolean(record.ready || record.state === 'waiting-input')
  }

  private records(): InjectTargetRecord[] {
    return this.options.records().filter(record => record.alias.trim().length > 0)
  }

  private blockReason(whitelistGate: InjectResolveTargetResult['whitelistGate'], strictModeGate: InjectResolveTargetResult['strictModeGate']): string {
    if (strictModeGate === 'requires-explicit-confirm') return 'strict mode requires explicit confirmation'
    if (whitelistGate === 'first-time-needed') return 'first-time confirmation required'
    if (whitelistGate === 'denied-expired') return 'whitelist entry expired'
    return 'target is not whitelisted for this scenario'
  }
}

function normalizePattern(value: string): string {
  return value.trim().replace(/\\/g, '/').toLowerCase()
}

function normalizePath(value: string): string {
  return resolve(value).replace(/\\/g, '/').toLowerCase()
}

function pathMatchesPrefix(targetPath: string, allowedPrefix: string): boolean {
  const target = normalizePath(targetPath)
  const prefix = normalizePath(allowedPrefix)
  return target === prefix || target.startsWith(`${prefix}/`)
}
