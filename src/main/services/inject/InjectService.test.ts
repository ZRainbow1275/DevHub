import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DatabaseConstructor from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import type { InjectActionV2 } from '@shared/schemas/inject'
import { InjectChunker } from './InjectChunker'
import { InjectFailureClassifier } from './InjectFailureClassifier'
import { InjectModeSelector } from './InjectModeSelector'
import { InjectService, type InjectTargetResolution } from './InjectService'
import { InjectModeRegistry } from './modes'
import { UiaMode } from './modes/UiaMode'
import { InjectScenarioRegistry } from './scenarios'

class MemoryStore {
  private readonly values = new Map<string, unknown>()

  get(key: string, defaultValue?: unknown): unknown {
    return this.values.has(key) ? this.values.get(key) : defaultValue
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value)
  }
}

describe('InjectService', () => {
  it('selects CLI, GUI, and meta-command mode fallbacks deterministically', () => {
    const selector = new InjectModeSelector()
    const baseAction = {
      id: '00000000-0000-4000-8000-000000000001',
      scenario: 'manual-template' as const,
      target: { selector: 'alias' as const, aliasOrId: 'target' },
      targetAlias: 'target',
      text: 'hello',
      textHash: 'a'.repeat(64),
      textLength: 5,
      isMetaCommand: false,
      mode: 'sendinput' as const,
      modeFallback: [],
      dryRun: false,
      countdownMs: 3000,
      strictModeRequiresExplicitConfirm: false,
      confirmedBy: 'vitest',
      taskId: null,
      sessionId: null,
      recordingId: null
    }

    expect(selector.select({ ...baseAction, targetAlias: 'codex-terminal' })).toEqual({ mode: 'pty', fallback: ['clipboard-paste', 'sendinput'] })
    expect(selector.select({ ...baseAction, targetAlias: 'cursor-gui' })).toEqual({ mode: 'clipboard-paste', fallback: ['uia', 'sendinput'] })
    expect(selector.select({ ...baseAction, isMetaCommand: true })).toEqual({ mode: 'pty', fallback: [] })
    expect(selector.select({ ...baseAction, mode: 'uia', modeFallback: ['clipboard-paste', 'sendinput'] })).toEqual({ mode: 'uia', fallback: ['clipboard-paste', 'sendinput'] })
  })

  it('executes all concrete mode classes without faking unavailable adapters', async () => {
    const registry = new InjectModeRegistry()
    const chunks = new InjectChunker().chunk('mode text')
    const action: InjectActionV2 = {
      id: '00000000-0000-4000-8000-000000000101',
      scenario: 'manual-template',
      target: { selector: 'alias', aliasOrId: 'cursor-gui' },
      targetAlias: 'cursor-gui',
      text: 'mode text',
      textHash: 'a'.repeat(64),
      textLength: 9,
      isMetaCommand: false,
      mode: 'sendinput',
      modeFallback: [],
      dryRun: false,
      countdownMs: 3000,
      strictModeRequiresExplicitConfirm: false,
      confirmedBy: 'user-explicit',
      taskId: null,
      sessionId: null,
      recordingId: null
    }

    expect(registry.list()).toEqual(['sendinput', 'pty', 'uia', 'clipboard-paste'])
    await expect(registry.execute('sendinput', {
      action,
      chunks,
      typeSendInputChunks: async chunksToType => ({ success: true, data: { characters: chunksToType.reduce((total, chunk) => total + chunk.text.length, 0) } })
    })).resolves.toMatchObject({ mode: 'sendinput', success: true, data: { characters: 9 } })
    await expect(registry.execute('pty', { action, chunks, typeSendInputChunks: async () => ({ success: true }) })).resolves.toMatchObject({
      mode: 'pty',
      success: false,
      error: expect.stringContaining('E_SHIM_NOT_INSTALLED')
    })
    await expect(registry.execute('uia', { action, chunks, typeSendInputChunks: async () => ({ success: true }) })).resolves.toMatchObject({
      mode: 'uia',
      success: false,
      error: expect.stringMatching(/UIA target HWND is required|UIA inject mode is only available on Windows/)
    })
    await expect(registry.execute('clipboard-paste', { action, chunks, typeSendInputChunks: async () => ({ success: true }) })).resolves.toMatchObject({
      mode: 'clipboard-paste',
      success: false,
      error: expect.stringContaining('clipboard ownership integration')
    })
  })

  const windowsIt = process.platform === 'win32' ? it : it.skip

  windowsIt('writes and verifies text through a real WinForms UIA ValuePattern target', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'devhub-uia-mode-'))
    const scriptPath = join(tempRoot, 'textbox-target.ps1')
    const text = `UIA real write ${Date.now()}`
    await writeFile(scriptPath, [
      'Add-Type -AssemblyName System.Windows.Forms',
      '[System.Windows.Forms.Application]::EnableVisualStyles()',
      '$form = New-Object System.Windows.Forms.Form',
      "$form.Text = 'DevHub UIA Test'",
      '$form.Width = 480',
      '$form.Height = 180',
      '$textBox = New-Object System.Windows.Forms.TextBox',
      '$textBox.Multiline = $true',
      '$textBox.Width = 420',
      '$textBox.Height = 80',
      '$textBox.Left = 20',
      '$textBox.Top = 20',
      '$form.Controls.Add($textBox)',
      '$form.Add_Shown({',
      '  $textBox.Focus()',
      '  [Console]::Out.WriteLine("HWND=$($form.Handle.ToInt64())")',
      '  [Console]::Out.Flush()',
      '})',
      '[System.Windows.Forms.Application]::Run($form)'
    ].join('\n'), 'utf8')

    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: false
    })
    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })

    try {
      const hwnd = await new Promise<number>((resolve, reject) => {
        let stdout = ''
        const timeout = setTimeout(() => {
          reject(new Error(`timed out waiting for WinForms HWND: ${stderr}`))
        }, 5000)
        child.stdout.on('data', chunk => {
          stdout += String(chunk)
          const match = /HWND=(\d+)/.exec(stdout)
          if (!match) return
          clearTimeout(timeout)
          resolve(Number(match[1]))
        })
        child.once('exit', code => {
          clearTimeout(timeout)
          reject(new Error(`WinForms target exited before HWND, code=${code}, stderr=${stderr}`))
        })
      })
      const action: InjectActionV2 = {
        id: '00000000-0000-4000-8000-000000000202',
        scenario: 'manual-template',
        target: { selector: 'window-handle', aliasOrId: 'winforms-uia', hwnd },
        targetAlias: 'winforms-uia',
        text,
        textHash: 'b'.repeat(64),
        textLength: text.length,
        isMetaCommand: false,
        mode: 'uia',
        modeFallback: [],
        dryRun: false,
        countdownMs: 3000,
        strictModeRequiresExplicitConfirm: false,
        confirmedBy: 'user-explicit',
        taskId: null,
        sessionId: null,
        recordingId: null
      }
      const result = await new UiaMode().execute({
        action,
        chunks: new InjectChunker().chunk(text),
        target: { resolvedHwnd: hwnd },
        typeSendInputChunks: async () => ({ success: false, error: 'sendinput must not be used by UIA mode' })
      })
      if (!result.success) throw new Error(`UIA mode failed: ${result.error ?? 'unknown error'}`)

      expect(result).toMatchObject({
        mode: 'uia',
        success: true,
        data: {
          characters: text.length,
          verifiedContentMatches: true
        }
      })
    } finally {
      child.kill()
      await rm(tempRoot, { recursive: true, force: true })
    }
  }, 15000)

  it('uses clipboard-paste bridge with save, paste, and restore semantics', async () => {
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const clipboardEvents: string[] = []
    let clipboardText = 'original clipboard'
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      clipboardBridge: {
        readText: () => clipboardText,
        writeText: text => {
          clipboardEvents.push(`write:${text}`)
          clipboardText = text
        },
        paste: async () => {
          clipboardEvents.push(`paste:${clipboardText}`)
          return { success: true }
        }
      }
    })

    const result = await service.execute({ targetAlias: 'cursor-gui', text: 'paste payload', mode: 'clipboard-paste', confirmedBy: 'vitest' })

    expect(result).toMatchObject({ success: true, modeUsed: 'clipboard-paste', injectedLength: 13 })
    expect(nativeTyper.typeText).not.toHaveBeenCalled()
    expect(clipboardText).toBe('original clipboard')
    expect(clipboardEvents).toEqual(['write:paste payload', 'paste:paste payload', 'write:original clipboard'])
    expect(service.listAudit()[0]).toMatchObject({ status: 'success', modeUsed: 'clipboard-paste' })
  })

  it('classifies every inject failure kind with a recommendation', () => {
    const classifier = new InjectFailureClassifier()
    const cases = [
      ['window handle not found', 'window-not-found'],
      ['target window is iconic minimized', 'window-iconic'],
      ['focus denied by foreground policy', 'no-focus'],
      ['target input not ready', 'input-not-ready'],
      ['foreground changed because user stole focus', 'user-stole-focus'],
      ['operator cancelled injection', 'ignored'],
      ['cursor position mismatch', 'wrong-position'],
      ['utf encoding failure', 'encoding-error'],
      ['rate limit timeout', 'rate-limited'],
      ['target tool crashed', 'tool-crashed'],
      ['clipboard ownership conflict', 'clipboard-conflict'],
      ['permission confirmation required', 'permission'],
      ['target alias missing', 'target-not-found'],
      ['native nut adapter disabled', 'native-disabled'],
      ['shim control channel missing', 'shim-not-installed'],
      ['unexpected runtime boundary', 'runtime-error']
    ] as const

    for (const [errorMessage, failureKind] of cases) {
      const diagnosis = classifier.diagnose(errorMessage)
      expect(diagnosis.failureKind).toBe(failureKind)
      expect(diagnosis.recommendation.length).toBeGreaterThan(20)
      expect(classifier.classify(errorMessage)).toBe(failureKind)
    }
  })

  it('builds every concrete scenario subclass into executable inject actions', () => {
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper: { typeText: vi.fn(async () => ({ success: true, data: { characters: 4 } })) },
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }),
      flagOverrides: () => ({})
    })
    const registry = new InjectScenarioRegistry()

    expect(registry.list()).toEqual([
      'csv-task-driven',
      'watchdog-restart-resume',
      'task-chain-next',
      'error-recovery',
      'user-schedule',
      'manual-template'
    ])

    for (const scenario of registry.list()) {
      const action = service.buildScenarioAction(scenario, {
        targetAlias: `${scenario}-target`,
        text: `prompt for ${scenario}`
      })
      const dryRun = service.dryRun(action)
      const successHook = registry.get(scenario).onSuccess(dryRun, { action })

      expect(action.scenario).toBe(scenario)
      expect(dryRun.success).toBe(true)
      expect(service.listAudit()[0]).toMatchObject({ scenario, targetAlias: `${scenario}-target` })
      expect(successHook).toMatchObject({ scenario, actionId: dryRun.actionId, status: 'success', failureKind: null })
    }

    expect(service.buildScenarioAction('csv-task-driven', { targetAlias: 'claude-devhub', text: 'csv prompt' })).toMatchObject({
      scenario: 'csv-task-driven',
      mode: 'pty',
      modeFallback: ['clipboard-paste', 'sendinput'],
      confirmedBy: 'csv-mode'
    })
    expect(service.buildScenarioAction('watchdog-restart-resume', { targetAlias: 'codex-terminal', text: 'resume prompt' })).toMatchObject({
      scenario: 'watchdog-restart-resume',
      text: 'resume prompt\n\n[continue]',
      mode: 'pty',
      modeFallback: ['uia', 'sendinput'],
      confirmedBy: 'auto-policy'
    })
    expect(service.buildScenarioAction('manual-template', { targetAlias: 'cursor-gui', text: 'manual prompt' })).toMatchObject({
      scenario: 'manual-template',
      mode: 'sendinput',
      modeFallback: [],
      confirmedBy: 'user-explicit'
    })
  })

  it('dry-runs target resolution and stores full content audit without injection', () => {
    const store = new MemoryStore()
    const nativeTyper = { typeText: vi.fn(async () => ({ success: true, data: { characters: 4 } })) }
    const service = new InjectService({ store, nativeTyper, resolveTarget: (): InjectTargetResolution => ({ found: false }), flagOverrides: () => ({}) })

    const result = service.dryRun({ targetAlias: 'missing-alias', text: 'full audit text', dryRun: true })

    expect(result.success).toBe(false)
    expect(result.failureKind).toBe('target-not-found')
    expect(nativeTyper.typeText).not.toHaveBeenCalled()
    expect(service.listAudit()[0].text).toBe('full audit text')
  })

  it('writes append-only SQLite audit rows with full text and hash indexes', async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), 'devhub-inject-audit-'))
    const auditDbPath = join(tempDirectory, 'inject-audit.sqlite')
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper: { typeText: vi.fn(async () => ({ success: true, data: { characters: 4 } })) },
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }),
      flagOverrides: () => ({}),
      auditDbPath,
      now: () => 1710000000000
    })

    try {
      const first = service.dryRun({ targetAlias: 'cursor-gui', text: `full audit text ${'x'.repeat(512)}`, dryRun: true })
      const second = service.dryRun({ targetAlias: 'codex-terminal', text: 'second audit text', dryRun: true })
      const database = new DatabaseConstructor(auditDbPath)

      try {
        const indexes = database.prepare("PRAGMA index_list('inject_audit_records')").all() as Array<{ name: string }>
        expect(indexes.map(index => index.name)).toEqual(expect.arrayContaining(['idx_inject_audit_text_hash', 'idx_inject_audit_created_at', 'idx_inject_audit_action_id']))

        const textHashRow = database.prepare('SELECT text, text_hash, payload_json FROM inject_audit_records WHERE text_hash = ?').get(first.textHash) as { text: string; text_hash: string; payload_json: string } | undefined
        expect(textHashRow).toMatchObject({ text: `full audit text ${'x'.repeat(512)}`, text_hash: first.textHash })
        expect(JSON.parse(textHashRow?.payload_json ?? '{}')).toMatchObject({ actionId: first.actionId, textHash: first.textHash })

        database.prepare(`
          INSERT INTO inject_audit_records (
            audit_id,
            action_id,
            scenario,
            target_alias,
            text,
            text_hash,
            text_length,
            mode_requested,
            mode_used,
            status,
            failure_kind,
            created_at,
            confirmed_by,
            payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'malformed-row',
          'malformed-action',
          'manual-template',
          'cursor-gui',
          'broken',
          'f'.repeat(64),
          6,
          'sendinput',
          'disabled',
          'dry-run',
          null,
          1710000000001,
          null,
          '{not-json'
        )
      } finally {
        database.close()
      }

      const auditRecords = service.listAudit()
      expect(auditRecords.map(record => record.actionId)).toEqual(expect.arrayContaining([first.actionId, second.actionId]))
      expect(auditRecords.every(record => record.auditId !== 'malformed-row')).toBe(true)
    } finally {
      await rm(tempDirectory, { recursive: true, force: true })
    }
  })

  it('falls through pty and clipboard modes before real sendinput execution', async () => {
    const store = new MemoryStore()
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const service = new InjectService({ store, nativeTyper, resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }), flagOverrides: () => ({ 'R8.A.libs.nut-js': true }) })

    const result = await service.execute({ targetAlias: 'codex-terminal', text: 'continue work', mode: 'pty', modeFallback: ['clipboard-paste', 'sendinput'], confirmedBy: 'vitest' })

    expect(result.success).toBe(true)
    expect(result.modeUsed).toBe('sendinput')
    expect(result.attemptCount).toBe(3)
    expect(nativeTyper.typeText).toHaveBeenCalledWith({ text: 'continue work', flagOverrides: { 'R8.A.libs.nut-js': true } })
    expect(service.listAudit()[0].status).toBe('success')
  })

  it('captures before and after screenshots around native typing', async () => {
    const events: string[] = []
    const nativeTyper = {
      typeText: vi.fn(async (input: { text: string }) => {
        events.push(`type:${input.text}`)
        return { success: true, data: { characters: input.text.length } }
      })
    }
    const screenshotBridge = {
      capture: vi.fn(async (input: { phase: 'before' | 'after'; target: unknown }) => {
        events.push(`screenshot:${input.phase}:${(input.target as { resolvedHwnd: number }).resolvedHwnd}`)
        return { success: true, path: `D:/devhub/inject-${input.phase}.png` }
      })
    }
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedHwnd: 808 } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      screenshotBridge
    })

    const result = await service.execute({ targetAlias: 'cursor-gui', text: 'hello', mode: 'sendinput', confirmedBy: 'vitest' })

    expect(result).toMatchObject({
      success: true,
      screenshotPathBefore: 'D:/devhub/inject-before.png',
      screenshotPathAfter: 'D:/devhub/inject-after.png'
    })
    expect(events).toEqual(['screenshot:before:808', 'type:hello', 'screenshot:after:808'])
    expect(screenshotBridge.capture).toHaveBeenCalledTimes(2)
  })

  it('fails before injection when configured before-screenshot capture fails', async () => {
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedHwnd: 808 } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      screenshotBridge: {
        capture: vi.fn(async () => ({ success: false, error: 'E_SCREENSHOT_BEFORE_FAILED:test failure' }))
      }
    })

    const result = await service.execute({ targetAlias: 'cursor-gui', text: 'hello', mode: 'sendinput', confirmedBy: 'vitest' })

    expect(result).toMatchObject({ success: false, modeUsed: 'disabled', attemptCount: 0, failureKind: 'runtime-error' })
    expect(result.error).toBe('E_SCREENSHOT_BEFORE_FAILED:test failure')
    expect(nativeTyper.typeText).not.toHaveBeenCalled()
  })

  it('downgrades to partial when configured after-screenshot capture fails after a successful write', async () => {
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedHwnd: 808 } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      screenshotBridge: {
        capture: vi.fn(async input => input.phase === 'before'
          ? { success: true, path: 'D:/devhub/inject-before.png' }
          : { success: false, error: 'E_SCREENSHOT_AFTER_FAILED:test failure' })
      }
    })

    const result = await service.execute({ targetAlias: 'cursor-gui', text: 'hello', mode: 'sendinput', confirmedBy: 'vitest' })

    expect(result).toMatchObject({
      success: false,
      status: 'partial',
      modeUsed: 'sendinput',
      injectedLength: 5,
      screenshotPathBefore: 'D:/devhub/inject-before.png',
      failureKind: 'runtime-error'
    })
    expect(result.error).toBe('E_SCREENSHOT_AFTER_FAILED:test failure')
    expect(nativeTyper.typeText).toHaveBeenCalledTimes(1)
  })

  it('routes meta-command pty injection through SHIM control without UI fallback', async () => {
    const store = new MemoryStore()
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const shimSend = vi.fn(async () => ({ success: true, data: { characters: 10 } }))
    const service = new InjectService({
      store,
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedTool: 'codex' } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      shimControlBridge: { send: shimSend }
    })

    const result = await service.execute({ targetAlias: 'codex-terminal', text: '[continue]', mode: 'pty', isMetaCommand: true, modeFallback: ['sendinput'], confirmedBy: 'vitest' })

    expect(result).toMatchObject({ success: true, modeUsed: 'pty', attemptCount: 1, injectedLength: 10, verifiedContentMatches: null })
    expect(shimSend).toHaveBeenCalledWith({ tool: 'codex', text: '[continue]', appendNewline: true, verifyEcho: false, echoText: '[continue]' })
    expect(nativeTyper.typeText).not.toHaveBeenCalled()
    expect(service.listAudit()[0]).toMatchObject({ status: 'success', modeUsed: 'pty' })
  })

  it('routes ordinary pty prompt injection through SHIM stdin when the bridge is connected', async () => {
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const shimSend = vi.fn(async () => ({ success: true, data: { characters: 12, verifiedContentMatches: true } }))
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedTool: 'claude' } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      shimControlBridge: { send: shimSend }
    })

    const result = await service.execute({ targetAlias: 'claude-terminal', text: 'prompt body', mode: 'pty', confirmedBy: 'vitest' })

    expect(result).toMatchObject({ success: true, modeUsed: 'pty', injectedLength: 12, verifiedContentMatches: true })
    expect(shimSend).toHaveBeenCalledWith({ tool: 'claude', text: 'prompt body', appendNewline: true, verifyEcho: true, echoText: 'prompt body' })
    expect(nativeTyper.typeText).not.toHaveBeenCalled()
    expect(service.listAudit()[0]).toMatchObject({ status: 'success', modeUsed: 'pty', verifiedContentMatches: true })
  })

  it('downgrades ordinary pty prompt injection to partial when SHIM echo verification fails', async () => {
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const shimSend = vi.fn(async () => ({
      success: true,
      data: {
        characters: 11,
        verifiedContentMatches: false,
        verificationError: 'E_SHIM_CONTROL_ECHO_TIMEOUT:shim stdout/stderr echo did not match injected text'
      }
    }))
    const screenshotBridge = {
      capture: vi.fn(async (input: { phase: 'before' | 'after' }) => ({
        success: true,
        path: `D:/devhub/inject-${input.phase}.png`
      }))
    }
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedTool: 'codex', resolvedHwnd: 909 } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      shimControlBridge: { send: shimSend },
      screenshotBridge
    })

    const result = await service.execute({ targetAlias: 'codex-terminal', text: 'prompt body', mode: 'pty', confirmedBy: 'vitest' })

    expect(result).toMatchObject({
      success: false,
      status: 'partial',
      modeUsed: 'pty',
      injectedLength: 11,
      verifiedContentMatches: false,
      screenshotPathBefore: 'D:/devhub/inject-before.png',
      screenshotPathAfter: 'D:/devhub/inject-after.png',
      failureKind: 'runtime-error'
    })
    expect(result.error).toContain('E_SHIM_CONTROL_ECHO_TIMEOUT')
    expect(shimSend).toHaveBeenCalledWith({ tool: 'codex', text: 'prompt body', appendNewline: true, verifyEcho: true, echoText: 'prompt body' })
    expect(nativeTyper.typeText).not.toHaveBeenCalled()
    expect(screenshotBridge.capture).toHaveBeenCalledTimes(2)
    expect(service.listAudit()[0]).toMatchObject({
      status: 'partial',
      modeUsed: 'pty',
      verifiedContentMatches: false,
      verificationError: expect.stringContaining('E_SHIM_CONTROL_ECHO_TIMEOUT'),
      screenshotPathAfter: 'D:/devhub/inject-after.png'
    })
  })

  it('does not fallback to sendinput when a meta-command SHIM control channel is unavailable', async () => {
    const store = new MemoryStore()
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const service = new InjectService({
      store,
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedTool: 'codex' } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true })
    })

    const result = await service.execute({ targetAlias: 'codex-terminal', text: '[continue]', mode: 'pty', isMetaCommand: true, modeFallback: ['sendinput'], confirmedBy: 'vitest' })

    expect(result).toMatchObject({ success: false, modeUsed: 'pty', attemptCount: 1, failureKind: 'shim-not-installed' })
    expect(result.error).toContain('E_SHIM_NOT_CONNECTED')
    expect(nativeTyper.typeText).not.toHaveBeenCalled()
    expect(service.listAudit()[0]).toMatchObject({ status: 'failed', modeUsed: 'pty', failureKind: 'shim-not-installed' })
  })

  it('reports partial instead of success when native typing writes fewer characters', async () => {
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper: { typeText: vi.fn(async () => ({ success: true, data: { characters: 5 } })) },
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true })
    })

    const result = await service.execute({ targetAlias: 'cursor-gui', text: 'hello world', mode: 'sendinput', confirmedBy: 'vitest' })

    expect(result.success).toBe(false)
    expect(result.status).toBe('partial')
    expect(result.modeUsed).toBe('sendinput')
    expect(result.injectedLength).toBe(5)
    expect(result.verifiedContentMatches).toBe(false)
    expect(result.error).toContain('E_PARTIAL_INJECT')
    expect(service.listAudit()[0]).toMatchObject({ status: 'partial', modeUsed: 'sendinput', failureKind: 'runtime-error' })
  })

  it('fails truthfully when every mode boundary is unavailable', async () => {
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper: { typeText: vi.fn(async () => ({ success: false, error: 'NUT_JS_DISABLED_BY_FLAG' })) },
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }),
      flagOverrides: () => ({})
    })

    const result = await service.execute({ targetAlias: 'cursor-gui', text: 'hello', mode: 'uia', modeFallback: ['clipboard-paste', 'sendinput'], confirmedBy: 'vitest' })

    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.failureKind).toBe('native-disabled')
    expect(result.modeUsed).toBe('sendinput')
  })

  it('sends long sendinput payload as bounded chunks with interval and focus checks', async () => {
    vi.useFakeTimers()
    const typedTexts: string[] = []
    const nativeTyper = {
      typeText: vi.fn(async (input: { text: string }) => {
        typedTexts.push(input.text)
        return { success: true, data: { characters: input.text.length } }
      })
    }
    const focusCheck = vi.fn(() => true)
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      focusCheck,
      chunkIntervalMs: 200
    })

    try {
      const payload = `${'a'.repeat(8192)}中文`
      const executing = service.execute({ targetAlias: 'cursor-gui', text: payload, mode: 'sendinput', confirmedBy: 'vitest' })
      await vi.advanceTimersByTimeAsync(0)
      expect(nativeTyper.typeText).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(199)
      expect(nativeTyper.typeText).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      const result = await executing

      expect(result).toMatchObject({ success: true, chunkCount: 2, injectedLength: payload.length })
      expect(typedTexts).toHaveLength(2)
      expect(typedTexts.every(text => Buffer.byteLength(text, 'utf8') <= 8192)).toBe(true)
      expect(focusCheck).toHaveBeenCalledTimes(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops between sendinput chunks when focus ownership changes', async () => {
    vi.useFakeTimers()
    let focusChecks = 0
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      focusCheck: () => {
        focusChecks += 1
        return focusChecks === 1
      },
      chunkIntervalMs: 200
    })

    try {
      const executing = service.execute({ targetAlias: 'cursor-gui', text: `${'a'.repeat(8192)}中文`, mode: 'sendinput', confirmedBy: 'vitest' })
      await vi.advanceTimersByTimeAsync(200)
      const result = await executing

      expect(result).toMatchObject({
        success: false,
        status: 'failed',
        failureKind: 'user-stole-focus',
        injectedLength: 0
      })
      expect(nativeTyper.typeText).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('polls the OS foreground window every 50ms and aborts when the user steals focus', async () => {
    vi.useFakeTimers()
    let activeHwnd = 10
    const foregroundWindowProvider = vi.fn(async () => ({ hwnd: activeHwnd, title: `window-${activeHwnd}` }))
    const nativeTyper = { typeText: vi.fn(async (input: { text: string }) => ({ success: true, data: { characters: input.text.length } })) }
    const service = new InjectService({
      store: new MemoryStore(),
      nativeTyper,
      resolveTarget: (): InjectTargetResolution => ({ found: true, ready: true, target: { resolvedHwnd: 10 } }),
      flagOverrides: () => ({ 'R8.A.libs.nut-js': true }),
      foregroundWindowProvider,
      focusPollingIntervalMs: 50,
      chunkIntervalMs: 200
    })

    try {
      const executing = service.execute({ targetAlias: 'window-10', text: `${'a'.repeat(8192)}中文`, mode: 'sendinput', confirmedBy: 'vitest' })
      await vi.advanceTimersByTimeAsync(0)
      expect(nativeTyper.typeText).toHaveBeenCalledTimes(1)

      activeHwnd = 99
      await vi.advanceTimersByTimeAsync(50)
      const result = await executing

      expect(result).toMatchObject({
        success: false,
        status: 'failed',
        failureKind: 'user-stole-focus',
        modeUsed: 'sendinput',
        injectedLength: 0
      })
      expect(result.error).toContain('E_USER_STOLE_FOCUS:foreground changed from 10 to 99')
      expect(nativeTyper.typeText).toHaveBeenCalledTimes(1)
      expect(foregroundWindowProvider.mock.calls.length).toBeGreaterThanOrEqual(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('chunks long UTF-8 text without splitting characters', () => {
    const chunks = new InjectChunker(8).chunk('abcdef中文')

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.map(chunk => chunk.text).join('')).toBe('abcdef中文')
    expect(chunks.every(chunk => chunk.bytes <= 8)).toBe(true)
  })
})
