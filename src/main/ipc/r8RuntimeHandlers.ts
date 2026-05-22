import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  R8_IPC_CHANNELS,
  attachedTopologyFavoriteChangeRequestSchema,
  attachedTopologyRequestSchema,
  backupCreateRequestSchema,
  backupDeleteRequestSchema,
  backupExportClassifiedRequestSchema,
  claudeCostSummaryRequestSchema,
  backupScheduleSchema,
  cloudSyncRequestSchema,
  commandHistoryEntrySchema,
  commandRegisterOsProtocolRequestSchema,
  customCommandSchema,
  cursorCopilotStatusRequestSchema,
  dataOwnershipExportAllRequestSchema,
  dataOwnershipListEntriesRequestSchema,
  diagnosticPackOptionsSchema,
  diagnosticScreenshotRequestSchema,
  flowEventStreamRequestSchema,
  flowEventStreamUnsubscribeRequestSchema,
  flowExportRequestSchema,
  flowRequestSchema,
  fusionConfigSchema,
  geminiPatternStatRequestSchema,
  geminiRuleReloadRequestSchema,
  csvDeleteTemplateRequestSchema,
  csvLockRequestSchema,
  csvLockStatusRequestSchema,
  csvSaveTemplateRequestSchema,
  csvTemplateListRequestSchema,
  dashboardDeletePresetRequestSchema,
  dashboardGetLayoutRequestSchema,
  dashboardMorphWidgetToDrawerRequestSchema,
  dashboardResetRequestSchema,
  monitorPopoutLayoutSchema,
  monitorToolSchema,
  watchdogSupervisorRespawnRequestSchema,
  watchdogSupervisorServiceRequestSchema,
  legacyRecordingStartRequestSchema,
  recordingDeleteRequestSchema,
  recordingExportAsciinemaRequestSchema,
  recordingExportZipRequestSchema,
  recordingGetEventsRequestSchema,
  recordingGetFsSnapshotAtRequestSchema,
  recordingGetCastRequestSchema,
  recordingGetEventsWindowRequestSchema,
  recordingGetManifestRequestSchema,
  recordingGetReplayStateRequestSchema,
  recordingGetScreenshotRequestSchema,
  recordingListAnchorsRequestSchema,
  recordingListRequestSchema,
  recordingStartRequestSchema,
  recordingStopRequestSchema,
  stateRuleOverrideRequestSchema,
  statusbarConfigSchema,
  statusbarResetRequestSchema,
  customSvgRemoveRequestSchema,
  customSvgUploadRequestSchema,
  themeDecorationConfigSchema,
  themeSoundConfigGetRequestSchema,
  themeSoundConfigSchema,
  titleRuleReloadRequestSchema,
  toolClearOverrideRequestSchema,
  toolDetectAllRequestSchema,
  toolDetectOneRequestSchema,
  toolOverrideRequestSchema,
  notificationAggregationSchema,
  notificationChannelConfigSchema,
  notificationInvokeActionSchema,
  notificationListRequestSchema,
  observabilityConfigSchema,
  observabilityDiagnosticPackRequestSchema,
  observabilityExportSnapshotRequestSchema,
  observabilitySnapshotRequestSchema,
  observabilitySubscribeRequestSchema,
  observabilityUnsubscribeRequestSchema,
  ocrRecognizeRequestSchema,
  permissionCheckRequestSchema,
  permissionRequestSchema,
  permissionRevokeAllRequestSchema,
  permissionRevokeRequestSchema,
  popoutBridgeMessageSchema,
  portPopoutBatchRequestSchema,
  portPopoutCloseRequestSchema,
  portPopoutDemoteRequestSchema,
  portPopoutOpenRequestSchema,
  portPopoutPinRequestSchema,
  portPopoutPositionGetRequestSchema,
  portPopoutPositionSaveRequestSchema,
  portPopoutSyncRequestSchema,
  processTreeChildrenRequestSchema,
  processTreeRequestSchema,
  processTreemapDataRequestSchema,
  processViewModeSetRequestSchema,
  rateLimitOverrideRequestSchema,
  recoveryCheckDirtyRequestSchema,
  recoveryCreateCheckpointRequestSchema,
  recoveryDismissRequestSchema,
  recoveryRestoreStateRequestSchema,
  restorePlanSchema,
  taskResultExportRequestSchema,
  zodValidatePayloadRequestSchema,
  type R8IpcChannelDefinition
} from '@shared/schemas/r8-runtime'
import { R8RuntimeService } from '../services/R8RuntimeService'
import { injectCountdownConfigSchema, injectCountdownControlRequestSchema, injectFirstTimeConfirmRequestSchema, injectResolveTargetInputSchema, injectStrictModeConfigSchema, injectWhitelistCreatedBySchema, injectWhitelistDurationSchema, injectWhitelistScopeSchema, injectScenarioSchema } from '@shared/schemas/inject'
import {
  RATE_LIMITS,
  registerR8RateLimitChannels,
  setRateLimitAuditSink,
  setRateLimitFeatureFlagProvider,
  withRateLimit
} from '../utils/rateLimiter'
import { auditLogger } from '../services/AuditLogger'

const SPECIFIC_R8_RUNTIME_CHANNELS = [
  'integrations:list-libraries',
  'integrations:flag-get',
  'integrations:flag-set',
  'integrations:health-check',
  'ipc:rate-limit-channel-list',
  'ipc:override-rate-class',
  'zod:list-schemas',
  'zod:validate-payload',
  'zod:migration-status',
  'cli:get-progress',
  'cli:title-rule-reload',
  'cli:title-sample-debug',
  'cli:select-strategy',
  'cli:install-shim',
  'cli:get-sessions',
  'shim:install',
  'shim:uninstall',
  'shim:status',
  'cli:detect-all',
  'cli:detect-one',
  'cli:set-tool-override',
  'cli:clear-tool-override',
  'cli:cursor-copilot-status',
  'monitor:open',
  'monitor:close',
  'monitor:snapshot',
  'monitor:set-window-prefs',
  'monitor:focus-instance',
  'monitor:popout-open',
  'monitor:popout-close',
  'monitor:popout-list',
  'monitor:popout-return-to-main',
  'monitor:popout-set-layout',
  'port:popout-open',
  'port:popout-close',
  'port:popout-list',
  'port:popout-position-get',
  'port:popout-position-save',
  'port:popout-pin',
  'port:popout-batch',
  'port:popout-sync',
  'port:popout-demote',
  'popout:create',
  'popout:close',
  'popout:list',
  'popout:bridge-message',
  'popout:pin',
  'popout:save-bounds',
  'popout:move-to-monitor',
  'popout:promote-from-floating',
  'popout:demote',
  'drawer:get-state',
  'drawer:set-state',
  'drawer:save-layout',
  'drawer:load-layout',
  'drawer:list-layouts',
  'drawer:morph-to-popout',
  'drawer:morph-from-popout',
  'command:list',
  'command:invoke',
  'command:history-list',
  'command:history-add',
  'command:history-clear',
  'command:resolve-uri',
  'command:register-os-protocol',
  'command:list-custom',
  'command:save-custom',
  'dashboard:get-layout',
  'dashboard:save-layout',
  'dashboard:list-presets',
  'dashboard:delete-preset',
  'dashboard:reset',
  'dashboard:morph-widget-to-drawer',
  'statusbar:get-config',
  'statusbar:set-config',
  'statusbar:reset',
  'theme:decoration-list',
  'theme:decoration-set',
  'theme:custom-svg-upload',
  'theme:custom-svg-list',
  'theme:custom-svg-remove',
  'theme:sound-config',
  'theme:sound-config-get',
  'a11y:get-prefs',
  'a11y:set-prefs',
  'a11y:os-prefs',
  'a11y:run-self-check',
  'process:tree',
  'process:tree-children',
  'process:treemap-data',
  'process:view-mode-set',
  'process:batch-op',
  'process:batch-cancel',
  'process:batch-undo',
  'process:tags-list',
  'process:tags-set',
  'process:history-24h',
  'window:batch-op',
  'window:batch-cancel',
  'window:batch-undo',
  'window:get-topmost',
  'window:groups',
  'window:layout-apply',
  'window:layout-list',
  'window:layout-save',
  'window:monitors',
  'window:move-to-desktop',
  'window:move-to-monitor',
  'window:set-alias',
  'window:set-topmost',
  'window:thumbnail-refresh',
  'window:thumbnails-batch',
  'window:vd-info',
  'window:vd-list',
  'window:viewport-config',
  'skill:validate-yaml',
  'skill:builtin-list',
  'skill:builtin-fork',
  'skill:builtin-readme',
  'skill:get',
  'skill:write',
  'skill:delete',
  'skill:create-from-template',
  'skill:template-list',
  'skill:reload',
  'status:aggregate',
  'port:security-tier',
  'port:blocklist-list',
  'port:blocklist-add',
  'port:blocklist-remove',
  'port:blocklist-reset',
  'port:public-banner-state',
  'csv:schema-info',
  'csv:validate-header',
  'csv:validate-row',
  'csv:list-groups',
  'csv:get-group',
  'csv:reload',
  'csv:enqueue-row',
  'csv:enqueue-group',
  'csv:generate-cli-command',
  'csv:launch',
  'csv:pause',
  'csv:resume',
  'csv:abort',
  'csv:get-runner-info',
  'csv:list-sessions',
  'csv:list-templates',
  'csv:save-template',
  'csv:export-template',
  'csv:lock-status-stream',
  'csv:delete-template',
  'csv:save',
  'csv:unlock',
  'csv:lock',
  'task:list',
  'task:get-stats',
  'task:export-results',
  'task:retry',
  'task:skip',
  'task:pause-session',
  'task:resume-session',
  'task:abort-session',
  'dag:build',
  'dag:detect-cycle',
  'dag:export',
  'dag:layer',
  'dag:check-ready',
  'watchdog:status',
  'watchdog:configure',
  'watchdog:get-history',
  'watchdog:override-restart',
  'watchdog-supervisor:status',
  'watchdog-supervisor:respawn',
  'watchdog-supervisor:install-service',
  'watchdog-supervisor:uninstall-service',
  'inject:dry-run',
  'inject:execute',
  'inject:get-whitelist',
  'inject:add-whitelist',
  'inject:remove-whitelist',
  'inject:resolve-target',
  'inject:get-ready-pool',
  'inject:history',
  'inject:cancel',
  'inject:configure-strict-mode',
  'inject:configure-countdown',
  'inject:countdown-cancel',
  'inject:countdown-complete',
  'inject:first-time-confirm',
  'notify:emit',
  'notify:list',
  'notify:dismiss',
  'notify:configure-aggregation',
  'notify:configure-channel',
  'notify:invoke-action',
  'obs:get-snapshot',
  'obs:configure',
  'obs:export-snapshot',
  'obs:export-diagnostic-pack',
  'obs:subscribe',
  'obs:unsubscribe',
  'topology:global:get-fullscreen',
  'topology:build-global-graph',
  'topology:network',
  'topology:neural',
  'topology:network:get',
  'topology:neural:get',
  'topology:save-snapshot',
  'topology:list-snapshots',
  'topology:export',
  'topology:global:export',
  'topology:warm-scope-global',
  'topology:attached:get-deep10',
  'topology:attached:favorite-change',
  'flow:build-scoped-flow',
  'flow:get-attached',
  'flow:filter-edges',
  'flow:scoped-stats',
  'flow:export-timeline',
  'flow:event-stream',
  'flow:event-stream:unsubscribe',
  'ai:get-signal-contributions',
  'ai:get-instance-state',
  'ai:list-weight-profiles',
  'ai:list-state-rules',
  'ai:override-rule',
  'ai:report-misreport',
  'ai:list-misreports',
  'ai:get-diagnostic-explain',
  'ai:reset-learned-weights',
  'ai:fusion-config',
  'ai:set-weight-profile',
  'ai:claude-cost-summary',
  'ai:gemini-pattern-stat',
  'ai:gemini-rule-reload',
  'ipc:rate-limit-stats',
  'recovery:scan',
  'recovery:report',
  'recovery:check-dirty',
  'recovery:restore-state',
  'recovery:list-snapshots',
  'recovery:create-checkpoint',
  'recovery:dismiss',
  'permission:ttl-config',
  'permission:confirm',
  'permission:allowlist',
  'permission:reset',
  'permission:request',
  'permission:check',
  'permission:revoke',
  'permission:revoke-all',
  'permission:list-active',
  'permission:configure-policy',
  'permission:expiry-stream',
  'backup:create',
  'backup:list',
  'backup:restore',
  'backup:delete',
  'backup:configure-schedule',
  'backup:schedule-config',
  'backup:export-classified',
  'data-ownership:list-paths',
  'data-ownership:list-entries',
  'data-ownership:export-all',
  'diagnostic:export',
  'diagnostic:list',
  'diagnostic:purge',
  'diagnostic:preview',
  'diagnostic:list-redaction-rules',
  'diagnostic:capture-screenshot',
  'diagnostic:list-packs',
  'skill:list',
  'skill:cloud-sync-disabled',
  'skill:cloud-sync-status',
  'skill:cloud-sync-trigger',
  'skill:cloud-sync-list-remote',
  'skill:install-from-path',
  'skill:uninstall',
  'skill:validate',
  'recording:start',
  'recording:stop',
  'recording:list',
  'recording:get-manifest',
  'recording:get-events',
  'recording:get-replay-state',
  'recording:get-events-window',
  'recording:get-cast',
  'recording:list-anchors',
  'recording:get-screenshot',
  'recording:get-fs-snapshot-at',
  'recording:export-asciinema',
  'recording:export-zip',
  'recording:delete',
  'recording:replay-start',
  'recording:replay-seek',
  'recording:replay-export',
  'ocr:capabilities',
  'ocr:recognize',
  'ocr:list-supported-languages'] as const

const R8_RUNTIME_CHANNELS = R8_IPC_CHANNELS.map(definition => definition.channel)
let activeR8RuntimeService: R8RuntimeService | null = null

const flagGetSchema = z.object({ flag: z.string().min(1) })
const flagSetSchema = z.object({ flag: z.string().min(1), value: z.boolean(), confirmedBy: z.string().optional() })
const popoutCloseSchema = z.object({ windowId: z.string().min(1) })
const popoutPinSchema = z.object({ windowId: z.string().min(1), pinned: z.boolean() })
const popoutBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
})
const popoutSaveBoundsSchema = z.object({ windowId: z.string().min(1), bounds: popoutBoundsSchema })
const popoutMoveToMonitorSchema = z.object({ windowId: z.string().min(1), monitorIndex: z.number().int().nonnegative() })
const popoutPromoteSchema = z.object({
  floatingId: z.string().min(1),
  bounds: popoutBoundsSchema.optional(),
  alwaysOnTop: z.boolean().optional()
})
const portSecuritySchema = z.object({ ip: z.string().trim().min(1).optional(), port: z.number().int().min(1).max(65535) })
const portBlocklistAddSchema = z.object({
  ip: z.string().trim().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  reason: z.string().max(200).optional(),
  confirmedBy: z.string().optional()
}).refine(input => typeof input.port === 'number' || typeof input.ip === 'string', {
  message: 'blocklist add requires port or ip',
  path: ['port']
})
const portBlocklistRemoveSchema = z.object({
  id: z.string().min(1).optional(),
  ip: z.string().trim().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  confirmedBy: z.string().optional()
}).refine(input => typeof input.id === 'string' || typeof input.port === 'number' || typeof input.ip === 'string', {
  message: 'blocklist remove requires id, port, or ip',
  path: ['id']
})
const portBlocklistResetSchema = z.object({ confirmedBy: z.string().optional() }).optional()
const portPublicBannerStateSchema = z.object({ ports: z.array(z.record(z.string(), z.unknown())).optional() }).optional()
const notificationDismissSchema = z.object({ notificationId: z.string().uuid() })
const cliProgressSchema = z.object({ tool: z.string().optional(), limit: z.number().int().positive().optional(), instanceId: z.string().optional() })
const cliShimInstallSchema = z.object({ tool: z.enum(['codex', 'claude', 'gemini']), confirmedBy: z.string().min(3).optional() })
const cliStrategySelectSchema = z.object({ sessionId: z.string().optional(), instanceId: z.string().optional(), strategy: z.enum(['ndjson', 'shim', 'line', 'sse']) })
const cliTitleSampleSchema = z.object({ title: z.string().min(1), tool: z.string().optional(), instanceId: z.string().optional() })
const monitorBoundsSchema = z.union([
  z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int().positive(), h: z.number().int().positive() }),
  z.object({ x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive() })
])
const monitorWindowPrefsSchema = z.object({
  alwaysOnTop: z.boolean().optional(),
  opacity: z.number().min(0.3).max(1).optional(),
  bounds: monitorBoundsSchema.optional(),
  confirmedBy: z.string().min(3).optional()
})
const monitorFocusInstanceSchema = z.object({ tool: monitorToolSchema, instanceId: z.string().min(1) })
const monitorPopoutOpenSchema = z.object({ tool: monitorToolSchema, layout: monitorPopoutLayoutSchema.optional() })
const monitorPopoutIdSchema = z.object({ popoutId: z.string().min(1) })
const monitorPopoutSetLayoutSchema = monitorPopoutIdSchema.extend({ layout: monitorPopoutLayoutSchema })
const confirmedSchema = z.object({ confirmedBy: z.string().min(3).optional() })
const skillNameSchema = z.object({ name: z.string().min(1) })
const skillDeleteSchema = skillNameSchema.merge(confirmedSchema)
const skillWriteSchema = z.object({
  name: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  yaml: z.string().min(1).optional(),
  body: z.string().optional(),
  script: z.string().optional(),
  scriptLanguage: z.enum(['node', 'python', 'bash', 'powershell']).optional(),
  filePath: z.string().min(1).optional(),
  confirmedBy: z.string().min(3).optional()
}).refine(value => Boolean(value.text || value.yaml), { message: 'text or yaml is required' })
const skillCreateFromTemplateSchema = z.object({ templateId: z.enum(['blank', 'fork-builtin', 'prompt-only', 'script-only', 'full']), name: z.string().min(1), displayName: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const skillInstallFromPathSchema = z.object({ sourcePath: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const skillBuiltinForkSchema = z.object({ name: z.string().min(1), targetName: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const skillReloadSchema = z.object({ force: z.boolean().optional(), watch: z.boolean().optional() }).optional()
const csvLaunchRowSchema = z.object({ row: z.unknown(), confirmedBy: z.string().min(3).optional() })
  .refine(value => Object.prototype.hasOwnProperty.call(value, 'row'), { message: 'row is required' })
const csvLaunchFileSchema = z.object({
  csvPath: z.string().min(1),
  runner: z.enum(['devhub', 'python', 'cli']).optional(),
  resume: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  concurrent: z.number().int().min(1).max(16).optional(),
  forceRerun: z.array(z.string().min(1)).optional(),
  parallelGroupOverrides: z.record(z.string(), z.number().int().min(1).max(16)).optional(),
  confirmedBy: z.string().min(3).optional()
})
const csvLaunchSchema = z.union([csvLaunchFileSchema, csvLaunchRowSchema])
const csvRunnerInfoSchema = z.object({ kind: z.enum(['devhub', 'python', 'cli']) })
const csvSessionActionSchema = z.object({ sessionId: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const csvGroupSchema = z.object({ groupId: z.string().min(1) })
const csvReloadSchema = z.object({ force: z.boolean().optional(), watch: z.boolean().optional() }).optional()
const csvEnqueueGroupSchema = z.object({
  groupId: z.string().min(1),
  filter: z.object({ tags: z.array(z.string().min(1)).optional() }).optional(),
  concurrent: z.number().int().min(1).max(16).optional(),
  resume: z.boolean().optional(),
  forceRerun: z.array(z.string().min(1)).optional(),
  parallelGroupOverrides: z.record(z.string(), z.number().int().min(1).max(16)).optional()
})
const csvEnqueueRowSchema = z.union([z.object({ groupId: z.string().min(1), rowIndex: z.number().int().nonnegative() }), z.unknown()])
const csvExportTemplateSchema = z.object({ savePath: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const taskRunActionSchema = z.object({ runId: z.string().min(1).optional(), taskIds: z.array(z.string().min(1)).optional(), sessionId: z.string().min(1).optional(), confirmedBy: z.string().min(3).optional() })
const taskSessionActionSchema = z.object({ sessionId: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const injectWhitelistAddSchema = z.object({
  alias: z.string().min(1).optional(),
  scope: injectWhitelistScopeSchema.optional(),
  pattern: z.string().min(1).optional(),
  scenarios: z.array(injectScenarioSchema).min(1).optional(),
  duration: injectWhitelistDurationSchema.optional(),
  reason: z.string().optional(),
  createdBy: injectWhitelistCreatedBySchema.optional(),
  confirmedBy: z.string().min(3).optional()
}).refine(value => Boolean(value.alias || value.pattern), { message: 'alias or pattern is required' })
const injectWhitelistRemoveSchema = z.object({ id: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const injectTargetRequestSchema = z.union([z.object({ targetAlias: z.string().min(1) }), injectResolveTargetInputSchema])
const injectStrictModeUpdateSchema = injectStrictModeConfigSchema.partial().extend({ confirmedBy: z.string().min(3).optional() })
const injectCountdownUpdateSchema = injectCountdownConfigSchema.partial().extend({ confirmedBy: z.string().min(3).optional() })
const injectCountdownCancelSchema = injectCountdownControlRequestSchema
const injectCancelSchema = z.object({ injectId: z.string().min(1), confirmedBy: z.string().min(3).optional() })
const watchdogOverrideSchema = z.object({ reason: z.string().optional(), confirmedBy: z.string().min(3).optional() })
const weightProfileSchema = z.object({ weights: z.record(z.string(), z.number()).optional(), profile: z.string().optional(), profileId: z.enum(['default', 'cli-heavy', 'window-heavy', 'user-custom']).optional(), confirmedBy: z.string().min(3).optional() })
const fusionConfigRequestSchema = fusionConfigSchema.partial().optional()
const recordingStartSchema = z.union([recordingStartRequestSchema, legacyRecordingStartRequestSchema])
const recordingSessionSchema = z.object({ sessionId: z.string().min(1) })
const recordingStopSchema = recordingStopRequestSchema
const replayStartSchema = recordingSessionSchema.merge(confirmedSchema)
const replaySeekSchema = z.object({ replayId: z.string().min(1), cursorMs: z.number().int().nonnegative() })
const replayExportSchema = z.object({ replayId: z.string().min(1) })
const instanceIdSchema = z.object({ instanceId: z.string().min(1) })
const topologyAttachedSchema = attachedTopologyRequestSchema.optional()
const topologyAttachedFavoriteChangeSchema = attachedTopologyFavoriteChangeRequestSchema
const flowScopeSchema = z.object({ scope: z.string().optional(), rootId: z.string().optional() }).optional()
const attachedFlowSchema = flowRequestSchema.optional()
const flowExportSchema = flowExportRequestSchema.optional()
const flowEventStreamSchema = flowEventStreamRequestSchema.optional()
const flowEventStreamUnsubscribeSchema = flowEventStreamUnsubscribeRequestSchema


function rateLimitForDefinition(definition: R8IpcChannelDefinition) {
  return definition.rateClass
}

function confirmedByFromPayload(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const confirmedBy = (input as { confirmedBy?: unknown }).confirmedBy
  return typeof confirmedBy === 'string' ? confirmedBy : undefined
}

function registerContractOnlyHandlers(service: R8RuntimeService): void {
  const specific = new Set<string>(SPECIFIC_R8_RUNTIME_CHANNELS)
  for (const definition of R8_IPC_CHANNELS) {
    if (specific.has(definition.channel)) continue
    ipcMain.handle(definition.channel, withRateLimit(definition.channel, rateLimitForDefinition(definition), (_event, input: unknown) => service.invokeContractOnlyChannel({
      channel: definition.channel,
      payload: input,
      confirmedBy: confirmedByFromPayload(input)
    })))
  }
}

export function setupR8RuntimeHandlers(service: R8RuntimeService): void {
  cleanupR8RuntimeHandlers()
  activeR8RuntimeService = service
  registerR8RateLimitChannels(R8_IPC_CHANNELS)
  setRateLimitFeatureFlagProvider(() => {
    const maybeService = service as R8RuntimeService & { getFeatureFlag?: (flag: 'R8.C.ipc.rate-limit') => boolean }
    return typeof maybeService.getFeatureFlag === 'function'
      ? maybeService.getFeatureFlag('R8.C.ipc.rate-limit')
      : true
  })
  setRateLimitAuditSink(event => {
    auditLogger.log('ipc:rate-limit-warn', {
      channel: event.channel,
      rateClass: event.rateClass,
      rejectRate: event.rejectRate,
      rejectedRequests: event.rejectedRequests,
      totalRequests: event.totalRequests
    }, 'refused', 'rejectRate>0.05')
  })

  ipcMain.handle('integrations:list-libraries', withRateLimit('integrations:list-libraries', RATE_LIMITS.QUERY, () => service.listIntegrationLibraries()))
  ipcMain.handle('integrations:flag-get', withRateLimit('integrations:flag-get', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getFeatureFlag(flagGetSchema.parse(input).flag)))
  ipcMain.handle('integrations:flag-set', withRateLimit('integrations:flag-set', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setFeatureFlag(flagSetSchema.parse(input))))
  ipcMain.handle('integrations:health-check', withRateLimit('integrations:health-check', RATE_LIMITS.QUERY, () => service.healthCheck()))

  ipcMain.handle('ipc:rate-limit-channel-list', withRateLimit('ipc:rate-limit-channel-list', 'meta', () => service.listRateLimitChannels()))
  ipcMain.handle('ipc:override-rate-class', withRateLimit('ipc:override-rate-class', 'meta', (_event, input: unknown) => service.overrideRateClass(rateLimitOverrideRequestSchema.parse(input))))
  ipcMain.handle('zod:list-schemas', withRateLimit('zod:list-schemas', RATE_LIMITS.QUERY, () => service.listSchemas()))
  ipcMain.handle('zod:validate-payload', withRateLimit('zod:validate-payload', RATE_LIMITS.QUERY, (_event, input: unknown) => service.validatePayload(zodValidatePayloadRequestSchema.parse(input))))
  ipcMain.handle('zod:migration-status', withRateLimit('zod:migration-status', RATE_LIMITS.QUERY, () => service.migrationStatus()))

  ipcMain.handle('cli:get-progress', withRateLimit('cli:get-progress', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getCliProgress(cliProgressSchema.parse(input ?? {}))))
  ipcMain.handle('cli:get-sessions', withRateLimit('cli:get-sessions', RATE_LIMITS.QUERY, () => service.listCliSessions()))
  ipcMain.handle('cli:install-shim', withRateLimit('cli:install-shim', RATE_LIMITS.ACTION, (_event, input: unknown) => service.installCliShim(cliShimInstallSchema.parse(input))))
  ipcMain.handle('shim:install', withRateLimit('shim:install', RATE_LIMITS.ACTION, (_event, input: unknown) => service.installShim(cliShimInstallSchema.parse(input))))
  ipcMain.handle('shim:uninstall', withRateLimit('shim:uninstall', RATE_LIMITS.ACTION, (_event, input: unknown) => service.uninstallShim(cliShimInstallSchema.parse(input))))
  ipcMain.handle('shim:status', withRateLimit('shim:status', RATE_LIMITS.QUERY, () => service.listShimStatus()))
  ipcMain.handle('cli:select-strategy', withRateLimit('cli:select-strategy', RATE_LIMITS.ACTION, (_event, input: unknown) => service.selectCliStrategy(cliStrategySelectSchema.parse(input))))
  ipcMain.handle('cli:title-rule-reload', withRateLimit('cli:title-rule-reload', RATE_LIMITS.ACTION, (_event, input: unknown) => service.reloadTitleRules(titleRuleReloadRequestSchema.parse(input))))
  ipcMain.handle('cli:title-sample-debug', withRateLimit('cli:title-sample-debug', RATE_LIMITS.QUERY, (_event, input: unknown) => service.debugCliTitleSample(cliTitleSampleSchema.parse(input))))
  ipcMain.handle('cli:detect-all', withRateLimit('cli:detect-all', RATE_LIMITS.QUERY, (_event, input: unknown) => service.detectTools(toolDetectAllRequestSchema.parse(input ?? {}) ?? {})))
  ipcMain.handle('cli:detect-one', withRateLimit('cli:detect-one', RATE_LIMITS.QUERY, (_event, input: unknown) => service.detectTool(toolDetectOneRequestSchema.parse(input))))
  ipcMain.handle('cli:set-tool-override', withRateLimit('cli:set-tool-override', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setToolOverride(toolOverrideRequestSchema.parse(input))))
  ipcMain.handle('cli:clear-tool-override', withRateLimit('cli:clear-tool-override', RATE_LIMITS.ACTION, (_event, input: unknown) => service.clearToolOverride(toolClearOverrideRequestSchema.parse(input))))
  ipcMain.handle('cli:cursor-copilot-status', withRateLimit('cli:cursor-copilot-status', RATE_LIMITS.QUERY, (_event, input: unknown) => service.cursorCopilotStatus(cursorCopilotStatusRequestSchema.parse(input ?? {}) ?? {})))

  ipcMain.handle('monitor:open', withRateLimit('monitor:open', RATE_LIMITS.ACTION, () => service.openMonitorWindow()))
  ipcMain.handle('monitor:close', withRateLimit('monitor:close', RATE_LIMITS.ACTION, () => service.closeMonitorWindow()))
  ipcMain.handle('monitor:snapshot', withRateLimit('monitor:snapshot', RATE_LIMITS.QUERY, () => service.monitorSnapshot()))
  ipcMain.handle('monitor:set-window-prefs', withRateLimit('monitor:set-window-prefs', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setMonitorWindowPrefs(monitorWindowPrefsSchema.parse(input ?? {}))))
  ipcMain.handle('monitor:focus-instance', withRateLimit('monitor:focus-instance', RATE_LIMITS.ACTION, (_event, input: unknown) => service.focusMonitorInstance(monitorFocusInstanceSchema.parse(input))))
  ipcMain.handle('monitor:popout-open', withRateLimit('monitor:popout-open', RATE_LIMITS.ACTION, (_event, input: unknown) => service.openMonitorPopout(monitorPopoutOpenSchema.parse(input))))
  ipcMain.handle('monitor:popout-close', withRateLimit('monitor:popout-close', RATE_LIMITS.ACTION, (_event, input: unknown) => service.closeMonitorPopout(monitorPopoutIdSchema.parse(input))))
  ipcMain.handle('monitor:popout-list', withRateLimit('monitor:popout-list', RATE_LIMITS.QUERY, () => service.listMonitorPopouts()))
  ipcMain.handle('monitor:popout-return-to-main', withRateLimit('monitor:popout-return-to-main', RATE_LIMITS.ACTION, (_event, input: unknown) => service.returnMonitorPopoutToMain(monitorPopoutIdSchema.parse(input))))
  ipcMain.handle('monitor:popout-set-layout', withRateLimit('monitor:popout-set-layout', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setMonitorPopoutLayoutPreference(monitorPopoutSetLayoutSchema.parse(input))))

  ipcMain.handle('popout:create', withRateLimit('popout:create', RATE_LIMITS.ACTION, (_event, input: unknown) => service.createPopout(input)))
  ipcMain.handle('popout:close', withRateLimit('popout:close', RATE_LIMITS.ACTION, (_event, input: unknown) => service.closePopout(popoutCloseSchema.parse(input))))
  ipcMain.handle('popout:list', withRateLimit('popout:list', RATE_LIMITS.QUERY, () => service.listPopouts()))
  ipcMain.handle('port:popout-open', withRateLimit('port:popout-open', RATE_LIMITS.ACTION, (_event, input: unknown) => service.openPortPopout(portPopoutOpenRequestSchema.parse(input))))
  ipcMain.handle('port:popout-close', withRateLimit('port:popout-close', RATE_LIMITS.ACTION, (_event, input: unknown) => service.closePortPopout(portPopoutCloseRequestSchema.parse(input))))
  ipcMain.handle('port:popout-list', withRateLimit('port:popout-list', RATE_LIMITS.QUERY, () => service.listPortPopouts()))
  ipcMain.handle('port:popout-position-get', withRateLimit('port:popout-position-get', RATE_LIMITS.BURST, (_event, input: unknown) => service.getPortPopoutPosition(portPopoutPositionGetRequestSchema.parse(input))))
  ipcMain.handle('port:popout-position-save', withRateLimit('port:popout-position-save', RATE_LIMITS.ACTION, (_event, input: unknown) => service.savePortPopoutPosition(portPopoutPositionSaveRequestSchema.parse(input))))
  ipcMain.handle('port:popout-pin', withRateLimit('port:popout-pin', RATE_LIMITS.ACTION, (_event, input: unknown) => service.pinPortPopout(portPopoutPinRequestSchema.parse(input))))
  ipcMain.handle('port:popout-batch', withRateLimit('port:popout-batch', RATE_LIMITS.ACTION, (_event, input: unknown) => service.batchPortPopouts(portPopoutBatchRequestSchema.parse(input))))
  ipcMain.handle('port:popout-sync', withRateLimit('port:popout-sync', RATE_LIMITS.SCAN, (_event, input: unknown) => service.syncPortPopout(portPopoutSyncRequestSchema.parse(input))))
  ipcMain.handle('port:popout-demote', withRateLimit('port:popout-demote', RATE_LIMITS.ACTION, (_event, input: unknown) => service.demotePortPopout(portPopoutDemoteRequestSchema.parse(input))))
  ipcMain.handle('popout:bridge-message', withRateLimit('popout:bridge-message', RATE_LIMITS.SCAN, (_event, input: unknown) => service.handlePopoutBridgeMessage(popoutBridgeMessageSchema.parse(input))))
  ipcMain.handle('popout:pin', withRateLimit('popout:pin', RATE_LIMITS.ACTION, (_event, input: unknown) => service.pinPopout(popoutPinSchema.parse(input))))
  ipcMain.handle('popout:save-bounds', withRateLimit('popout:save-bounds', RATE_LIMITS.ACTION, (_event, input: unknown) => service.savePopoutBounds(popoutSaveBoundsSchema.parse(input))))
  ipcMain.handle('popout:move-to-monitor', withRateLimit('popout:move-to-monitor', RATE_LIMITS.ACTION, (_event, input: unknown) => service.movePopoutToMonitor(popoutMoveToMonitorSchema.parse(input))))
  ipcMain.handle('popout:promote-from-floating', withRateLimit('popout:promote-from-floating', RATE_LIMITS.ACTION, (_event, input: unknown) => service.promotePopoutFromFloating(popoutPromoteSchema.parse(input))))
  ipcMain.handle('popout:demote', withRateLimit('popout:demote', RATE_LIMITS.ACTION, (_event, input: unknown) => service.demotePopout(popoutCloseSchema.parse(input))))

  ipcMain.handle('drawer:get-state', withRateLimit('drawer:get-state', RATE_LIMITS.QUERY, () => service.getDrawerState()))
  ipcMain.handle('drawer:set-state', withRateLimit('drawer:set-state', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setDrawerState(input)))
  ipcMain.handle('drawer:save-layout', withRateLimit('drawer:save-layout', RATE_LIMITS.ACTION, (_event, input: unknown) => service.saveDrawerLayout(input)))
  ipcMain.handle('drawer:load-layout', withRateLimit('drawer:load-layout', RATE_LIMITS.ACTION, (_event, input: unknown) => service.loadDrawerLayout(input)))
  ipcMain.handle('drawer:list-layouts', withRateLimit('drawer:list-layouts', RATE_LIMITS.QUERY, () => service.listDrawerLayouts()))
  ipcMain.handle('drawer:morph-to-popout', withRateLimit('drawer:morph-to-popout', RATE_LIMITS.ACTION, (_event, input: unknown) => service.morphDrawerToPopout(input)))
  ipcMain.handle('drawer:morph-from-popout', withRateLimit('drawer:morph-from-popout', RATE_LIMITS.ACTION, (_event, input: unknown) => service.morphPopoutToDrawer(input)))

  ipcMain.handle('command:list', withRateLimit('command:list', RATE_LIMITS.QUERY, () => service.listCommands()))
  ipcMain.handle('command:invoke', withRateLimit('command:invoke', RATE_LIMITS.ACTION, (_event, input: unknown) => service.invokeCommand(input as { commandId: string; args?: unknown; confirmedBy?: string })))
  ipcMain.handle('command:history-list', withRateLimit('command:history-list', RATE_LIMITS.QUERY, () => service.listCommandHistory()))
  ipcMain.handle('command:history-add', withRateLimit('command:history-add', RATE_LIMITS.ACTION, (_event, input: unknown) => service.addCommandHistory(commandHistoryEntrySchema.parse(input))))
  ipcMain.handle('command:history-clear', withRateLimit('command:history-clear', RATE_LIMITS.ACTION, (_event, input: unknown) => service.clearCommandHistory(confirmedSchema.parse(input ?? {}))))
  ipcMain.handle('command:resolve-uri', withRateLimit('command:resolve-uri', RATE_LIMITS.QUERY, (_event, input: unknown) => service.resolveCommandUri(input)))
  ipcMain.handle('command:register-os-protocol', withRateLimit('command:register-os-protocol', RATE_LIMITS.ACTION, (_event, input: unknown) => service.registerOsProtocol(commandRegisterOsProtocolRequestSchema.parse(input))))
  ipcMain.handle('command:list-custom', withRateLimit('command:list-custom', RATE_LIMITS.QUERY, () => service.listCustomCommands()))
  ipcMain.handle('command:save-custom', withRateLimit('command:save-custom', RATE_LIMITS.ACTION, (_event, input: unknown) => service.saveCustomCommand(customCommandSchema.parse(input))))

  ipcMain.handle('dashboard:get-layout', withRateLimit('dashboard:get-layout', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getDashboardLayout(dashboardGetLayoutRequestSchema.parse(input ?? {}))))
  ipcMain.handle('dashboard:save-layout', withRateLimit('dashboard:save-layout', RATE_LIMITS.ACTION, (_event, input: unknown) => service.saveDashboardLayout(input)))
  ipcMain.handle('dashboard:list-presets', withRateLimit('dashboard:list-presets', RATE_LIMITS.QUERY, () => service.listDashboardPresets()))
  ipcMain.handle('dashboard:delete-preset', withRateLimit('dashboard:delete-preset', RATE_LIMITS.ACTION, (_event, input: unknown) => service.deleteDashboardPreset(dashboardDeletePresetRequestSchema.parse(input))))
  ipcMain.handle('dashboard:reset', withRateLimit('dashboard:reset', RATE_LIMITS.ACTION, (_event, input: unknown) => service.resetDashboardLayout(dashboardResetRequestSchema.parse(input ?? {}))))
  ipcMain.handle('dashboard:morph-widget-to-drawer', withRateLimit('dashboard:morph-widget-to-drawer', RATE_LIMITS.ACTION, (_event, input: unknown) => service.morphDashboardWidgetToDrawer(dashboardMorphWidgetToDrawerRequestSchema.parse(input))))

  ipcMain.handle('process:tree', withRateLimit('process:tree', RATE_LIMITS.QUERY, (_event, input: unknown) => service.processTree(processTreeRequestSchema.parse(input ?? {}))))
  ipcMain.handle('process:tree-children', withRateLimit('process:tree-children', RATE_LIMITS.QUERY, (_event, input: unknown) => service.processTreeChildren(processTreeChildrenRequestSchema.parse(input))))
  ipcMain.handle('process:treemap-data', withRateLimit('process:treemap-data', RATE_LIMITS.QUERY, (_event, input: unknown) => service.processTreemapData(processTreemapDataRequestSchema.parse(input ?? {}))))
  ipcMain.handle('process:view-mode-set', withRateLimit('process:view-mode-set', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setProcessViewMode(processViewModeSetRequestSchema.parse(input))))

  ipcMain.handle('skill:validate-yaml', withRateLimit('skill:validate-yaml', RATE_LIMITS.QUERY, (_event, input: unknown) => service.validateSkillYaml(input)))
  ipcMain.handle('skill:validate', withRateLimit('skill:validate', RATE_LIMITS.QUERY, (_event, input: unknown) => service.validateSkillEditor(input)))
  ipcMain.handle('skill:builtin-list', withRateLimit('skill:builtin-list', RATE_LIMITS.QUERY, () => service.listBuiltinSkills()))
  ipcMain.handle('skill:builtin-fork', withRateLimit('skill:builtin-fork', RATE_LIMITS.ACTION, (_event, input: unknown) => service.forkBuiltinSkill(skillBuiltinForkSchema.parse(input))))
  ipcMain.handle('skill:builtin-readme', withRateLimit('skill:builtin-readme', RATE_LIMITS.QUERY, (_event, input: unknown) => service.builtinReadme(skillNameSchema.parse(input))))
  ipcMain.handle('skill:get', withRateLimit('skill:get', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getSkill(skillNameSchema.parse(input))))
  ipcMain.handle('skill:write', withRateLimit('skill:write', RATE_LIMITS.ACTION, (_event, input: unknown) => service.writeSkill(skillWriteSchema.parse(input))))
  ipcMain.handle('skill:delete', withRateLimit('skill:delete', RATE_LIMITS.ACTION, (_event, input: unknown) => service.deleteSkill(skillDeleteSchema.parse(input))))
  ipcMain.handle('skill:create-from-template', withRateLimit('skill:create-from-template', RATE_LIMITS.ACTION, (_event, input: unknown) => service.createSkillFromTemplate(skillCreateFromTemplateSchema.parse(input))))
  ipcMain.handle('skill:install-from-path', withRateLimit('skill:install-from-path', RATE_LIMITS.ACTION, (_event, input: unknown) => service.installSkillFromPath(skillInstallFromPathSchema.parse(input))))
  ipcMain.handle('skill:uninstall', withRateLimit('skill:uninstall', RATE_LIMITS.ACTION, (_event, input: unknown) => service.uninstallSkill(skillDeleteSchema.parse(input))))
  ipcMain.handle('skill:template-list', withRateLimit('skill:template-list', RATE_LIMITS.QUERY, () => service.listSkillTemplates()))
  ipcMain.handle('skill:reload', withRateLimit('skill:reload', RATE_LIMITS.ACTION, (_event, input: unknown) => service.reloadSkills(skillReloadSchema.parse(input ?? {}) ?? {})))

  ipcMain.handle('status:aggregate', withRateLimit('status:aggregate', RATE_LIMITS.QUERY, () => service.statusAggregate()))
  ipcMain.handle('statusbar:get-config', withRateLimit('statusbar:get-config', RATE_LIMITS.QUERY, () => service.getStatusbarConfig()))
  ipcMain.handle('statusbar:set-config', withRateLimit('statusbar:set-config', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setStatusbarConfig(statusbarConfigSchema.parse(input))))
  ipcMain.handle('statusbar:reset', withRateLimit('statusbar:reset', RATE_LIMITS.ACTION, (_event, input: unknown) => service.resetStatusbarConfig(statusbarResetRequestSchema.parse(input))))
  ipcMain.handle('theme:decoration-list', withRateLimit('theme:decoration-list', RATE_LIMITS.QUERY, () => service.listThemeDecorations()))
  ipcMain.handle('theme:decoration-set', withRateLimit('theme:decoration-set', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setThemeDecorationConfig(themeDecorationConfigSchema.parse(input))))
  ipcMain.handle('theme:custom-svg-upload', withRateLimit('theme:custom-svg-upload', RATE_LIMITS.ACTION, (_event, input: unknown) => service.uploadCustomSvg(customSvgUploadRequestSchema.parse(input))))
  ipcMain.handle('theme:custom-svg-list', withRateLimit('theme:custom-svg-list', RATE_LIMITS.QUERY, () => service.listCustomSvgs()))
  ipcMain.handle('theme:custom-svg-remove', withRateLimit('theme:custom-svg-remove', RATE_LIMITS.ACTION, (_event, input: unknown) => service.removeCustomSvg(customSvgRemoveRequestSchema.parse(input))))
  ipcMain.handle('theme:sound-config', withRateLimit('theme:sound-config', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setThemeSoundConfig(themeSoundConfigSchema.parse(input))))
  ipcMain.handle('theme:sound-config-get', withRateLimit('theme:sound-config-get', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getThemeSoundConfig(themeSoundConfigGetRequestSchema.parse(input))))
  ipcMain.handle('port:security-tier', withRateLimit('port:security-tier', RATE_LIMITS.QUERY, (_event, input: unknown) => service.classifyPort(portSecuritySchema.parse(input))))
  ipcMain.handle('port:blocklist-list', withRateLimit('port:blocklist-list', RATE_LIMITS.QUERY, () => service.listBlocklist()))
  ipcMain.handle('port:blocklist-add', withRateLimit('port:blocklist-add', RATE_LIMITS.ACTION, (_event, input: unknown) => service.addBlocklist(portBlocklistAddSchema.parse(input))))
  ipcMain.handle('port:blocklist-remove', withRateLimit('port:blocklist-remove', RATE_LIMITS.ACTION, (_event, input: unknown) => service.removeBlocklist(portBlocklistRemoveSchema.parse(input))))
  ipcMain.handle('port:blocklist-reset', withRateLimit('port:blocklist-reset', RATE_LIMITS.ACTION, (_event, input: unknown) => service.resetBlocklist(portBlocklistResetSchema.parse(input) ?? {})))
  ipcMain.handle('port:public-banner-state', withRateLimit('port:public-banner-state', RATE_LIMITS.QUERY, (_event, input: unknown) => service.publicBannerState(portPublicBannerStateSchema.parse(input) ?? undefined)))

  ipcMain.handle('csv:schema-info', withRateLimit('csv:schema-info', RATE_LIMITS.QUERY, () => service.csvSchemaInfo()))
  ipcMain.handle('csv:validate-header', withRateLimit('csv:validate-header', RATE_LIMITS.QUERY, (_event, input: unknown) => service.validateCsvHeader(input)))
  ipcMain.handle('csv:validate-row', withRateLimit('csv:validate-row', RATE_LIMITS.QUERY, (_event, input: unknown) => service.validateCsvRow(input)))
  ipcMain.handle('csv:list-groups', withRateLimit('csv:list-groups', RATE_LIMITS.QUERY, () => ({ groups: service.listCsvGroups() })))
  ipcMain.handle('csv:get-group', withRateLimit('csv:get-group', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getCsvGroup(csvGroupSchema.parse(input))))
  ipcMain.handle('csv:reload', withRateLimit('csv:reload', RATE_LIMITS.ACTION, (_event, input: unknown) => service.reloadCsvGroups(csvReloadSchema.parse(input ?? {}) ?? {})))
  ipcMain.handle('csv:enqueue-row', withRateLimit('csv:enqueue-row', RATE_LIMITS.ACTION, (_event, input: unknown) => {
    const parsed = csvEnqueueRowSchema.parse(input)
    return typeof parsed === 'object' && parsed !== null && 'groupId' in parsed ? service.enqueueCsvDriverRow(parsed as { groupId: string; rowIndex: number }) : service.enqueueCsvRow(parsed)
  }))
  ipcMain.handle('csv:enqueue-group', withRateLimit('csv:enqueue-group', RATE_LIMITS.ACTION, (_event, input: unknown) => service.enqueueCsvGroup(csvEnqueueGroupSchema.parse(input))))
  ipcMain.handle('csv:generate-cli-command', withRateLimit('csv:generate-cli-command', RATE_LIMITS.QUERY, (_event, input: unknown) => service.generateCsvCommand(input)))
  ipcMain.handle('csv:get-runner-info', withRateLimit('csv:get-runner-info', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getCsvRunnerInfo(csvRunnerInfoSchema.parse(input))))
  ipcMain.handle('csv:launch', withRateLimit('csv:launch', RATE_LIMITS.ACTION, (_event, input: unknown) => {
    const parsed = csvLaunchSchema.parse(input)
    return 'csvPath' in parsed ? service.launchCsv(parsed) : service.launchCsvRow(parsed)
  }))
  ipcMain.handle('csv:pause', withRateLimit('csv:pause', RATE_LIMITS.ACTION, (_event, input: unknown) => service.pauseCsvSession(csvSessionActionSchema.parse(input))))
  ipcMain.handle('csv:resume', withRateLimit('csv:resume', RATE_LIMITS.ACTION, (_event, input: unknown) => service.resumeCsvSession(csvSessionActionSchema.parse(input))))
  ipcMain.handle('csv:abort', withRateLimit('csv:abort', RATE_LIMITS.ACTION, (_event, input: unknown) => service.abortCsvSession(csvSessionActionSchema.parse(input))))
  ipcMain.handle('csv:list-sessions', withRateLimit('csv:list-sessions', RATE_LIMITS.QUERY, () => service.listCsvSessions()))
  ipcMain.handle('csv:list-templates', withRateLimit('csv:list-templates', RATE_LIMITS.QUERY, (_event, input: unknown) => service.listCsvTemplates(csvTemplateListRequestSchema.parse(input ?? {}))))
  ipcMain.handle('csv:save-template', withRateLimit('csv:save-template', RATE_LIMITS.ACTION, (_event, input: unknown) => service.saveCsvTemplate(csvSaveTemplateRequestSchema.parse(input))))
  ipcMain.handle('csv:delete-template', withRateLimit('csv:delete-template', RATE_LIMITS.ACTION, (_event, input: unknown) => service.deleteCsvTemplate(csvDeleteTemplateRequestSchema.parse(input))))
  ipcMain.handle('csv:export-template', withRateLimit('csv:export-template', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportCsvTemplate(csvExportTemplateSchema.parse(input))))
  ipcMain.handle('csv:lock', withRateLimit('csv:lock', RATE_LIMITS.ACTION, (_event, input: unknown) => service.lockCsv(csvLockRequestSchema.parse(input))))
  ipcMain.handle('csv:unlock', withRateLimit('csv:unlock', RATE_LIMITS.ACTION, (_event, input: unknown) => service.unlockCsv(csvLockRequestSchema.parse(input))))
  ipcMain.handle('csv:save', withRateLimit('csv:save', RATE_LIMITS.ACTION, (_event, input: unknown) => service.saveCsv(input)))
  ipcMain.handle('csv:lock-status-stream', withRateLimit('csv:lock-status-stream', RATE_LIMITS.SCAN, (_event, input: unknown) => service.csvLockStatus(csvLockStatusRequestSchema.parse(input))))
  ipcMain.handle('task:list', withRateLimit('task:list', RATE_LIMITS.QUERY, (_event, input: unknown) => service.listTasks(typeof input === 'object' && input !== null ? input as { sessionId?: string } : {})))
  ipcMain.handle('task:get-stats', withRateLimit('task:get-stats', RATE_LIMITS.QUERY, (_event, input: unknown) => service.queueStats(typeof input === 'object' && input !== null ? input as { sessionId?: string } : {})))
  ipcMain.handle('task:export-results', withRateLimit('task:export-results', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportTaskResults(taskResultExportRequestSchema.parse(input ?? {}))))
  ipcMain.handle('task:retry', withRateLimit('task:retry', RATE_LIMITS.ACTION, (_event, input: unknown) => service.retryTask(taskRunActionSchema.parse(input))))
  ipcMain.handle('task:skip', withRateLimit('task:skip', RATE_LIMITS.ACTION, (_event, input: unknown) => service.skipTask(taskRunActionSchema.parse(input))))
  ipcMain.handle('task:pause-session', withRateLimit('task:pause-session', RATE_LIMITS.ACTION, (_event, input: unknown) => service.pauseTaskSession(taskSessionActionSchema.parse(input))))
  ipcMain.handle('task:resume-session', withRateLimit('task:resume-session', RATE_LIMITS.ACTION, (_event, input: unknown) => service.resumeTaskSession(taskSessionActionSchema.parse(input))))
  ipcMain.handle('task:abort-session', withRateLimit('task:abort-session', RATE_LIMITS.ACTION, (_event, input: unknown) => service.abortTaskSession(taskSessionActionSchema.parse(input))))
  ipcMain.handle('dag:build', withRateLimit('dag:build', RATE_LIMITS.QUERY, (_event, input: unknown) => service.buildDag(input)))
  ipcMain.handle('dag:detect-cycle', withRateLimit('dag:detect-cycle', RATE_LIMITS.QUERY, (_event, input: unknown) => service.detectDagCycle(input)))
  ipcMain.handle('dag:export', withRateLimit('dag:export', RATE_LIMITS.QUERY, (_event, input: unknown) => service.exportDag(input)))
  ipcMain.handle('dag:layer', withRateLimit('dag:layer', RATE_LIMITS.QUERY, (_event, input: unknown) => service.dagLayer(input)))
  ipcMain.handle('dag:check-ready', withRateLimit('dag:check-ready', RATE_LIMITS.SCAN, (_event, input: unknown) => service.checkDagReady(input)))

  ipcMain.handle('watchdog:status', withRateLimit('watchdog:status', RATE_LIMITS.QUERY, () => service.getWatchdogStatus()))
  ipcMain.handle('watchdog:configure', withRateLimit('watchdog:configure', RATE_LIMITS.ACTION, (_event, input: unknown) => service.configureWatchdog(input)))
  ipcMain.handle('watchdog:get-history', withRateLimit('watchdog:get-history', RATE_LIMITS.QUERY, () => service.getWatchdogHistory()))
  ipcMain.handle('watchdog:override-restart', withRateLimit('watchdog:override-restart', RATE_LIMITS.ACTION, (_event, input: unknown) => service.overrideWatchdogRestart(watchdogOverrideSchema.parse(input ?? {}))))
  ipcMain.handle('watchdog-supervisor:status', withRateLimit('watchdog-supervisor:status', RATE_LIMITS.QUERY, () => service.watchdogSupervisorStatus()))
  ipcMain.handle('watchdog-supervisor:respawn', withRateLimit('watchdog-supervisor:respawn', RATE_LIMITS.ACTION, (_event, input: unknown) => service.watchdogSupervisorRespawn(watchdogSupervisorRespawnRequestSchema.parse(input ?? {}))))
  ipcMain.handle('watchdog-supervisor:install-service', withRateLimit('watchdog-supervisor:install-service', RATE_LIMITS.ACTION, (_event, input: unknown) => service.watchdogSupervisorInstallService(watchdogSupervisorServiceRequestSchema.parse(input ?? {}))))
  ipcMain.handle('watchdog-supervisor:uninstall-service', withRateLimit('watchdog-supervisor:uninstall-service', RATE_LIMITS.ACTION, (_event, input: unknown) => service.watchdogSupervisorUninstallService(watchdogSupervisorServiceRequestSchema.parse(input ?? {}))))
  ipcMain.handle('inject:dry-run', withRateLimit('inject:dry-run', RATE_LIMITS.QUERY, (_event, input: unknown) => service.dryRunInject(input)))
  ipcMain.handle('inject:execute', withRateLimit('inject:execute', 'medium_query', (_event, input: unknown) => service.executeInject(input)))
  ipcMain.handle('inject:get-whitelist', withRateLimit('inject:get-whitelist', RATE_LIMITS.QUERY, (_event, input: unknown) => service.listInjectWhitelist(typeof input === 'object' && input !== null ? input as { scope?: 'instance' | 'tool' | 'project-cwd' } : {})))
  ipcMain.handle('inject:add-whitelist', withRateLimit('inject:add-whitelist', RATE_LIMITS.ACTION, (_event, input: unknown) => service.addInjectWhitelist(injectWhitelistAddSchema.parse(input))))
  ipcMain.handle('inject:remove-whitelist', withRateLimit('inject:remove-whitelist', RATE_LIMITS.ACTION, (_event, input: unknown) => service.removeInjectWhitelist(injectWhitelistRemoveSchema.parse(input))))
  ipcMain.handle('inject:resolve-target', withRateLimit('inject:resolve-target', RATE_LIMITS.QUERY, (_event, input: unknown) => service.resolveInjectTarget(injectTargetRequestSchema.parse(input))))
  ipcMain.handle('inject:get-ready-pool', withRateLimit('inject:get-ready-pool', RATE_LIMITS.QUERY, () => service.getInjectReadyPool()))
  ipcMain.handle('inject:history', withRateLimit('inject:history', RATE_LIMITS.QUERY, () => service.listInjectHistory()))
  ipcMain.handle('inject:cancel', withRateLimit('inject:cancel', RATE_LIMITS.ACTION, (_event, input: unknown) => service.cancelInject(injectCancelSchema.parse(input))))
  ipcMain.handle('inject:configure-strict-mode', withRateLimit('inject:configure-strict-mode', RATE_LIMITS.ACTION, (_event, input: unknown) => service.configureInjectStrictMode(injectStrictModeUpdateSchema.parse(input ?? {}))))
  ipcMain.handle('inject:configure-countdown', withRateLimit('inject:configure-countdown', RATE_LIMITS.ACTION, (_event, input: unknown) => service.configureInjectCountdown(injectCountdownUpdateSchema.parse(input ?? {}))))
  ipcMain.handle('inject:countdown-cancel', withRateLimit('inject:countdown-cancel', RATE_LIMITS.ACTION, (_event, input: unknown) => service.cancelInjectCountdown(injectCountdownCancelSchema.parse(input))))
  ipcMain.handle('inject:countdown-complete', withRateLimit('inject:countdown-complete', RATE_LIMITS.ACTION, (_event, input: unknown) => service.completeInjectCountdown(injectCountdownControlRequestSchema.parse(input))))
  ipcMain.handle('inject:first-time-confirm', withRateLimit('inject:first-time-confirm', RATE_LIMITS.ACTION, (_event, input: unknown) => service.confirmInjectFirstTime(injectFirstTimeConfirmRequestSchema.parse(input))))
  ipcMain.handle('notify:emit', withRateLimit('notify:emit', RATE_LIMITS.ACTION, (_event, input: unknown) => service.emitNotification(input)))
  ipcMain.handle('notify:list', withRateLimit('notify:list', RATE_LIMITS.QUERY, (_event, input: unknown) => service.listNotifications(notificationListRequestSchema.parse(input ?? {}))))
  ipcMain.handle('notify:dismiss', withRateLimit('notify:dismiss', RATE_LIMITS.ACTION, (_event, input: unknown) => service.dismissNotification(notificationDismissSchema.parse(input))))
  ipcMain.handle('notify:configure-aggregation', withRateLimit('notify:configure-aggregation', RATE_LIMITS.ACTION, (_event, input: unknown) => service.configureNotificationAggregation(notificationAggregationSchema.parse(input ?? {}))))
  ipcMain.handle('notify:configure-channel', withRateLimit('notify:configure-channel', RATE_LIMITS.ACTION, (_event, input: unknown) => service.configureNotificationChannel(notificationChannelConfigSchema.parse(input))))
  ipcMain.handle('notify:invoke-action', withRateLimit('notify:invoke-action', RATE_LIMITS.ACTION, (_event, input: unknown) => service.invokeNotificationAction(notificationInvokeActionSchema.parse(input))))
  ipcMain.handle('topology:global:get-fullscreen', withRateLimit('topology:global:get-fullscreen', RATE_LIMITS.QUERY, (_event, input: unknown) => service.topologyFullscreen(input)))
  ipcMain.handle('topology:build-global-graph', withRateLimit('topology:build-global-graph', RATE_LIMITS.QUERY, (_event, input: unknown) => service.buildGlobalTopology(input)))
  ipcMain.handle('topology:network', withRateLimit('topology:network', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getNetworkTopology(input)))
  ipcMain.handle('topology:neural', withRateLimit('topology:neural', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getNeuralTopology(input)))
  ipcMain.handle('topology:network:get', withRateLimit('topology:network:get', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getNetworkTopology(input)))
  ipcMain.handle('topology:neural:get', withRateLimit('topology:neural:get', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getNeuralTopology(input)))
  ipcMain.handle('topology:save-snapshot', withRateLimit('topology:save-snapshot', RATE_LIMITS.ACTION, (_event, input: unknown) => service.saveTopologySnapshot(input)))
  ipcMain.handle('topology:list-snapshots', withRateLimit('topology:list-snapshots', RATE_LIMITS.QUERY, () => service.listTopologySnapshots()))
  ipcMain.handle('topology:export', withRateLimit('topology:export', RATE_LIMITS.QUERY, (_event, input: unknown) => service.exportTopology(input)))
  ipcMain.handle('topology:global:export', withRateLimit('topology:global:export', RATE_LIMITS.QUERY, (_event, input: unknown) => service.exportTopology(input)))
  ipcMain.handle('topology:warm-scope-global', withRateLimit('topology:warm-scope-global', RATE_LIMITS.ACTION, (_event, input: unknown) => service.warmTopologyScopes(input)))
  ipcMain.handle('topology:attached:get-deep10', withRateLimit('topology:attached:get-deep10', RATE_LIMITS.QUERY, (_event, input: unknown) => service.topologyAttachedDeep10(topologyAttachedSchema.parse(input) ?? {})))
  ipcMain.handle('topology:attached:favorite-change', withRateLimit('topology:attached:favorite-change', RATE_LIMITS.ACTION, (_event, input: unknown) => service.auditAttachedTopologyFavoriteChange(topologyAttachedFavoriteChangeSchema.parse(input))))
  ipcMain.handle('flow:build-scoped-flow', withRateLimit('flow:build-scoped-flow', RATE_LIMITS.QUERY, (_event, input: unknown) => service.buildScopedFlow(flowScopeSchema.parse(input) ?? {})))
  ipcMain.handle('flow:get-attached', withRateLimit('flow:get-attached', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getAttachedFlow(attachedFlowSchema.parse(input) ?? {})))
  ipcMain.handle('flow:filter-edges', withRateLimit('flow:filter-edges', RATE_LIMITS.QUERY, (_event, input: unknown) => service.filterAttachedFlow(attachedFlowSchema.parse(input) ?? {})))
  ipcMain.handle('flow:scoped-stats', withRateLimit('flow:scoped-stats', RATE_LIMITS.QUERY, (_event, input: unknown) => service.flowScopedStats(attachedFlowSchema.parse(input) ?? {})))
  ipcMain.handle('flow:export-timeline', withRateLimit('flow:export-timeline', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportFlowTimeline(flowExportSchema.parse(input) ?? {})))
  ipcMain.handle('flow:event-stream', withRateLimit('flow:event-stream', RATE_LIMITS.SCAN, (event, input: unknown) => service.subscribeFlowEventStream(event.sender, flowEventStreamSchema.parse(input) ?? {})))
  ipcMain.handle('flow:event-stream:unsubscribe', withRateLimit('flow:event-stream:unsubscribe', RATE_LIMITS.BURST, (_event, input: unknown) => service.unsubscribeFlowEventStream(flowEventStreamUnsubscribeSchema.parse(input))))
  ipcMain.handle('ai:get-signal-contributions', withRateLimit('ai:get-signal-contributions', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getSignalContributions(instanceIdSchema.parse(input))))
  ipcMain.handle('ai:get-instance-state', withRateLimit('ai:get-instance-state', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getInstanceState(instanceIdSchema.parse(input))))
  ipcMain.handle('ai:report-misreport', withRateLimit('ai:report-misreport', RATE_LIMITS.ACTION, (_event, input: unknown) => service.reportMisreport(input)))
  ipcMain.handle('ai:list-misreports', withRateLimit('ai:list-misreports', RATE_LIMITS.QUERY, (_event, input?: unknown) => service.listMisreports(input)))
  ipcMain.handle('ai:get-diagnostic-explain', withRateLimit('ai:get-diagnostic-explain', RATE_LIMITS.QUERY, (_event, input: unknown) => service.diagnosticExplain(input)))
  ipcMain.handle('ai:reset-learned-weights', withRateLimit('ai:reset-learned-weights', RATE_LIMITS.ACTION, (_event, input: unknown) => service.resetLearnedWeights(input)))
  ipcMain.handle('ai:list-weight-profiles', withRateLimit('ai:list-weight-profiles', RATE_LIMITS.QUERY, () => service.listWeightProfiles()))
  ipcMain.handle('ai:list-state-rules', withRateLimit('ai:list-state-rules', RATE_LIMITS.QUERY, () => service.listStateRules()))
  ipcMain.handle('ai:override-rule', withRateLimit('ai:override-rule', RATE_LIMITS.ACTION, (_event, input: unknown) => service.overrideStateRule(stateRuleOverrideRequestSchema.parse(input))))
  ipcMain.handle('ai:fusion-config', withRateLimit('ai:fusion-config', RATE_LIMITS.QUERY, (_event, input: unknown) => service.fusionConfig(fusionConfigRequestSchema.parse(input ?? undefined))))
  ipcMain.handle('ai:set-weight-profile', withRateLimit('ai:set-weight-profile', RATE_LIMITS.ACTION, (_event, input: unknown) => service.setWeightProfile(weightProfileSchema.parse(input ?? {}))))
  ipcMain.handle('ai:claude-cost-summary', withRateLimit('ai:claude-cost-summary', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getClaudeCostSummary(claudeCostSummaryRequestSchema.parse(input))))
  ipcMain.handle('ai:gemini-pattern-stat', withRateLimit('ai:gemini-pattern-stat', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getGeminiPatternStat(geminiPatternStatRequestSchema.parse(input ?? {}))))
  ipcMain.handle('ai:gemini-rule-reload', withRateLimit('ai:gemini-rule-reload', RATE_LIMITS.ACTION, (_event, input: unknown) => service.reloadGeminiRules(geminiRuleReloadRequestSchema.parse(input))))
  ipcMain.handle('ipc:rate-limit-stats', withRateLimit('ipc:rate-limit-stats', 'meta', () => service.rateLimitStats()))
  ipcMain.handle('obs:get-snapshot', withRateLimit('obs:get-snapshot', 'medium_query', (_event, input: unknown) => service.getObservabilitySnapshot(observabilitySnapshotRequestSchema.parse(input ?? undefined))))
  ipcMain.handle('obs:configure', withRateLimit('obs:configure', 'low_freq_op', (_event, input: unknown) => service.configureObservability(observabilityConfigSchema.parse(input ?? {}))))
  ipcMain.handle('obs:export-snapshot', withRateLimit('obs:export-snapshot', 'low_freq_op', (_event, input: unknown) => service.exportObservabilitySnapshot(observabilityExportSnapshotRequestSchema.parse(input ?? undefined))))
  ipcMain.handle('obs:export-diagnostic-pack', withRateLimit('obs:export-diagnostic-pack', 'low_freq_op', (_event, input: unknown) => service.exportObservabilityDiagnosticPack(observabilityDiagnosticPackRequestSchema.parse(input ?? undefined))))
  ipcMain.handle('obs:subscribe', withRateLimit('obs:subscribe', 'high_freq_scan', (event, input: unknown) => service.subscribeObservability(event.sender, observabilitySubscribeRequestSchema.parse(input ?? undefined))))
  ipcMain.handle('obs:unsubscribe', withRateLimit('obs:unsubscribe', 'meta', (_event, input: unknown) => service.unsubscribeObservability(observabilityUnsubscribeRequestSchema.parse(input))))
  ipcMain.handle('recovery:scan', withRateLimit('recovery:scan', RATE_LIMITS.ACTION, () => service.recoveryScan()))
  ipcMain.handle('recovery:report', withRateLimit('recovery:report', RATE_LIMITS.QUERY, () => service.recoveryReport()))
  ipcMain.handle('recovery:check-dirty', withRateLimit('recovery:check-dirty', RATE_LIMITS.QUERY, (_event, input: unknown) => service.recoveryCheckDirty(recoveryCheckDirtyRequestSchema.parse(input ?? {}))))
  ipcMain.handle('recovery:restore-state', withRateLimit('recovery:restore-state', RATE_LIMITS.ACTION, (_event, input: unknown) => service.recoveryRestoreState(recoveryRestoreStateRequestSchema.parse(input))))
  ipcMain.handle('recovery:list-snapshots', withRateLimit('recovery:list-snapshots', RATE_LIMITS.QUERY, () => service.recoveryListSnapshots()))
  ipcMain.handle('recovery:create-checkpoint', withRateLimit('recovery:create-checkpoint', RATE_LIMITS.ACTION, (_event, input: unknown) => service.recoveryCreateCheckpoint(recoveryCreateCheckpointRequestSchema.parse(input ?? {}))))
  ipcMain.handle('recovery:dismiss', withRateLimit('recovery:dismiss', RATE_LIMITS.ACTION, (_event, input: unknown) => service.dismissRecoveryReport(recoveryDismissRequestSchema.parse(input))))
  ipcMain.handle('permission:ttl-config', withRateLimit('permission:ttl-config', RATE_LIMITS.QUERY, () => service.getPermissionTtlConfig()))
  ipcMain.handle('permission:confirm', withRateLimit('permission:confirm', RATE_LIMITS.ACTION, (_event, input: unknown) => service.grantPermission(input)))
  ipcMain.handle('permission:allowlist', withRateLimit('permission:allowlist', RATE_LIMITS.QUERY, () => service.listPermissionAllowlist()))
  ipcMain.handle('permission:reset', withRateLimit('permission:reset', RATE_LIMITS.ACTION, (_event, input: unknown) => service.resetPermissions(confirmedSchema.parse(input ?? {}))))
  ipcMain.handle('permission:request', withRateLimit('permission:request', RATE_LIMITS.ACTION, (_event, input: unknown) => service.requestPermission(permissionRequestSchema.parse(input))))
  ipcMain.handle('permission:check', withRateLimit('permission:check', RATE_LIMITS.QUERY, (_event, input: unknown) => service.checkPermission(permissionCheckRequestSchema.parse(input))))
  ipcMain.handle('permission:revoke', withRateLimit('permission:revoke', RATE_LIMITS.ACTION, (_event, input: unknown) => service.revokePermissionGrant(permissionRevokeRequestSchema.parse(input))))
  ipcMain.handle('permission:revoke-all', withRateLimit('permission:revoke-all', RATE_LIMITS.ACTION, (_event, input: unknown) => service.revokeAllPermissionGrants(permissionRevokeAllRequestSchema.parse(input))))
  ipcMain.handle('permission:list-active', withRateLimit('permission:list-active', RATE_LIMITS.QUERY, () => service.listActivePermissionGrants()))
  ipcMain.handle('permission:configure-policy', withRateLimit('permission:configure-policy', RATE_LIMITS.ACTION, (_event, input: unknown) => service.configurePermissionPolicy(input)))
  ipcMain.handle('permission:expiry-stream', withRateLimit('permission:expiry-stream', RATE_LIMITS.QUERY, () => service.permissionExpiryStreamPayload()))

  ipcMain.handle('backup:create', withRateLimit('backup:create', RATE_LIMITS.ACTION, (_event, input: unknown) => service.createBackup(backupCreateRequestSchema.parse(input ?? {}))))
  ipcMain.handle('backup:list', withRateLimit('backup:list', RATE_LIMITS.QUERY, () => service.listBackups()))
  ipcMain.handle('backup:restore', withRateLimit('backup:restore', RATE_LIMITS.ACTION, (_event, input: unknown) => service.restoreBackup(restorePlanSchema.parse(input))))
  ipcMain.handle('backup:delete', withRateLimit('backup:delete', RATE_LIMITS.ACTION, (_event, input: unknown) => service.deleteBackup(backupDeleteRequestSchema.parse(input))))
  ipcMain.handle('backup:configure-schedule', withRateLimit('backup:configure-schedule', RATE_LIMITS.ACTION, (_event, input: unknown) => service.configureBackupSchedule(backupScheduleSchema.parse(input ?? {}))))
  ipcMain.handle('backup:schedule-config', withRateLimit('backup:schedule-config', RATE_LIMITS.QUERY, () => service.getBackupSchedule()))
  ipcMain.handle('backup:export-classified', withRateLimit('backup:export-classified', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportClassifiedBackup(backupExportClassifiedRequestSchema.parse(input))))
  ipcMain.handle('data-ownership:list-paths', withRateLimit('data-ownership:list-paths', RATE_LIMITS.QUERY, () => service.listDataOwnershipPaths()))
  ipcMain.handle('data-ownership:list-entries', withRateLimit('data-ownership:list-entries', RATE_LIMITS.QUERY, (_event, input: unknown) => service.listDataOwnershipEntries(dataOwnershipListEntriesRequestSchema.parse(input ?? {}))))
  ipcMain.handle('data-ownership:export-all', withRateLimit('data-ownership:export-all', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportDataOwnershipArchive(dataOwnershipExportAllRequestSchema.parse(input ?? {}))))
  ipcMain.handle('diagnostic:export', withRateLimit('diagnostic:export', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportDiagnosticPack(input)))
  ipcMain.handle('diagnostic:list', withRateLimit('diagnostic:list', RATE_LIMITS.QUERY, () => service.listDiagnostics()))
  ipcMain.handle('diagnostic:purge', withRateLimit('diagnostic:purge', RATE_LIMITS.ACTION, (_event, input: unknown) => service.purgeDiagnostics(confirmedSchema.parse(input ?? {}))))
  ipcMain.handle('diagnostic:preview', withRateLimit('diagnostic:preview', RATE_LIMITS.ACTION, (_event, input: unknown) => service.previewDiagnosticPack(diagnosticPackOptionsSchema.parse(input ?? {}))))
  ipcMain.handle('diagnostic:list-redaction-rules', withRateLimit('diagnostic:list-redaction-rules', RATE_LIMITS.QUERY, () => service.listDiagnosticRedactionRules()))
  ipcMain.handle('diagnostic:capture-screenshot', withRateLimit('diagnostic:capture-screenshot', RATE_LIMITS.ACTION, (_event, input: unknown) => service.captureDiagnosticScreenshot(diagnosticScreenshotRequestSchema.parse(input ?? {}))))
  ipcMain.handle('diagnostic:list-packs', withRateLimit('diagnostic:list-packs', RATE_LIMITS.QUERY, () => service.listDiagnosticPacks()))
  ipcMain.handle('skill:list', withRateLimit('skill:list', RATE_LIMITS.QUERY, () => service.listSkills()))
  ipcMain.handle('skill:cloud-sync-disabled', withRateLimit('skill:cloud-sync-disabled', RATE_LIMITS.QUERY, () => service.cloudSyncDisabled()))
  ipcMain.handle('skill:cloud-sync-status', withRateLimit('skill:cloud-sync-status', RATE_LIMITS.QUERY, () => service.cloudSyncStatus()))
  ipcMain.handle('skill:cloud-sync-trigger', withRateLimit('skill:cloud-sync-trigger', RATE_LIMITS.QUERY, (_event, input: unknown) => service.triggerCloudSync(cloudSyncRequestSchema.parse(input ?? { direction: 'bidirectional', conflictPolicy: 'local-wins' }))))
  ipcMain.handle('skill:cloud-sync-list-remote', withRateLimit('skill:cloud-sync-list-remote', RATE_LIMITS.QUERY, () => service.listRemoteCloudSkills()))
  ipcMain.handle('recording:start', withRateLimit('recording:start', RATE_LIMITS.ACTION, (_event, input: unknown) => service.startRecording(recordingStartSchema.parse(input ?? {}))))
  ipcMain.handle('recording:stop', withRateLimit('recording:stop', RATE_LIMITS.ACTION, (_event, input: unknown) => {
    const parsed = recordingStopSchema.parse(input)
    return parsed.recordingId
      ? service.stopRecording({ recordingId: parsed.recordingId, confirmedBy: parsed.confirmedBy })
      : service.stopRecording({ sessionId: parsed.sessionId ?? '', confirmedBy: parsed.confirmedBy })
  }))
  ipcMain.handle('recording:list', withRateLimit('recording:list', RATE_LIMITS.QUERY, (_event, input: unknown) => {
    const parsed = recordingListRequestSchema.parse(input)
    return parsed ? service.listRecordings(parsed) : service.listRecordings()
  }))
  ipcMain.handle('recording:get-manifest', withRateLimit('recording:get-manifest', RATE_LIMITS.QUERY, (_event, input: unknown) => {
    const parsed = recordingGetManifestRequestSchema.parse(input)
    return parsed.recordingId
      ? service.getRecordingManifest({ recordingId: parsed.recordingId })
      : service.getRecordingManifest({ sessionId: parsed.sessionId ?? '' })
  }))
  ipcMain.handle('recording:get-events', withRateLimit('recording:get-events', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getRecordingEvents(recordingGetEventsRequestSchema.parse(input))))
  ipcMain.handle('recording:get-replay-state', withRateLimit('recording:get-replay-state', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getRecordingReplayState(recordingGetReplayStateRequestSchema.parse(input))))
  ipcMain.handle('recording:get-events-window', withRateLimit('recording:get-events-window', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getRecordingEventsWindow(recordingGetEventsWindowRequestSchema.parse(input))))
  ipcMain.handle('recording:get-cast', withRateLimit('recording:get-cast', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getRecordingCast(recordingGetCastRequestSchema.parse(input))))
  ipcMain.handle('recording:list-anchors', withRateLimit('recording:list-anchors', RATE_LIMITS.QUERY, (_event, input: unknown) => service.listRecordingAnchors(recordingListAnchorsRequestSchema.parse(input))))
  ipcMain.handle('recording:get-screenshot', withRateLimit('recording:get-screenshot', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getRecordingScreenshot(recordingGetScreenshotRequestSchema.parse(input))))
  ipcMain.handle('recording:get-fs-snapshot-at', withRateLimit('recording:get-fs-snapshot-at', RATE_LIMITS.QUERY, (_event, input: unknown) => service.getRecordingFsSnapshotAt(recordingGetFsSnapshotAtRequestSchema.parse(input))))
  ipcMain.handle('recording:export-asciinema', withRateLimit('recording:export-asciinema', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportRecordingAsciinema(recordingExportAsciinemaRequestSchema.parse(input))))
  ipcMain.handle('recording:export-zip', withRateLimit('recording:export-zip', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportRecordingZip(recordingExportZipRequestSchema.parse(input))))
  ipcMain.handle('recording:delete', withRateLimit('recording:delete', RATE_LIMITS.ACTION, (_event, input: unknown) => service.deleteRecording(recordingDeleteRequestSchema.parse(input))))
  ipcMain.handle('recording:replay-start', withRateLimit('recording:replay-start', RATE_LIMITS.ACTION, (_event, input: unknown) => service.startReplay(replayStartSchema.parse(input))))
  ipcMain.handle('recording:replay-seek', withRateLimit('recording:replay-seek', RATE_LIMITS.ACTION, (_event, input: unknown) => service.seekReplay(replaySeekSchema.parse(input))))
  ipcMain.handle('recording:replay-export', withRateLimit('recording:replay-export', RATE_LIMITS.ACTION, (_event, input: unknown) => service.exportReplay(replayExportSchema.parse(input))))
  ipcMain.handle('ocr:capabilities', withRateLimit('ocr:capabilities', RATE_LIMITS.QUERY, () => service.ocrCapabilities()))
  ipcMain.handle('ocr:recognize', withRateLimit('ocr:recognize', RATE_LIMITS.ACTION, (_event, input: unknown) => service.recognizeOcr(ocrRecognizeRequestSchema.parse(input ?? {}))))
  ipcMain.handle('ocr:list-supported-languages', withRateLimit('ocr:list-supported-languages', RATE_LIMITS.QUERY, () => service.listOcrSupportedLanguages()))

  service.startStatusAggregator?.()
  service.startTopologySnapshotter?.()
  registerContractOnlyHandlers(service)
}

export function cleanupR8RuntimeHandlers(): void {
  activeR8RuntimeService?.dispose?.()
  activeR8RuntimeService = null
  for (const channel of R8_RUNTIME_CHANNELS) {
    ipcMain.removeHandler(channel)
  }
}
