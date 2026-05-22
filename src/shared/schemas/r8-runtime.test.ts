import fs from 'node:fs'
import path from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  R8_IPC_CHANNELS,
  CLAUDE_STREAM_SCHEMA_VERSION,
  assertR8IpcRegistry,
  browserPopoutSchema,
  claudeCostSummarySchema,
  claudeStreamEventSchema,
  commandHistoryEntrySchema,
  customCommandSchema,
  csvRowStreamPayloadSchema,
  csvSessionEventSchema,
  csvTaskRowSchema,
  cursorCopilotSignalSchema,
  cursorCopilotStatusSchema,
  dataOwnershipExportAllRequestSchema,
  dataOwnershipListEntriesRequestSchema,
  dataOwnershipListEntriesResponseSchema,
  dataOwnershipListPathsResponseSchema,
  fusedSignalSchema,
  geminiPatternRuleInputSchema,
  geminiRuleReloadRequestSchema,
  injectCountdownStreamPayloadSchema,
  injectResultSchema,
  monitorPopoutSchema,
  monitorSnapshotSchema,
  cloudSyncResultSchema,
  diagnosticPackOptionsSchema,
  diagnosticPreviewSchema,
  permissionCheckResultSchema,
  permissionRequestSchema,
  skillFrontmatterSchema,
  skillInputSchema,
  skillLoadErrorSchema,
  skillListStreamPayloadSchema,
  skillSchema,
  ocrCapabilitiesSchema,
  ocrDisabledResponseSchema,
  popoutThemeSyncPayloadSchema,
  portPopoutPositionGetResponseSchema,
  portPopoutPositionSaveRequestSchema,
  r8RuntimeSchemaRegistry,
  securityTierSchema,
  titlePatternRuleSchema,
  titleRuleReloadRequestSchema,
  toolDetectionStateSchema,
  windowVdWatchPayloadSchema,
  watchdogEventStreamPayloadSchema
} from './r8-runtime'
import { BUILTIN_SKILL_NAMES, BUILTIN_SKILLS } from '../skill-builtins'

function extractSkillFrontmatter(markdown: string): unknown {
  const trimmed = markdown.trimStart()
  const end = trimmed.indexOf('\n---', 3)
  if (!trimmed.startsWith('---') || end === -1) throw new Error('missing frontmatter')
  return loadYaml(trimmed.slice(3, end))
}

function walkMarkdownFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files
}

function extractPromptDeclaredChannels(): string[] {
  const promptsRoot = path.resolve(process.cwd(), '..', 'prompts', '0503-2')
  const channels = new Set<string>()
  for (const filePath of walkMarkdownFiles(promptsRoot)) {
    const sourceText = fs.readFileSync(filePath, 'utf8')
    for (const match of sourceText.matchAll(/^\s*([a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*){1,3}):\s*\{/gm)) {
      channels.add(match[1])
    }
  }
  return Array.from(channels).sort()
}

describe('R8 runtime contracts', () => {
  it('validates command history entries with bounded use counts', () => {
    expect(commandHistoryEntrySchema.parse({
      commandId: 'monitor.ai-task',
      invokedAt: 1_700_000_000_000,
      confirmedBy: null,
      useCount: 3
    })).toMatchObject({
      commandId: 'monitor.ai-task',
      useCount: 3
    })

    expect(() => commandHistoryEntrySchema.parse({
      commandId: '',
      invokedAt: -1,
      useCount: 0
    })).toThrow()
  })

  it('validates port popout position persistence contracts', () => {
    expect(portPopoutPositionSaveRequestSchema.parse({
      port: 3000,
      position: { x: 220, y: 360 },
      size: { width: 420, height: 340 }
    })).toMatchObject({
      port: 3000,
      position: { x: 220, y: 360 },
      size: { width: 420, height: 340 }
    })

    expect(portPopoutPositionGetResponseSchema.parse({
      success: true,
      port: 3000,
      position: null
    })).toMatchObject({
      success: true,
      port: 3000,
      position: null
    })
  })

  it('validates custom command storage without eval-capable handler scripts', () => {
    expect(customCommandSchema.parse({
      id: 'custom.audit-pack',
      label: 'Run audit pack',
      handlerScript: 'skill:run audit-pack',
      confirmedBy: 'vitest'
    })).toMatchObject({
      id: 'custom.audit-pack',
      enabled: true,
      savedAt: 0
    })

    expect(() => customCommandSchema.parse({
      id: 'custom.bad',
      label: 'Unsafe command',
      handlerScript: 'eval("danger")',
      confirmedBy: 'vitest'
    })).toThrow()
  })

  it('keeps R8.B and R8.C IPC channels unique and feature mapped', () => {
    const registry = assertR8IpcRegistry()
    const channels = registry.map(item => item.channel)

    expect(R8_IPC_CHANNELS.length).toBeGreaterThanOrEqual(298)
    expect(new Set(channels).size).toBe(channels.length)
    expect(channels).toContain('popout:create')
    expect(channels).toContain('status:aggregate')
    expect(channels).toContain('zod:validate-payload')
    expect(channels).toContain('ocr:recognize')
    expect(channels).toContain('cli:detect-all')
    expect(channels).toContain('cli:detect-one')
    expect(channels).toContain('cli:clear-tool-override')
    expect(channels).toContain('task:get-stats')
    expect(channels).toContain('task:retry')
    expect(channels).toContain('task:state-stream')
    expect(channels).toContain('watchdog:event-stream')
    expect(channels).toContain('inject:get-whitelist')
    expect(channels).toContain('inject:countdown-stream')
    expect(channels).toContain('recording:start')
    expect(channels).toContain('recording:get-events')
    expect(channels).toContain('recording:get-replay-state')
    expect(channels).toContain('recording:get-events-window')
    expect(channels).toContain('recording:get-cast')
    expect(channels).toContain('recording:list-anchors')
    expect(channels).toContain('recording:get-screenshot')
    expect(channels).toContain('recording:get-fs-snapshot-at')
    expect(channels).toContain('recording:export-asciinema')
    expect(channels).toContain('recording:export-zip')
    expect(channels).toContain('recording:delete')
    expect(channels).toContain('topology:build-global-graph')
    expect(channels).toContain('topology:network')
    expect(channels).toContain('topology:neural')
    expect(channels).toContain('topology:save-snapshot')
    expect(channels).toContain('topology:list-snapshots')
    expect(channels).toContain('topology:export')
    expect(channels).toContain('topology:warm-scope-global')
    expect(channels).toContain('flow:get-attached')
    expect(channels).toContain('flow:filter-edges')
    expect(channels).toContain('flow:scoped-stats')
    expect(channels).toContain('flow:export-timeline')
    expect(channels).toContain('flow:event-stream')
    expect(channels).toContain('flow:event-stream:unsubscribe')
    expect(channels).toContain('backup:restore')
    expect(channels).toContain('data-ownership:list-paths')
    expect(channels).toContain('data-ownership:list-entries')
    expect(channels).toContain('data-ownership:export-all')
    expect(channels).toContain('diagnostic:preview')
    expect(channels).toContain('diagnostic:list-redaction-rules')
    expect(channels).toContain('diagnostic:capture-screenshot')
    expect(channels).toContain('permission:request')
    expect(channels).toContain('permission:check')
    expect(channels).toContain('permission:revoke-all')
    expect(channels).toContain('skill:cloud-sync-status')
    expect(channels).toContain('skill:cloud-sync-trigger')
    expect(channels).toContain('skill:cloud-sync-list-remote')
    expect(channels).toContain('skill:list-stream')
    expect(channels).toContain('ocr:capabilities')
    expect(channels).toContain('ocr:list-supported-languages')
    expect(channels).toContain('diagnostic:purge')
    expect(channels).toContain('skill:write')
    expect(channels).toContain('obs:get-snapshot')
    expect(channels).toContain('obs:configure')
    expect(channels).toContain('obs:export-snapshot')
    expect(channels).toContain('obs:export-diagnostic-pack')
    expect(channels).toContain('obs:subscribe')
    expect(channels).toContain('obs:unsubscribe')
    expect(channels).toContain('recovery:check-dirty')
    expect(channels).toContain('recovery:restore-state')
    expect(channels).toContain('recovery:list-snapshots')
    expect(channels).toContain('recovery:create-checkpoint')
    expect(registry.find(item => item.channel === 'inject:execute')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'inject:execute')?.rateClass).toBe('medium_query')
    expect(registry.find(item => item.channel === 'backup:restore')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'data-ownership:export-all')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'recovery:restore-state')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'recording:start')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'recording:delete')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'diagnostic:purge')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'skill:write')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'skill:list-stream')?.direction).toBe('main-to-renderer-stream')
    expect(registry.find(item => item.channel === 'task:retry')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'task:state-stream')?.direction).toBe('main-to-renderer-stream')
    expect(registry.find(item => item.channel === 'window:vd-watch')?.direction).toBe('main-to-renderer-stream')
    expect(registry.find(item => item.channel === 'watchdog:event-stream')?.direction).toBe('main-to-renderer-stream')
    expect(registry.find(item => item.channel === 'watchdog:event-stream')?.rateClass).toBe('high_freq_scan')
    expect(registry.find(item => item.channel === 'inject:countdown-stream')?.direction).toBe('main-to-renderer-stream')
    expect(registry.find(item => item.channel === 'inject:countdown-stream')?.rateClass).toBe('high_freq_scan')
    expect(registry.find(item => item.channel === 'permission:reset')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'ai:list-state-rules')?.featureFlag).toBe('R8.C.state.three-layer')
    expect(registry.find(item => item.channel === 'ai:override-rule')?.featureFlag).toBe('R8.C.state.three-layer')
    expect(registry.find(item => item.channel === 'ai:override-rule')?.confirmedByRequired).toBe(true)
    expect(registry.find(item => item.channel === 'ai:state-stream')?.featureFlag).toBe('R8.C.state.three-layer')
    expect(registry.find(item => item.channel === 'ai:state-stream')?.direction).toBe('main-to-renderer-stream')
    expect(registry.find(item => item.channel === 'ai:report-misreport')?.featureFlag).toBe('R8.C.feedback.loop')
    expect(registry.find(item => item.channel === 'ai:get-diagnostic-explain')?.featureFlag).toBe('R8.C.feedback.loop')
    expect(registry.find(item => item.channel === 'ai:reset-learned-weights')?.featureFlag).toBe('R8.C.feedback.loop')
    expect(registry.find(item => item.channel === 'ai:reset-learned-weights')?.confirmedByRequired).toBe(true)
  })

  it('validates display-backed virtual desktop watch payloads without fabricated desktops', () => {
    expect(windowVdWatchPayloadSchema.parse({
      eventType: 'display-metrics-changed',
      monitors: [{
        id: 10,
        name: 'Primary Panel',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
        primary: true
      }],
      desktops: [],
      unavailableReason: 'E_NO_VIRTUAL_DESKTOPS_VISIBLE',
      emittedAt: 1_700_000_000_000
    })).toMatchObject({
      eventType: 'display-metrics-changed',
      desktops: [],
      unavailableReason: 'E_NO_VIRTUAL_DESKTOPS_VISIBLE'
    })

    expect(windowVdWatchPayloadSchema.parse({
      eventType: 'virtual-desktop-changed',
      monitors: [],
      desktops: [],
      emittedAt: 1_700_000_000_001
    })).toMatchObject({
      eventType: 'virtual-desktop-changed'
    })

    expect(() => windowVdWatchPayloadSchema.parse({
      eventType: 'virtual-desktop-switched',
      monitors: [],
      desktops: [],
      emittedAt: 1
    })).toThrow()
  })


  it('covers every IPC channel declared by prompts/0503-2 specs', () => {
    const declared = extractPromptDeclaredChannels()
    const implemented = new Set(R8_IPC_CHANNELS.map(item => item.channel))
    const missing = declared.filter(channel => !implemented.has(channel))

    expect(declared).toHaveLength(308)
    expect(missing).toEqual([])
    expect(R8_IPC_CHANNELS.find(item => item.channel === 'audit:purge')?.confirmedByRequired).toBe(true)
    expect(R8_IPC_CHANNELS.find(item => item.channel === 'elevation:execute')?.confirmedByRequired).toBe(true)
    expect(R8_IPC_CHANNELS.find(item => item.channel === 'watchdog-supervisor:install-service')?.confirmedByRequired).toBe(true)
  })

  it('exposes Zod source-of-truth schemas for cross-layer R8 payloads', () => {
    expect(Object.keys(r8RuntimeSchemaRegistry)).toEqual(expect.arrayContaining([
      'BrowserPopout',
      'PopoutThemeSyncPayload',
      'CommandPaletteEntry',
      'CommandHistoryEntry',
      'CustomCommand',
      'CustomCommandListResponse',
      'CustomCommandSaveResult',
      'CsvTaskRow',
      'FlowRequest',
      'FlowSnapshot',
      'FlowStats',
      'FlowWarning',
      'FlowExportResult',
      'FlowEventStreamRequest',
      'FlowEventStreamResponse',
      'FlowEventStreamPayload',
      'DagGraph',
      'DiagnosticExportRequest',
      'DiagnosticPackOptions',
      'DiagnosticPackManifest',
      'DiagnosticPreview',
      'DataOwnershipRootCategory',
      'DataOwnershipPathKind',
      'DataOwnershipPathSummary',
      'DataOwnershipListPathsResponse',
      'DataOwnershipListEntriesRequest',
      'DataOwnershipEntry',
      'DataOwnershipListEntriesResponse',
      'DataOwnershipExportAllRequest',
      'PermissionTtlGrant',
      'PermissionCheckResult',
      'CloudSyncStatus',
      'CloudSyncResult',
      'OcrCapabilities',
      'OcrDisabledResponse',
      'ToolDetectResult',
      'TaskRun',
      'TaskStateStreamPayload',
      'TaskStateTransition',
      'QueueStats',
      'SignalSource',
      'SignalSample',
      'WeightProfile',
      'SignalContributionSnapshot',
      'FusionConfig',
      'InstanceState',
      'StateAssertionRule',
      'StateTransitionEvent',
      'MisreportKind',
      'MisreportRecord',
      'WeightAdjustment',
      'DiagnosticExplain',
      'ReportMisreportRequest',
      'MisreportResponse',
      'ResetLearnedWeightsResponse',
      'FusedSignal',
      'InjectResult',
      'WatchdogSupervisorStatus',
      'SupervisorState',
      'HandshakeMessage',
      'RpcRequest',
      'RpcResponse',
      'MonitorSnapshot',
      'MonitorPopout',
      'ObservabilitySnapshot',
      'ObservabilityConfig',
      'ObservabilityExportSnapshotRequest',
      'ObservabilityDiagnosticPackResponse',
      'ObservabilitySubscribeResponse',
      'ObservabilityUnsubscribeRequest',
      'SchemaMeta',
      'IpcSchemaPair',
      'SchemaValidationVerdict',
      'SchemaMigrationStep',
      'ZodListSchemasResponse',
      'ZodValidatePayloadRequest',
      'ZodValidatePayloadResponse',
      'ZodMigrationStatusResponse',
      'SkillFrontmatter',
      'Skill',
      'SkillLoadError',
      'SkillEditorBuffer',
      'SkillValidationResult',
      'SkillTemplate',
      'CsvRowStreamPayload',
      'CsvSessionEvent',
      'RecordingSession',
      'RecordingManifest',
      'RecordingEvent',
      'RecordingStartRequest',
      'RecordingExportZipRequest',
      'RecordingReplayState',
      'RecordingGetReplayStateRequest',
      'RecordingGetEventsWindowRequest',
      'AsciinemaCast',
      'RecordingFsSnapshotResult',
      'GraphKind',
      'GraphLayout',
      'GraphSlice',
      'GraphSnapshot',
      'GraphExportResult',
      'GraphWarmScopeRequest',
      'RecoveryReport',
      'ReplayState',
      'TitlePatternRule',
      'CursorCopilotSignal',
      'CursorCopilotStatus',
      'TitleRuleReloadRequest',
      'ToolDetectionState',
      'ToolClearOverrideResponse',
      'ContractOnlyResponse'
    ]))
  })

  it('validates BrowserWindow popout theme sync payloads with strict appearance axes', () => {
    expect(popoutThemeSyncPayloadSchema.safeParse({
      emittedAt: 1_000,
      settings: {
        appearance: {
          theme: 'cyberpunk',
          informationDensity: 'compact',
          radiusFamily: 'round',
          motionLevel: 'expressive',
          layoutMode: 'split',
          enableAnimations: true
        },
        window: { portPopout: { syncPolicyDefault: { theme: true } } }
      }
    }).success).toBe(true)

    expect(popoutThemeSyncPayloadSchema.safeParse({
      emittedAt: 1_000,
      settings: {
        appearance: {
          theme: 'surprise-theme'
        }
      }
    }).success).toBe(false)
  })

  it('validates data ownership settings-panel contracts without implicit path trust', () => {
    expect(dataOwnershipListPathsResponseSchema.parse({
      generatedAt: 1,
      roots: [{
        rootId: 'skills',
        label: 'User skills',
        description: 'Local skills directory',
        category: 'skills',
        path: 'C:/Users/DevHub/skills',
        kind: 'directory',
        exists: true,
        fileCount: 2,
        sizeBytes: 2048,
        updatedAt: 2,
        truncated: false,
        sensitive: true,
        exportable: true
      }]
    }).roots[0].rootId).toBe('skills')

    expect(dataOwnershipListEntriesRequestSchema.parse({
      rootId: 'skills'
    })).toEqual({ rootId: 'skills', relativePath: '' })

    expect(dataOwnershipListEntriesResponseSchema.safeParse({
      rootId: 'skills',
      rootPath: 'C:/Users/DevHub/skills',
      relativePath: '',
      absolutePath: 'C:/Users/DevHub/skills',
      kind: 'directory',
      exists: true,
      entries: [{
        name: 'review-skill',
        relativePath: 'review-skill',
        kind: 'directory',
        sizeBytes: 0,
        updatedAt: 3
      }],
      entriesTruncated: false,
      generatedAt: 4
    }).success).toBe(true)

    expect(dataOwnershipExportAllRequestSchema.parse({})).toEqual({ confirmedBy: 'data-ownership-panel' })
    expect(dataOwnershipListEntriesResponseSchema.safeParse({
      rootId: 'skills',
      rootPath: 'C:/Users/DevHub/skills',
      relativePath: '',
      absolutePath: 'C:/Users/DevHub/skills',
      kind: 'directory',
      exists: true,
      entries: [{ name: 'bad', relativePath: 'bad', kind: 'symlink', sizeBytes: 0, updatedAt: 1 }],
      entriesTruncated: false,
      generatedAt: 1
    }).success).toBe(false)
  })

  it('validates BrowserWindow popout multi-display restore metadata', () => {
    const popout = browserPopoutSchema.parse({
      windowId: 'popout-display-restore',
      surface: 'port',
      targetId: 6500,
      mode: 'browserwindow',
      route: '/monitor?port=6500',
      title: 'Port 6500',
      pinned: true,
      bounds: { x: 24, y: 24, width: 420, height: 300 },
      displayId: 1,
      pendingRestoreBounds: { x: 1944, y: 24, width: 420, height: 300 },
      pendingRestoreDisplayId: 2,
      displayMigratedAt: 4_444,
      createdAt: 1_000,
      bridgeState: 'connected'
    })

    expect(popout.displayId).toBe(1)
    expect(popout.pendingRestoreDisplayId).toBe(2)
    expect(browserPopoutSchema.safeParse({
      ...popout,
      pendingRestoreBounds: { x: 1, y: 1, width: 0, height: 300 }
    }).success).toBe(false)
  })

  it('validates strict Skill schemas and rejects unexpected keys', () => {
    const frontmatter = {
      schemaVersion: '1.0',
      name: 'strict-review',
      displayName: 'Strict Review',
      version: '1.0.0',
      description: 'Strict schema validation for local skills.',
      author: 'Vitest',
      license: 'MIT',
      sandbox: 'read-only',
      tags: ['review'],
      inputs: [{ name: 'file', type: 'file', required: true, description: 'File path.' }],
      outputs: [{ name: 'report', type: 'json' }],
      scriptPath: './run.js',
      runtime: 'node',
      permissions: ['fs-read'],
      mcpServers: []
    }
    const skill = { ...frontmatter, builtIn: false, source: 'user', loadedAt: 1, filePath: 'C:/DevHub/skills/strict-review/SKILL.md' }

    expect(skillFrontmatterSchema.safeParse(frontmatter).success).toBe(true)
    expect(skillSchema.safeParse(skill).success).toBe(true)
    expect(skillListStreamPayloadSchema.safeParse({ added: [skill], updated: [], removed: [], skills: [skill], errors: [], source: 'change', emittedAt: 1 }).success).toBe(true)
    expect(skillFrontmatterSchema.safeParse({ ...frontmatter, unexpected: true }).success).toBe(false)
    expect(skillInputSchema.safeParse({ name: 'file', type: 'file', surprise: true }).success).toBe(false)
    expect(skillLoadErrorSchema.safeParse({ filePath: 'x', errorCode: 'E_PARSE', message: 'bad', details: null, extra: true }).success).toBe(false)
  })

  it('validates all builtin skill manifests and markdown frontmatter without network permissions', () => {
    expect(BUILTIN_SKILL_NAMES).toHaveLength(10)
    expect(BUILTIN_SKILLS).toHaveLength(10)
    expect(new Set(BUILTIN_SKILL_NAMES).size).toBe(10)

    for (const builtin of BUILTIN_SKILLS) {
      expect(BUILTIN_SKILL_NAMES).toContain(builtin.name)
      expect(skillSchema.safeParse(builtin.skill).success).toBe(true)
      expect(skillFrontmatterSchema.safeParse(extractSkillFrontmatter(builtin.markdown)).success).toBe(true)
      expect(builtin.skill.builtIn).toBe(true)
      expect(builtin.skill.source).toBe('builtin')
      expect(builtin.skill.runtime).toBe('node')
      expect(builtin.skill.license).toBe('MIT')
      expect(builtin.skill.sandbox).toBe('read-only')
      expect(builtin.skill.permissions).toEqual(['fs-read'])
      expect(builtin.skill.mcpServers).toEqual([])
      expect(builtin.scriptContent).toContain("require('node:fs')")
      expect(builtin.scriptContent).not.toMatch(/https?:\/\/|api[_-]?key/i)
      expect(builtin.markdown.match(/ {2}- name: file/g)).toHaveLength(1)
    }
  })

  it('validates real CSV task rows and rejects empty prompts', () => {
    expect(csvTaskRowSchema.safeParse({
      id: 'row-1',
      tool: 'codex',
      prompt: 'run verification',
      priority: '70',
      dry_run: 'false'
    }).success).toBe(true)

    expect(csvTaskRowSchema.safeParse({ id: 'row-2', tool: 'codex', prompt: '' }).success).toBe(false)
  })

  it('validates CSV row stream payloads for renderer subscriptions', () => {
    expect(csvRowStreamPayloadSchema.safeParse({
      source: 'watch:change',
      emittedAt: Date.now(),
      changedGroupIds: ['dev'],
      removedGroupIds: [],
      summary: {
        groupCount: 0,
        totalRows: 0,
        validRows: 0,
        errorCount: 0,
        groups: []
      }
    }).success).toBe(true)

    expect(csvRowStreamPayloadSchema.safeParse({
      source: 'watch:rename',
      emittedAt: Date.now(),
      changedGroupIds: [],
      removedGroupIds: [],
      summary: { groupCount: 0, totalRows: 0, validRows: 0, errorCount: 0, groups: [] }
    }).success).toBe(false)
  })

  it('validates watchdog event stream payloads for renderer subscriptions', () => {
    expect(watchdogEventStreamPayloadSchema.safeParse({
      emittedAt: Date.now(),
      events: [{
        eventId: 'watchdog-event-1',
        type: 'state-change',
        at: Date.now(),
        instanceId: 'codex-main',
        data: { prev: 'healthy', next: 'suspect', reason: 'heartbeat-timeout' }
      }]
    }).success).toBe(true)

    expect(watchdogEventStreamPayloadSchema.safeParse({
      emittedAt: Date.now(),
      events: [{
        eventId: 'watchdog-event-2',
        type: 'unsupported',
        at: Date.now(),
        data: {}
      }]
    }).success).toBe(false)
  })

  it('validates CSV session event payloads for launch streams', () => {
    expect(csvSessionEventSchema.safeParse({
      sessionId: '11111111-1111-4111-8111-111111111111',
      type: 'task-start',
      emittedAt: Date.now(),
      data: { taskId: 'task-001', runner: 'devhub' }
    }).success).toBe(true)

    expect(csvSessionEventSchema.safeParse({
      sessionId: 'not-a-uuid',
      type: 'task-start',
      emittedAt: Date.now(),
      data: {}
    }).success).toBe(false)
  })

  it('validates Claude stream-json events and cost summaries strictly', () => {
    const parsed = claudeStreamEventSchema.parse({
      type: 'assistant',
      message: {
        id: 'm1',
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [{ type: 'tool_use', id: 'tu1', name: 'Read', input: { file_path: 'README.md' } }],
        usage: { input_tokens: 10, output_tokens: 8 }
      }
    })

    expect(parsed.schemaVersion).toBe(CLAUDE_STREAM_SCHEMA_VERSION)

    expect(claudeStreamEventSchema.safeParse({ type: 'system', subtype: 'init', session_id: 's1' }).success).toBe(false)
    expect(claudeStreamEventSchema.safeParse({
      schemaVersion: 2,
      type: 'assistant',
      message: {
        id: 'm1',
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [{ type: 'text', text: 'future schema' }]
      }
    }).success).toBe(false)
    expect(claudeCostSummarySchema.parse({ totalInputTokens: 10, totalOutputTokens: 8, totalCostUsd: 0.001, durationMs: 1200 })).toEqual({
      totalInputTokens: 10,
      totalOutputTokens: 8,
      totalCostUsd: 0.001,
      durationMs: 1200
    })
  })

  it('validates Gemini pattern rules through the shared schema contract', () => {
    expect(geminiPatternRuleInputSchema.parse({
      kind: 'tool_call',
      regex: '\\[tool:\\s*([^\\]]+)\\]',
      flags: 'i',
      confidence: 0.9,
      ansiStrip: true
    })).toMatchObject({ kind: 'tool_call', confidence: 0.9 })

    expect(geminiPatternRuleInputSchema.safeParse({ kind: 'thinking', regex: '(', flags: 'bad', confidence: 0.5 }).success).toBe(false)
    expect(geminiRuleReloadRequestSchema.safeParse({
      rules: [{ kind: 'thinking', regex: 'Waiting', flags: 'i', confidence: 0.7 }],
      confirmedBy: 'vitest'
    }).success).toBe(true)
  })

  it('validates Cursor/Copilot window-title schemas with bounded confidence and hashed privacy', () => {
    expect(titlePatternRuleSchema.parse({
      tool: 'cursor',
      regex: 'Cursor\\s+-\\s+Editing',
      phase: 'editing',
      confidence: 0.7
    })).toMatchObject({ tool: 'cursor', flags: 'i', confidence: 0.7 })

    expect(titlePatternRuleSchema.safeParse({ tool: 'cursor', regex: 'Cursor', phase: 'editing', confidence: 0.71 }).success).toBe(false)
    expect(titlePatternRuleSchema.safeParse({ tool: 'cursor', regex: 'Cursor', flags: 'bad', phase: 'editing', confidence: 0.5 }).success).toBe(false)
    expect(titleRuleReloadRequestSchema.safeParse({
      rules: [{ tool: 'copilot', regex: 'Copilot suggesting', phase: 'thinking', confidence: 0.5 }],
      confirmedBy: 'vitest'
    }).success).toBe(true)

    const signal = cursorCopilotSignalSchema.parse({
      instanceId: 'cursor-42',
      tool: 'cursor',
      phase: 'editing',
      confidence: 0.6,
      source: 'window-title',
      rawTitle: 'Cursor - Editing main.ts',
      titleHash: '0123456789abcdef',
      hwnd: 42,
      pid: 1042,
      processName: 'Cursor.exe',
      ts: 100
    })
    const status = cursorCopilotStatusSchema.parse({
      checkedAt: 101,
      cursorTasks: 1,
      copilotTasks: 0,
      totalAiTasks: 1,
      phase: 'editing',
      confidence: signal.confidence,
      rawTitle: signal.rawTitle,
      titleHash: signal.titleHash,
      ts: signal.ts,
      signals: [signal]
    })

    expect(status.signals[0].titleHash).toHaveLength(16)
    expect(cursorCopilotSignalSchema.safeParse({ ...signal, titleHash: signal.rawTitle }).success).toBe(false)
  })

  it('validates CLI detection state contracts for five tools without online probes', () => {
    const checkedAt = 1000
    const result = {
      found: false,
      version: null,
      path: null,
      detectStrategy: 'not-found',
      recommendedParser: null,
      capabilities: [],
      errors: ['not in PATH'],
      error: 'not in PATH',
      checkedAt
    }
    const state = toolDetectionStateSchema.parse({
      results: ['codex', 'claude', 'gemini', 'cursor', 'copilot'].map(tool => ({ ...result, tool })),
      lastFullScanAt: checkedAt,
      scanDurationMs: 42
    })

    expect(state.results).toHaveLength(5)
    expect(state.results[0].detectedAt).toBe(checkedAt)
    expect(toolDetectionStateSchema.safeParse({ ...state, results: state.results.slice(0, 4) }).success).toBe(false)
  })


  it('validates monitor snapshot and monitor popout contracts with real parser-shaped events', () => {
    const event = {
      tool: 'claude',
      stream: 'stdout',
      line: JSON.stringify({ type: 'assistant', usage: { input_tokens: 3, output_tokens: 2 } }),
      progress: 0.4,
      confidence: 0.8,
      phase: 'working',
      observedAt: 10,
      eventType: 'progress_pct',
      rawSource: 'ndjson',
      instanceId: 'claude-1',
      sessionId: 'session-1'
    }
    const card = {
      tool: 'claude',
      active: true,
      instanceCount: 1,
      currentPhase: 'running',
      progress: { instanceId: 'claude-1', percent: 0.4, source: 'cli-real', confidence: 0.8, observedAt: 10, message: event.line },
      tokens: { input: 3, output: 2 },
      costUsd: null,
      lastEventAt: 10,
      recentEvents: [event]
    }
    const emptyCards = ['codex', 'gemini', 'cursor', 'copilot'].map(tool => ({
      tool,
      active: false,
      instanceCount: 0,
      currentPhase: 'idle',
      progress: null,
      tokens: null,
      costUsd: null,
      lastEventAt: null,
      recentEvents: []
    }))
    const snapshot = monitorSnapshotSchema.parse({
      cards: [emptyCards[0], card, ...emptyCards.slice(1)],
      windowState: { alwaysOnTop: false, opacity: 0.96, bounds: { x: 0, y: 0, w: 720, h: 520 } },
      collectedAt: 11
    })
    const popout = monitorPopoutSchema.parse({
      windowId: 'popout-1',
      surface: 'monitor',
      targetId: 'claude',
      mode: 'browserwindow',
      route: '/monitor-popout',
      title: 'DevHub claude Monitor',
      pinned: false,
      bounds: { x: 0, y: 0, width: 320, height: 140 },
      createdAt: 11,
      bridgeState: 'connected',
      popoutKind: 'monitor-tool',
      tool: 'claude',
      miniLayout: 'compact',
      card
    })

    expect(snapshot.cards).toHaveLength(5)
    expect(snapshot.cards[1].progress?.source).toBe('cli-real')
    expect(popout.card.tokens).toEqual({ input: 3, output: 2 })
  })

  it('validates R8.C orchestration result schemas without mock payloads', () => {
    const inject = injectResultSchema.parse({
      success: false,
      dryRun: false,
      modeUsed: 'disabled',
      targetAlias: 'claude-devhub',
      characters: 0,
      failureKind: 'native-disabled',
      error: 'R8.A.libs.nut-js is disabled'
    })
    expect(inject.failureKind).toBe('native-disabled')

    const countdown = injectCountdownStreamPayloadSchema.parse({
      actionId: '00000000-0000-4000-8000-000000000000',
      scenario: 'manual-template',
      targetAlias: 'claude-devhub',
      totalMs: 300,
      remainingMs: 200,
      elapsedMs: 100,
      emittedAt: 1_700_000_000_000,
      phase: 'tick',
      canCancel: true
    })
    expect(countdown.phase).toBe('tick')

    const fused = fusedSignalSchema.parse({
      instanceId: 'codex-1',
      fusedProgress: { instanceId: 'codex-1', percent: 0.5, source: 'fusion', confidence: 0.8, observedAt: 1 },
      contributions: [{ source: 'cli_parse', contributionPct: 1, weightedValue: 0.5, confidence: 0.8, weight: 0.8, rawValue: 0.5, effectiveWeight: 0.64, decayedConfidence: 0.8, ageMs: 0, stale: false }],
      state: 'working'
    })
    expect(fused.contributions[0].source).toBe('cli_parse')
  })

  it('keeps OCR hard-disabled with a stable error contract', () => {
    const response = ocrDisabledResponseSchema.parse({
      success: false,
      code: 'E_OCR_DISABLED',
      errorCode: 'E_OCR_DISABLED',
      message: 'disabled'
    })

    expect(response.code).toBe('E_OCR_DISABLED')
    expect(response.blocks).toEqual([])
  })

  it('validates R8.C spec-36..39 resilience contracts without enabling deferred features', () => {
    const diagnosticOptions = diagnosticPackOptionsSchema.parse({
      sectionsIncluded: ['audit-log', 'system-info'],
      includeScreenshots: false,
      redactionLevel: 'aggressive'
    })
    expect(diagnosticOptions.sectionsIncluded).toEqual(['audit-log', 'system-info'])

    const preview = diagnosticPreviewSchema.parse({
      sections: [{ section: 'audit-log', sampleContent: 'x'.repeat(32), sizeBytes: 32, redactionCount: 1 }],
      totalEstimatedSize: 32,
      redactionCounts: { 'api-key': 1 },
      warnings: []
    })
    expect(preview.sections[0].sampleContent.length).toBeLessThanOrEqual(2000)

    const request = permissionRequestSchema.parse({
      op: 'inject',
      scope: { instanceId: 'codex-1' },
      ttlMs: 60_000,
      confirmedBy: 'vitest'
    })
    expect(request.op).toBe('inject')
    expect(permissionCheckResultSchema.parse({ granted: false, reason: 'expired' }).reason).toBe('expired')

    const deferred = cloudSyncResultSchema.parse({
      success: false,
      errorCode: 'E_FEATURE_DEFERRED',
      message: 'deferred',
      scheduledRelease: 'R9',
      enabled: false
    })
    expect(deferred.enabled).toBe(false)

    const capabilities = ocrCapabilitiesSchema.parse({
      enabled: false,
      reason: 'NO-OCR-INTEGRATION constraint',
      futureRelease: null
    })
    expect(capabilities.enabled).toBe(false)
  })

  it('classifies suspicious public ports with bounded schema output', () => {
    const tier = securityTierSchema.parse({
      tier: 'WAN-Capable',
      score: 95,
      reasons: ['public-bind-address', 'sensitive-default-port'],
      port: 3389,
      ip: '0.0.0.0',
      tone: 'orange',
      label: '公网可达',
      iconToken: 'ShieldAlert'
    })

    expect(tier.reasons).toContain('public-bind-address')
  })
  it('registers DAG editor CSV lock and save schemas in the runtime registry', () => {
    expect(r8RuntimeSchemaRegistry.DagEditorState.parse({
      csvPath: 'D:/tasks.csv',
      isLocked: true,
      lockOwnerPid: 42,
      isDirty: false,
      rows: [],
      snapshot: null,
      selectedTaskIds: [],
      hoveredEdge: null,
      view: 'canvas',
      undoStack: [],
      redoStack: [],
      cyclePaths: [],
      validationErrors: []
    }).view).toBe('canvas')
    expect(r8RuntimeSchemaRegistry.CsvLockRequest.parse({ csvPath: 'D:/tasks.csv', confirmedBy: 'vitest' }).csvPath).toContain('tasks.csv')
    expect(r8RuntimeSchemaRegistry.CsvSaveResult.parse({ success: false, cycleDetected: true, cyclePaths: [['A', 'B', 'A']], rowCount: 2, csvPath: 'D:/tasks.csv', error: 'E_DAG_CYCLE' }).cycleDetected).toBe(true)
    expect(r8RuntimeSchemaRegistry.NodeTemplate.parse({ id: 'tpl-1', name: 'code-review-block', rowTemplate: { taskId: 'A' }, createdAt: 1, source: 'user' }).source).toBe('user')
  })

})
