import { describe, expect, it } from 'vitest'
import { injectWhitelistEntrySchema, type InjectCountdownConfig, type InjectStrictModeConfig, type InjectWhitelistEntry } from '@shared/schemas/inject'
import { InjectTargetResolver, expiresAtForDuration, hashInjectWhitelistPattern, type InjectTargetRecord } from './InjectTargetResolver'

const now = 1_800_000_000_000
const allScenarios: InjectWhitelistEntry['scenarios'] = ['csv-task-driven', 'watchdog-restart-resume', 'task-chain-next', 'error-recovery', 'user-schedule', 'manual-template']

function whitelist(pattern: string, overrides: Partial<InjectWhitelistEntry> = {}): InjectWhitelistEntry {
  const scope = overrides.scope ?? 'instance'
  const duration = overrides.duration ?? '24h'
  const createdAt = overrides.createdAt ?? now
  return injectWhitelistEntrySchema.parse({
    id: overrides.id ?? '00000000-0000-4000-8000-000000000001',
    scope,
    pattern,
    patternHash: overrides.patternHash ?? hashInjectWhitelistPattern(scope, pattern),
    scenarios: overrides.scenarios ?? allScenarios,
    duration,
    createdAt,
    expiresAt: overrides.expiresAt ?? expiresAtForDuration(duration, createdAt),
    createdBy: overrides.createdBy ?? 'user-explicit',
    enabled: overrides.enabled ?? true,
    reason: overrides.reason ?? 'vitest-fixture',
    confirmedBy: overrides.confirmedBy ?? 'vitest'
  })
}

function resolver(input: {
  records: InjectTargetRecord[]
  entries?: InjectWhitelistEntry[]
  strict?: Partial<InjectStrictModeConfig>
  countdown?: Partial<InjectCountdownConfig>
}) {
  return new InjectTargetResolver({
    records: () => input.records,
    whitelistEntries: () => input.entries ?? [],
    strictMode: () => ({ enabled: false, applyToScenarios: ['manual-template', 'user-schedule'], bypassForCsvMode: false, confirmedBy: null, ...input.strict }),
    countdown: () => ({ defaultMs: 3000, perScenarioMs: {}, showProgressBar: true, allowEscToCancel: true, confirmedBy: null, ...input.countdown }),
    now: () => now
  })
}

describe('InjectTargetResolver', () => {
  it('resolves an exact alias and passes an instance whitelist gate', () => {
    const targetResolver = resolver({
      records: [{ alias: 'claude-devhub', pid: 42, hwnd: 9001, tool: 'claude', ready: true, lastReadyAt: now - 10 }],
      entries: [whitelist('claude-devhub')]
    })

    const result = targetResolver.resolve({ selector: 'alias', aliasOrId: 'claude-devhub', scenario: 'manual-template' })

    expect(result.ok).toBe(true)
    expect(result.target?.resolvedTool).toBe('claude')
    expect(result.target?.resolvedPid).toBe(42)
    expect(result.target?.resolvedHwnd).toBe(9001)
  })

  it('selects only waiting-input instances for ready-pool targets', () => {
    const targetResolver = resolver({
      records: [
        { alias: 'claude-1', tool: 'claude', state: 'thinking', lastReadyAt: now - 1 },
        { alias: 'claude-3', tool: 'claude', state: 'waiting-input', lastReadyAt: now - 5 },
        { alias: 'codex-1', tool: 'codex', state: 'waiting-input', lastReadyAt: now - 2 }
      ],
      entries: [whitelist('claude', { scope: 'tool' })]
    })

    const result = targetResolver.resolve({ selector: 'ready-pool', aliasOrId: 'any-claude', scenario: 'manual-template' })

    expect(result.ok).toBe(true)
    expect(result.target?.resolvedAlias).toBe('claude-3')
    expect(targetResolver.readyPool().map(item => item.resolvedAlias)).toEqual(['codex-1', 'claude-3'])
  })

  it('requires first-time confirmation when a manual target is not whitelisted', () => {
    const targetResolver = resolver({ records: [{ alias: 'codex-1', tool: 'codex', ready: true }] })

    const result = targetResolver.resolve({ selector: 'alias', aliasOrId: 'codex-1', scenario: 'manual-template' })

    expect(result.ok).toBe(false)
    expect(result.whitelistGate).toBe('first-time-needed')
    expect(result.errorCode).toBe('E_PERMISSION_DENIED')
  })

  it('detects expired whitelist entries with epoch timestamps', () => {
    const targetResolver = resolver({
      records: [{ alias: 'codex-1', tool: 'codex', ready: true }],
      entries: [whitelist('codex-1', { createdAt: now - 25 * 60 * 60 * 1000, expiresAt: now - 60_000 })]
    })

    const result = targetResolver.resolve({ selector: 'alias', aliasOrId: 'codex-1', scenario: 'manual-template' })

    expect(result.whitelistGate).toBe('denied-expired')
    expect(result.ok).toBe(false)
  })

  it('enforces strict mode before countdown execution', () => {
    const targetResolver = resolver({
      records: [{ alias: 'codex-1', tool: 'codex', ready: true }],
      entries: [whitelist('codex-1')],
      strict: { enabled: true, applyToScenarios: ['manual-template'], bypassForCsvMode: false }
    })

    const result = targetResolver.resolve({ selector: 'alias', aliasOrId: 'codex-1', scenario: 'manual-template' })

    expect(result.strictModeGate).toBe('requires-explicit-confirm')
    expect(result.countdownMs).toBe(3000)
  })

  it('allows CSV automation to skip countdown only after whitelist approval', () => {
    const targetResolver = resolver({
      records: [{ alias: 'batch-row-1', rowAlias: 'row-1', tool: 'codex', ready: true }],
      entries: [whitelist('batch-row-1', { scenarios: ['csv-task-driven'] })],
      countdown: { defaultMs: 3000, perScenarioMs: { 'csv-task-driven': 5000 } }
    })

    const result = targetResolver.resolve({ selector: 'csv-row-alias', aliasOrId: 'row-1', scenario: 'csv-task-driven' })

    expect(result.ok).toBe(true)
    expect(result.countdownMs).toBe(0)
  })

  it('resolves CSV row aliases only through row alias mappings', () => {
    const targetResolver = resolver({
      records: [{ alias: 'codex-batch-7', rowAlias: 'row-7', pid: 707, hwnd: 1707, tool: 'codex', ready: true }],
      entries: [whitelist('codex-batch-7', { scenarios: ['csv-task-driven'] })]
    })

    const result = targetResolver.resolve({ selector: 'csv-row-alias', aliasOrId: 'row-7', scenario: 'csv-task-driven' })
    const rawAliasResult = targetResolver.resolve({ selector: 'csv-row-alias', aliasOrId: 'codex-batch-7', scenario: 'csv-task-driven' })

    expect(result.ok).toBe(true)
    expect(result.target?.resolvedAlias).toBe('codex-batch-7')
    expect(result.target?.resolvedPid).toBe(707)
    expect(rawAliasResult.ok).toBe(false)
    expect(rawAliasResult.errorCode).toBe('E_NOT_FOUND')
  })

  it('matches project cwd whitelist entries by normalized prefix', () => {
    const targetResolver = resolver({
      records: [{ alias: 'codex-cwd', tool: 'codex', cwd: 'D:/Projects/myapp/sub', ready: true }],
      entries: [whitelist('D:/Projects/myapp', { scope: 'project-cwd' })]
    })

    const result = targetResolver.resolve({ selector: 'alias', aliasOrId: 'codex-cwd', scenario: 'manual-template' })

    expect(result.ok).toBe(true)
    expect(result.whitelistGate).toBe('allowed')
  })

  it('does not match sibling cwd names that only share a string prefix', () => {
    const targetResolver = resolver({
      records: [{ alias: 'codex-cwd', tool: 'codex', cwd: 'D:/Projects/myapp2/sub', ready: true }],
      entries: [whitelist('D:/Projects/myapp', { scope: 'project-cwd' })]
    })

    const result = targetResolver.resolve({ selector: 'alias', aliasOrId: 'codex-cwd', scenario: 'manual-template' })

    expect(result.ok).toBe(false)
    expect(result.whitelistGate).toBe('first-time-needed')
    expect(result.errorCode).toBe('E_PERMISSION_DENIED')
  })

  it('rejects pid or window handle targets when the alias does not match', () => {
    const targetResolver = resolver({
      records: [{ alias: 'claude-devhub', pid: 1234, hwnd: 55, tool: 'claude', ready: true }],
      entries: [whitelist('claude-devhub')]
    })

    const result = targetResolver.resolve({ selector: 'pid', aliasOrId: 'codex-devhub', pid: 1234, scenario: 'manual-template' })

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('E_VALIDATION')
  })

  it('requires concrete pid and window handle selector inputs before alias verification', () => {
    const targetResolver = resolver({
      records: [{ alias: 'claude-devhub', pid: 1234, hwnd: 55, tool: 'claude', ready: true }],
      entries: [whitelist('claude-devhub')]
    })

    const missingPid = targetResolver.resolve({ selector: 'pid', aliasOrId: 'claude-devhub', scenario: 'manual-template' })
    const windowHandle = targetResolver.resolve({ selector: 'window-handle', aliasOrId: 'claude-devhub', hwnd: 55, scenario: 'manual-template' })
    const missingWindowHandle = targetResolver.resolve({ selector: 'window-handle', aliasOrId: 'claude-devhub', scenario: 'manual-template' })

    expect(missingPid.ok).toBe(false)
    expect(missingPid.errorCode).toBe('E_VALIDATION')
    expect(missingPid.reason).toBe('pid selector requires pid')
    expect(windowHandle.ok).toBe(true)
    expect(windowHandle.target?.resolvedPid).toBe(1234)
    expect(missingWindowHandle.ok).toBe(false)
    expect(missingWindowHandle.errorCode).toBe('E_VALIDATION')
    expect(missingWindowHandle.reason).toBe('window-handle selector requires hwnd')
  })

  it('covers the selector, whitelist scope, and duration matrix without simulated targets', () => {
    const selectors = ['alias', 'ready-pool', 'csv-row-alias', 'pid'] as const
    const scopes: InjectWhitelistEntry['scope'][] = ['instance', 'tool', 'project-cwd']
    const durations: InjectWhitelistEntry['duration'][] = ['session', '24h', '7d', 'permanent']
    const results: string[] = []

    for (const selector of selectors) {
      for (const scope of scopes) {
        for (const duration of durations) {
          const alias = `codex-${selector}-${scope}-${duration}`
          const record: InjectTargetRecord = {
            alias,
            rowAlias: `${alias}-row`,
            pid: 9000 + results.length,
            hwnd: 19000 + results.length,
            tool: 'codex',
            cwd: 'D:/Projects/matrix/sub',
            state: 'waiting-input',
            lastReadyAt: now - results.length
          }
          const pattern = scope === 'tool'
            ? 'codex'
            : scope === 'project-cwd'
              ? 'D:/Projects/matrix'
              : alias
          const targetResolver = resolver({
            records: [record],
            entries: [whitelist(pattern, { scope, duration })]
          })
          const input = selector === 'ready-pool'
            ? { selector, aliasOrId: 'any-codex', scenario: 'manual-template' as const }
            : selector === 'csv-row-alias'
              ? { selector, aliasOrId: `${alias}-row`, scenario: 'manual-template' as const }
              : selector === 'pid'
                ? { selector, aliasOrId: alias, pid: record.pid, scenario: 'manual-template' as const }
                : { selector, aliasOrId: alias, scenario: 'manual-template' as const }
          const result = targetResolver.resolve(input)

          expect(result.ok).toBe(true)
          expect(result.whitelistGate).toBe('allowed')
          expect(result.target?.resolvedAlias).toBe(alias)
          results.push(`${selector}:${scope}:${duration}`)
        }
      }
    }

    expect(results).toHaveLength(4 * 3 * 4)
  })
})
