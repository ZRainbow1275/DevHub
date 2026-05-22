import { createHash, randomUUID } from 'node:crypto'
import {
  injectActionSchemaV2,
  injectResultSchemaV2,
  normalizedInjectActionSchema,
  type InjectActionV2,
  type InjectAuditRecord,
  type InjectFailureKind,
  type InjectMode,
  type InjectResultV2
} from '@shared/schemas/inject'
import { InjectAuditRepository, type InjectAuditStore } from './InjectAuditRepository'
import { InjectChunker } from './InjectChunker'
import { InjectFailureClassifier } from './InjectFailureClassifier'
import { InjectModeSelector } from './InjectModeSelector'
import { FocusPollingGuard, type FocusPollingSession, type ForegroundWindowProvider } from './FocusPollingGuard'
import { InjectModeRegistry, type ShimControlBridge } from './modes'
import { InjectScenarioRegistry, type InjectScenarioBuildOptions, type InjectScenarioAction } from './scenarios'

export interface InjectTargetResolution {
  found: boolean
  ready?: boolean
  target?: unknown
  whitelistGate?: 'allowed' | 'denied-not-listed' | 'denied-expired' | 'first-time-needed'
  strictModeGate?: 'allowed' | 'requires-explicit-confirm'
  countdownMs?: number
  reason?: string
}

export interface NativeTextTyper {
  typeText(input: { text: string; flagOverrides?: Record<string, boolean> }): Promise<{ success: boolean; data?: { characters: number }; error?: string }>
}

export interface ClipboardPasteBridge {
  readText: () => string
  writeText: (text: string) => void
  paste: () => Promise<{ success: boolean; error?: string }>
}

export interface InjectScreenshotBridge {
  capture: (input: { action: InjectActionV2; target: unknown; phase: 'before' | 'after' }) => Promise<{ success: boolean; path?: string; error?: string }>
}

export interface InjectServiceOptions {
  store: InjectAuditStore
  nativeTyper: NativeTextTyper
  resolveTarget: (action: InjectActionV2) => InjectTargetResolution
  flagOverrides: () => Record<string, boolean>
  auditDbPath?: string
  clipboardBridge?: ClipboardPasteBridge
  focusCheck?: () => boolean
  foregroundWindowProvider?: ForegroundWindowProvider
  focusPollingIntervalMs?: number
  shimControlBridge?: ShimControlBridge
  screenshotBridge?: InjectScreenshotBridge
  chunkIntervalMs?: number
  now?: () => number
}

export class InjectService {
  private readonly chunker = new InjectChunker()
  private readonly classifier = new InjectFailureClassifier()
  private readonly selector = new InjectModeSelector()
  private readonly modeRegistry = new InjectModeRegistry()
  private readonly scenarios = new InjectScenarioRegistry()
  private readonly audit: InjectAuditRepository
  private readonly focusPollingGuard: FocusPollingGuard
  private readonly chunkIntervalMs: number
  private readonly now: () => number

  constructor(private readonly options: InjectServiceOptions) {
    this.chunkIntervalMs = Math.max(0, options.chunkIntervalMs ?? 200)
    this.now = options.now ?? (() => Date.now())
    this.audit = new InjectAuditRepository(options.store, this.now, options.auditDbPath ?? null)
    this.focusPollingGuard = new FocusPollingGuard(options.foregroundWindowProvider, options.focusPollingIntervalMs ?? 50)
  }

  dryRun(input: unknown): InjectResultV2 {
    const action = this.normalize(input, true)
    const chunks = this.chunker.chunk(action.text)
    const target = this.options.resolveTarget(action)
    const success = target.found
    const failureKind: InjectFailureKind | null = success ? null : 'target-not-found'
    this.audit.append({ action, status: 'dry-run', modeUsed: 'disabled', failureKind, confirmedBy: this.confirmedBy(action) })
    return this.result({
      action,
      success,
      dryRun: true,
      status: success ? 'success' : 'failed',
      modeUsed: 'disabled',
      failureKind,
      error: success ? null : 'E_NOT_FOUND:inject target not found',
      attemptCount: 0,
      injectedLength: 0,
      chunkCount: chunks.length,
      startedAt: this.now()
    })
  }

  async execute(input: unknown): Promise<InjectResultV2> {
    const action = this.normalize(input, false)
    if (!action.confirmedBy || String(action.confirmedBy).length < 3) throw new Error('E_PERMISSION:confirmedBy required')
    const target = this.options.resolveTarget(action)
    if (!target.found) return this.failed(action, 'target-not-found', 'E_NOT_FOUND:inject target not found', 'disabled', 0)
    if (action.target.selector === 'ready-pool' && target.ready === false) return this.failed(action, 'input-not-ready', 'E_NOT_FOUND:inject target is not ready for input', 'disabled', 0)
    if (target.whitelistGate && target.whitelistGate !== 'allowed') return this.failed(action, 'permission', 'E_INJECT_BLOCKED:' + target.whitelistGate, 'disabled', 0)
    if (target.strictModeGate === 'requires-explicit-confirm') return this.failed(action, 'permission', 'E_PERMISSION_DENIED:strict mode requires explicit confirmation', 'disabled', 0)
    const chunks = this.chunker.chunk(action.text)
    const plan = this.selector.select(action)
    const modes = [plan.mode, ...plan.fallback.filter(mode => mode !== plan.mode)].slice(0, 4)
    const startedAt = this.now()
    const screenshotBefore = await this.captureScreenshot(action, target.target, 'before')
    if (screenshotBefore?.success === false) {
      return this.failed(action, 'runtime-error', screenshotBefore.error ?? 'E_SCREENSHOT_BEFORE_FAILED:inject before screenshot capture failed', 'disabled', 0, chunks.length, startedAt)
    }
    let attemptCount = 0
    let lastError = 'E_RUNTIME:inject failed'
    for (const mode of modes) {
      attemptCount += 1
      const focusSession = await this.focusPollingGuard.start(this.targetHwnd(target.target))
      const focusStartError = focusSession.failureReason()
      if (focusStartError) {
        focusSession.stop()
        return this.failed(action, this.classifier.classify(focusStartError), focusStartError, mode, attemptCount, chunks.length, startedAt)
      }
      const typed = await this.modeRegistry.execute(mode, {
        action,
        chunks,
        target: target.target,
        typeSendInputChunks: chunksToType => this.typeSendInputChunks(chunksToType, focusSession),
        shimControlBridge: this.options.shimControlBridge,
        clipboardBridge: this.options.clipboardBridge
      })
      const focusError = focusSession.failureReason()
      focusSession.stop()
      if (focusError) return this.failed(action, this.classifier.classify(focusError), focusError, typed.mode, attemptCount, chunks.length, startedAt)
      if (typed.success) {
        const injectedLength = typed.data?.characters ?? action.text.length
        const verifiedContentMatches = typed.data?.verifiedContentMatches ?? null
        const verificationError = typed.data?.verificationError ?? null
        if (injectedLength < action.text.length) {
          this.audit.append({ action, status: 'partial', modeUsed: typed.mode, failureKind: 'runtime-error', confirmedBy: this.confirmedBy(action), verifiedContentMatches: false, verificationError: 'E_PARTIAL_INJECT:native typer reported fewer characters than requested', screenshotPathBefore: screenshotBefore?.path ?? null })
          return this.result({ action, success: false, dryRun: false, status: 'partial', modeUsed: typed.mode, failureKind: 'runtime-error', error: 'E_PARTIAL_INJECT:native typer reported fewer characters than requested', attemptCount, injectedLength, chunkCount: chunks.length, startedAt, screenshotPathBefore: screenshotBefore?.path ?? null, verifiedContentMatches: false })
        }
        const screenshotAfter = await this.captureScreenshot(action, target.target, 'after')
        if (screenshotAfter?.success === false) {
          this.audit.append({ action, status: 'partial', modeUsed: typed.mode, failureKind: 'runtime-error', confirmedBy: this.confirmedBy(action), verifiedContentMatches, verificationError, screenshotPathBefore: screenshotBefore?.path ?? null })
          return this.result({ action, success: false, dryRun: false, status: 'partial', modeUsed: typed.mode, failureKind: 'runtime-error', error: screenshotAfter.error ?? 'E_SCREENSHOT_AFTER_FAILED:inject after screenshot capture failed', attemptCount, injectedLength, chunkCount: chunks.length, startedAt, screenshotPathBefore: screenshotBefore?.path ?? null, verifiedContentMatches: verifiedContentMatches ?? false })
        }
        if (verifiedContentMatches === false) {
          const error = verificationError ?? 'E_CONTENT_VERIFY_FAILED:post-inject content verification did not match target output'
          this.audit.append({ action, status: 'partial', modeUsed: typed.mode, failureKind: 'runtime-error', confirmedBy: this.confirmedBy(action), verifiedContentMatches: false, verificationError: error, screenshotPathBefore: screenshotBefore?.path ?? null, screenshotPathAfter: screenshotAfter?.path ?? null })
          return this.result({ action, success: false, dryRun: false, status: 'partial', modeUsed: typed.mode, failureKind: 'runtime-error', error, attemptCount, injectedLength, chunkCount: chunks.length, startedAt, screenshotPathBefore: screenshotBefore?.path ?? null, screenshotPathAfter: screenshotAfter?.path ?? null, verifiedContentMatches: false })
        }
        this.audit.append({ action, status: 'success', modeUsed: typed.mode, failureKind: null, confirmedBy: this.confirmedBy(action), verifiedContentMatches, verificationError, screenshotPathBefore: screenshotBefore?.path ?? null, screenshotPathAfter: screenshotAfter?.path ?? null })
        return this.result({ action, success: true, dryRun: false, status: 'success', modeUsed: typed.mode, failureKind: null, error: null, attemptCount, injectedLength, chunkCount: chunks.length, startedAt, screenshotPathBefore: screenshotBefore?.path ?? null, screenshotPathAfter: screenshotAfter?.path ?? null, verifiedContentMatches })
      }
      lastError = typed.error ?? 'E_RUNTIME:native typer failed'
      const failureKind = this.classifier.classify(lastError)
      if (action.isMetaCommand && failureKind === 'shim-not-installed') {
        return this.failed(action, failureKind, lastError, typed.mode, attemptCount, chunks.length, startedAt)
      }
      if (failureKind === 'user-stole-focus' || failureKind === 'no-focus') {
        return this.failed(action, failureKind, lastError, typed.mode, attemptCount, chunks.length, startedAt)
      }
    }
    return this.failed(action, this.classifier.classify(lastError), lastError, modes.at(-1) ?? 'disabled', attemptCount, chunks.length, startedAt)
  }

  listAudit(): InjectAuditRecord[] {
    return this.audit.list()
  }

  buildScenarioAction(scenario: InjectActionV2['scenario'], options: InjectScenarioBuildOptions): InjectScenarioAction {
    return this.scenarios.buildAction(scenario, options)
  }

  private async typeSendInputChunks(chunks: ReturnType<InjectChunker['chunk']>, focusSession: FocusPollingSession): Promise<{ success: boolean; data?: { characters: number }; error?: string }> {
    const flagOverrides = this.options.flagOverrides()
    let characters = 0
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const focusError = await this.focusFailure(focusSession)
      if (focusError) return { success: false, error: focusError }
      const typed = await this.options.nativeTyper.typeText({ text: chunk.text, flagOverrides })
      const postTypeFocusError = await this.focusFailure(focusSession)
      if (postTypeFocusError) return { success: false, error: postTypeFocusError }
      if (!typed.success) return typed
      const typedCharacters = typed.data?.characters ?? chunk.text.length
      characters += typedCharacters
      if (typedCharacters < chunk.text.length) return { success: true, data: { characters } }
      if (chunkIndex < chunks.length - 1 && this.chunkIntervalMs > 0) {
        const delayCompleted = await this.delay(this.chunkIntervalMs, focusSession)
        if (!delayCompleted) return { success: false, error: focusSession.failureReason() ?? 'E_USER_STOLE_FOCUS:foreground changed during chunk interval' }
      }
    }
    return { success: true, data: { characters } }
  }

  private async focusFailure(focusSession: FocusPollingSession): Promise<string | null> {
    if (!this.isFocusSafe()) return 'E_USER_STOLE_FOCUS:foreground changed between chunks'
    const safe = await focusSession.checkNow()
    return safe ? null : focusSession.failureReason() ?? 'E_USER_STOLE_FOCUS:foreground changed during inject'
  }

  private isFocusSafe(): boolean {
    if (!this.options.focusCheck) return true
    try {
      return this.options.focusCheck()
    } catch {
      return false
    }
  }

  private async delay(ms: number, focusSession: FocusPollingSession): Promise<boolean> {
    return focusSession.wait(ms)
  }

  private async captureScreenshot(action: InjectActionV2, target: unknown, phase: 'before' | 'after'): Promise<{ success: boolean; path?: string; error?: string } | null> {
    if (!this.options.screenshotBridge) return null
    try {
      const result = await this.options.screenshotBridge.capture({ action, target, phase })
      if (result.success) return result
      return {
        success: false,
        error: result.error ?? `E_SCREENSHOT_${phase.toUpperCase()}_FAILED:inject screenshot capture did not return a path`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private targetHwnd(target: unknown): number | null {
    if (typeof target !== 'object' || target === null) return null
    const record = target as Record<string, unknown>
    const resolvedHwnd = Number(record.resolvedHwnd ?? record.hwnd)
    if (!Number.isInteger(resolvedHwnd) || resolvedHwnd <= 0) return null
    return resolvedHwnd
  }

  private normalize(input: unknown, dryRun: boolean): InjectActionV2 {
    const raw = injectActionSchemaV2.parse({ ...(typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}), dryRun })
    const targetAlias = raw.targetAlias ?? raw.target?.aliasOrId ?? ''
    const text = raw.text.normalize('NFC')
    const textHash = createHash('sha256').update(text).digest('hex')
    return normalizedInjectActionSchema.parse({
      ...raw,
      id: raw.id ?? randomUUID(),
      target: raw.target ?? { selector: 'alias', aliasOrId: targetAlias },
      targetAlias,
      text,
      textHash,
      textLength: text.length,
      dryRun
    })
  }

  private failed(action: InjectActionV2, failureKind: InjectFailureKind, error: string, modeUsed: InjectMode | 'disabled', attemptCount: number, chunkCount = 1, startedAt = this.now()): InjectResultV2 {
    this.audit.append({ action, status: 'failed', modeUsed, failureKind, confirmedBy: this.confirmedBy(action) })
    return this.result({ action, success: false, dryRun: false, status: 'failed', modeUsed, failureKind, error, attemptCount, injectedLength: 0, chunkCount, startedAt })
  }

  private result(input: { action: InjectActionV2; success: boolean; dryRun: boolean; status: InjectResultV2['status']; modeUsed: InjectMode | 'disabled'; failureKind: InjectFailureKind | null; error: string | null; attemptCount: number; injectedLength: number; chunkCount: number; startedAt: number; screenshotPathBefore?: string | null; screenshotPathAfter?: string | null; verifiedContentMatches?: boolean | null }): InjectResultV2 {
    const durationMs = Math.max(0, this.now() - input.startedAt)
    return injectResultSchemaV2.parse({
      actionId: input.action.id,
      status: input.status,
      success: input.success,
      dryRun: input.dryRun,
      targetAlias: input.action.targetAlias,
      failureKind: input.failureKind,
      error: input.error,
      errorMessage: input.error,
      modeUsed: input.modeUsed,
      attemptCount: input.attemptCount,
      durationMs,
      characters: input.action.text.length,
      injectedLength: input.injectedLength,
      verifiedContentMatches: input.verifiedContentMatches ?? (input.success ? null : false),
      screenshotPathBefore: input.screenshotPathBefore ?? null,
      screenshotPathAfter: input.screenshotPathAfter ?? null,
      textHash: input.action.textHash,
      chunkCount: input.chunkCount
    })
  }

  private confirmedBy(action: InjectActionV2): string | null {
    return typeof action.confirmedBy === 'string' ? action.confirmedBy : null
  }
}
