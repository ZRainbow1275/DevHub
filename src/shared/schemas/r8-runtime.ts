import { z } from 'zod'
import { featureFlagNameSchema } from '../feature-flags'
import {
  THEME_DECORATION_KIND_VALUES,
  THEME_DECORATION_POSITION_VALUES
} from '../types'
import {
  PopoutSyncPolicySchema,
  PORT_POPOUT_LIMITS,
  PortPopoutPositionSchema,
  PortPopoutSizeSchema,
  PortPopoutTriggerSchema
} from '../types-extended'
import { DECORATION_LIMITS } from '../theme-decorations'
export { DECORATION_LIMITS } from '../theme-decorations'
import { SECURITY_TIER_VALUES, SECURITY_TIER_VISUAL } from '../port-security'
import { PROCESS_TAG_COLOR_VALUES, TAG_HISTORY_LIMITS } from '../process-tags-history'
export { TAG_HISTORY_LIMITS } from '../process-tags-history'
import { A11Y_FOCUS_RING_VALUES, A11Y_IMPACT_VALUES, A11Y_LIMITS } from '../a11y'
export { A11Y_LIMITS } from '../a11y'
import { ICON_LIBRARY_VALUES, ICON_TOKEN_REGEX } from '../icon-library'
export { ICON_LIBRARY_USAGE, ICON_LIMITS, ICON_TOKEN_REGEX } from '../icon-library'
import {
  channelConfigSchema,
  notificationAggregationConfigSchema,
  notificationSchema,
  notifyEmitResponseSchema,
  notifyInvokeActionRequestSchema,
  notifyListRequestSchema
} from './notification'
export * from './notification'
import {
  claudeCostSummaryRequestSchema,
  claudeCostSummarySchema,
  claudeStreamEventSchema,
  claudeStreamJsonRestartCommandSchema,
  claudeStreamJsonRestartConfirmRequestSchema,
  claudeStreamJsonRestartRecordSchema,
  claudeStreamJsonRestartRequestSchema
} from './claude-stream'
export * from './claude-stream'
import {
  geminiParseStateSchema,
  geminiPatternKindSchema,
  geminiPatternRuleInputSchema,
  geminiPatternStatRequestSchema,
  geminiPatternStatSchema,
  geminiRuleReloadRequestSchema,
  geminiRuleReloadResponseSchema
} from './gemini-pattern'
export * from './gemini-pattern'
import {
  cursorCopilotSignalSchema,
  cursorCopilotStatusRequestSchema,
  cursorCopilotStatusSchema,
  titlePatternRuleSchema,
  titleRuleReloadRequestSchema,
  titleRuleReloadResponseSchema,
  titleSampleSchema,
  titleToolSchema,
  windowTitleSignalPhaseSchema,
  windowTitleSignalToolSchema
} from './window-title-pattern'
export * from './window-title-pattern'
import {
  toolClearOverrideRequestSchema,
  toolClearOverrideResponseSchema,
  toolDetectAllRequestSchema,
  toolDetectOneRequestSchema,
  toolDetectResultSchema,
  toolDetectionStateSchema,
  toolNameSchema,
  toolOverrideRequestSchema,
  toolOverrideResponseSchema
} from './tool-detect'
export * from './tool-detect'
import {
  channelRegistrationSchema,
  rateLimitClassSchema,
  rateLimitOverrideRequestSchema,
  rateLimitOverrideResponseSchema,
  rateLimitStatsResponseSchema,
  rateLimitStatsSchema,
  rateLimitVerdictSchema
} from './ipc-rate-limit'
export * from './ipc-rate-limit'
import {
  metricKindSchema,
  metricSampleSchema,
  observabilityConfigSchema,
  observabilityConfigureResponseSchema,
  observabilityDiagnosticPackRequestSchema,
  observabilityDiagnosticPackResponseSchema,
  observabilityExportSnapshotRequestSchema,
  observabilityExportSnapshotResponseSchema,
  observabilitySnapshotRequestSchema,
  observabilitySnapshotSchema,
  observabilitySubscribeRequestSchema,
  observabilitySubscribeResponseSchema,
  observabilityUnsubscribeRequestSchema,
  observabilityUnsubscribeResponseSchema
} from './observability'
export * from './observability'
import {
  appLifecycleMarkerSchema,
  dirtyFindingSchema,
  dirtyKindSchema,
  dirtySeveritySchema,
  recoveryAppliedActionSchema,
  recoveryCheckDirtyRequestSchema,
  recoveryCheckDirtyResponseSchema,
  recoveryCreateCheckpointRequestSchema,
  recoveryDismissRequestSchema,
  recoveryDismissResponseSchema,
  recoveryListSnapshotsResponseSchema,
  recoveryProbeSummarySchema,
  recoveryRecommendedActionSchema,
  recoveryReportSchema,
  recoveryRestoreStateRequestSchema,
  recoverySnapshotFileSchema,
  recoverySnapshotReasonSchema,
  recoverySnapshotSchema,
  recoveryUserChoiceSchema
} from './recovery'
export * from './recovery'
import {
  ipcSchemaPairSchema,
  schemaMetaSchema,
  schemaMigrationStepSchema,
  schemaValidationIssueSchema,
  schemaValidationVerdictSchema,
  zodListSchemasResponseSchema,
  zodMigrationStatusResponseSchema,
  zodValidatePayloadRequestSchema,
  zodValidatePayloadResponseSchema
} from './_meta'
export * from './_meta'
import { CSV_COLUMN_NAMES, csvColumnInfoSchema, csvHeaderValidationResultSchema, csvTaskRow18Schema } from './csv-task-row'
import {
  handshakeMessageSchema,
  rpcChannelSchema,
  rpcErrorSchema,
  rpcRequestSchema,
  rpcResponseSchema,
  sessionTokenContextSchema,
  supervisorStateSchema,
  watchdogChannelDiagnosticSchema,
  watchdogMarkerFileSchema,
  watchdogProtocolVersionSchema,
  watchdogRpcMethodSchema,
  watchdogSessionTokenSchema,
  watchdogSupervisorRespawnRequestSchema,
  watchdogSupervisorServiceRequestSchema,
  watchdogSupervisorEventResultSchema,
  watchdogSupervisorEventSchema,
  watchdogSupervisorEventStreamPayloadSchema,
  watchdogSupervisorEventTypeSchema,
  watchdogSupervisorStatusSchema,
  watchdogSupervisorStatusValueSchema
} from './watchdog-rpc'
export * from './watchdog-rpc'
import {
  injectActionSchemaV2,
  injectAuditRecordSchema,
  injectCountdownConfigSchema,
  injectCountdownPhaseSchema,
  injectCountdownStreamPayloadSchema,
  injectDryRunResultSchema,
  injectFailureKindSchema,
  injectModeSchema,
  injectReadyPoolInstanceSchema,
  injectResolveTargetInputSchema,
  injectResolveTargetResultSchema,
  injectResultSchemaV2,
  injectScenarioSchema,
  injectSelectorKindSchema,
  injectStrictModeConfigSchema,
  injectStrictModeGateSchema,
  injectTargetSchema,
  injectWhitelistDurationSchema,
  injectWhitelistEntrySchema,
  injectWhitelistGateSchema,
  injectWhitelistScopeSchema,
  normalizedInjectActionSchema,
  resolvedInjectTargetSchema
} from './inject'
export * from './inject'
import {
  dagBuildRequestSchema,
  dagAuditEntrySchema,
  dagCycleErrorSchema,
  dagEdgeSchema,
  dagExportFormatSchema,
  dagExportRequestSchema,
  dagExportResultSchema,
  dagGraphSchema,
  dagInputNodeSchema,
  dagLayerRequestSchema,
  dagNodeSchema,
  dagReadyRequestSchema,
  dagSnapshotSchema,
  dagWarningSchema,
  dependencyClauseSchema,
  dependencyCombinatorSchema,
  dependencyConditionSchema,
  parsedDependencySchema
} from './dag'
export * from './dag'
import {
  csvDeleteTemplateRequestSchema,
  csvDeleteTemplateResultSchema,
  csvExternalChangeEventSchema,
  csvLockRequestSchema,
  csvLockResultSchema,
  csvLockStatusRequestSchema,
  csvLockStatusSchema,
  csvSaveRequestSchema,
  csvSaveResultSchema,
  csvSaveTemplateRequestSchema,
  csvTemplateListRequestSchema,
  dagEditorEdgeHoverSchema,
  dagEditorPatchSchema,
  dagEditorStateSchema,
  dagEditorValidationErrorSchema,
  dagViewKindSchema,
  nodeTemplateSchema
} from './dag-editor-state'
export * from './dag-editor-state'
import {
  fsEventSchema,
  gitDiffEventSchema,
  legacyRecordingStartRequestSchema,
  recordingDeleteRequestSchema,
  recordingDeleteResultSchema,
  recordingEventSchema,
  recordingEventStreamPayloadSchema,
  recordingExportAsciinemaRequestSchema,
  recordingExportResultSchema,
  recordingExportZipRequestSchema,
  recordingFsOpSchema,
  recordingGetEventsRequestSchema,
  recordingGetManifestRequestSchema,
  recordingListRequestSchema,
  recordingManifestSchema,
  recordingScreenshotRegionSchema,
  recordingSourceSchema,
  recordingStartRequestSchema,
  recordingStatusSchema,
  recordingStopRequestSchema,
  recordingStreamFileSchema,
  recordingStreamKindSchema,
  screenshotEventSchema,
  stdinEventSchema,
  stdoutEventSchema
} from './recording'
export * from './recording'
import {
  asciinemaCastSchema,
  recordingFsSnapshotResultSchema,
  recordingGetCastRequestSchema,
  recordingGetCastResultSchema,
  recordingGetEventsWindowRequestSchema,
  recordingGetEventsWindowResultSchema,
  recordingGetFsSnapshotAtRequestSchema,
  recordingGetReplayStateRequestSchema,
  recordingGetScreenshotRequestSchema,
  recordingListAnchorsRequestSchema,
  recordingListAnchorsResultSchema,
  recordingReplayStateSchema,
  recordingScreenshotResultSchema,
  replayAnchorKindSchema,
  replayAnchorSchema,
  replaySpeedSchema,
  replaySpeedValueSchema
} from './replay-state'
export * from './replay-state'
import {
  graphEdgeSchema,
  graphExportFormatSchema,
  graphExportRequestSchema,
  graphExportResultSchema,
  graphKindSchema,
  graphLayoutSchema,
  graphNodeKindSchema,
  graphNodeSchema,
  graphSaveSnapshotRequestSchema,
  graphSavedSnapshotSchema,
  graphSliceSchema,
  graphSnapshotSchema,
  graphWarmScopeRequestSchema
} from './graph'
export * from './graph'
import {
  attachedTopologyFavoriteChangeRequestSchema,
  attachedTopologyFavoriteChangeResultSchema,
  attachedTopologyFavoriteSchema,
  attachedTopologyRequestSchema,
  attachedTopologyResultSchema
} from './attached-topology'
export * from './attached-topology'
import {
  flowExportRequestSchema,
  flowExportResultSchema,
  flowEventStreamPayloadSchema,
  flowEventStreamRequestSchema,
  flowEventStreamResponseSchema,
  flowEventStreamUnsubscribeRequestSchema,
  flowFilterSchema,
  flowRequestSchema,
  flowSnapshotSchema,
  flowStatsSchema,
  flowWarningSchema
} from './flow'
export * from './flow'
import {
  fusionConfigSchema,
  signalContributionSchema,
  signalContributionSnapshotSchema,
  signalSampleSchema,
  signalSourceSchema,
  weightProfileSchema
} from './signal-fusion'
export * from './signal-fusion'
import {
  instanceStateSchema,
  stateAssertionRuleSchema,
  stateRuleOverrideRequestSchema,
  stateTransitionEventSchema,
  systemStateSchema,
  taskStateSchema,
  uiStateSchema
} from './state-machine'
export * from './state-machine'
import {
  diagnosticExplainSchema,
  listMisreportsRequestSchema,
  misreportRecordSchema,
  misreportResponseSchema,
  misreportKindSchema,
  reportMisreportRequestSchema,
  resetLearnedWeightsRequestSchema,
  resetLearnedWeightsResponseSchema,
  weightAdjustmentSchema
} from './misreport'
export * from './misreport'

export const r8RateClassSchema = rateLimitClassSchema
export const r8IpcNamespaceSchema = z.enum([
  'process', 'port', 'popout', 'window', 'topology', 'flow', 'monitor', 'cli', 'shim', 'ai',
  'skill', 'csv', 'task', 'dag', 'inject', 'watchdog', 'watchdog-supervisor', 'recording',
  'audit', 'permission', 'elevation', 'theme', 'drawer', 'command', 'dashboard', 'status',
  'statusbar', 'i18n', 'a11y', 'icon', 'notify', 'obs', 'ipc', 'zod', 'recovery', 'backup',
  'diagnostic', 'data-ownership', 'integrations', 'ocr'
])

export const r8IpcChannelDefinitionSchema = z.object({
  channel: z.string().regex(/^[a-z][a-z0-9-]*:[a-z0-9:-]+$/),
  namespace: r8IpcNamespaceSchema,
  source: z.string().min(1),
  rateClass: r8RateClassSchema,
  confirmedByRequired: z.boolean().default(false),
  featureFlag: featureFlagNameSchema.optional(),
  direction: z.enum(['invoke', 'send', 'main-to-renderer-stream']).default('invoke')
})

export type R8IpcChannelDefinition = z.infer<typeof r8IpcChannelDefinitionSchema>

const channel = (
  name: string,
  source: string,
  rateClass: z.infer<typeof r8RateClassSchema>,
  options: Partial<Omit<R8IpcChannelDefinition, 'channel' | 'namespace' | 'source' | 'rateClass'>> = {}
): R8IpcChannelDefinition => r8IpcChannelDefinitionSchema.parse({
  channel: name,
  namespace: name.split(':', 1)[0],
  source,
  rateClass,
  ...options
})

export const R8B_IPC_CHANNELS = [
  channel('port:popout-open', 'R8.B/spec-01', 'low_freq_op', { featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-close', 'R8.B/spec-01', 'meta', { featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-list', 'R8.B/spec-01', 'meta', { featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-position-get', 'R8.B/spec-01', 'meta', { featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-position-save', 'R8.B/spec-01', 'low_freq_op', { featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-pin', 'R8.B/spec-01', 'meta', { featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-batch', 'R8.B/spec-01', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-sync', 'R8.B/spec-01', 'high_freq_scan', { direction: 'main-to-renderer-stream', featureFlag: 'R8.B.port.popout-system' }),
  channel('port:popout-demote', 'R8.B/spec-01', 'low_freq_op', { featureFlag: 'R8.B.port.popout-system' }),
  channel('popout:create', 'R8.B/spec-02', 'low_freq_op', { featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:close', 'R8.B/spec-02', 'meta', { featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:list', 'R8.B/spec-02', 'meta', { featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:bridge-message', 'R8.B/spec-02', 'high_freq_scan', { featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:pin', 'R8.B/spec-02', 'meta', { featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:move-to-monitor', 'R8.B/spec-02', 'low_freq_op', { featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:save-bounds', 'R8.B/spec-02', 'low_freq_op', { featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:screen-event', 'R8.B/spec-02', 'high_freq_scan', { direction: 'main-to-renderer-stream', featureFlag: 'R8.B.popout.browserwindow' }),
  channel('drawer:get-state', 'R8.B/spec-03', 'meta', { featureFlag: 'R8.B.drawer.system' }),
  channel('drawer:set-state', 'R8.B/spec-03', 'low_freq_op', { featureFlag: 'R8.B.drawer.system' }),
  channel('drawer:save-layout', 'R8.B/spec-03', 'low_freq_op', { featureFlag: 'R8.B.drawer.system' }),
  channel('drawer:load-layout', 'R8.B/spec-03', 'low_freq_op', { featureFlag: 'R8.B.drawer.system' }),
  channel('drawer:list-layouts', 'R8.B/spec-03', 'meta', { featureFlag: 'R8.B.drawer.system' }),
  channel('drawer:morph-to-popout', 'R8.B/spec-03', 'low_freq_op', { featureFlag: 'R8.B.drawer.system' }),
  channel('drawer:morph-from-popout', 'R8.B/spec-03', 'low_freq_op', { featureFlag: 'R8.B.drawer.system' }),
  channel('command:list', 'R8.B/spec-04', 'medium_query', { featureFlag: 'R8.B.command.palette' }),
  channel('command:invoke', 'R8.B/spec-04', 'low_freq_op', { featureFlag: 'R8.B.command.palette' }),
  channel('command:history-add', 'R8.B/spec-04', 'meta', { featureFlag: 'R8.B.command.palette' }),
  channel('command:history-list', 'R8.B/spec-04', 'meta', { featureFlag: 'R8.B.command.palette' }),
  channel('command:history-clear', 'R8.B/spec-04', 'meta', { confirmedByRequired: true, featureFlag: 'R8.B.command.palette' }),
  channel('command:resolve-uri', 'R8.B/spec-04', 'medium_query', { featureFlag: 'R8.B.command.palette' }),
  channel('dashboard:get-layout', 'R8.B/spec-05', 'meta', { featureFlag: 'R8.B.dashboard.grid' }),
  channel('dashboard:save-layout', 'R8.B/spec-05', 'low_freq_op', { featureFlag: 'R8.B.dashboard.grid' }),
  channel('dashboard:list-presets', 'R8.B/spec-05', 'meta', { featureFlag: 'R8.B.dashboard.grid' }),
  channel('dashboard:delete-preset', 'R8.B/spec-05', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.dashboard.grid' }),
  channel('dashboard:reset', 'R8.B/spec-05', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.dashboard.grid' }),
  channel('dashboard:morph-widget-to-drawer', 'R8.B/spec-05', 'medium_query', { featureFlag: 'R8.B.dashboard.grid' }),
  channel('process:tree', 'R8.B/spec-06', 'medium_query', { featureFlag: 'R8.B.process.treemap-tree' }),
  channel('process:tree-children', 'R8.B/spec-06', 'medium_query', { featureFlag: 'R8.B.process.treemap-tree' }),
  channel('process:treemap-data', 'R8.B/spec-06', 'low_freq_op', { featureFlag: 'R8.B.process.treemap-tree' }),
  channel('process:view-mode-set', 'R8.B/spec-06', 'meta', { featureFlag: 'R8.B.process.treemap-tree' }),
  channel('process:batch-op', 'R8.B/spec-12', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.process.batch-ops' }),
  channel('process:batch-cancel', 'R8.B/spec-12', 'meta', { confirmedByRequired: true, featureFlag: 'R8.B.process.batch-ops' }),
  channel('process:batch-undo', 'R8.B/spec-12', 'meta', { confirmedByRequired: true, featureFlag: 'R8.B.process.batch-ops' }),
  channel('process:batch-progress', 'R8.B/spec-12', 'high_freq_scan', { direction: 'main-to-renderer-stream', featureFlag: 'R8.B.process.batch-ops' }),
  channel('process:tags-list', 'R8.B/spec-14', 'medium_query', { featureFlag: 'R8.B.process.tags-history' }),
  channel('process:tags-set', 'R8.B/spec-14', 'low_freq_op', { featureFlag: 'R8.B.process.tags-history' }),
  channel('process:history-24h', 'R8.B/spec-14', 'medium_query', { featureFlag: 'R8.B.process.tags-history' }),
  channel('port:security-tier', 'R8.B/spec-13', 'medium_query', { featureFlag: 'R8.B.port.security-tier' }),
  channel('port:blocklist-list', 'R8.B/spec-13', 'meta', { featureFlag: 'R8.B.port.security-tier' }),
  channel('port:blocklist-add', 'R8.B/spec-13', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.port.security-tier' }),
  channel('status:aggregate', 'R8.B/spec-08', 'high_freq_scan', { featureFlag: 'R8.B.statusbar.extension' }),
  channel('statusbar:get-config', 'R8.B/spec-08', 'meta', { featureFlag: 'R8.B.statusbar.extension' }),
  channel('statusbar:set-config', 'R8.B/spec-08', 'meta', { featureFlag: 'R8.B.statusbar.extension' }),
  channel('i18n:get-locale', 'R8.B/spec-15', 'meta', { featureFlag: 'R8.B.i18n.scaffold' }),
  channel('i18n:set-locale', 'R8.B/spec-15', 'low_freq_op', { featureFlag: 'R8.B.i18n.scaffold' }),
  channel('i18n:list-locales', 'R8.B/spec-15', 'meta', { featureFlag: 'R8.B.i18n.scaffold' }),
  channel('a11y:get-prefs', 'R8.B/spec-16', 'meta', { featureFlag: 'R8.B.a11y.full' }),
  channel('a11y:set-prefs', 'R8.B/spec-16', 'low_freq_op', { featureFlag: 'R8.B.a11y.full' }),
  channel('a11y:os-prefs', 'R8.B/spec-16', 'meta', { featureFlag: 'R8.B.a11y.full' }),
  channel('a11y:run-self-check', 'R8.B/spec-16', 'low_freq_op', { featureFlag: 'R8.B.a11y.full' }),
  channel('icon:list-libraries', 'R8.B/spec-17', 'meta', { featureFlag: 'R8.B.icon.library' }),
  channel('icon:resolve-token', 'R8.B/spec-17', 'medium_query', { featureFlag: 'R8.B.icon.library' })
] as const satisfies readonly R8IpcChannelDefinition[]

export const R8C_IPC_CHANNELS = [
  channel('cli:event-stream', 'R8.C/spec-01', 'high_freq_scan', { direction: 'main-to-renderer-stream', featureFlag: 'R8.C.cli.parser' }),
  channel('cli:get-progress', 'R8.C/spec-01', 'medium_query', { featureFlag: 'R8.C.cli.parser' }),
  channel('cli:detect-all', 'R8.C/spec-06', 'medium_query', { featureFlag: 'R8.C.cli.detect' }),
  channel('cli:detect-one', 'R8.C/spec-06', 'medium_query', { featureFlag: 'R8.C.cli.detect' }),
  channel('cli:set-tool-override', 'R8.C/spec-06', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.cli.detect' }),
  channel('cli:clear-tool-override', 'R8.C/spec-06', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.cli.detect' }),
  channel('cli:cursor-copilot-status', 'R8.C/spec-05', 'medium_query', { featureFlag: 'R8.C.cli.cursor-copilot' }),
  channel('skill:list', 'R8.C/spec-09', 'medium_query', { featureFlag: 'R8.C.skill.library' }),
  channel('skill:validate-yaml', 'R8.C/spec-09', 'medium_query', { featureFlag: 'R8.C.skill.library' }),
  channel('skill:builtin-list', 'R8.C/spec-10', 'medium_query', { featureFlag: 'R8.C.skill.builtin' }),
  channel('skill:get', 'R8.C/spec-09', 'medium_query', { featureFlag: 'R8.C.skill.library' }),
  channel('skill:write', 'R8.C/spec-11', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.skill.editor' }),
  channel('skill:delete', 'R8.C/spec-11', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.skill.editor' }),
  channel('skill:template-list', 'R8.C/spec-11', 'medium_query', { featureFlag: 'R8.C.skill.editor' }),
  channel('skill:reload', 'R8.C/spec-09', 'meta', { featureFlag: 'R8.C.skill.library' }),
  channel('skill:cloud-sync-disabled', 'R8.C/spec-38', 'meta', { featureFlag: 'R8.C.skill.cloud-sync' }),
  channel('skill:cloud-sync-status', 'R8.C/spec-38', 'meta', { featureFlag: 'R8.C.skill.cloud-sync' }),
  channel('skill:cloud-sync-trigger', 'R8.C/spec-38', 'meta', { featureFlag: 'R8.C.skill.cloud-sync' }),
  channel('skill:cloud-sync-list-remote', 'R8.C/spec-38', 'meta', { featureFlag: 'R8.C.skill.cloud-sync' }),
  channel('csv:schema-info', 'R8.C/spec-13', 'meta', { featureFlag: 'R8.C.csv.schema' }),
  channel('csv:validate-header', 'R8.C/spec-13', 'medium_query', { featureFlag: 'R8.C.csv.schema' }),
  channel('csv:validate-row', 'R8.C/spec-13', 'medium_query', { featureFlag: 'R8.C.csv.schema' }),
  channel('csv:enqueue-row', 'R8.C/spec-12', 'low_freq_op', { featureFlag: 'R8.C.csv.driver' }),
  channel('csv:generate-cli-command', 'R8.C/spec-14', 'medium_query', { featureFlag: 'R8.C.csv.launch.cli' }),
  channel('csv:launch', 'R8.C/spec-14', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv.launch' }),
  channel('csv:list-sessions', 'R8.C/spec-14', 'medium_query', { featureFlag: 'R8.C.csv.launch' }),
  channel('csv:list-templates', 'R8.C/spec-12', 'medium_query', { featureFlag: 'R8.C.csv.driver' }),
  channel('csv:save-template', 'R8.C/spec-12', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv.driver' }),
  channel('task:list', 'R8.C/spec-15', 'medium_query', { featureFlag: 'R8.C.task.queue' }),
  channel('task:get-stats', 'R8.C/spec-15', 'medium_query', { featureFlag: 'R8.C.task.queue' }),
  channel('task:export-results', '0503/28-final-acceptance-checklist.md#F.4.8', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.task.queue' }),
  channel('task:retry', 'R8.C/spec-15', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.task.queue' }),
  channel('task:skip', 'R8.C/spec-15', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.task.queue' }),
  channel('dag:build', 'R8.C/spec-20', 'medium_query', { featureFlag: 'R8.C.dag.orchestrator' }),
  channel('dag:detect-cycle', 'R8.C/spec-20', 'medium_query', { featureFlag: 'R8.C.dag.orchestrator' }),
  channel('dag:export', 'R8.C/spec-20', 'meta', { featureFlag: 'R8.C.dag.orchestrator' }),
  channel('dag:layer', 'R8.C/spec-20', 'medium_query', { featureFlag: 'R8.C.dag.orchestrator' }),
  channel('dag:check-ready', 'R8.C/spec-20', 'high_freq_scan', { featureFlag: 'R8.C.dag.orchestrator' }),
  channel('inject:dry-run', 'R8.C/spec-18', 'medium_query', { featureFlag: 'R8.C.inject.engine' }),
  channel('inject:execute', 'R8.C/spec-18', 'medium_query', { confirmedByRequired: true, featureFlag: 'R8.C.inject.engine' }),
  channel('inject:get-whitelist', 'R8.C/spec-19', 'meta', { featureFlag: 'R8.C.inject.targets' }),
  channel('inject:add-whitelist', 'R8.C/spec-19', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.inject.targets' }),
  channel('inject:remove-whitelist', 'R8.C/spec-19', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.inject.targets' }),
  channel('inject:resolve-target', 'R8.C/spec-19', 'medium_query', { featureFlag: 'R8.C.inject.targets' }),
  channel('inject:get-ready-pool', 'R8.C/spec-19', 'medium_query', { featureFlag: 'R8.C.inject.targets' }),
  channel('inject:history', 'R8.C/spec-18', 'medium_query', { featureFlag: 'R8.C.inject.engine' }),
  channel('inject:cancel', 'R8.C/spec-18', 'meta', { confirmedByRequired: true, featureFlag: 'R8.C.inject.engine' }),
  channel('watchdog:status', 'R8.C/spec-16', 'medium_query', { featureFlag: 'R8.C.watchdog.engine' }),
  channel('watchdog:configure', 'R8.C/spec-16', 'meta', { featureFlag: 'R8.C.watchdog.engine' }),
  channel('watchdog:get-history', 'R8.C/spec-16', 'medium_query', { featureFlag: 'R8.C.watchdog.engine' }),
  channel('watchdog:override-restart', 'R8.C/spec-16', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.watchdog.engine' }),
  channel('watchdog-supervisor:status', 'R8.C/spec-17', 'medium_query', { featureFlag: 'R8.C.watchdog.subprocess' }),
  channel('topology:global:get-fullscreen', 'R8.C/spec-24', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:build-global-graph', 'R8.C/spec-24', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:network', 'R8.C/spec-24', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:neural', 'R8.C/spec-24', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:save-snapshot', 'R8.C/spec-24', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.topology.global' }),
  channel('topology:list-snapshots', 'R8.C/spec-24', 'meta', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:export', 'R8.C/spec-24', 'meta', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:warm-scope-global', 'R8.C/spec-24', 'low_freq_op', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:attached:get-deep10', 'R8.C/spec-25', 'medium_query', { featureFlag: 'R8.C.topology.attached' }),
  channel('topology:attached:favorite-change', 'R8.C/spec-25', 'low_freq_op', { featureFlag: 'R8.C.topology.attached' }),
  channel('flow:build-scoped-flow', 'R8.C/spec-26', 'medium_query', { featureFlag: 'R8.C.flow.attached' }),
  channel('ai:get-signal-contributions', 'R8.C/spec-27', 'medium_query', { featureFlag: 'R8.C.signal.fusion' }),
  channel('ai:get-instance-state', 'R8.C/spec-28', 'medium_query', { featureFlag: 'R8.C.state.three-layer' }),
  channel('ai:report-misreport', 'R8.C/spec-29', 'low_freq_op', { featureFlag: 'R8.C.feedback.loop' }),
  channel('ai:list-misreports', 'R8.C/spec-29', 'medium_query', { featureFlag: 'R8.C.feedback.loop' }),
  channel('ai:fusion-config', 'R8.C/spec-27', 'medium_query', { featureFlag: 'R8.C.signal.fusion' }),
  channel('ai:set-weight-profile', 'R8.C/spec-27', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.signal.fusion' }),
  channel('notify:emit', 'R8.C/spec-30', 'low_freq_op', { featureFlag: 'R8.C.notify.system' }),
  channel('notify:list', 'R8.C/spec-30', 'medium_query', { featureFlag: 'R8.C.notify.system' }),
  channel('notify:dismiss', 'R8.C/spec-30', 'meta', { featureFlag: 'R8.C.notify.system' }),
  channel('notify:configure-aggregation', 'R8.C/spec-30', 'meta', { featureFlag: 'R8.C.notify.system' }),
  channel('ipc:rate-limit-stats', 'R8.C/spec-31', 'meta', { featureFlag: 'R8.C.ipc.rate-limit' }),
  channel('ipc:rate-limit-channel-list', 'R8.C/spec-31', 'meta', { featureFlag: 'R8.C.ipc.rate-limit' }),
  channel('zod:list-schemas', 'R8.C/spec-33', 'meta', { featureFlag: 'R8.C.zod.sot' }),
  channel('zod:validate-payload', 'R8.C/spec-33', 'medium_query', { featureFlag: 'R8.C.zod.sot' }),
  channel('zod:migration-status', 'R8.C/spec-33', 'meta', { featureFlag: 'R8.C.zod.sot' }),
  channel('recovery:scan', 'R8.C/spec-34', 'low_freq_op', { featureFlag: 'R8.C.recovery.crash' }),
  channel('recovery:report', 'R8.C/spec-34', 'medium_query', { featureFlag: 'R8.C.recovery.crash' }),
  channel('recovery:check-dirty', 'R8.C/spec-34', 'meta', { featureFlag: 'R8.C.recovery.crash' }),
  channel('recovery:restore-state', 'R8.C/spec-34', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.recovery.crash' }),
  channel('recovery:list-snapshots', 'R8.C/spec-34', 'meta', { featureFlag: 'R8.C.recovery.crash' }),
  channel('recovery:create-checkpoint', 'R8.C/spec-34', 'low_freq_op', { featureFlag: 'R8.C.recovery.crash' }),
  channel('recovery:dismiss', 'R8.C/spec-34', 'meta', { featureFlag: 'R8.C.recovery.crash' }),
  channel('backup:create', 'R8.C/spec-35', 'low_freq_op', { featureFlag: 'R8.C.backup.restore' }),
  channel('backup:list', 'R8.C/spec-35', 'medium_query', { featureFlag: 'R8.C.backup.restore' }),
  channel('backup:restore', 'R8.C/spec-35', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.backup.restore' }),
  channel('backup:delete', 'R8.C/spec-35', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.backup.restore' }),
  channel('backup:configure-schedule', 'R8.C/spec-35', 'low_freq_op', { featureFlag: 'R8.C.backup.restore' }),
  channel('backup:export-classified', 'R8.C/spec-35', 'low_freq_op', { featureFlag: 'R8.C.backup.restore' }),
  channel('diagnostic:export', 'R8.C/spec-36', 'low_freq_op', { featureFlag: 'R8.C.diagnostic.export' }),
  channel('diagnostic:list', 'R8.C/spec-36', 'medium_query', { featureFlag: 'R8.C.diagnostic.export' }),
  channel('diagnostic:purge', 'R8.C/spec-36', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.diagnostic.export' }),
  channel('diagnostic:preview', 'R8.C/spec-36', 'low_freq_op', { featureFlag: 'R8.C.diagnostic.export' }),
  channel('diagnostic:list-redaction-rules', 'R8.C/spec-36', 'meta', { featureFlag: 'R8.C.diagnostic.export' }),
  channel('diagnostic:capture-screenshot', 'R8.C/spec-36', 'low_freq_op', { featureFlag: 'R8.C.diagnostic.export' }),
  channel('diagnostic:list-packs', 'R8.C/spec-36', 'meta', { featureFlag: 'R8.C.diagnostic.export' }),
  channel('data-ownership:list-paths', 'prompts/0503/28-final-acceptance-checklist.md#H.2', 'medium_query'),
  channel('data-ownership:list-entries', 'prompts/0503/28-final-acceptance-checklist.md#H.2', 'medium_query'),
  channel('data-ownership:export-all', 'prompts/0503/28-final-acceptance-checklist.md#H.2', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.backup.restore' }),
  channel('permission:ttl-config', 'R8.C/spec-37', 'meta', { featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:confirm', 'R8.C/spec-37', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:allowlist', 'R8.C/spec-37', 'medium_query', { featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:reset', 'R8.C/spec-37', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:request', 'R8.C/spec-37', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:check', 'R8.C/spec-37', 'medium_query', { featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:revoke', 'R8.C/spec-37', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:revoke-all', 'R8.C/spec-37', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:list-active', 'R8.C/spec-37', 'meta', { featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:configure-policy', 'R8.C/spec-37', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:expiry-stream', 'R8.C/spec-37', 'medium_query', { featureFlag: 'R8.C.permission.ttl', direction: 'main-to-renderer-stream' }),
  channel('recording:start', 'R8.C/spec-22', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.recording.engine' }),
  channel('recording:stop', 'R8.C/spec-22', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.recording.engine' }),
  channel('recording:list', 'R8.C/spec-22', 'medium_query', { featureFlag: 'R8.C.recording.engine' }),
  channel('recording:get-manifest', 'R8.C/spec-22', 'medium_query', { featureFlag: 'R8.C.recording.engine' }),
  channel('recording:get-events', 'R8.C/spec-22', 'medium_query', { featureFlag: 'R8.C.recording.engine' }),
  channel('recording:export-asciinema', 'R8.C/spec-22', 'low_freq_op', { featureFlag: 'R8.C.recording.engine' }),
  channel('recording:export-zip', 'R8.C/spec-22', 'low_freq_op', { featureFlag: 'R8.C.recording.engine' }),
  channel('recording:delete', 'R8.C/spec-22', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.recording.engine' }),
  channel('recording:get-replay-state', 'R8.C/spec-23', 'medium_query', { featureFlag: 'R8.C.recording.replay' }),
  channel('recording:get-events-window', 'R8.C/spec-23', 'medium_query', { featureFlag: 'R8.C.recording.replay' }),
  channel('recording:get-cast', 'R8.C/spec-23', 'medium_query', { featureFlag: 'R8.C.recording.replay' }),
  channel('recording:list-anchors', 'R8.C/spec-23', 'medium_query', { featureFlag: 'R8.C.recording.replay' }),
  channel('recording:get-screenshot', 'R8.C/spec-23', 'medium_query', { featureFlag: 'R8.C.recording.replay' }),
  channel('recording:get-fs-snapshot-at', 'R8.C/spec-23', 'medium_query', { featureFlag: 'R8.C.recording.replay' }),
  channel('recording:replay-start', 'R8.C/spec-23-legacy', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.recording.replay' }),
  channel('recording:replay-seek', 'R8.C/spec-23', 'medium_query', { featureFlag: 'R8.C.recording.replay' }),
  channel('recording:replay-export', 'R8.C/spec-23', 'low_freq_op', { featureFlag: 'R8.C.recording.replay' }),
  channel('integrations:list-libraries', 'R8.C/spec-01', 'meta'),
  channel('integrations:flag-get', 'R8.C/spec-01', 'meta'),
  channel('integrations:health-check', 'R8.C/spec-01', 'medium_query'),
  channel('ocr:capabilities', 'R8.C/spec-39', 'meta', { featureFlag: 'R8.C.ocr.interface' }),
  channel('ocr:recognize', 'R8.C/spec-39', 'low_freq_op', { featureFlag: 'R8.C.ocr.interface' }),
  channel('ocr:list-supported-languages', 'R8.C/spec-39', 'meta', { featureFlag: 'R8.C.ocr.interface' })
] as const satisfies readonly R8IpcChannelDefinition[]

export const R8_SPEC_DECLARED_IPC_CHANNELS = [
  channel('ai:claude-cost-summary', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.signal.fusion' }),
  channel('ai:claude-stream-event', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.signal.fusion', direction: 'main-to-renderer-stream' }),
  channel('ai:fusion-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.signal.fusion', direction: 'main-to-renderer-stream' }),
  channel('ai:gemini-pattern-stat', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.signal.fusion' }),
  channel('ai:gemini-rule-reload', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.signal.fusion' }),
  channel('ai:get-diagnostic-explain', 'R8.C/spec-29', 'medium_query', { featureFlag: 'R8.C.feedback.loop' }),
  channel('ai:list-state-rules', 'R8.C/spec-28', 'medium_query', { featureFlag: 'R8.C.state.three-layer' }),
  channel('ai:list-weight-profiles', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.signal.fusion' }),
  channel('ai:override-rule', 'R8.C/spec-28', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.state.three-layer' }),
  channel('ai:reset-learned-weights', 'R8.C/spec-29', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.feedback.loop' }),
  channel('ai:state-stream', 'R8.C/spec-28', 'high_freq_scan', { featureFlag: 'R8.C.state.three-layer', direction: 'main-to-renderer-stream' }),
  channel('audit:append', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.A.audit.log' }),
  channel('audit:export', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { featureFlag: 'R8.A.audit.log' }),
  channel('audit:purge', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.A.audit.log' }),
  channel('audit:query', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.A.audit.log' }),
  channel('audit:tail', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.A.audit.log', direction: 'main-to-renderer-stream' }),
  channel('backup:schedule-config', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.backup.restore' }),
  channel('cli:detection-event', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.cli', direction: 'main-to-renderer-stream' }),
  channel('cli:get-sessions', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.cli' }),
  channel('cli:install-shim', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.cli' }),
  channel('cli:select-strategy', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.cli' }),
  channel('cli:title-rule-reload', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.cli' }),
  channel('cli:title-sample-debug', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.cli' }),
  channel('command:list-custom', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.command.palette' }),
  channel('command:register-os-protocol', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.command.palette' }),
  channel('command:save-custom', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.command.palette' }),
  channel('csv:abort', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('csv:delete-template', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('csv:enqueue-group', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.csv' }),
  channel('csv:export-template', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { featureFlag: 'R8.C.csv' }),
  channel('csv:external-change-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.csv', direction: 'main-to-renderer-stream' }),
  channel('csv:get-group', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.csv' }),
  channel('csv:get-runner-info', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.csv' }),
  channel('csv:list-groups', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.csv' }),
  channel('csv:lock', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('csv:lock-status-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { confirmedByRequired: true, featureFlag: 'R8.C.csv', direction: 'main-to-renderer-stream' }),
  channel('csv:pause', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('csv:reload', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('csv:resume', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('csv:row-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.csv', direction: 'main-to-renderer-stream' }),
  channel('csv:save', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('csv:session-event-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.csv', direction: 'main-to-renderer-stream' }),
  channel('csv:unlock', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.csv' }),
  channel('diagnostic:share-config', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.diagnostic.export' }),
  channel('elevation:execute', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.A.process.uac-spawn' }),
  channel('elevation:request', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.A.process.uac-spawn' }),
  channel('elevation:revoke', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.A.process.uac-spawn' }),
  channel('elevation:status', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.A.process.uac-spawn' }),
  channel('flow:bookmark-event', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.flow.attached', direction: 'main-to-renderer-stream' }),
  channel('flow:event-stream', 'R8.C/spec-26', 'high_freq_scan', { featureFlag: 'R8.C.flow.attached', direction: 'main-to-renderer-stream' }),
  channel('flow:event-stream:unsubscribe', 'R8.C/spec-26', 'meta', { featureFlag: 'R8.C.flow.attached' }),
  channel('flow:export-timeline', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { featureFlag: 'R8.C.flow.attached' }),
  channel('flow:filter-edges', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.flow.attached' }),
  channel('flow:get-attached', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.flow.attached' }),
  channel('flow:replay-controls', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.flow.attached' }),
  channel('flow:replay-state-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.flow.attached', direction: 'main-to-renderer-stream' }),
  channel('flow:scoped-stats', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.flow.attached' }),
  channel('i18n:reload-resources', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.i18n.scaffold' }),
  channel('inject:configure-countdown', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.inject' }),
  channel('inject:configure-strict-mode', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.inject' }),
  channel('inject:countdown-cancel', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.inject' }),
  channel('inject:countdown-complete', 'R8.C/spec-19', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.inject.targets' }),
  channel('inject:countdown-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.inject', direction: 'main-to-renderer-stream' }),
  channel('inject:first-time-confirm', 'R8.C/spec-19', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.inject.targets' }),
  channel('inject:first-time-required', 'R8.C/spec-19', 'high_freq_scan', { featureFlag: 'R8.C.inject.targets', direction: 'main-to-renderer-stream' }),
  channel('inject:stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.inject', direction: 'main-to-renderer-stream' }),
  channel('integrations:flag-set', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.A.libs' }),
  channel('ipc:override-rate-class', '0503-2/_shared/ipc-channels.md', 'meta', { confirmedByRequired: true, featureFlag: 'R8.C.ipc.rate-limit' }),
  channel('monitor:close', '0503-2/R8.C/spec-07-monitor-window.md', 'meta', { featureFlag: 'R8.C.monitor.window' }),
  channel('monitor:focus-instance', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.monitor.window' }),
  channel('monitor:open', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.monitor.window' }),
  channel('monitor:popout-close', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.monitor.popout' }),
  channel('monitor:popout-list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.monitor.popout' }),
  channel('monitor:popout-open', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.monitor.popout' }),
  channel('monitor:popout-return-to-main', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.monitor.popout' }),
  channel('monitor:popout-set-layout', '0503-2/R8.C/spec-08-monitor-window-popout.md', 'low_freq_op', { featureFlag: 'R8.C.monitor.popout' }),
  channel('monitor:popout-snapshot-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.monitor.popout', direction: 'main-to-renderer-stream' }),
  channel('monitor:set-window-prefs', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.monitor.window' }),
  channel('monitor:snapshot', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.monitor.window' }),
  channel('monitor:snapshot-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.monitor.window', direction: 'main-to-renderer-stream' }),
  channel('notify:configure-channel', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.notify.system' }),
  channel('notify:invoke-action', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.notify.system' }),
  channel('notify:stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.notify.system', direction: 'main-to-renderer-stream' }),
  channel('obs:configure', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.observability.panel' }),
  channel('obs:export-diagnostic-pack', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { featureFlag: 'R8.C.observability.panel' }),
  channel('obs:export-snapshot', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { featureFlag: 'R8.C.observability.panel' }),
  channel('obs:get-snapshot', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.observability.panel' }),
  channel('obs:subscribe', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.observability.panel', direction: 'main-to-renderer-stream' }),
  channel('obs:unsubscribe', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.observability.panel' }),
  channel('permission:allowlist:list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:allowlist:revoke', '0503-2/_shared/ipc-channels.md', 'medium_query', { confirmedByRequired: true, featureFlag: 'R8.C.permission.ttl' }),
  channel('permission:ttl-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.permission.ttl', direction: 'main-to-renderer-stream' }),
  channel('popout:demote', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.popout.browserwindow' }),
  channel('popout:promote-from-floating', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.popout.browserwindow' }),
  channel('port:blacklist:add-user', '0503-2/_shared/ipc-channels.md', 'medium_query', { confirmedByRequired: true, featureFlag: 'R8.B.port' }),
  channel('port:blacklist:get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.port' }),
  channel('port:blocklist-remove', '0503-2/_shared/ipc-channels.md', 'medium_query', { confirmedByRequired: true, featureFlag: 'R8.B.port' }),
  channel('port:blocklist-reset', '0503-2/_shared/ipc-channels.md', 'medium_query', { confirmedByRequired: true, featureFlag: 'R8.B.port' }),
  channel('port:popout-layout-apply', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.port' }),
  channel('port:popout-layout-list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.port' }),
  channel('port:popout-layout-save', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.port' }),
  channel('port:public-banner-state', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.port' }),
  channel('port:vm:get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.port' }),
  channel('port:vm:list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.port' }),
  channel('recording:event-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.recording', direction: 'main-to-renderer-stream' }),
  channel('recovery:apply', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.recovery.crash' }),
  channel('shim:frame', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.shim.codex' }),
  channel('shim:install', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.shim.codex' }),
  channel('shim:status', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.shim.codex' }),
  channel('shim:uninstall', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.shim.codex' }),
  channel('skill:builtin-fork', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.skill' }),
  channel('skill:builtin-readme', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.skill' }),
  channel('skill:create-from-template', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.skill' }),
  channel('skill:install-from-path', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.skill' }),
  channel('skill:list-stream', 'R8.C/spec-09', 'high_freq_scan', { featureFlag: 'R8.C.skill.library', direction: 'main-to-renderer-stream' }),
  channel('skill:uninstall', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.skill' }),
  channel('skill:validate', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.skill' }),
  channel('statusbar:reset', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.statusbar.extension' }),
  channel('task:abort-session', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.task.queue' }),
  channel('task:pause-session', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.task.queue' }),
  channel('task:resume-session', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.task.queue' }),
  channel('task:state-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.task.queue', direction: 'main-to-renderer-stream' }),
  channel('theme:custom-svg-list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:custom-svg-remove', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:custom-svg-upload', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:decoration-list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:decoration-set', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:distance:get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:lock-set', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:set', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:sound-config', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.theme.decorations' }),
  channel('theme:sound-config-get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.theme.decorations' }),
  channel('topology:attached:bookmarks:list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:attached:lazy-load', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:attached:save-bookmark', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.topology.global' }),
  channel('topology:build-scoped-graph', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:flow:get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:get-attached', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:global:export', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:global:filter-set', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.topology.global' }),
  channel('topology:global:layout-set', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.topology.global' }),
  channel('topology:network:get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:neural:get', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.C.topology.global' }),
  channel('topology:warm-scope', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.C.topology.global' }),
  channel('watchdog-supervisor:install-service', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.watchdog' }),
  channel('watchdog-supervisor:respawn', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.watchdog' }),
  channel('watchdog-supervisor:uninstall-service', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.C.watchdog' }),
  channel('watchdog-supervisor:event-stream', 'R8.C/spec-17', 'high_freq_scan', { featureFlag: 'R8.C.watchdog.subprocess', direction: 'main-to-renderer-stream' }),
  channel('watchdog:event-stream', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.C.watchdog', direction: 'main-to-renderer-stream' }),
  channel('window:batch-cancel', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:batch-op', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:batch-progress', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.B.window.batch-ops', direction: 'main-to-renderer-stream' }),
  channel('window:batch-undo', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:get-topmost', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:groups', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.window.thumbnail-wall' }),
  channel('window:layout-apply', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:layout-list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:layout-save', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:monitors', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:move-to-desktop', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:move-to-monitor', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:set-alias', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.thumbnail-wall' }),
  channel('window:set-topmost', '0503-2/_shared/ipc-channels.md', 'low_freq_op', { confirmedByRequired: true, featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:thumbnail-refresh', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.window.thumbnail-wall' }),
  channel('window:thumbnails-batch', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.window.thumbnail-wall' }),
  channel('window:topmost-list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:vd-info', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:vd-list', '0503-2/_shared/ipc-channels.md', 'medium_query', { featureFlag: 'R8.B.window.batch-ops' }),
  channel('window:vd-watch', '0503-2/_shared/ipc-channels.md', 'high_freq_scan', { featureFlag: 'R8.B.window.batch-ops', direction: 'main-to-renderer-stream' }),
  channel('window:viewport-config', '0503-2/_shared/ipc-channels.md', 'meta', { featureFlag: 'R8.B.window.thumbnail-wall' })
] as const satisfies readonly R8IpcChannelDefinition[]

export const R8_IPC_CHANNELS = [
  ...R8B_IPC_CHANNELS,
  ...R8C_IPC_CHANNELS,
  ...R8_SPEC_DECLARED_IPC_CHANNELS
] as const satisfies readonly R8IpcChannelDefinition[]

export const r8ContractOnlyResponseSchema = z.object({
  success: z.literal(false),
  status: z.enum(['contract-only', 'permission-required', 'not-registered']),
  code: z.enum(['E_R8_CONTRACT_ONLY', 'E_PERMISSION', 'E_R8_CHANNEL_NOT_REGISTERED']),
  channel: z.string().regex(/^[a-z][a-z0-9-]*:[a-z0-9:-]+$/),
  namespace: r8IpcNamespaceSchema.optional(),
  source: z.string().min(1).optional(),
  rateClass: r8RateClassSchema.optional(),
  direction: z.enum(['invoke', 'send', 'main-to-renderer-stream']).optional(),
  featureFlag: featureFlagNameSchema.nullable().optional(),
  confirmedByRequired: z.boolean().optional(),
  executable: z.literal(false),
  checkedAt: z.number().int().nonnegative(),
  payload: z.unknown().optional(),
  message: z.string().min(1)
})

export const r8BoundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
})

export const r8ConfirmedRequestSchema = z.object({
  confirmedBy: z.string().min(3).optional()
})

export const popoutCreateRequestSchema = z.object({
  surface: z.enum(['port', 'monitor', 'process', 'window', 'dashboard', 'topology', 'r8-ops']),
  targetId: z.union([z.string().min(1), z.number().int().nonnegative()]),
  mode: z.enum(['floating', 'browserwindow']).default('browserwindow'),
  route: z.string().min(1).default('/monitor'),
  bounds: r8BoundsSchema.optional(),
  title: z.string().min(1).max(120).optional()
})

export const panelPopoutSurfaceSchema = z.enum(['process', 'window', 'dashboard', 'topology', 'r8-ops'])
export type PanelPopoutSurface = z.infer<typeof panelPopoutSurfaceSchema>

export const portPopoutPositionRecordSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().min(280).optional(),
  h: z.number().finite().min(200).optional(),
  updatedAt: z.number().int().nonnegative()
}).strict()

export const portPopoutPositionSaveRequestSchema = z.object({
  port: z.number().int().min(1).max(65535),
  position: PortPopoutPositionSchema,
  size: PortPopoutSizeSchema.optional()
}).strict()

export const portPopoutPositionGetRequestSchema = z.object({
  port: z.number().int().min(1).max(65535)
}).strict()

export const portPopoutPositionSaveResponseSchema = z.object({
  success: z.literal(true),
  port: z.number().int().min(1).max(65535),
  position: PortPopoutPositionSchema,
  size: PortPopoutSizeSchema.optional(),
  updatedAt: z.number().int().nonnegative()
}).strict()

export const portPopoutPositionGetResponseSchema = z.object({
  success: z.literal(true),
  port: z.number().int().min(1).max(65535),
  position: PortPopoutPositionSchema.nullable(),
  size: PortPopoutSizeSchema.optional(),
  updatedAt: z.number().int().nonnegative().optional()
}).strict()

export const portPopoutOpenRequestSchema = z.object({
  port: z.number().int().min(1).max(65535),
  pid: z.number().int().positive(),
  trigger: PortPopoutTriggerSchema,
  mode: z.enum(['floating', 'browserwindow']).default('floating'),
  hintPosition: PortPopoutPositionSchema.optional(),
  hint_position: PortPopoutPositionSchema.optional(),
  size: PortPopoutSizeSchema.optional(),
  syncPolicy: PopoutSyncPolicySchema.optional(),
  sync_policy: PopoutSyncPolicySchema.optional()
}).strict()

export const portPopoutIdRequestSchema = z.object({
  popoutId: z.string().min(1)
}).strict()

export const portPopoutCloseRequestSchema = portPopoutIdRequestSchema.extend({
  reason: z.enum(['user', 'evict', 'main-quit', 'force']).default('user')
}).strict()

export const portPopoutPinRequestSchema = portPopoutIdRequestSchema.extend({
  pinned: z.boolean()
}).strict()

export const browserPopoutSchema = z.object({
  windowId: z.string().min(1),
  surface: popoutCreateRequestSchema.shape.surface,
  targetId: popoutCreateRequestSchema.shape.targetId,
  mode: popoutCreateRequestSchema.shape.mode,
  route: z.string().min(1),
  title: z.string().min(1),
  pinned: z.boolean(),
  bounds: r8BoundsSchema.nullable(),
  createdAt: z.number().int().nonnegative(),
  lastInteractedAt: z.number().int().nonnegative().optional(),
  lastHeartbeatAt: z.number().int().nonnegative().optional(),
  restoredAt: z.number().int().nonnegative().optional(),
  closedAt: z.number().int().nonnegative().optional(),
  displayId: z.number().int().optional(),
  pendingRestoreBounds: r8BoundsSchema.optional(),
  pendingRestoreDisplayId: z.number().int().optional(),
  displayMigratedAt: z.number().int().nonnegative().optional(),
  bridgeState: z.enum(['connected', 'pending', 'closed'])
})

export const portPopoutRuntimeRecordSchema = z.object({
  popoutId: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  pid: z.number().int().positive().nullable().default(null),
  trigger: PortPopoutTriggerSchema.nullable().default(null),
  mode: z.enum(['floating', 'browserwindow']),
  actualPosition: PortPopoutPositionSchema,
  size: PortPopoutSizeSchema,
  zIndex: z.number().int().min(PORT_POPOUT_LIMITS.Z_INDEX_BASE).max(PORT_POPOUT_LIMITS.Z_INDEX_BASE + PORT_POPOUT_LIMITS.Z_INDEX_RANGE),
  pinned: z.boolean(),
  bridgeState: browserPopoutSchema.shape.bridgeState,
  browserPopout: browserPopoutSchema
}).strict()

export const portPopoutOpenResponseSchema = portPopoutRuntimeRecordSchema.extend({
  success: z.literal(true)
}).strict()

export const portPopoutListResponseSchema = z.object({
  success: z.literal(true),
  popouts: z.array(portPopoutRuntimeRecordSchema),
  listedAt: z.number().int().nonnegative()
}).strict()

export const portPopoutCloseResponseSchema = z.object({
  success: z.literal(true),
  popoutId: z.string().min(1),
  reason: portPopoutCloseRequestSchema.shape.reason,
  closedAt: z.number().int().nonnegative()
}).strict()

export const portPopoutPinResponseSchema = z.object({
  success: z.literal(true),
  popoutId: z.string().min(1),
  pinned: z.boolean(),
  popout: portPopoutRuntimeRecordSchema.nullable(),
  updatedAt: z.number().int().nonnegative()
}).strict()

export const portPopoutBatchActionSchema = z.enum(['close', 'pin', 'unpin'])

export const portPopoutBatchOperationSchema = z.object({
  popoutId: z.string().min(1),
  action: portPopoutBatchActionSchema
}).strict()

export const portPopoutBatchRequestSchema = z.object({
  confirmedBy: z.string().min(3),
  operations: z.array(portPopoutBatchOperationSchema).min(1).max(PORT_POPOUT_LIMITS.MAX_TOTAL)
}).strict()

export const portPopoutBatchResultSchema = z.object({
  popoutId: z.string().min(1),
  action: portPopoutBatchActionSchema,
  success: z.boolean(),
  message: z.string().min(1).optional()
}).strict()

export const portPopoutBatchResponseSchema = z.object({
  success: z.boolean(),
  confirmedBy: z.string().min(3),
  results: z.array(portPopoutBatchResultSchema),
  completedAt: z.number().int().nonnegative()
}).strict()

export const portPopoutSyncRequestSchema = z.object({
  popoutId: z.string().min(1),
  key: z.string().min(1).max(120),
  value: z.unknown()
}).strict()

export const portPopoutSyncResponseSchema = z.object({
  success: z.literal(true),
  popoutId: z.string().min(1),
  key: z.string().min(1).max(120),
  sentWindowIds: z.array(z.string().min(1)),
  syncedAt: z.number().int().nonnegative()
}).strict()

export const portPopoutDemoteRequestSchema = portPopoutIdRequestSchema

export const portPopoutDemoteResponseSchema = z.object({
  success: z.literal(true),
  popoutId: z.string().min(1),
  floatingId: z.string().min(1),
  popout: portPopoutRuntimeRecordSchema,
  demotedAt: z.number().int().nonnegative()
}).strict()

const popoutThemeAppearanceSchema = z.object({
  theme: z.enum(['constructivism', 'modern-light', 'warm-light', 'cyberpunk', 'swiss', 'dark', 'light']),
  followSystemTheme: z.boolean().optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  sidebarPosition: z.enum(['left', 'right']).optional(),
  compactMode: z.boolean().optional(),
  enableAnimations: z.boolean().optional(),
  holidayDecorationsEnabled: z.boolean().optional(),
  holidayAutoPromptEnabled: z.boolean().optional(),
  holidayFocusMode: z.boolean().optional(),
  layoutMode: z.enum(['auto', 'split', 'stacked']).optional(),
  informationDensity: z.enum(['compact', 'standard', 'comfortable']).optional(),
  radiusFamily: z.enum(['sharp', 'soft', 'round']).optional(),
  motionLevel: z.enum(['reduced', 'balanced', 'expressive']).optional(),
  decoration: z.unknown().optional()
}).passthrough()

export const popoutThemeSyncPayloadSchema = z.object({
  emittedAt: z.number().int().nonnegative(),
  settings: z.object({
    appearance: popoutThemeAppearanceSchema
  }).passthrough()
}).strict()

const popoutBridgeMessageBaseSchema = z.object({
  windowId: z.string().min(1)
})

export const popoutBridgeMessageSchema = z.discriminatedUnion('type', [
  popoutBridgeMessageBaseSchema.extend({
    type: z.literal('heartbeat'),
    at: z.number().int().nonnegative().optional()
  }),
  popoutBridgeMessageBaseSchema.extend({
    type: z.literal('close-request')
  }),
  popoutBridgeMessageBaseSchema.extend({
    type: z.literal('focus-main')
  }),
  popoutBridgeMessageBaseSchema.extend({
    type: z.literal('demote-request')
  }),
  popoutBridgeMessageBaseSchema.extend({
    type: z.literal('sync'),
    key: z.string().min(1),
    value: z.unknown()
  }),
  popoutBridgeMessageBaseSchema.extend({
    type: z.literal('data-update'),
    payload: z.unknown()
  }),
  popoutBridgeMessageBaseSchema.extend({
    type: z.literal('action-request'),
    action: z.string().min(1),
    args: z.unknown().optional()
  })
])

export const popoutScreenEventSchema = z.object({
  type: z.enum(['display-added', 'display-removed', 'display-metrics-changed']),
  affectedPopouts: z.array(z.string().min(1)),
  reflowAction: z.enum(['migrate-to-primary', 'restore', 'noop']),
  emittedAt: z.number().int().nonnegative()
})

export const drawerSlotSchema = z.enum(['top', 'right', 'bottom', 'floating', 'statusbar'])

export const drawerScopeSchema = z.enum(['global', 'monitor', 'project', 'ai-task'])

export const drawerStateSchema = z.object({
  slot: drawerSlotSchema,
  open: z.boolean(),
  pinned: z.boolean().default(false),
  contentId: z.string().min(1).nullable(),
  scope: drawerScopeSchema.default('global'),
  size: z.number().int().min(0).max(2000).optional(),
  width: z.number().int().positive().max(2000).optional(),
  height: z.number().int().positive().max(2000).optional(),
  zIndex: z.number().int().min(0).max(9999).optional(),
  updatedAt: z.number().int().nonnegative()
})

export const drawerLayoutRecordSchema = z.object({
  name: z.string().min(1).max(80),
  states: z.array(drawerStateSchema).length(5),
  savedAt: z.number().int().nonnegative()
})

export const drawerSaveLayoutRequestSchema = z.object({
  name: z.string().min(1).max(80),
  states: z.union([
    z.array(drawerStateSchema),
    z.record(drawerSlotSchema, drawerStateSchema)
  ]).optional()
})

export const drawerLoadLayoutRequestSchema = z.object({
  name: z.string().min(1).max(80)
})

export const drawerMorphToPopoutRequestSchema = z.object({
  slot: drawerSlotSchema,
  contentId: z.string().min(1).optional()
})

export const drawerMorphToPopoutResultSchema = z.object({
  popoutId: z.string().min(1)
})

export const drawerMorphFromPopoutRequestSchema = z.object({
  popoutId: z.string().min(1),
  slot: drawerSlotSchema
})

export const drawerMorphFromPopoutResultSchema = z.object({
  drawerState: drawerStateSchema
})

export const commandTypeSchema = z.enum(['command', 'navigate', 'search-result', 'ai-action', 'history', 'recent-uri'])

export const commandPaletteEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: commandTypeSchema.default('command'),
  label: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(['navigation', 'monitor', 'window', 'process', 'port', 'settings', 'diagnostics', 'history', 'ai-action']),
  keywords: z.array(z.string().min(1)).default([]),
  shortcut: z.string().optional(),
  handler: z.string().min(1).optional(),
  scope: z.enum(['global', 'monitor', 'project']).default('global'),
  uri: z.string().optional(),
  requiresConfirmation: z.boolean().default(false)
})

export const commandHistoryEntrySchema = z.object({
  commandId: z.string().min(1),
  invokedAt: z.number().int().nonnegative(),
  confirmedBy: z.string().min(1).nullable().default(null),
  useCount: z.number().int().positive().default(1)
})

const customCommandHandlerScriptForbiddenPattern = /\b(?:eval|Function)\s*\(/i

export const customCommandSchema = z.object({
  id: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9._:-]*$/i),
  label: z.string().min(1).max(120),
  shortcut: z.array(z.string().min(1).max(40)).default([]),
  handlerScript: z.string().min(1).max(8192).refine(
    value => !customCommandHandlerScriptForbiddenPattern.test(value),
    { message: 'handlerScript must not contain eval() or Function()' }
  ),
  enabled: z.boolean().default(true),
  savedAt: z.number().int().nonnegative().default(0),
  confirmedBy: z.string().min(1).nullable().default(null)
})

export const customCommandListResponseSchema = z.object({
  commands: z.array(customCommandSchema)
})

export const customCommandSaveResultSchema = z.object({
  success: z.boolean(),
  command: customCommandSchema
})

export const commandUriScopeSchema = z.enum(['process', 'port', 'window', 'ai-task', 'csv-batch', 'project', 'skill', 'snapshot'])

export const commandParsedUriSchema = z.object({
  scheme: z.literal('devhub'),
  scope: commandUriScopeSchema,
  id: z.string().min(1),
  host: z.string().default('local'),
  fallback: z.record(z.string(), z.string()).default({})
})

export const commandResolveUriRequestSchema = z.object({
  uri: z.string().min(1).regex(/^devhub:\/\/[a-z-]+\/[^?]+(?:\?.*)?$/i)
})

export const commandResolvedUriSchema = z.object({
  kind: commandUriScopeSchema,
  id: z.string().min(1),
  uri: commandParsedUriSchema,
  monitor: z.string().nullable().default(null),
  panel: z.string().nullable().default(null),
  exists: z.boolean(),
  fallbackUsed: z.boolean(),
  candidateCount: z.number().int().nonnegative().default(0)
})

export const commandRegisterOsProtocolRequestSchema = z.object({
  register: z.boolean(),
  confirmedBy: z.string().min(3).optional()
})

export const commandRegisterOsProtocolResultSchema = z.object({
  success: z.boolean(),
  registered: z.boolean(),
  scheme: z.literal('devhub'),
  action: z.enum(['register', 'unregister']),
  checkedAt: z.number().int().nonnegative(),
  devMode: z.boolean(),
  platform: z.string().min(1),
  handlerPath: z.string().min(1).nullable(),
  handlerArgs: z.array(z.string()).default([]),
  message: z.string().min(1)
})

export const dashboardWidgetIdSchema = z.enum([
  'process-summary',
  'port-summary',
  'window-summary',
  'ai-task-queue',
  'system-resource',
  'notifications',
  'topology-mini',
  'treemap-mini',
  'sparkline-cpu',
  'sparkline-rss',
  'recent-uri',
  'favorites',
  'custom'
])

export const dashboardBreakpointSchema = z.enum(['xs', 'sm', 'md', 'lg', 'xl'])

export const dashboardGridItemSchema = z.object({
  i: z.string().min(1),
  widgetId: dashboardWidgetIdSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  minW: z.number().int().min(1).optional(),
  minH: z.number().int().min(1).optional(),
  maxW: z.number().int().min(1).optional(),
  maxH: z.number().int().min(1).optional(),
  static: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).default({})
})

export const dashboardColsSchema = z.object({
  xs: z.number().int().min(1).default(4),
  sm: z.number().int().min(1).default(6),
  md: z.number().int().min(1).default(8),
  lg: z.number().int().min(1).default(12),
  xl: z.number().int().min(1).default(16)
})

export const dashboardLayoutSchema = z.object({
  name: z.string().min(1).max(80),
  layouts: z.record(dashboardBreakpointSchema, z.array(dashboardGridItemSchema)),
  cols: dashboardColsSchema.default({ xs: 4, sm: 6, md: 8, lg: 12, xl: 16 }),
  rowHeight: z.number().int().min(24).max(160).default(50),
  margin: z.tuple([z.number().int().min(0), z.number().int().min(0)]).default([8, 8]),
  containerPadding: z.tuple([z.number().int().min(0), z.number().int().min(0)]).default([8, 8]),
  updatedAt: z.number().int().nonnegative().optional()
})

export const dashboardGetLayoutRequestSchema = z.object({
  name: z.string().min(1).max(80).optional()
}).default({})

export const dashboardLayoutResponseSchema = z.object({
  layout: dashboardLayoutSchema
})

export const dashboardSaveLayoutResultSchema = z.object({
  success: z.boolean(),
  layout: dashboardLayoutSchema
})

export const dashboardListPresetsResponseSchema = z.object({
  names: z.array(z.string().min(1))
})

export const dashboardDeletePresetRequestSchema = z.object({
  name: z.string().min(1).max(80),
  confirmedBy: z.string().min(1).optional()
})

export const dashboardResetRequestSchema = z.object({
  preset: z.string().min(1).max(80).optional(),
  confirmedBy: z.string().min(1).optional()
}).default({})

export const dashboardMorphWidgetToDrawerRequestSchema = z.object({
  widgetInstanceId: z.string().min(1),
  slot: z.enum(['right', 'bottom'])
})

export const dashboardMorphWidgetToDrawerResultSchema = z.object({
  drawerState: drawerStateSchema,
  layout: dashboardLayoutSchema
})

export const processViewModeSchema = z.enum(['card', 'list', 'grouped', 'tree', 'treemap'])

export interface ProcessTreeNodeValue {
  pid: number
  ppid: number
  exe: string
  cmdline?: string
  rss: number
  cpu: number
  children: ProcessTreeNodeValue[]
  expanded: boolean
  depth: number
  isAiTool: boolean
  permissionLevel?: 'full' | 'partial' | 'denied'
}

export const processTreeNodeSchema: z.ZodType<ProcessTreeNodeValue> = z.lazy(() => z.object({
  pid: z.number().int(),
  ppid: z.number().int(),
  exe: z.string().min(1),
  cmdline: z.string().optional(),
  rss: z.number().int().nonnegative(),
  cpu: z.number(),
  children: z.array(processTreeNodeSchema).default([]),
  expanded: z.boolean().default(false),
  depth: z.number().int().min(0),
  isAiTool: z.boolean().default(false),
  permissionLevel: z.enum(['full', 'partial', 'denied']).optional()
}))

export const treemapNodeSchema = z.object({
  id: z.string().min(1),
  pid: z.number().int(),
  exe: z.string().min(1),
  value: z.number().int().nonnegative(),
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number(),
  depth: z.number().int().min(0),
  parent: z.string().optional(),
  color: z.string().optional()
})

export const treemapLayoutSchema = z.object({
  nodes: z.array(treemapNodeSchema),
  totalRss: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  groupBy: z.enum(['none', 'parent', 'exe', 'ai-tool']).default('parent'),
  colorBy: z.enum(['exe', 'rss', 'cpu', 'ai-tool', 'tag']).default('exe'),
  truncated: z.boolean().default(false)
})

export const processTreeRequestSchema = z.object({
  rootPid: z.number().int().optional(),
  maxDepth: z.number().int().min(1).max(16).default(3)
}).default({ maxDepth: 3 })

export const processTreeChildrenRequestSchema = z.object({
  pid: z.number().int()
})

export const processTreemapDataRequestSchema = z.object({
  groupBy: z.enum(['none', 'parent', 'exe', 'ai-tool']).default('parent'),
  colorBy: z.enum(['exe', 'rss', 'cpu', 'ai-tool', 'tag']).default('exe'),
  width: z.number().int().positive().default(960),
  height: z.number().int().positive().default(540)
}).default({ groupBy: 'parent', colorBy: 'exe', width: 960, height: 540 })

export const processViewModeSetRequestSchema = z.object({
  mode: processViewModeSchema
})

export const processViewModeSetResultSchema = z.object({
  success: z.boolean(),
  mode: processViewModeSchema
})

export const processBatchActionSchema = z.enum([
  'kill',
  'focus',
  'inject-text',
  'tag',
  'add-watchdog',
  'export-diag'
])

export const processBatchRequestSchema = z.object({
  action: processBatchActionSchema,
  pids: z.array(z.number().int().positive()).min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  confirmed: z.boolean().default(false),
  dryRun: z.boolean().default(false)
})

export const processBatchTagArgsSchema = z.object({
  tag: z.string().trim().min(1).max(TAG_HISTORY_LIMITS.TAG_MAX_LEN * 4),
  color: z.enum(PROCESS_TAG_COLOR_VALUES).optional(),
  pinned: z.boolean().optional()
}).strict()

export const processBatchResultSchema = z.object({
  pid: z.number().int().positive(),
  status: z.enum(['ok', 'failed', 'skipped', 'rolled-back']),
  error: z.string().optional(),
  output: z.unknown().optional()
})

export const processBatchProgressSchema = z.object({
  jobId: z.string().uuid(),
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(processBatchResultSchema),
  state: z.enum(['running', 'paused', 'completed', 'cancelled'])
})

export const processBatchStartResponseSchema = z.object({
  jobId: z.string().uuid()
})

export const processBatchJobRequestSchema = z.object({
  jobId: z.string().uuid(),
  confirmedBy: z.string().min(1).max(100).optional()
})

export const processBatchCancelResponseSchema = z.object({
  jobId: z.string().uuid(),
  cancelled: z.boolean(),
  skipped: z.number().int().nonnegative()
})

export const processBatchUndoResponseSchema = z.object({
  jobId: z.string().uuid(),
  undone: z.number().int().nonnegative(),
  results: z.array(processBatchResultSchema)
})

export const PROCESS_BATCH_LIMITS = {
  CONFIRM_THRESHOLD_KILL: 5,
  CONFIRM_REQUIRED_FOR_INJECT: true,
  CONFIRM_REQUIRED_FOR_WATCHDOG: true,
  CONFIRM_REQUIRED_FOR_SYSTEM_PID: true,
  SYSTEM_PID_THRESHOLD: 100,
  PARALLEL: 4,
  UNDO_WINDOW_MS: 5000,
  PROGRESS_PUSH_INTERVAL_MS: 100
} as const

export const windowThumbnailViewModeSchema = z.enum(['cards', 'list', 'process', 'wall'])

export const thumbnailWallEntrySchema = z.object({
  hwnd: z.number().int().positive(),
  fingerprintHash: z.string().min(1),
  thumbnailDataUrl: z.string().nullable(),
  capturedAt: z.number().int().nonnegative(),
  isStale: z.boolean(),
  groupId: z.string().nullable(),
  alias: z.string().nullable(),
  pid: z.number().int(),
  title: z.string(),
  exe: z.string(),
  cwd: z.string().optional(),
  launchOrder: z.number().int().optional(),
  monitorId: z.number().int(),
  desktopId: z.string().nullable()
})

export const THUMBNAIL_LIMITS = {
  CAPTURE_TIMEOUT_MS: 800,
  REFRESH_DEFAULT_MS: 5000,
  MAX_PARALLEL_CAPTURES: 4,
  TILE_W_BY_ZOOM: { xs: 120, sm: 180, md: 240, lg: 360 },
  TILE_H_BY_ZOOM: { xs: 80, sm: 120, md: 160, lg: 240 },
  LAZY_THRESHOLD: 200
} as const

export const thumbnailWallViewportSchema = z.object({
  zoomLevel: z.enum(['xs', 'sm', 'md', 'lg']).default('md'),
  filterText: z.string().default(''),
  groupBy: z.enum(['none', 'group', 'monitor', 'desktop', 'exe']).default('group'),
  refreshIntervalMs: z.number().int().min(2000).max(60000).default(5000),
  showStaleAfterMs: z.number().int().positive().default(15000)
})

export const thumbnailSizeSchema = z.object({
  width: z.number().int().min(32).max(1024),
  height: z.number().int().min(32).max(768)
})

export const thumbnailBatchRequestSchema = z.object({
  hwnds: z.array(z.number().int().positive()).min(1).max(THUMBNAIL_LIMITS.LAZY_THRESHOLD),
  maxAgeMs: z.number().int().min(0).max(60000).default(THUMBNAIL_LIMITS.REFRESH_DEFAULT_MS),
  thumbnailSize: thumbnailSizeSchema.optional()
})

export const thumbnailRefreshRequestSchema = z.object({
  hwnd: z.number().int().positive(),
  thumbnailSize: thumbnailSizeSchema.optional()
})

export const thumbnailBatchResponseSchema = z.object({
  entries: z.array(thumbnailWallEntrySchema),
  captured: z.number().int().nonnegative(),
  cacheHits: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  generatedAt: z.number().int().nonnegative(),
  source: z.enum(['win32-printwindow', 'electron-desktop-capturer', 'cache', 'unavailable'])
})

export const thumbnailWindowAliasRequestSchema = z.object({
  hwnd: z.number().int().positive(),
  alias: z.string().trim().min(1).max(80),
  confirmedBy: z.string().trim().min(1).max(120).optional()
})

export const thumbnailWindowAliasResponseSchema = z.object({
  success: z.boolean(),
  hwnd: z.number().int().positive(),
  alias: z.string().optional(),
  error: z.string().optional()
})

export const thumbnailViewportConfigResponseSchema = z.object({
  viewport: thumbnailWallViewportSchema,
  savedAt: z.number().int().nonnegative()
})

export const thumbnailWindowGroupSchema = z.object({
  id: z.string().min(1),
  exe: z.string().min(1),
  titlePattern: z.string().optional(),
  cwd: z.string().optional(),
  alias: z.string().optional(),
  launchOrder: z.number().int().optional(),
  members: z.array(z.number().int())
})

export const thumbnailGroupsResponseSchema = z.object({
  groups: z.array(thumbnailWindowGroupSchema),
  generatedAt: z.number().int().nonnegative()
})

export const windowBatchActionSchema = z.enum([
  'focus',
  'minimize',
  'restore',
  'close',
  'aot-toggle',
  'screenshot',
  'rename',
  'inject-text',
  'move-to-desktop'
])

export const windowBatchRequestSchema = z.object({
  action: windowBatchActionSchema,
  hwnds: z.array(z.number().int().positive()).min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  confirmed: z.boolean().default(false),
  dryRun: z.boolean().default(false)
})

export const windowBatchResultSchema = z.object({
  hwnd: z.number().int().positive(),
  status: z.enum(['ok', 'failed', 'skipped', 'rolled-back']),
  error: z.string().optional(),
  output: z.unknown().optional()
})

export const windowBatchProgressSchema = z.object({
  jobId: z.string().uuid(),
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(windowBatchResultSchema),
  state: z.enum(['running', 'paused', 'completed', 'cancelled'])
})

export const windowBatchStartResponseSchema = z.object({
  jobId: z.string().uuid()
})

export const windowBatchJobRequestSchema = z.object({
  jobId: z.string().uuid(),
  confirmedBy: z.string().min(1).max(100).optional()
})

export const windowBatchCancelResponseSchema = z.object({
  jobId: z.string().uuid(),
  cancelled: z.boolean(),
  skipped: z.number().int().nonnegative()
})

export const windowBatchUndoResponseSchema = z.object({
  jobId: z.string().uuid(),
  undone: z.number().int().nonnegative(),
  results: z.array(windowBatchResultSchema)
})

export const WINDOW_BATCH_LIMITS = {
  CONFIRM_THRESHOLD_CLOSE: 5,
  CONFIRM_REQUIRED_FOR_INJECT: true,
  UNDO_WINDOW_MS: 5000,
  PARALLEL: 4,
  PROGRESS_PUSH_INTERVAL_MS: 100,
  FOCUS_INTERVAL_MS: 150
} as const

export const virtualDesktopSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  name: z.string().nullable(),
  current: z.boolean()
})

export const r8MonitorInfoSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  bounds: r8BoundsSchema,
  workArea: r8BoundsSchema,
  scaleFactor: z.number().positive(),
  primary: z.boolean(),
  rotation: z.number().int().default(0),
  internal: z.boolean().default(false)
})

export const windowVdInfoSchema = z.object({
  hwnd: z.number().int().positive(),
  desktopId: z.string().nullable(),
  monitorId: z.number().int().nonnegative(),
  isOnCurrentDesktop: z.boolean()
})

export const virtualDesktopListResponseSchema = z.object({
  desktops: z.array(virtualDesktopSchema),
  unavailableReason: z.string().optional()
})

export const windowVdWatchEventTypeSchema = z.enum([
  'display-added',
  'display-removed',
  'display-metrics-changed',
  'virtual-desktop-changed',
  'snapshot'
])

export const windowVdWatchPayloadSchema = z.object({
  eventType: windowVdWatchEventTypeSchema,
  monitors: z.array(r8MonitorInfoSchema),
  desktops: z.array(virtualDesktopSchema),
  unavailableReason: z.string().optional(),
  emittedAt: z.number().int().nonnegative()
})

export const windowVdInfoRequestSchema = z.object({
  hwnds: z.array(z.number().int().positive()).min(1).max(100)
})

export const windowVdInfoResponseSchema = z.object({
  info: z.array(windowVdInfoSchema),
  unavailableReason: z.string().optional()
})

const virtualDesktopIdSchema = z.string().trim().regex(/^[{(]?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[)}]?$/)

export const moveWindowToDesktopRequestSchema = z.object({
  hwnd: z.number().int().positive(),
  desktopId: virtualDesktopIdSchema.transform(value => value.trim().replace(/^[{(]/, '').replace(/[)}]$/, '').toLowerCase()),
  confirmedBy: z.string().min(1).max(120).optional()
})

export const moveWindowToDesktopResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hwnd: z.number().int().positive(),
    desktopId: virtualDesktopIdSchema
  }).optional(),
  error: z.string().optional()
})

export const r8MonitorsResponseSchema = z.object({
  monitors: z.array(r8MonitorInfoSchema)
})

export const moveWindowToMonitorRequestSchema = z.object({
  hwnd: z.number().int().positive(),
  monitorId: z.number().int().nonnegative(),
  confirmedBy: z.string().min(1).max(120).optional()
})

export const moveWindowToMonitorResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    hwnd: z.number().int().positive(),
    monitorId: z.number().int().nonnegative(),
    rect: r8BoundsSchema
  }).optional(),
  error: z.string().optional()
})

export const windowLayoutPresetSchema = z.object({
  name: z.string().min(1).max(120),
  windows: z.array(z.object({
    groupKey: z.string().min(1),
    desktopId: z.string().nullable(),
    monitorId: z.number().int().nonnegative(),
    bounds: r8BoundsSchema,
    alwaysOnTop: z.boolean().default(false)
  })),
  popouts: z.array(z.object({
    kind: z.string().min(1),
    targetId: z.string().min(1),
    monitorId: z.number().int().nonnegative(),
    bounds: r8BoundsSchema
  })).default([]),
  createdAt: z.number().int().nonnegative()
})

export const windowLayoutSaveRequestSchema = windowLayoutPresetSchema.extend({
  confirmedBy: z.string().min(1).max(120).optional()
})

export const windowLayoutSaveResponseSchema = z.object({
  preset: windowLayoutPresetSchema,
  savedAt: z.number().int().nonnegative()
})

export const windowLayoutListResponseSchema = z.object({
  presets: z.array(z.string().min(1))
})

export const windowLayoutApplyRequestSchema = z.object({
  name: z.string().min(1).max(120),
  confirmedBy: z.string().min(1).max(120).optional()
})

export const windowLayoutApplyResponseSchema = z.object({
  ok: z.boolean(),
  applied: z.array(z.object({
    groupKey: z.string().min(1),
    hwnd: z.number().int().positive()
  })),
  failed: z.array(z.object({
    groupKey: z.string().min(1),
    hwnd: z.number().int().positive().optional(),
    error: z.string().min(1)
  }))
})

export const securityTierLevelSchema = z.enum(SECURITY_TIER_VALUES)

export const securityTierSchema = z.object({
  tier: securityTierLevelSchema,
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1)),
  port: z.number().int().min(1).max(65535),
  ip: z.string().min(1),
  tone: z.enum(['success', 'warning', 'orange', 'error']),
  label: z.string().min(1),
  iconToken: z.string().min(1)
}).superRefine((value, ctx) => {
  const visual = SECURITY_TIER_VISUAL[value.tier]
  if (value.tone !== visual.tone || value.label !== visual.label || value.iconToken !== visual.iconToken) {
    ctx.addIssue({
      code: 'custom',
      message: `security tier visual mismatch for ${value.tier}`,
      path: ['tier']
    })
  }
})

export const blocklistEntrySchema = z.object({
  id: z.string().min(1),
  ip: z.string().trim().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  reason: z.string().max(200).default(''),
  source: z.enum(['default', 'user']),
  addedAt: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative()
}).refine(entry => typeof entry.port === 'number' || typeof entry.ip === 'string', {
  message: 'blocklist entry requires port or ip',
  path: ['port']
})

export const publicBannerStateSchema = z.object({
  wanCount: z.number().int().nonnegative(),
  suspiciousCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  generatedAt: z.number().int().nonnegative(),
  ports: z.array(z.object({
    port: z.number().int().min(1).max(65535),
    ip: z.string().min(1),
    tier: securityTierLevelSchema,
    processName: z.string().optional()
  })).max(50)
})

export const processTagColorSchema = z.enum(PROCESS_TAG_COLOR_VALUES)

export const processTagSchema = z.object({
  key: z.string().min(1),
  exe: z.string().trim().min(1),
  cwd: z.string().trim().optional(),
  tag: z.string().trim().min(1).max(TAG_HISTORY_LIMITS.TAG_MAX_LEN),
  color: processTagColorSchema.optional(),
  pinned: z.boolean().default(false),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const processTagSetRequestSchema = z.object({
  exe: z.string().trim().min(1),
  cwd: z.string().trim().optional(),
  tag: z.string().trim().min(1).max(TAG_HISTORY_LIMITS.TAG_MAX_LEN * 4),
  color: processTagColorSchema.optional(),
  pinned: z.boolean().optional(),
})

export const processTagRemoveRequestSchema = z.object({
  exe: z.string().trim().min(1),
  cwd: z.string().trim().optional(),
})

export const processTagsListResponseSchema = z.object({
  tags: z.array(processTagSchema),
})

export const processTagsImportRequestSchema = z.object({
  json: z.string().min(1).max(2_000_000),
})

export const processTagsImportResponseSchema = z.object({
  success: z.boolean(),
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
})

export const processHistoryPointSchema = z.object({
  ts: z.number().int().nonnegative(),
  cpu: z.number().min(0).nullable(),
  rssMb: z.number().min(0).nullable(),
  handles: z.number().int().nonnegative().optional(),
  threads: z.number().int().nonnegative().optional(),
  missing: z.boolean().default(false),
})

export const processHistorySchema = z.object({
  key: z.string().min(1),
  exe: z.string(),
  cwd: z.string().optional(),
  windowMs: z.number().int().positive(),
  points: z.array(processHistoryPointSchema).max(TAG_HISTORY_LIMITS.MAX_POINTS_PER_KEY + 60),
})

export const processHistoryRequestSchema = z.object({
  exe: z.string().trim().min(1),
  cwd: z.string().trim().optional(),
})

export const processHistoryBatchRequestSchema = z.object({
  keys: z.array(z.string().min(1)).max(200),
})

export const processHistoryBatchResponseSchema = z.object({
  histories: z.array(processHistorySchema),
})

export const localeSchema = z.enum(['zh-CN', 'en-US'])

export const localeManifestSchema = z.object({
  locale: localeSchema,
  displayName: z.string().min(1),
  nativeName: z.string().min(1),
  status: z.enum(['stable', 'preview', 'partial']),
  coverage: z.number().min(0).max(1),
  updatedAt: z.number().int().nonnegative(),
})

export const localeGetResponseSchema = z.object({
  locale: localeSchema,
})

export const localeSetRequestSchema = z.object({
  locale: localeSchema,
})

export const localeSetResponseSchema = z.object({
  success: z.boolean(),
  locale: localeSchema,
})

export const localeListResponseSchema = z.object({
  manifest: z.array(localeManifestSchema),
})

export const localeReloadResponseSchema = z.object({
  reloaded: z.number().int().nonnegative(),
})

export const a11yFocusRingThicknessSchema = z.enum(A11Y_FOCUS_RING_VALUES)

export const a11yPrefsSchema = z.object({
  reducedMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  largeText: z.boolean().default(false),
  forcedColors: z.boolean().default(false),
  screenReaderOptimized: z.boolean().default(false),
  focusRingThickness: a11yFocusRingThicknessSchema.default('normal'),
  followOsSettings: z.boolean().default(true),
}).strict()

export const a11yOsPrefsSchema = z.object({
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  forcedColors: z.boolean(),
}).strict()

export const a11yImpactSchema = z.enum(A11Y_IMPACT_VALUES)

export const a11yAxeViolationSchema = z.object({
  id: z.string().min(1),
  impact: a11yImpactSchema,
  description: z.string().min(1),
  nodes: z.array(z.string().min(1)).max(A11Y_LIMITS.SELF_CHECK_FINDING_MAX),
}).strict()

export const a11yContrastFailureSchema = z.object({
  selector: z.string().min(1),
  ratio: z.number().nonnegative(),
  required: z.number().positive(),
}).strict()

export const a11ySelfCheckResultSchema = z.object({
  ts: z.number().int().nonnegative(),
  axeExecuted: z.boolean().default(false),
  axeTarget: z.string().min(1).nullable().default(null),
  axeViolations: z.array(a11yAxeViolationSchema).max(A11Y_LIMITS.SELF_CHECK_FINDING_MAX),
  contrastFailures: z.array(a11yContrastFailureSchema).max(A11Y_LIMITS.SELF_CHECK_FINDING_MAX),
  keyboardUnreachable: z.array(z.string().min(1)).max(A11Y_LIMITS.SELF_CHECK_FINDING_MAX),
  warnings: z.array(z.string().min(1)).max(A11Y_LIMITS.SELF_CHECK_FINDING_MAX),
  passed: z.boolean(),
}).strict()

export const iconLibrarySchema = z.enum(ICON_LIBRARY_VALUES)

export const iconTokenSchema = z.string().trim().regex(ICON_TOKEN_REGEX)

export const iconResolveSchema = z.object({
  library: iconLibrarySchema,
  name: z.string().min(1),
  size: z.number().int().min(8).max(128).optional(),
  strokeWidth: z.number().min(0.5).max(4).optional(),
  color: z.string().min(1).optional(),
}).strict()

export const iconResolveRequestSchema = z.object({
  token: iconTokenSchema,
}).strict()

export const iconResolveResponseSchema = z.object({
  requestedToken: z.string().min(1),
  resolved: iconResolveSchema,
  available: z.boolean(),
  fallbackToken: iconTokenSchema.nullable(),
}).strict()

export const iconLibraryManifestSchema = z.object({
  library: iconLibrarySchema,
  count: z.number().int().nonnegative(),
  usage: z.string().min(1),
}).strict()

export const iconListLibrariesResponseSchema = z.object({
  libraries: z.array(iconLibrarySchema),
  counts: z.record(iconLibrarySchema, z.number().int().nonnegative()),
  manifests: z.array(iconLibraryManifestSchema),
}).strict()

export const themeDecorationKindSchema = z.enum(THEME_DECORATION_KIND_VALUES)
export const themeDecorationPositionSchema = z.enum(THEME_DECORATION_POSITION_VALUES)
export const themeDecorationBlendModeSchema = z.enum(['normal', 'multiply', 'overlay', 'screen'])
export const themeDecorationConfigSchema = z.object({
  kind: themeDecorationKindSchema,
  customSvgId: z.string().uuid().optional(),
  opacity: z.number().min(DECORATION_LIMITS.MIN_OPACITY).max(DECORATION_LIMITS.MAX_OPACITY).default(0.15),
  positions: z.array(themeDecorationPositionSchema).default([]),
  blendMode: themeDecorationBlendModeSchema.default('normal'),
  scale: z.number().min(0.5).max(4).default(1),
  motionRespect: z.boolean().default(true)
})
export const customSvgEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(DECORATION_LIMITS.MAX_CUSTOM_SVG_NAME_LENGTH),
  sanitizedContent: z.string().min(1),
  uploadedAt: z.number().int(),
  size: z.number().int().positive().max(DECORATION_LIMITS.MAX_CUSTOM_SVG_KB * 1024),
  hash: z.string().regex(/^[a-f0-9]{64}$/)
})
export const customSvgUploadRequestSchema = z.object({
  name: z.string().trim().min(1).max(DECORATION_LIMITS.MAX_CUSTOM_SVG_NAME_LENGTH),
  content: z.string().min(1).max(DECORATION_LIMITS.MAX_CUSTOM_SVG_KB * 1024 * 2),
  confirmedBy: z.string().min(3).optional()
})
export const customSvgRemoveRequestSchema = z.object({
  id: z.string().uuid(),
  confirmedBy: z.string().min(3).optional()
})
export const themeDecorationListResponseSchema = z.object({
  kinds: z.array(themeDecorationKindSchema),
  customSvgs: z.array(customSvgEntrySchema)
})
export const customSvgUploadResponseSchema = z.object({
  id: z.string().uuid(),
  sanitizedContent: z.string().min(1),
  entry: customSvgEntrySchema
})
export const customSvgListResponseSchema = z.object({
  items: z.array(customSvgEntrySchema)
})
export const customSvgRemoveResponseSchema = z.object({
  success: z.boolean(),
  removed: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative()
})
export const themeSoundConfigSchema = z.object({
  themeId: z.enum(['constructivism', 'modern-light', 'warm-light', 'cyberpunk', 'swiss', 'dark', 'light']),
  enabled: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(0.3),
  events: z.object({
    hover: z.string().optional(),
    click: z.string().optional(),
    notify: z.string().optional(),
    error: z.string().optional(),
    success: z.string().optional()
  })
})
export const themeSoundConfigGetRequestSchema = z.object({
  themeId: z.enum(['constructivism', 'modern-light', 'warm-light', 'cyberpunk', 'swiss', 'dark', 'light'])
})
export const themeSoundConfigResponseSchema = z.object({
  success: z.boolean(),
  config: themeSoundConfigSchema
})

export const statusTileIdValues = [
  'cpu',
  'mem',
  'net',
  'battery',
  'projects',
  'ai-tasks',
  'public-ports',
  'listening-ports',
  'notifications',
  'popouts',
  'theme',
  'cmdk',
  'time'
] as const

export const statusTileIdSchema = z.enum(statusTileIdValues)
export const statusBadgeTypeSchema = z.enum(['new', 'unread', 'number', 'experimental', 'warning', 'error'])
export const statusTileActionTypeSchema = z.enum(['open-drawer', 'open-popout', 'navigate', 'invoke-cmd', 'open-cmdk'])

export const statusTileClickActionSchema = z.object({
  type: statusTileActionTypeSchema,
  args: z.record(z.string(), z.unknown()).default({})
})

export const STATUSBAR_LIMITS = {
  HEIGHT_PX: 28,
  REFRESH_INTERVAL_MS: 1000,
  AGGREGATE_PUSH_DEBOUNCE_MS: 100,
  MAX_VISIBLE_TILES: 14
} as const

export const statusTileSchema = z.object({
  id: statusTileIdSchema,
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  tone: z.enum(['neutral', 'success', 'warning', 'danger', 'accent']),
  source: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  visible: z.boolean().default(true),
  order: z.number().int().min(0).max(20).default(0),
  align: z.enum(['left', 'center', 'right']).default('left'),
  badgeType: statusBadgeTypeSchema.optional(),
  badgeValue: z.union([z.string(), z.number()]).optional(),
  iconToken: z.string().optional(),
  tooltip: z.string().optional(),
  clickAction: statusTileClickActionSchema.optional()
})

export const statusAggregateSchema = z.object({
  generatedAt: z.number().int().nonnegative(),
  tiles: z.array(statusTileSchema).max(STATUSBAR_LIMITS.MAX_VISIBLE_TILES),
  badges: z.array(statusTileSchema).max(6),
  refreshIntervalMs: z.number().int().positive().default(STATUSBAR_LIMITS.REFRESH_INTERVAL_MS)
})

export const statusbarConfigSchema = z.object({
  tiles: z.array(statusTileSchema).max(STATUSBAR_LIMITS.MAX_VISIBLE_TILES),
  updatedAt: z.number().int().nonnegative().default(0)
}).strict().superRefine((config, ctx) => {
  const seen = new Set<StatusTileId>()
  for (const [index, tile] of config.tiles.entries()) {
    if (seen.has(tile.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate statusbar tile id: ${tile.id}`,
        path: ['tiles', index, 'id']
      })
    }
    seen.add(tile.id)
  }
})

export const statusbarSetConfigRequestSchema = statusbarConfigSchema
export const statusbarResetRequestSchema = z.object({
  confirmedBy: z.string().min(3)
}).strict()


export const parserStrategySchema = z.enum(['ndjson', 'shim', 'line', 'sse'])

export const parserDescriptorSchema = z.object({
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot', 'unknown']),
  strategy: parserStrategySchema,
  priority: z.number().int().min(0).max(100),
  enabled: z.boolean().default(true)
})

export const parseSessionSchema = z.object({
  sessionId: z.string().min(1),
  instanceId: z.string().min(1),
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot', 'unknown']),
  strategy: parserStrategySchema,
  startedAt: z.number().int().nonnegative(),
  bytesProcessed: z.number().int().nonnegative(),
  eventsEmitted: z.number().int().nonnegative(),
  lastEventAt: z.number().int().nonnegative().nullable()
})

export const codexMarkerSchema = z.object({
  version: z.literal(1),
  field: z.enum(['PHASE', 'PROGRESS', 'TOKENS', 'TOOL', 'ERROR', 'DONE', 'HEARTBEAT']),
  value: z.string(),
  ts: z.number().int().nonnegative()
})

export const shimManifestSchema = z.object({
  toolName: z.enum(['codex', 'claude', 'gemini']),
  realExePath: z.string().min(1),
  shimExePath: z.string().min(1),
  installedAt: z.number().int().nonnegative(),
  shimVersion: z.string().min(1),
  ipcPipe: z.string().min(1)
})

export const shimFrameSchema = z.object({
  shimPid: z.number().int(),
  realPid: z.number().int().nullable(),
  source: z.enum(['stdout', 'stderr']),
  line: z.string(),
  ts: z.number().int().nonnegative(),
  tool: z.enum(['codex', 'claude', 'gemini']).optional(),
  argv: z.array(z.string()).max(200).optional(),
  restartArgs: z.array(z.string()).max(200).optional(),
  cwd: z.string().min(1).optional(),
  fallbackReason: z.enum(['non-stream-json-output', 'schema-mismatch']).optional(),
  requiresUserConfirmation: z.boolean().optional()
})

export const shimControlFrameSchema = z.object({
  type: z.literal('stdin'),
  requestId: z.string().uuid(),
  text: z.string().min(1),
  appendNewline: z.boolean().default(true),
  ts: z.number().int().nonnegative()
}).strict()

export const cliEventPayloadSchema = z.object({
  step: z.number().int().nonnegative().optional(),
  total: z.number().int().positive().optional(),
  rawType: z.string().optional(),
  source: z.string().optional(),
  field: z.string().optional(),
  value: z.string().optional(),
  phase: z.string().optional(),
  tool: z.string().optional(),
  kind: z.string().optional(),
  subtype: z.string().optional(),
  claudeSessionId: z.string().optional(),
  durationMs: z.number().optional(),
  costUsd: z.number().optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  model: z.string().optional(),
  text: z.string().optional(),
  throttledPartialCount: z.number().int().nonnegative().optional()
}).passthrough()

export const cliOutputEventSchema = z.object({
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot', 'unknown']),
  stream: z.enum(['stdout', 'stderr', 'title', 'system']),
  line: z.string(),
  progress: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  phase: z.enum(['idle', 'thinking', 'working', 'validating', 'waiting-input', 'completed', 'error']),
  observedAt: z.number().int().nonnegative(),
  eventType: z.enum(['start', 'progress', 'tool-use', 'tool_invocation', 'progress_pct', 'message-out', 'completion', 'waiting-input', 'phase_marker', 'error', 'unknown']).optional(),
  rawSource: z.enum(['ndjson', 'shim', 'line', 'sse', 'heuristic', 'window-title']).optional(),
  instanceId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  payload: cliEventPayloadSchema.optional()
})

export const progressDataPointSchema = z.object({
  instanceId: z.string().min(1),
  percent: z.number().min(0).max(1),
  source: z.enum(['cli-real', 'heuristic', 'fusion']),
  confidence: z.number().min(0).max(1),
  observedAt: z.number().int().nonnegative(),
  message: z.string().optional()
})

export const monitorToolSchema = z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot'])
export const monitorCardPhaseSchema = z.enum(['idle', 'thinking', 'tool-use', 'editing', 'running', 'completed', 'error'])
export const monitorWindowStateSchema = z.object({
  alwaysOnTop: z.boolean(),
  opacity: z.number().min(0.3).max(1),
  bounds: z.object({
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int().positive(),
    h: z.number().int().positive()
  })
})
export const toolMonitorCardSchema = z.object({
  tool: monitorToolSchema,
  active: z.boolean(),
  instanceCount: z.number().int().nonnegative(),
  currentPhase: monitorCardPhaseSchema,
  progress: progressDataPointSchema.nullable(),
  tokens: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative()
  }).nullable(),
  costUsd: z.number().nonnegative().nullable(),
  lastEventAt: z.number().int().nonnegative().nullable(),
  recentEvents: z.array(cliOutputEventSchema).max(20)
})
export const monitorSnapshotSchema = z.object({
  cards: z.array(toolMonitorCardSchema).length(5),
  windowState: monitorWindowStateSchema,
  collectedAt: z.number().int().nonnegative()
})
export const monitorPopoutLayoutSchema = z.enum(['compact', 'progress-only', 'events-only'])
export const monitorPopoutSchema = browserPopoutSchema.extend({
  popoutKind: z.literal('monitor-tool'),
  tool: monitorToolSchema,
  miniLayout: monitorPopoutLayoutSchema,
  card: toolMonitorCardSchema
})

export const fusedSignalSchema = z.object({
  instanceId: z.string().min(1),
  fusedProgress: progressDataPointSchema,
  contributions: z.array(signalContributionSchema),
  state: z.enum(['idle', 'thinking', 'working', 'validating', 'waiting-input', 'completed', 'error', 'stuck'])
})

const skillNameSchema = z.string().min(1).max(60).regex(/^[a-z0-9-]+$/)
const skillSemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/)
export const skillSandboxSchema = z.enum(['read-only', 'read-write', 'system'])
export const skillInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'file', 'json']),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  description: z.string().optional()
}).strict()
export const skillOutputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'json', 'file', 'exit-code'])
}).strict()
export const skillMcpServerSchema = z.object({
  name: skillNameSchema,
  transport: z.enum(['stdio']).default('stdio'),
  command: z.string().min(1).max(500),
  args: z.array(z.string().max(500)).max(20).default([]),
  env: z.record(z.string(), z.string().max(500)).default({})
}).strict()
export const skillFrontmatterSchema = z.object({
  schemaVersion: z.literal('1.0'),
  name: skillNameSchema,
  displayName: z.string().min(1).max(120),
  version: skillSemverSchema,
  description: z.string().min(10).max(500),
  author: z.string().max(80).default('DevHub'),
  license: z.string().min(1).max(80).default('UNLICENSED'),
  sandbox: skillSandboxSchema.default('read-only'),
  tags: z.array(z.string().min(1)).max(10).default([]),
  inputs: z.array(skillInputSchema).max(20).default([]),
  outputs: z.array(skillOutputSchema).max(10).default([]),
  scriptPath: z.string().min(1),
  runtime: z.enum(['node', 'python', 'bash', 'powershell', 'exe']),
  runtimeVersion: z.string().optional(),
  permissions: z.array(z.enum(['fs-read', 'fs-write', 'net', 'exec'])).max(4).default([]),
  mcpServers: z.array(skillMcpServerSchema).max(10).default([])
}).strict()
export const skillSchema = skillFrontmatterSchema.extend({
  builtIn: z.boolean().default(false),
  source: z.enum(['builtin', 'user']),
  loadedAt: z.number().int().nonnegative(),
  filePath: z.string().min(1)
}).strict()
export const skillLoadErrorSchema = z.object({
  filePath: z.string().min(1),
  errorCode: z.enum(['E_VALIDATION', 'E_NOT_FOUND', 'E_PARSE', 'E_PERMISSION']),
  message: z.string().min(1),
  details: z.unknown().nullable()
}).strict()
export const skillListStreamPayloadSchema = z.object({
  added: z.array(skillSchema),
  updated: z.array(skillSchema),
  removed: z.array(skillNameSchema),
  skills: z.array(skillSchema),
  errors: z.array(skillLoadErrorSchema),
  source: z.enum(['add', 'change', 'unlink', 'reload', 'write', 'install', 'uninstall', 'fork']),
  emittedAt: z.number().int().nonnegative()
}).strict()

export const skillEditorScriptLanguageSchema = z.enum(['node', 'python', 'bash', 'powershell'])
export const skillEditorBufferSchema = z.object({
  filePath: z.string().min(1),
  yamlFrontmatter: z.string().min(1),
  bodyMarkdown: z.string(),
  scriptContent: z.string(),
  scriptLanguage: skillEditorScriptLanguageSchema,
  isDirty: z.boolean(),
  lastSavedAt: z.number().int().nonnegative().nullable()
}).strict()
export const skillValidationIssueSchema = z.object({
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  message: z.string().min(1),
  severity: z.enum(['error', 'warning'])
}).strict()
export const skillSchemaIssueSchema = z.object({
  path: z.string(),
  message: z.string().min(1)
}).strict()
export const skillValidationResultSchema = z.object({
  valid: z.boolean(),
  yamlErrors: z.array(skillValidationIssueSchema),
  schemaErrors: z.array(skillSchemaIssueSchema)
}).strict()
export const skillTemplateSchema = z.object({
  templateId: z.enum(['blank', 'fork-builtin', 'prompt-only', 'script-only', 'full']),
  defaultName: skillNameSchema,
  yaml: z.string().min(1),
  body: z.string(),
  script: z.string()
}).strict()

export const csvTaskRowSchema = z.object({
  id: z.string().min(1),
  group: z.string().min(1).optional(),
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']),
  prompt: z.string().min(1),
  cwd: z.string().min(1).optional(),
  skill: z.string().optional(),
  priority: z.coerce.number().int().min(0).max(100).default(50),
  dependency: z.string().optional(),
  parallel_group: z.string().optional(),
  success_criteria: z.string().optional(),
  timeout_ms: z.coerce.number().int().positive().optional(),
  retries: z.coerce.number().int().nonnegative().default(0),
  env: z.string().optional(),
  tags: z.string().optional(),
  output_path: z.string().optional(),
  dry_run: z.coerce.boolean().default(false),
  allow_inject: z.coerce.boolean().default(false),
  permission_ttl_ms: z.coerce.number().int().positive().optional(),
  on_fail: z.enum(['next', 'abort', 'retry', 'fallback-tool', 'escalate-model', 'human', 'execute-skill']).optional(),
  fallback_tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']).optional(),
  execute_skill: z.string().min(1).max(80).optional(),
  needs_bigger_model: z.boolean().optional(),
  notes: z.string().optional()
})

export const csvRowErrorSchema = z.object({
  line: z.number().int().nonnegative(),
  column: z.string().min(1),
  message: z.string().min(1)
}).strict()
export const csvDriverRowSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  raw: z.record(z.string(), z.string()),
  row: csvTaskRow18Schema.nullable(),
  runtimeRow: csvTaskRowSchema.nullable(),
  rowState: z.enum(['valid', 'invalid']),
  errors: z.array(csvRowErrorSchema)
}).strict()
export const csvMetadataSchema = z.object({
  devhubCsvVersion: z.string().min(1),
  runner: z.enum(['devhub', 'python', 'cli']),
  author: z.string().optional(),
  totalTimeoutMs: z.number().int().positive().optional(),
  concurrentMax: z.number().int().min(1).max(16)
}).strict()
export const csvFileGroupSchema = z.object({
  groupId: z.string().min(1),
  filePath: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
  validRowCount: z.number().int().nonnegative(),
  rows: z.array(csvDriverRowSchema),
  errors: z.array(csvRowErrorSchema),
  loadedAt: z.number().int().nonnegative(),
  fileMtime: z.number().int().nonnegative(),
  metadata: csvMetadataSchema
}).strict()
export const csvDriverStateSchema = z.object({
  groups: z.array(csvFileGroupSchema),
  lastFullScanAt: z.number().int().nonnegative(),
  watchedDirs: z.array(z.string().min(1))
}).strict()
export const csvSchemaInfoSchema = z.object({
  schemaName: z.literal('CsvTaskRow18'),
  columnCount: z.literal(CSV_COLUMN_NAMES.length),
  columns: z.array(csvColumnInfoSchema).length(CSV_COLUMN_NAMES.length),
  header: z.array(z.enum(CSV_COLUMN_NAMES)).length(CSV_COLUMN_NAMES.length)
}).strict()
export const csvReloadSummarySchema = z.object({
  groupCount: z.number().int().nonnegative(),
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  groups: z.array(csvFileGroupSchema)
}).strict()
export const csvRowStreamPayloadSchema = z.object({
  source: z.enum(['reload', 'watch:add', 'watch:change', 'watch:unlink']),
  emittedAt: z.number().int().nonnegative(),
  changedGroupIds: z.array(z.string().min(1)),
  removedGroupIds: z.array(z.string().min(1)),
  summary: csvReloadSummarySchema
}).strict()
export const csvLaunchOptionsSchema = z.object({
  csvPath: z.string().min(1),
  runner: z.enum(['devhub', 'python', 'cli']).optional(),
  resume: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  concurrent: z.number().int().min(1).max(16).optional(),
  forceRerun: z.array(z.string().min(1)).default([]),
  parallelGroupOverrides: z.record(z.string(), z.number().int().min(1).max(16)).default({}),
  confirmedBy: z.string().min(3).optional()
}).strict()
export const csvLaunchSessionSchema = z.object({
  sessionId: z.string().uuid(),
  csvPath: z.string().min(1),
  runner: z.enum(['devhub', 'python', 'cli']),
  metadata: csvMetadataSchema,
  rowCount: z.number().int().nonnegative(),
  enqueued: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  startedAt: z.number().int().nonnegative(),
  pid: z.number().int().nullable(),
  status: z.enum(['preparing', 'dry-run', 'queued', 'running', 'paused', 'completed', 'failed', 'aborted', 'command-generated']),
  command: z.string().nullable(),
  error: z.string().nullable()
}).strict()
export const csvSessionEventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['task-start', 'task-progress', 'task-end', 'session-end', 'session-error', 'command-generated', 'session-start', 'control-ack']),
  emittedAt: z.number().int().nonnegative(),
  data: z.unknown()
}).strict()

export const taskStatusSchema = z.enum(['pending', 'queued', 'running', 'succeeded', 'failed', 'skipped', 'paused', 'waiting-dependency', 'cancelled', 'awaiting-human', 'retrying'])
export const taskStateTransitionSchema = z.object({
  transitionId: z.string().min(1),
  runId: z.string().min(1),
  taskId: z.string().min(1),
  sessionId: z.string().nullable(),
  prev: taskStatusSchema,
  next: taskStatusSchema,
  at: z.number().int().nonnegative(),
  reason: z.string().min(1)
}).strict()
export const taskStateStreamPayloadSchema = z.object({
  emittedAt: z.number().int().nonnegative(),
  transitions: z.array(taskStateTransitionSchema).min(1).max(100)
}).strict()
export const taskRunSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  row: csvTaskRowSchema,
  status: taskStatusSchema,
  attempts: z.number().int().nonnegative(),
  attemptCount: z.number().int().nonnegative().default(0),
  maxRetry: z.number().int().nonnegative().default(0),
  rowHash: z.string().optional(),
  queuedAt: z.number().int().nonnegative(),
  startedAt: z.number().int().nonnegative().nullable(),
  endedAt: z.number().int().nonnegative().nullable(),
  retryBackoffMs: z.number().int().nonnegative().nullable().default(null),
  nextRetryAt: z.number().int().nonnegative().nullable().default(null),
  exitCode: z.number().int().nullable().default(null),
  error: z.string().nullable(),
  errorCode: z.string().nullable().default(null),
  errorMessage: z.string().nullable().default(null),
  parallelGroup: z.string().nullable().default(null),
  artifactsPath: z.string().nullable().default(null),
  injectActionId: z.string().nullable().default(null),
  recordingId: z.string().nullable().default(null)
})

export const taskResultExportFormatSchema = z.enum(['csv', 'json', 'both'])
export const taskResultExportRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  runIds: z.array(z.string().min(1)).max(1000).optional(),
  format: taskResultExportFormatSchema.default('both'),
  outputDir: z.string().min(1).optional(),
  confirmedBy: z.string().min(3).optional()
}).strict().refine(input => input.runIds === undefined || input.runIds.length > 0, {
  message: 'runIds must not be empty when provided',
  path: ['runIds']
})

export const taskResultExportScopeSchema = z.enum(['all', 'session', 'runs'])
export const taskResultExportFileSchema = z.object({
  format: z.enum(['csv', 'json']),
  path: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  mimeType: z.string().min(1)
}).strict()

export const taskResultExportPayloadSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  exportedAt: z.number().int().nonnegative(),
  scope: taskResultExportScopeSchema,
  sessionId: z.string().nullable(),
  taskCount: z.number().int().nonnegative(),
  tasks: z.array(taskRunSchema)
}).strict()

export const taskResultExportResultSchema = z.object({
  success: z.literal(true),
  scope: taskResultExportScopeSchema,
  sessionId: z.string().nullable(),
  runIds: z.array(z.string().min(1)),
  taskCount: z.number().int().nonnegative(),
  exportedAt: z.number().int().nonnegative(),
  artifactDir: z.string().min(1),
  files: z.array(taskResultExportFileSchema).min(1).max(2)
}).strict()

export const queueStatsSchema = z.object({
  sessionId: z.string().nullable().default(null),
  pending: z.number().int().nonnegative().default(0),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  awaitingHuman: z.number().int().nonnegative().default(0),
  retrying: z.number().int().nonnegative().default(0),
  cancelled: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative(),
  concurrent: z.number().int().positive().default(3),
  throughputPerMin: z.number().nonnegative().default(0),
  estimatedSecondsRemaining: z.number().int().nonnegative().nullable().default(null)
})

export const taskQueueEngineSchema = z.enum(['better-queue', 'p-queue'])
export const taskQueueStorageStatusSchema = z.object({
  flag: z.literal('R8.C.task.queue.engine'),
  engine: taskQueueEngineSchema,
  allowedEngines: z.array(taskQueueEngineSchema).length(2),
  backend: z.enum(['sqlite-kv-indexed', 'electron-store']),
  sqlitePath: z.string().nullable(),
  sqliteIntegrity: z.object({
    status: z.enum(['ok', 'recovered', 'not-applicable']),
    checkedAt: z.number().int().nonnegative().nullable(),
    backupPath: z.string().nullable(),
    error: z.string().nullable()
  }).strict(),
  nativeBetterQueueAvailable: z.boolean(),
  nativeBetterQueueSqliteAvailable: z.boolean(),
  nativeSqlite3Available: z.boolean(),
  switchRequiresRestart: z.boolean(),
  warning: z.string().nullable()
}).strict()

export const heartbeatSourceSchema = z.enum(['marker-file', 'stdout', 'cpu-pulse', 'window-title', 'http-health', 'fs-activity', 'hung-window', 'network', 'etw'])
export const heartbeatModeSchema = z.enum(['lenient', 'strict'])
export const watchdogActionPolicySchema = z.enum(['restart', 'fallback-tool', 'escalate-model', 'human-intervention', 'log-only'])
export const watchdogPhaseSchema = z.enum(['receiving-input', 'thinking', 'running', 'awaiting-human'])
export const taskPhaseTimeoutsSchema = z.object({
  receivingInputMs: z.number().int().positive().default(600_000),
  thinkingMs: z.number().int().positive().default(300_000),
  runningMs: z.number().int().positive().default(120_000),
  awaitingHumanMs: z.number().int().positive().default(1_800_000)
})
export const watchdogInstanceSchema = z.object({
  instanceId: z.string().min(1),
  pid: z.number().int().positive(),
  alias: z.string().optional(),
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']),
  mode: heartbeatModeSchema.default('lenient'),
  perPhase: taskPhaseTimeoutsSchema,
  enabledSources: z.array(heartbeatSourceSchema),
  graceUntil: z.number().int().nonnegative(),
  state: z.enum(['healthy', 'suspect', 'stuck', 'restarting', 'fallback-pending', 'human-pending', 'dead']),
  consecutiveStuckCount: z.number().int().nonnegative(),
  lastHeartbeatAt: z.number().int().nonnegative(),
  lastAcceptedHeartbeatAt: z.number().int().nonnegative(),
  actionPolicy: watchdogActionPolicySchema.default('restart'),
  phase: watchdogPhaseSchema.default('running'),
  createdAt: z.number().int().nonnegative()
}).strict()
export const watchdogStatusSchema = z.object({
  enabled: z.boolean(),
  heartbeatTimeoutMs: z.number().int().positive(),
  restartCount: z.number().int().nonnegative(),
  lastHeartbeatAt: z.number().int().nonnegative().nullable(),
  state: z.enum(['idle', 'watching', 'restarting', 'failed', 'healthy', 'suspect', 'stuck', 'dead', 'fallback-pending', 'human-pending']),
  isHealthy: z.boolean().default(true),
  monitoredInstances: z.array(watchdogInstanceSchema).default([]),
  lastSelfCheckAt: z.number().int().nonnegative().nullable().default(null),
  totalRestarts24h: z.number().int().nonnegative().default(0),
  totalFallbacks24h: z.number().int().nonnegative().default(0),
  restartStormActive: z.boolean().default(false)
})
export const watchdogEventTypeSchema = z.enum(['heartbeat', 'state-change', 'action-taken', 'storm-detected', 'configure', 'self-check', 'manual-restart-override'])
export const watchdogEventSchema = z.object({
  eventId: z.string().min(1),
  type: watchdogEventTypeSchema,
  at: z.number().int().nonnegative(),
  instanceId: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown())
}).strict()
export const watchdogEventStreamPayloadSchema = z.object({
  emittedAt: z.number().int().nonnegative(),
  events: z.array(watchdogEventSchema).min(1).max(100)
}).strict()

export const injectActionSchema = injectActionSchemaV2
export const injectResultSchema = injectResultSchemaV2

export const r8NotificationSchema = notificationSchema
export const notificationAggregationSchema = notificationAggregationConfigSchema
export const notificationChannelConfigSchema = channelConfigSchema
export const notificationListRequestSchema = notifyListRequestSchema
export const notificationInvokeActionSchema = notifyInvokeActionRequestSchema
export const notificationEmitResponseSchema = notifyEmitResponseSchema

export const permissionGrantSchema = z.object({
  operation: z.string().min(1),
  subject: z.string().min(1),
  grantedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  confirmedBy: z.string().min(3)
})

export const sensitivePermissionOperationSchema = z.enum([
  'inject',
  'shim-install',
  'kill-pid',
  'file-write',
  'fs-elevated',
  'webhook',
  'smtp',
  'store-api-key'
])

export const permissionGrantScopeSchema = z.object({
  instanceId: z.string().min(1).optional(),
  pathGlob: z.string().min(1).optional(),
  targetUrl: z.string().min(1).optional()
}).strict()

export const permissionTtlGrantSchema = z.object({
  grantId: z.string().uuid(),
  op: sensitivePermissionOperationSchema,
  scope: permissionGrantScopeSchema.default({}),
  grantedAt: z.number().int().nonnegative(),
  ttlMs: z.number().int().min(60_000).max(86_400_000),
  expiresAt: z.number().int().positive(),
  monotonicGrantedAt: z.number().nonnegative(),
  grantedBy: z.string().min(1),
  reason: z.string().max(500).optional(),
  revokedAt: z.number().int().nonnegative().nullable().default(null),
  usageCount: z.number().int().nonnegative().default(0)
}).strict()

export const permissionPolicySchema = z.object({
  op: sensitivePermissionOperationSchema,
  defaultTtlMs: z.number().int().min(60_000).max(86_400_000).default(30 * 60_000),
  maxTtlMs: z.number().int().min(60_000).max(86_400_000).default(24 * 60 * 60_000),
  requireReason: z.boolean().default(false),
  rateLimitPerHour: z.number().int().min(1).max(60).default(20)
}).strict()

export const permissionRequestSchema = z.object({
  op: sensitivePermissionOperationSchema,
  scope: permissionGrantScopeSchema.default({}),
  ttlMs: z.number().int().min(60_000).max(86_400_000).optional(),
  reason: z.string().max(500).optional(),
  confirmedBy: z.string().min(3)
}).strict()

export const permissionCheckRequestSchema = z.object({
  op: sensitivePermissionOperationSchema,
  scope: permissionGrantScopeSchema.default({})
}).strict()

export const permissionCheckResultSchema = z.object({
  granted: z.boolean(),
  grantId: z.string().uuid().optional(),
  expiresAt: z.number().int().positive().optional(),
  remainingMs: z.number().int().nonnegative().optional(),
  reason: z.enum(['active', 'expired', 'revoked', 'never-granted', 'rate-limited'])
}).strict()

export const permissionRevokeRequestSchema = z.object({
  grantId: z.string().uuid(),
  confirmedBy: z.string().min(3)
}).strict()

export const permissionRevokeAllRequestSchema = z.object({
  confirmedBy: z.string().min(3)
}).strict()

export const permissionRevokeResponseSchema = z.object({
  success: z.boolean(),
  revokedCount: z.number().int().nonnegative(),
  revokedAt: z.number().int().nonnegative(),
  confirmedBy: z.string().min(3)
}).strict()

export const permissionListActiveResponseSchema = z.object({
  grants: z.array(permissionTtlGrantSchema),
  now: z.number().int().nonnegative()
}).strict()

export const permissionConfigurePolicyResponseSchema = z.object({
  success: z.boolean(),
  policy: permissionPolicySchema,
  updatedAt: z.number().int().nonnegative(),
  confirmedBy: z.string().min(3)
}).strict()

export const permissionExpiryStreamPayloadSchema = z.object({
  grants: z.array(z.object({
    grantId: z.string().uuid(),
    op: sensitivePermissionOperationSchema,
    remainingMs: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive()
  }).strict()),
  emittedAt: z.number().int().nonnegative()
}).strict()

export const backupLegacyScopeSchema = z.enum(['settings', 'csv', 'skills', 'audit'])
export const backupCategorySchema = z.enum(['settings', 'csv-tasks', 'skills', 'audit-log'])
export const backupCreatedBySchema = z.enum(['user', 'schedule', 'pre-recovery', 'migration'])
export const backupConflictPolicySchema = z.enum(['overwrite', 'merge', 'skip'])

export const backupCategoryEntrySchema = z.object({
  category: backupCategorySchema,
  fileCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string().min(1)
}).strict()

export const backupManifestSchema = z.object({
  backupId: z.string().uuid(),
  bundleId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  schemaVersion: z.string().min(1),
  categories: z.array(backupCategoryEntrySchema).min(1),
  totalSizeBytes: z.number().int().nonnegative(),
  artifactPath: z.string().min(1),
  zipPath: z.string().min(1),
  createdBy: backupCreatedBySchema,
  redactedFields: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)).default([])
}).strict()

export const backupScheduleSchema = z.object({
  enabled: z.boolean().default(false),
  cron: z.string().min(1).default('0 3 * * *'),
  retentionDays: z.number().int().min(1).max(365).default(30),
  destPath: z.string().min(1).optional(),
  categoriesIncluded: z.array(backupCategorySchema).min(1).default(['settings', 'csv-tasks', 'skills', 'audit-log'])
}).strict()

export const backupCreateRequestSchema = z.object({
  categories: z.array(backupCategorySchema).min(1).optional(),
  scope: z.array(backupLegacyScopeSchema).min(1).optional(),
  destPath: z.string().min(1).optional(),
  createdBy: backupCreatedBySchema.default('user'),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const backupExportClassifiedRequestSchema = z.object({
  categories: z.array(backupCategorySchema).min(1),
  destPath: z.string().min(1),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const backupDeleteRequestSchema = z.object({
  backupId: z.string().min(1).optional(),
  bundleId: z.string().min(1).optional(),
  confirmedBy: z.string().min(3).optional()
}).refine(value => Boolean(value.backupId || value.bundleId), { message: 'backupId or bundleId is required' })

export const restorePlanSchema = z.object({
  backupId: z.string().min(1).optional(),
  bundleId: z.string().min(1).optional(),
  categoriesToRestore: z.array(backupCategorySchema).min(1).optional(),
  scope: z.array(backupLegacyScopeSchema).min(1).optional(),
  conflictPolicy: backupConflictPolicySchema.default('overwrite'),
  preRestoreSnapshot: z.boolean().default(true),
  confirmedBy: z.string().min(3).optional()
}).refine(value => Boolean(value.backupId || value.bundleId), { message: 'backupId or bundleId is required' })

export const restoreCategoryResultSchema = z.object({
  category: backupCategorySchema,
  fileCount: z.number().int().nonnegative(),
  success: z.boolean(),
  errors: z.array(z.string())
}).strict()

export const restoreResultSchema = z.object({
  startedAt: z.number().int().nonnegative(),
  finishedAt: z.number().int().nonnegative(),
  restored: z.array(restoreCategoryResultSchema),
  preRestoreSnapshotId: z.string().uuid().nullable()
}).strict()

export const backupScheduleResultSchema = z.object({
  success: z.boolean(),
  schedule: backupScheduleSchema,
  updatedAt: z.number().int().nonnegative()
}).strict()

export const backupBundleSchema = z.object({
  bundleId: z.string().min(1),
  backupId: z.string().min(1).optional(),
  scope: z.array(backupLegacyScopeSchema).min(1),
  categories: z.array(backupCategoryEntrySchema).optional(),
  path: z.string().min(1),
  artifactPath: z.string().min(1).optional(),
  zipPath: z.string().min(1).optional(),
  bytes: z.number().int().nonnegative(),
  totalSizeBytes: z.number().int().nonnegative().optional(),
  createdAt: z.number().int().nonnegative(),
  schemaVersion: z.string().min(1).optional(),
  createdBy: backupCreatedBySchema.optional(),
  redactedFields: z.array(z.string().min(1)).optional(),
  warnings: z.array(z.string().min(1)).optional()
}).strict()

export const diagnosticSectionSchema = z.enum([
  'observability-snapshot',
  'audit-log',
  'state-machine-ringbuffer',
  'misreport-records',
  'system-info',
  'screenshots',
  'recovery-report',
  'feature-flags',
  'env-config-redacted'
])

export const diagnosticRedactionLevelSchema = z.enum(['minimal', 'standard', 'aggressive'])
export const diagnosticScreenshotModeSchema = z.enum(['active-window', 'main-window', 'all-displays'])
export const diagnosticRuleCategorySchema = z.enum(['secret', 'identity', 'path', 'network', 'custom'])

export const diagnosticRedactionRuleSchema = z.object({
  ruleId: z.string().min(1).optional(),
  pattern: z.string().min(1),
  replacement: z.string().default('[REDACTED]'),
  enabled: z.boolean().default(true),
  description: z.string().min(1),
  category: diagnosticRuleCategorySchema.default('custom')
}).strict()

export const diagnosticPackOptionsSchema = z.object({
  sectionsIncluded: z.array(diagnosticSectionSchema).min(1).default([
    'observability-snapshot',
    'audit-log',
    'state-machine-ringbuffer',
    'misreport-records',
    'system-info',
    'recovery-report',
    'feature-flags',
    'env-config-redacted'
  ]),
  includeScreenshots: z.boolean().default(false),
  screenshotMode: diagnosticScreenshotModeSchema.default('main-window'),
  redactionLevel: diagnosticRedactionLevelSchema.default('aggressive'),
  customRedactionRules: z.array(diagnosticRedactionRuleSchema).default([]),
  destPath: z.string().min(1).optional()
}).strict()

export const diagnosticPackSectionEntrySchema = z.object({
  section: diagnosticSectionSchema,
  fileCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string().min(1),
  redactionCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1)).default([])
}).strict()

export const diagnosticPackManifestSchema = z.object({
  packId: z.string().uuid(),
  createdAt: z.number().int().nonnegative(),
  exportedAt: z.number().int().nonnegative(),
  artifactPath: z.string().min(1),
  zipPath: z.string().min(1),
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  sectionsIncluded: z.array(diagnosticSectionSchema).min(1),
  sections: z.array(diagnosticPackSectionEntrySchema),
  redactionsApplied: z.number().int().nonnegative(),
  redactionCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
  schemaVersion: z.string().min(1),
  appVersion: z.string().min(1),
  warnings: z.array(z.string().min(1)).default([]),
  noTelemetry: z.literal(true).default(true)
}).strict()

export const diagnosticPreviewSectionSchema = z.object({
  section: diagnosticSectionSchema,
  sampleContent: z.string().max(2000),
  sizeBytes: z.number().int().nonnegative(),
  redactionCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().min(1)).default([])
}).strict()

export const diagnosticPreviewSchema = z.object({
  sections: z.array(diagnosticPreviewSectionSchema),
  totalEstimatedSize: z.number().int().nonnegative(),
  redactionCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
  warnings: z.array(z.string().min(1)).default([])
}).strict()

export const diagnosticScreenshotRequestSchema = z.object({
  mode: diagnosticScreenshotModeSchema.default('main-window')
}).strict()

export const diagnosticScreenshotResultSchema = z.object({
  success: z.boolean(),
  mode: diagnosticScreenshotModeSchema,
  pngBase64: z.string().optional(),
  sizeBytes: z.number().int().nonnegative(),
  warning: z.string().min(1).nullable().default(null),
  capturedAt: z.number().int().nonnegative()
}).strict()

export const diagnosticRedactionRulesResponseSchema = z.object({
  defaults: z.array(diagnosticRedactionRuleSchema),
  custom: z.array(diagnosticRedactionRuleSchema)
}).strict()

export const diagnosticListPacksResponseSchema = z.object({
  packs: z.array(diagnosticPackManifestSchema)
}).strict()

export const dataOwnershipRootCategorySchema = z.enum([
  'core',
  'settings',
  'tasks',
  'skills',
  'audit',
  'diagnostics',
  'backup',
  'recording',
  'recovery',
  'runtime'
])

export const dataOwnershipPathKindSchema = z.enum(['file', 'directory', 'missing'])

export const dataOwnershipPathSummarySchema = z.object({
  rootId: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  category: dataOwnershipRootCategorySchema,
  path: z.string().min(1),
  kind: dataOwnershipPathKindSchema,
  exists: z.boolean(),
  fileCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().nullable(),
  truncated: z.boolean(),
  sensitive: z.boolean(),
  exportable: z.boolean()
}).strict()

export const dataOwnershipListPathsResponseSchema = z.object({
  generatedAt: z.number().int().nonnegative(),
  roots: z.array(dataOwnershipPathSummarySchema)
}).strict()

export const dataOwnershipListEntriesRequestSchema = z.object({
  rootId: z.string().min(1),
  relativePath: z.string().default('')
}).strict()

export const dataOwnershipEntrySchema = z.object({
  name: z.string().min(1),
  relativePath: z.string(),
  kind: z.enum(['file', 'directory']),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative().nullable()
}).strict()

export const dataOwnershipListEntriesResponseSchema = z.object({
  rootId: z.string().min(1),
  rootPath: z.string().min(1),
  relativePath: z.string(),
  absolutePath: z.string().min(1),
  kind: dataOwnershipPathKindSchema,
  exists: z.boolean(),
  entries: z.array(dataOwnershipEntrySchema),
  entriesTruncated: z.boolean(),
  generatedAt: z.number().int().nonnegative()
}).strict()

export const dataOwnershipExportAllRequestSchema = z.object({
  confirmedBy: z.string().min(3).default('data-ownership-panel'),
  destPath: z.string().min(1).optional()
}).strict()

export const diagnosticExportRequestSchema = z.object({
  includeAudit: z.boolean().default(true),
  includeSnapshot: z.boolean().default(true),
  redactPII: z.boolean().default(true),
  includeScreenshot: z.boolean().default(false)
})

export const cloudProviderSchema = z.enum(['none', 'self-hosted', 'custom-webhook'])
export const cloudSyncConflictPolicySchema = z.enum(['local-wins', 'remote-wins', 'manual', 'timestamp'])
export const cloudSyncDirectionSchema = z.enum(['push', 'pull', 'bidirectional'])

export const remoteSkillManifestSchema = z.object({
  remoteId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  publishedAt: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  provider: cloudProviderSchema
}).strict()

export const cloudSyncRequestSchema = z.object({
  direction: cloudSyncDirectionSchema,
  conflictPolicy: cloudSyncConflictPolicySchema,
  skillNames: z.array(z.string().min(1)).optional(),
  confirmedBy: z.string().min(3).optional()
}).strict()

export const cloudSyncResultSchema = z.object({
  success: z.literal(false),
  errorCode: z.literal('E_FEATURE_DEFERRED'),
  code: z.literal('E_FEATURE_DEFERRED').default('E_FEATURE_DEFERRED'),
  message: z.string().min(1),
  scheduledRelease: z.literal('R9'),
  enabled: z.literal(false)
}).strict()

export const cloudSyncStatusSchema = z.object({
  enabled: z.literal(false),
  provider: cloudProviderSchema.default('none'),
  lastSyncAt: z.null(),
  pendingCount: z.literal(0),
  scheduledRelease: z.literal('R9'),
  errorCode: z.literal('E_FEATURE_DEFERRED')
}).strict()

export const cloudSyncRemoteListResponseSchema = z.object({
  skills: z.array(remoteSkillManifestSchema).length(0),
  notice: z.literal('feature deferred to R9'),
  scheduledRelease: z.literal('R9'),
  enabled: z.literal(false)
}).strict()

export const recordingSessionSchema = z.object({
  sessionId: z.string().min(1),
  label: z.string().min(1),
  source: z.enum(['ai-task', 'csv-batch', 'watchdog', 'inject', 'system']),
  startedAt: z.number().int().nonnegative(),
  stoppedAt: z.number().int().nonnegative().nullable(),
  status: z.enum(['recording', 'stopped']),
  events: z.array(z.object({ type: z.string().min(1), at: z.number().int().nonnegative(), payload: z.unknown().optional() }))
})

export const replayStateSchema = z.object({
  replayId: z.string().min(1),
  sessionId: z.string().min(1),
  startedAt: z.number().int().nonnegative(),
  cursorMs: z.number().int().nonnegative(),
  status: z.enum(['running', 'paused', 'exported'])
})

export const ocrRecognizeRequestSchema = z.object({
  imagePath: z.string().min(1).optional(),
  imageBase64: z.string().min(1).optional(),
  languages: z.array(z.enum(['eng', 'chs', 'cht', 'jpn', 'kor', 'rus', 'ara'])).min(1).default(['eng']),
  rotateAuto: z.boolean().default(true),
  preprocessFilters: z.array(z.enum(['grayscale', 'denoise', 'threshold', 'sharpen'])).optional()
}).strict()

export const ocrLanguageSchema = z.enum(['eng', 'chs', 'cht', 'jpn', 'kor', 'rus', 'ara'])

export const ocrTextBlockSchema = z.object({
  text: z.string(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  }).strict(),
  confidence: z.number().min(0).max(1),
  language: ocrLanguageSchema
}).strict()

export const ocrDisabledResponseSchema = z.object({
  success: z.literal(false),
  code: z.literal('E_OCR_DISABLED'),
  errorCode: z.literal('E_OCR_DISABLED').default('E_OCR_DISABLED'),
  message: z.string().min(1),
  blocks: z.array(ocrTextBlockSchema).default([]),
  notice: z.literal('OCR feature is intentionally disabled in R8; see master section 10 NO-OCR-INTEGRATION').default('OCR feature is intentionally disabled in R8; see master section 10 NO-OCR-INTEGRATION')
}).strict()

export const ocrCapabilitiesSchema = z.object({
  enabled: z.literal(false),
  reason: z.literal('NO-OCR-INTEGRATION constraint'),
  futureRelease: z.string().nullable().default(null)
}).strict()

export const ocrSupportedLanguagesResponseSchema = z.object({
  languages: z.array(ocrLanguageSchema).length(0),
  notice: z.literal('OCR disabled'),
  enabled: z.literal(false)
}).strict()

export type R8ContractOnlyResponse = z.infer<typeof r8ContractOnlyResponseSchema>
export type PortPopoutPositionRecord = z.infer<typeof portPopoutPositionRecordSchema>
export type PortPopoutPositionSaveRequest = z.infer<typeof portPopoutPositionSaveRequestSchema>
export type PortPopoutPositionGetRequest = z.infer<typeof portPopoutPositionGetRequestSchema>
export type PortPopoutPositionSaveResponse = z.infer<typeof portPopoutPositionSaveResponseSchema>
export type PortPopoutPositionGetResponse = z.infer<typeof portPopoutPositionGetResponseSchema>
export type PortPopoutOpenRequest = z.infer<typeof portPopoutOpenRequestSchema>
export type PortPopoutOpenResponse = z.infer<typeof portPopoutOpenResponseSchema>
export type PortPopoutCloseRequest = z.infer<typeof portPopoutCloseRequestSchema>
export type PortPopoutCloseResponse = z.infer<typeof portPopoutCloseResponseSchema>
export type PortPopoutPinRequest = z.infer<typeof portPopoutPinRequestSchema>
export type PortPopoutPinResponse = z.infer<typeof portPopoutPinResponseSchema>
export type PortPopoutRuntimeRecord = z.infer<typeof portPopoutRuntimeRecordSchema>
export type PortPopoutListResponse = z.infer<typeof portPopoutListResponseSchema>
export type PortPopoutBatchRequest = z.infer<typeof portPopoutBatchRequestSchema>
export type PortPopoutBatchResponse = z.infer<typeof portPopoutBatchResponseSchema>
export type PortPopoutSyncRequest = z.infer<typeof portPopoutSyncRequestSchema>
export type PortPopoutSyncResponse = z.infer<typeof portPopoutSyncResponseSchema>
export type PortPopoutDemoteRequest = z.infer<typeof portPopoutDemoteRequestSchema>
export type PortPopoutDemoteResponse = z.infer<typeof portPopoutDemoteResponseSchema>
export type BrowserPopout = z.infer<typeof browserPopoutSchema>
export type PopoutBridgeMessage = z.infer<typeof popoutBridgeMessageSchema>
export type PopoutScreenEvent = z.infer<typeof popoutScreenEventSchema>
export type PopoutThemeSyncPayload = z.infer<typeof popoutThemeSyncPayloadSchema>
export type MonitorTool = z.infer<typeof monitorToolSchema>
export type MonitorWindowState = z.infer<typeof monitorWindowStateSchema>
export type ToolMonitorCard = z.infer<typeof toolMonitorCardSchema>
export type MonitorSnapshot = z.infer<typeof monitorSnapshotSchema>
export type MonitorPopoutLayout = z.infer<typeof monitorPopoutLayoutSchema>
export type MonitorPopout = z.infer<typeof monitorPopoutSchema>
export type ParserStrategy = z.infer<typeof parserStrategySchema>
export type ParserDescriptor = z.infer<typeof parserDescriptorSchema>
export type ParseSession = z.infer<typeof parseSessionSchema>
export type CliOutputEvent = z.infer<typeof cliOutputEventSchema>
export type CliEventPayload = z.infer<typeof cliEventPayloadSchema>
export type Skill = z.infer<typeof skillSchema>
export type SkillLoadError = z.infer<typeof skillLoadErrorSchema>
export type SkillListStreamPayload = z.infer<typeof skillListStreamPayloadSchema>
export type SkillEditorScriptLanguage = z.infer<typeof skillEditorScriptLanguageSchema>
export type SkillEditorBuffer = z.infer<typeof skillEditorBufferSchema>
export type SkillValidationResult = z.infer<typeof skillValidationResultSchema>
export type SkillTemplate = z.infer<typeof skillTemplateSchema>
export type CsvTaskRow18 = z.infer<typeof csvTaskRow18Schema>
export type CsvFileGroup = z.infer<typeof csvFileGroupSchema>
export type CsvDriverState = z.infer<typeof csvDriverStateSchema>
export type CsvReloadSummary = z.infer<typeof csvReloadSummarySchema>
export type CsvRowStreamPayload = z.infer<typeof csvRowStreamPayloadSchema>
export type CsvLaunchSession = z.infer<typeof csvLaunchSessionSchema>
export type CsvSessionEvent = z.infer<typeof csvSessionEventSchema>
export type CodexMarker = z.infer<typeof codexMarkerSchema>
export type ShimManifest = z.infer<typeof shimManifestSchema>
export type ShimFrame = z.infer<typeof shimFrameSchema>
export type ShimControlFrame = z.infer<typeof shimControlFrameSchema>
export type ProgressDataPoint = z.infer<typeof progressDataPointSchema>
export type CommandPaletteEntry = z.infer<typeof commandPaletteEntrySchema>
export type CommandHistoryEntry = z.infer<typeof commandHistoryEntrySchema>
export type CustomCommand = z.infer<typeof customCommandSchema>
export type CustomCommandListResponse = z.infer<typeof customCommandListResponseSchema>
export type CustomCommandSaveResult = z.infer<typeof customCommandSaveResultSchema>
export type CommandResolvedUri = z.infer<typeof commandResolvedUriSchema>
export type CommandRegisterOsProtocolResult = z.infer<typeof commandRegisterOsProtocolResultSchema>
export type DrawerState = z.infer<typeof drawerStateSchema>
export type DrawerSlot = z.infer<typeof drawerSlotSchema>
export type DrawerLayoutRecord = z.infer<typeof drawerLayoutRecordSchema>
export type DashboardWidgetId = z.infer<typeof dashboardWidgetIdSchema>
export type DashboardBreakpoint = z.infer<typeof dashboardBreakpointSchema>
export type DashboardGridItem = z.infer<typeof dashboardGridItemSchema>
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>
export type DashboardLayoutResponse = z.infer<typeof dashboardLayoutResponseSchema>
export type DashboardSaveLayoutResult = z.infer<typeof dashboardSaveLayoutResultSchema>
export type DashboardListPresetsResponse = z.infer<typeof dashboardListPresetsResponseSchema>
export type DashboardMorphWidgetToDrawerResult = z.infer<typeof dashboardMorphWidgetToDrawerResultSchema>
export type ProcessViewMode = z.infer<typeof processViewModeSchema>
export type ProcessTreeNode = z.infer<typeof processTreeNodeSchema>
export type TreemapNode = z.infer<typeof treemapNodeSchema>
export type TreemapLayout = z.infer<typeof treemapLayoutSchema>
export type ProcessBatchAction = z.infer<typeof processBatchActionSchema>
export type ProcessBatchRequest = z.infer<typeof processBatchRequestSchema>
export type ProcessBatchTagArgs = z.infer<typeof processBatchTagArgsSchema>
export type ProcessBatchResult = z.infer<typeof processBatchResultSchema>
export type ProcessBatchProgress = z.infer<typeof processBatchProgressSchema>
export type ProcessBatchStartResponse = z.infer<typeof processBatchStartResponseSchema>
export type ProcessBatchJobRequest = z.infer<typeof processBatchJobRequestSchema>
export type ProcessBatchCancelResponse = z.infer<typeof processBatchCancelResponseSchema>
export type ProcessBatchUndoResponse = z.infer<typeof processBatchUndoResponseSchema>
export type WindowThumbnailViewMode = z.infer<typeof windowThumbnailViewModeSchema>
export type ThumbnailWallEntry = z.infer<typeof thumbnailWallEntrySchema>
export type ThumbnailWallViewport = z.infer<typeof thumbnailWallViewportSchema>
export type ThumbnailBatchRequest = z.infer<typeof thumbnailBatchRequestSchema>
export type ThumbnailRefreshRequest = z.infer<typeof thumbnailRefreshRequestSchema>
export type ThumbnailBatchResponse = z.infer<typeof thumbnailBatchResponseSchema>
export type ThumbnailWindowGroup = z.infer<typeof thumbnailWindowGroupSchema>
export type ThumbnailGroupsResponse = z.infer<typeof thumbnailGroupsResponseSchema>
export type ThumbnailWindowAliasRequest = z.infer<typeof thumbnailWindowAliasRequestSchema>
export type ThumbnailWindowAliasResponse = z.infer<typeof thumbnailWindowAliasResponseSchema>
export type ThumbnailViewportConfigResponse = z.infer<typeof thumbnailViewportConfigResponseSchema>
export type WindowBatchAction = z.infer<typeof windowBatchActionSchema>
export type WindowBatchRequest = z.infer<typeof windowBatchRequestSchema>
export type WindowBatchResult = z.infer<typeof windowBatchResultSchema>
export type WindowBatchProgress = z.infer<typeof windowBatchProgressSchema>
export type WindowBatchStartResponse = z.infer<typeof windowBatchStartResponseSchema>
export type WindowBatchJobRequest = z.infer<typeof windowBatchJobRequestSchema>
export type WindowBatchCancelResponse = z.infer<typeof windowBatchCancelResponseSchema>
export type WindowBatchUndoResponse = z.infer<typeof windowBatchUndoResponseSchema>
export type VirtualDesktop = z.infer<typeof virtualDesktopSchema>
export type VirtualDesktopListResponse = z.infer<typeof virtualDesktopListResponseSchema>
export type R8MonitorInfo = z.infer<typeof r8MonitorInfoSchema>
export type R8MonitorsResponse = z.infer<typeof r8MonitorsResponseSchema>
export type WindowVdWatchEventType = z.infer<typeof windowVdWatchEventTypeSchema>
export type WindowVdWatchPayload = z.infer<typeof windowVdWatchPayloadSchema>
export type WindowVdInfo = z.infer<typeof windowVdInfoSchema>
export type WindowVdInfoRequest = z.infer<typeof windowVdInfoRequestSchema>
export type WindowVdInfoResponse = z.infer<typeof windowVdInfoResponseSchema>
export type MoveWindowToDesktopRequest = z.infer<typeof moveWindowToDesktopRequestSchema>
export type MoveWindowToDesktopResponse = z.infer<typeof moveWindowToDesktopResponseSchema>
export type MoveWindowToMonitorRequest = z.infer<typeof moveWindowToMonitorRequestSchema>
export type MoveWindowToMonitorResponse = z.infer<typeof moveWindowToMonitorResponseSchema>
export type WindowLayoutPreset = z.infer<typeof windowLayoutPresetSchema>
export type WindowLayoutSaveRequest = z.infer<typeof windowLayoutSaveRequestSchema>
export type WindowLayoutSaveResponse = z.infer<typeof windowLayoutSaveResponseSchema>
export type WindowLayoutListResponse = z.infer<typeof windowLayoutListResponseSchema>
export type WindowLayoutApplyRequest = z.infer<typeof windowLayoutApplyRequestSchema>
export type WindowLayoutApplyResponse = z.infer<typeof windowLayoutApplyResponseSchema>
export type StatusTileId = z.infer<typeof statusTileIdSchema>
export type StatusBadgeType = z.infer<typeof statusBadgeTypeSchema>
export type StatusTile = z.infer<typeof statusTileSchema>
export type StatusbarConfig = z.infer<typeof statusbarConfigSchema>
export type StatusbarResetRequest = z.infer<typeof statusbarResetRequestSchema>
export type ThemeDecorationConfig = z.infer<typeof themeDecorationConfigSchema>
export type CustomSvgEntry = z.infer<typeof customSvgEntrySchema>
export type ThemeDecorationListResponse = z.infer<typeof themeDecorationListResponseSchema>
export type CustomSvgUploadRequest = z.infer<typeof customSvgUploadRequestSchema>
export type CustomSvgUploadResponse = z.infer<typeof customSvgUploadResponseSchema>
export type CustomSvgListResponse = z.infer<typeof customSvgListResponseSchema>
export type CustomSvgRemoveRequest = z.infer<typeof customSvgRemoveRequestSchema>
export type CustomSvgRemoveResponse = z.infer<typeof customSvgRemoveResponseSchema>
export type ThemeSoundConfig = z.infer<typeof themeSoundConfigSchema>
export type ThemeSoundConfigGetRequest = z.infer<typeof themeSoundConfigGetRequestSchema>
export type ThemeSoundConfigResponse = z.infer<typeof themeSoundConfigResponseSchema>
export type FusedSignal = z.infer<typeof fusedSignalSchema>
export type InjectResult = z.infer<typeof injectResultSchema>
export type QueueStats = z.infer<typeof queueStatsSchema>
export type TaskQueueEngine = z.infer<typeof taskQueueEngineSchema>
export type TaskQueueStorageStatus = z.infer<typeof taskQueueStorageStatusSchema>
export type TaskStateTransition = z.infer<typeof taskStateTransitionSchema>
export type TaskStateStreamPayload = z.infer<typeof taskStateStreamPayloadSchema>
export type TaskResultExportFormat = z.infer<typeof taskResultExportFormatSchema>
export type TaskResultExportRequest = z.infer<typeof taskResultExportRequestSchema>
export type TaskResultExportPayload = z.infer<typeof taskResultExportPayloadSchema>
export type TaskResultExportResult = z.infer<typeof taskResultExportResultSchema>
export type RecordingSession = z.infer<typeof recordingSessionSchema>
export type RecoveryReport = z.infer<typeof recoveryReportSchema>
export type DirtyKind = z.infer<typeof dirtyKindSchema>
export type DirtyFinding = z.infer<typeof dirtyFindingSchema>
export type RecoverySnapshot = z.infer<typeof recoverySnapshotSchema>
export type RecoveryCheckDirtyResponse = z.infer<typeof recoveryCheckDirtyResponseSchema>
export type RecoveryRestoreStateRequest = z.infer<typeof recoveryRestoreStateRequestSchema>
export type RecoveryDismissRequest = z.infer<typeof recoveryDismissRequestSchema>
export type RecoveryDismissResponse = z.infer<typeof recoveryDismissResponseSchema>
export type ReplayState = z.infer<typeof replayStateSchema>
export type GraphSnapshot = z.infer<typeof graphSnapshotSchema>
export type GraphSlice = z.infer<typeof graphSliceSchema>
export type GraphSavedSnapshot = z.infer<typeof graphSavedSnapshotSchema>
export type GraphExportResult = z.infer<typeof graphExportResultSchema>
export type AttachedTopologyFavorite = z.infer<typeof attachedTopologyFavoriteSchema>
export type AttachedTopologyFavoriteChangeRequest = z.infer<typeof attachedTopologyFavoriteChangeRequestSchema>
export type AttachedTopologyFavoriteChangeResult = z.infer<typeof attachedTopologyFavoriteChangeResultSchema>
export type AttachedTopologyRequest = z.infer<typeof attachedTopologyRequestSchema>
export type AttachedTopologyResult = z.infer<typeof attachedTopologyResultSchema>
export type FlowRequest = z.infer<typeof flowRequestSchema>
export type FlowSnapshot = z.infer<typeof flowSnapshotSchema>
export type FlowStats = z.infer<typeof flowStatsSchema>
export type FlowWarning = z.infer<typeof flowWarningSchema>
export type FlowExportResult = z.infer<typeof flowExportResultSchema>
export type FlowEventStreamRequest = z.infer<typeof flowEventStreamRequestSchema>
export type FlowEventStreamUnsubscribeRequest = z.infer<typeof flowEventStreamUnsubscribeRequestSchema>
export type FlowEventStreamResponse = z.infer<typeof flowEventStreamResponseSchema>
export type FlowEventStreamPayload = z.infer<typeof flowEventStreamPayloadSchema>
export type ProcessTagColor = z.infer<typeof processTagColorSchema>
export type ProcessTag = z.infer<typeof processTagSchema>
export type ProcessTagSetRequest = z.infer<typeof processTagSetRequestSchema>
export type ProcessTagRemoveRequest = z.infer<typeof processTagRemoveRequestSchema>
export type ProcessTagsListResponse = z.infer<typeof processTagsListResponseSchema>
export type ProcessTagsImportResponse = z.infer<typeof processTagsImportResponseSchema>
export type ProcessHistoryPoint = z.infer<typeof processHistoryPointSchema>
export type ProcessHistory = z.infer<typeof processHistorySchema>
export type ProcessHistoryBatchResponse = z.infer<typeof processHistoryBatchResponseSchema>
export type Locale = z.infer<typeof localeSchema>
export type LocaleManifest = z.infer<typeof localeManifestSchema>
export type LocaleGetResponse = z.infer<typeof localeGetResponseSchema>
export type LocaleSetResponse = z.infer<typeof localeSetResponseSchema>
export type LocaleListResponse = z.infer<typeof localeListResponseSchema>
export type LocaleReloadResponse = z.infer<typeof localeReloadResponseSchema>
export type A11yFocusRingThickness = z.infer<typeof a11yFocusRingThicknessSchema>
export type A11yPrefs = z.infer<typeof a11yPrefsSchema>
export type A11yOsPrefs = z.infer<typeof a11yOsPrefsSchema>
export type A11yImpact = z.infer<typeof a11yImpactSchema>
export type A11yAxeViolation = z.infer<typeof a11yAxeViolationSchema>
export type A11yContrastFailure = z.infer<typeof a11yContrastFailureSchema>
export type A11ySelfCheckResult = z.infer<typeof a11ySelfCheckResultSchema>
export type IconLibrary = z.infer<typeof iconLibrarySchema>
export type IconResolve = z.infer<typeof iconResolveSchema>
export type IconResolveRequest = z.infer<typeof iconResolveRequestSchema>
export type IconResolveResponse = z.infer<typeof iconResolveResponseSchema>
export type IconLibraryManifest = z.infer<typeof iconLibraryManifestSchema>
export type IconListLibrariesResponse = z.infer<typeof iconListLibrariesResponseSchema>
export type SecurityTierLevel = z.infer<typeof securityTierLevelSchema>
export type SecurityTier = z.infer<typeof securityTierSchema>
export type BlocklistEntry = z.infer<typeof blocklistEntrySchema>
export type PublicBannerState = z.infer<typeof publicBannerStateSchema>
export type StatusAggregate = z.infer<typeof statusAggregateSchema>
export type TaskRun = z.infer<typeof taskRunSchema>
export type DagSnapshot = z.infer<typeof dagSnapshotSchema>
export type ToolDetectResult = z.infer<typeof toolDetectResultSchema>
export type WatchdogStatus = z.infer<typeof watchdogStatusSchema>
export type WatchdogEvent = z.infer<typeof watchdogEventSchema>
export type WatchdogEventStreamPayload = z.infer<typeof watchdogEventStreamPayloadSchema>
export type BackupCategory = z.infer<typeof backupCategorySchema>
export type BackupManifest = z.infer<typeof backupManifestSchema>
export type BackupSchedule = z.infer<typeof backupScheduleSchema>
export type RestorePlan = z.infer<typeof restorePlanSchema>
export type RestoreResult = z.infer<typeof restoreResultSchema>
export type BackupBundle = z.infer<typeof backupBundleSchema>
export type DiagnosticSection = z.infer<typeof diagnosticSectionSchema>
export type DiagnosticPackOptions = z.infer<typeof diagnosticPackOptionsSchema>
export type DiagnosticPackManifest = z.infer<typeof diagnosticPackManifestSchema>
export type DiagnosticPreview = z.infer<typeof diagnosticPreviewSchema>
export type DiagnosticRedactionRule = z.infer<typeof diagnosticRedactionRuleSchema>
export type DataOwnershipPathSummary = z.infer<typeof dataOwnershipPathSummarySchema>
export type DataOwnershipListPathsResponse = z.infer<typeof dataOwnershipListPathsResponseSchema>
export type DataOwnershipListEntriesRequest = z.infer<typeof dataOwnershipListEntriesRequestSchema>
export type DataOwnershipListEntriesResponse = z.infer<typeof dataOwnershipListEntriesResponseSchema>
export type DataOwnershipExportAllRequest = z.infer<typeof dataOwnershipExportAllRequestSchema>
export type SensitivePermissionOperation = z.infer<typeof sensitivePermissionOperationSchema>
export type PermissionTtlGrant = z.infer<typeof permissionTtlGrantSchema>
export type PermissionPolicy = z.infer<typeof permissionPolicySchema>
export type PermissionCheckResult = z.infer<typeof permissionCheckResultSchema>
export type PermissionExpiryStreamPayload = z.infer<typeof permissionExpiryStreamPayloadSchema>
export type CloudSyncStatus = z.infer<typeof cloudSyncStatusSchema>
export type CloudSyncResult = z.infer<typeof cloudSyncResultSchema>
export type OcrCapabilities = z.infer<typeof ocrCapabilitiesSchema>
export type OcrDisabledResponse = z.infer<typeof ocrDisabledResponseSchema>
export type SchemaMeta = z.infer<typeof schemaMetaSchema>
export type IpcSchemaPair = z.infer<typeof ipcSchemaPairSchema>
export type SchemaValidationIssue = z.infer<typeof schemaValidationIssueSchema>
export type SchemaValidationVerdict = z.infer<typeof schemaValidationVerdictSchema>
export type SchemaMigrationStep = z.infer<typeof schemaMigrationStepSchema>
export type ZodListSchemasResponse = z.infer<typeof zodListSchemasResponseSchema>
export type ZodValidatePayloadRequest = z.infer<typeof zodValidatePayloadRequestSchema>
export type ZodValidatePayloadResponse = z.infer<typeof zodValidatePayloadResponseSchema>
export type ZodMigrationStatusResponse = z.infer<typeof zodMigrationStatusResponseSchema>

export const r8RuntimeSchemaRegistry = {
  SchemaMeta: schemaMetaSchema,
  IpcSchemaPair: ipcSchemaPairSchema,
  SchemaValidationIssue: schemaValidationIssueSchema,
  SchemaValidationVerdict: schemaValidationVerdictSchema,
  SchemaMigrationStep: schemaMigrationStepSchema,
  ZodListSchemasResponse: zodListSchemasResponseSchema,
  ZodValidatePayloadRequest: zodValidatePayloadRequestSchema,
  ZodValidatePayloadResponse: zodValidatePayloadResponseSchema,
  ZodMigrationStatusResponse: zodMigrationStatusResponseSchema,
  R8IpcChannelDefinition: r8IpcChannelDefinitionSchema,
  RateLimitClass: rateLimitClassSchema,
  RateLimitChannelRegistration: channelRegistrationSchema,
  RateLimitVerdict: rateLimitVerdictSchema,
  RateLimitStats: rateLimitStatsSchema,
  RateLimitStatsResponse: rateLimitStatsResponseSchema,
  RateLimitOverrideRequest: rateLimitOverrideRequestSchema,
  RateLimitOverrideResponse: rateLimitOverrideResponseSchema,
  ObservabilityMetricKind: metricKindSchema,
  ObservabilityMetricSample: metricSampleSchema,
  ObservabilitySnapshot: observabilitySnapshotSchema,
  ObservabilitySnapshotRequest: observabilitySnapshotRequestSchema,
  ObservabilityConfig: observabilityConfigSchema,
  ObservabilityConfigureResponse: observabilityConfigureResponseSchema,
  ObservabilityExportSnapshotRequest: observabilityExportSnapshotRequestSchema,
  ObservabilityExportSnapshotResponse: observabilityExportSnapshotResponseSchema,
  ObservabilityDiagnosticPackRequest: observabilityDiagnosticPackRequestSchema,
  ObservabilityDiagnosticPackResponse: observabilityDiagnosticPackResponseSchema,
  ObservabilitySubscribeRequest: observabilitySubscribeRequestSchema,
  ObservabilitySubscribeResponse: observabilitySubscribeResponseSchema,
  ObservabilityUnsubscribeRequest: observabilityUnsubscribeRequestSchema,
  ObservabilityUnsubscribeResponse: observabilityUnsubscribeResponseSchema,
  R8Bounds: r8BoundsSchema,
  ContractOnlyResponse: r8ContractOnlyResponseSchema,
  PortPopoutPositionRecord: portPopoutPositionRecordSchema,
  PortPopoutPositionSaveRequest: portPopoutPositionSaveRequestSchema,
  PortPopoutPositionGetRequest: portPopoutPositionGetRequestSchema,
  PortPopoutPositionSaveResponse: portPopoutPositionSaveResponseSchema,
  PortPopoutPositionGetResponse: portPopoutPositionGetResponseSchema,
  PortPopoutOpenRequest: portPopoutOpenRequestSchema,
  PortPopoutOpenResponse: portPopoutOpenResponseSchema,
  PortPopoutCloseRequest: portPopoutCloseRequestSchema,
  PortPopoutCloseResponse: portPopoutCloseResponseSchema,
  PortPopoutPinRequest: portPopoutPinRequestSchema,
  PortPopoutPinResponse: portPopoutPinResponseSchema,
  PortPopoutRuntimeRecord: portPopoutRuntimeRecordSchema,
  PortPopoutListResponse: portPopoutListResponseSchema,
  PortPopoutBatchRequest: portPopoutBatchRequestSchema,
  PortPopoutBatchResponse: portPopoutBatchResponseSchema,
  PortPopoutSyncRequest: portPopoutSyncRequestSchema,
  PortPopoutSyncResponse: portPopoutSyncResponseSchema,
  PortPopoutDemoteRequest: portPopoutDemoteRequestSchema,
  PortPopoutDemoteResponse: portPopoutDemoteResponseSchema,
  BrowserPopout: browserPopoutSchema,
  PopoutCreateRequest: popoutCreateRequestSchema,
  PanelPopoutSurface: panelPopoutSurfaceSchema,
  PopoutBridgeMessage: popoutBridgeMessageSchema,
  PopoutScreenEvent: popoutScreenEventSchema,
  PopoutThemeSyncPayload: popoutThemeSyncPayloadSchema,
  DrawerSlot: drawerSlotSchema,
  MonitorWindowState: monitorWindowStateSchema,
  ToolMonitorCard: toolMonitorCardSchema,
  MonitorSnapshot: monitorSnapshotSchema,
  MonitorPopout: monitorPopoutSchema,
  DrawerState: drawerStateSchema,
  DrawerLayoutRecord: drawerLayoutRecordSchema,
  DrawerSaveLayoutRequest: drawerSaveLayoutRequestSchema,
  DrawerLoadLayoutRequest: drawerLoadLayoutRequestSchema,
  DrawerMorphToPopoutRequest: drawerMorphToPopoutRequestSchema,
  DrawerMorphToPopoutResult: drawerMorphToPopoutResultSchema,
  DrawerMorphFromPopoutRequest: drawerMorphFromPopoutRequestSchema,
  DrawerMorphFromPopoutResult: drawerMorphFromPopoutResultSchema,
  CommandType: commandTypeSchema,
  CommandPaletteEntry: commandPaletteEntrySchema,
  CommandHistoryEntry: commandHistoryEntrySchema,
  CustomCommand: customCommandSchema,
  CustomCommandListResponse: customCommandListResponseSchema,
  CustomCommandSaveResult: customCommandSaveResultSchema,
  CommandParsedUri: commandParsedUriSchema,
  CommandResolveUriRequest: commandResolveUriRequestSchema,
  CommandResolvedUri: commandResolvedUriSchema,
  CommandRegisterOsProtocolRequest: commandRegisterOsProtocolRequestSchema,
  CommandRegisterOsProtocolResult: commandRegisterOsProtocolResultSchema,
  DashboardWidgetId: dashboardWidgetIdSchema,
  DashboardBreakpoint: dashboardBreakpointSchema,
  DashboardGridItem: dashboardGridItemSchema,
  DashboardLayout: dashboardLayoutSchema,
  DashboardGetLayoutRequest: dashboardGetLayoutRequestSchema,
  DashboardLayoutResponse: dashboardLayoutResponseSchema,
  DashboardSaveLayoutResult: dashboardSaveLayoutResultSchema,
  DashboardListPresetsResponse: dashboardListPresetsResponseSchema,
  DashboardDeletePresetRequest: dashboardDeletePresetRequestSchema,
  DashboardResetRequest: dashboardResetRequestSchema,
  DashboardMorphWidgetToDrawerRequest: dashboardMorphWidgetToDrawerRequestSchema,
  DashboardMorphWidgetToDrawerResult: dashboardMorphWidgetToDrawerResultSchema,
  ProcessViewMode: processViewModeSchema,
  ProcessTreeNode: processTreeNodeSchema,
  ProcessTreeRequest: processTreeRequestSchema,
  ProcessTreeChildrenRequest: processTreeChildrenRequestSchema,
  ProcessTreemapDataRequest: processTreemapDataRequestSchema,
  ProcessViewModeSetRequest: processViewModeSetRequestSchema,
  ProcessViewModeSetResult: processViewModeSetResultSchema,
  TreemapNode: treemapNodeSchema,
  TreemapLayout: treemapLayoutSchema,
  ProcessBatchAction: processBatchActionSchema,
  ProcessBatchRequest: processBatchRequestSchema,
  ProcessBatchTagArgs: processBatchTagArgsSchema,
  ProcessBatchResult: processBatchResultSchema,
  ProcessBatchProgress: processBatchProgressSchema,
  ProcessBatchStartResponse: processBatchStartResponseSchema,
  ProcessBatchJobRequest: processBatchJobRequestSchema,
  ProcessBatchCancelResponse: processBatchCancelResponseSchema,
  ProcessBatchUndoResponse: processBatchUndoResponseSchema,
  WindowThumbnailViewMode: windowThumbnailViewModeSchema,
  ThumbnailWallEntry: thumbnailWallEntrySchema,
  ThumbnailWallViewport: thumbnailWallViewportSchema,
  ThumbnailSize: thumbnailSizeSchema,
  ThumbnailBatchRequest: thumbnailBatchRequestSchema,
  ThumbnailRefreshRequest: thumbnailRefreshRequestSchema,
  ThumbnailBatchResponse: thumbnailBatchResponseSchema,
  ThumbnailWindowGroup: thumbnailWindowGroupSchema,
  ThumbnailGroupsResponse: thumbnailGroupsResponseSchema,
  ThumbnailWindowAliasRequest: thumbnailWindowAliasRequestSchema,
  ThumbnailWindowAliasResponse: thumbnailWindowAliasResponseSchema,
  ThumbnailViewportConfigResponse: thumbnailViewportConfigResponseSchema,
  WindowBatchAction: windowBatchActionSchema,
  WindowBatchRequest: windowBatchRequestSchema,
  WindowBatchResult: windowBatchResultSchema,
  WindowBatchProgress: windowBatchProgressSchema,
  WindowBatchStartResponse: windowBatchStartResponseSchema,
  WindowBatchJobRequest: windowBatchJobRequestSchema,
  WindowBatchCancelResponse: windowBatchCancelResponseSchema,
  WindowBatchUndoResponse: windowBatchUndoResponseSchema,
  VirtualDesktop: virtualDesktopSchema,
  VirtualDesktopListResponse: virtualDesktopListResponseSchema,
  R8MonitorInfo: r8MonitorInfoSchema,
  R8MonitorsResponse: r8MonitorsResponseSchema,
  WindowVdWatchEventType: windowVdWatchEventTypeSchema,
  WindowVdWatchPayload: windowVdWatchPayloadSchema,
  WindowVdInfo: windowVdInfoSchema,
  WindowVdInfoRequest: windowVdInfoRequestSchema,
  WindowVdInfoResponse: windowVdInfoResponseSchema,
  MoveWindowToDesktopRequest: moveWindowToDesktopRequestSchema,
  MoveWindowToDesktopResponse: moveWindowToDesktopResponseSchema,
  MoveWindowToMonitorRequest: moveWindowToMonitorRequestSchema,
  MoveWindowToMonitorResponse: moveWindowToMonitorResponseSchema,
  WindowLayoutPreset: windowLayoutPresetSchema,
  WindowLayoutSaveRequest: windowLayoutSaveRequestSchema,
  WindowLayoutSaveResponse: windowLayoutSaveResponseSchema,
  WindowLayoutListResponse: windowLayoutListResponseSchema,
  WindowLayoutApplyRequest: windowLayoutApplyRequestSchema,
  WindowLayoutApplyResponse: windowLayoutApplyResponseSchema,
  ProcessTagColor: processTagColorSchema,
  ProcessTag: processTagSchema,
  ProcessTagSetRequest: processTagSetRequestSchema,
  ProcessTagRemoveRequest: processTagRemoveRequestSchema,
  ProcessTagsListResponse: processTagsListResponseSchema,
  ProcessTagsImportRequest: processTagsImportRequestSchema,
  ProcessTagsImportResponse: processTagsImportResponseSchema,
  ProcessHistoryPoint: processHistoryPointSchema,
  ProcessHistory: processHistorySchema,
  ProcessHistoryRequest: processHistoryRequestSchema,
  ProcessHistoryBatchRequest: processHistoryBatchRequestSchema,
  ProcessHistoryBatchResponse: processHistoryBatchResponseSchema,
  Locale: localeSchema,
  LocaleManifest: localeManifestSchema,
  LocaleGetResponse: localeGetResponseSchema,
  LocaleSetRequest: localeSetRequestSchema,
  LocaleSetResponse: localeSetResponseSchema,
  LocaleListResponse: localeListResponseSchema,
  LocaleReloadResponse: localeReloadResponseSchema,
  A11yFocusRingThickness: a11yFocusRingThicknessSchema,
  A11yPrefs: a11yPrefsSchema,
  A11yOsPrefs: a11yOsPrefsSchema,
  A11yImpact: a11yImpactSchema,
  A11yAxeViolation: a11yAxeViolationSchema,
  A11yContrastFailure: a11yContrastFailureSchema,
  A11ySelfCheckResult: a11ySelfCheckResultSchema,
  IconLibrary: iconLibrarySchema,
  IconToken: iconTokenSchema,
  IconResolve: iconResolveSchema,
  IconResolveRequest: iconResolveRequestSchema,
  IconResolveResponse: iconResolveResponseSchema,
  IconLibraryManifest: iconLibraryManifestSchema,
  IconListLibrariesResponse: iconListLibrariesResponseSchema,
  ThemeDecorationKind: themeDecorationKindSchema,
  ThemeDecorationPosition: themeDecorationPositionSchema,
  ThemeDecorationBlendMode: themeDecorationBlendModeSchema,
  ThemeDecorationConfig: themeDecorationConfigSchema,
  CustomSvgEntry: customSvgEntrySchema,
  CustomSvgUploadRequest: customSvgUploadRequestSchema,
  CustomSvgUploadResponse: customSvgUploadResponseSchema,
  CustomSvgListResponse: customSvgListResponseSchema,
  CustomSvgRemoveRequest: customSvgRemoveRequestSchema,
  CustomSvgRemoveResponse: customSvgRemoveResponseSchema,
  ThemeDecorationListResponse: themeDecorationListResponseSchema,
  ThemeSoundConfig: themeSoundConfigSchema,
  ThemeSoundConfigGetRequest: themeSoundConfigGetRequestSchema,
  ThemeSoundConfigResponse: themeSoundConfigResponseSchema,
  SecurityTierLevel: securityTierLevelSchema,
  SecurityTier: securityTierSchema,
  BlocklistEntry: blocklistEntrySchema,
  PublicBannerState: publicBannerStateSchema,
  StatusAggregate: statusAggregateSchema,
  StatusbarConfig: statusbarConfigSchema,
  StatusbarSetConfigRequest: statusbarSetConfigRequestSchema,
  StatusbarResetRequest: statusbarResetRequestSchema,
  ParserDescriptor: parserDescriptorSchema,
  ParseSession: parseSessionSchema,
  StatusTile: statusTileSchema,
  CliOutputEvent: cliOutputEventSchema,
  CliEventPayload: cliEventPayloadSchema,
  CodexMarker: codexMarkerSchema,
  ShimManifest: shimManifestSchema,
  ShimFrame: shimFrameSchema,
  ShimControlFrame: shimControlFrameSchema,
  ProgressDataPoint: progressDataPointSchema,
  ClaudeStreamEvent: claudeStreamEventSchema,
  ClaudeCostSummaryRequest: claudeCostSummaryRequestSchema,
  ClaudeCostSummary: claudeCostSummarySchema,
  ClaudeStreamJsonRestartCommand: claudeStreamJsonRestartCommandSchema,
  ClaudeStreamJsonRestartRequest: claudeStreamJsonRestartRequestSchema,
  ClaudeStreamJsonRestartConfirmRequest: claudeStreamJsonRestartConfirmRequestSchema,
  ClaudeStreamJsonRestartRecord: claudeStreamJsonRestartRecordSchema,
  GeminiPatternKind: geminiPatternKindSchema,
  GeminiPatternRuleInput: geminiPatternRuleInputSchema,
  GeminiParseState: geminiParseStateSchema,
  GeminiPatternStatRequest: geminiPatternStatRequestSchema,
  GeminiPatternStat: geminiPatternStatSchema,
  GeminiRuleReloadRequest: geminiRuleReloadRequestSchema,
  GeminiRuleReloadResponse: geminiRuleReloadResponseSchema,
  TitleTool: titleToolSchema,
  WindowTitleSignalTool: windowTitleSignalToolSchema,
  WindowTitleSignalPhase: windowTitleSignalPhaseSchema,
  TitlePatternRule: titlePatternRuleSchema,
  TitleSample: titleSampleSchema,
  CursorCopilotSignal: cursorCopilotSignalSchema,
  CursorCopilotStatusRequest: cursorCopilotStatusRequestSchema,
  CursorCopilotStatus: cursorCopilotStatusSchema,
  TitleRuleReloadRequest: titleRuleReloadRequestSchema,
  TitleRuleReloadResponse: titleRuleReloadResponseSchema,
  ToolName: toolNameSchema,
  ToolDetectResult: toolDetectResultSchema,
  ToolDetectionState: toolDetectionStateSchema,
  ToolDetectAllRequest: toolDetectAllRequestSchema,
  ToolDetectOneRequest: toolDetectOneRequestSchema,
  ToolOverrideRequest: toolOverrideRequestSchema,
  ToolOverrideResponse: toolOverrideResponseSchema,
  ToolClearOverrideRequest: toolClearOverrideRequestSchema,
  ToolClearOverrideResponse: toolClearOverrideResponseSchema,
  TaskStateTransition: taskStateTransitionSchema,
  TaskStateStreamPayload: taskStateStreamPayloadSchema,
  TaskRun: taskRunSchema,
  TaskResultExportRequest: taskResultExportRequestSchema,
  TaskResultExportPayload: taskResultExportPayloadSchema,
  TaskResultExportResult: taskResultExportResultSchema,
  QueueStats: queueStatsSchema,
  TaskQueueEngine: taskQueueEngineSchema,
  TaskQueueStorageStatus: taskQueueStorageStatusSchema,
  CsvTaskRow18: csvTaskRow18Schema,
  CsvHeaderValidationResult: csvHeaderValidationResultSchema,
  CsvFileGroup: csvFileGroupSchema,
  CsvDriverState: csvDriverStateSchema,
  CsvSchemaInfo: csvSchemaInfoSchema,
  CsvReloadSummary: csvReloadSummarySchema,
  CsvRowStreamPayload: csvRowStreamPayloadSchema,
  CsvLaunchOptions: csvLaunchOptionsSchema,
  CsvLaunchSession: csvLaunchSessionSchema,
  CsvSessionEvent: csvSessionEventSchema,
  SignalSource: signalSourceSchema,
  SignalSample: signalSampleSchema,
  WeightProfile: weightProfileSchema,
  SignalContribution: signalContributionSchema,
  SignalContributionSnapshot: signalContributionSnapshotSchema,
  FusionConfig: fusionConfigSchema,
  SystemState: systemStateSchema,
  TaskState: taskStateSchema,
  UiState: uiStateSchema,
  StateTransitionEvent: stateTransitionEventSchema,
  InstanceState: instanceStateSchema,
  StateAssertionRule: stateAssertionRuleSchema,
  StateRuleOverrideRequest: stateRuleOverrideRequestSchema,
  MisreportKind: misreportKindSchema,
  MisreportRecord: misreportRecordSchema,
  WeightAdjustment: weightAdjustmentSchema,
  DiagnosticExplain: diagnosticExplainSchema,
  ReportMisreportRequest: reportMisreportRequestSchema,
  MisreportResponse: misreportResponseSchema,
  ListMisreportsRequest: listMisreportsRequestSchema,
  ResetLearnedWeightsRequest: resetLearnedWeightsRequestSchema,
  ResetLearnedWeightsResponse: resetLearnedWeightsResponseSchema,
  FusedSignal: fusedSignalSchema,
  SkillFrontmatter: skillFrontmatterSchema,
  Skill: skillSchema,
  SkillLoadError: skillLoadErrorSchema,
  SkillListStreamPayload: skillListStreamPayloadSchema,
  SkillEditorBuffer: skillEditorBufferSchema,
  SkillValidationResult: skillValidationResultSchema,
  SkillTemplate: skillTemplateSchema,
  CsvTaskRow: csvTaskRowSchema,
  DependencyCondition: dependencyConditionSchema,
  DependencyCombinator: dependencyCombinatorSchema,
  DependencyClause: dependencyClauseSchema,
  ParsedDependency: parsedDependencySchema,
  DagBuildRequest: dagBuildRequestSchema,
  DagAuditEntry: dagAuditEntrySchema,
  DagGraph: dagGraphSchema,
  DagInputNode: dagInputNodeSchema,
  DagNode: dagNodeSchema,
  DagEdge: dagEdgeSchema,
  DagWarning: dagWarningSchema,
  DagSnapshot: dagSnapshotSchema,
  DagCycleError: dagCycleErrorSchema,
  DagExportFormat: dagExportFormatSchema,
  DagExportRequest: dagExportRequestSchema,
  DagExportResult: dagExportResultSchema,
  DagLayerRequest: dagLayerRequestSchema,
  DagReadyRequest: dagReadyRequestSchema,
  DagViewKind: dagViewKindSchema,
  DagEditorValidationError: dagEditorValidationErrorSchema,
  DagEditorPatch: dagEditorPatchSchema,
  DagEditorEdgeHover: dagEditorEdgeHoverSchema,
  DagEditorState: dagEditorStateSchema,
  NodeTemplate: nodeTemplateSchema,
  CsvTemplateListRequest: csvTemplateListRequestSchema,
  CsvSaveTemplateRequest: csvSaveTemplateRequestSchema,
  CsvDeleteTemplateRequest: csvDeleteTemplateRequestSchema,
  CsvDeleteTemplateResult: csvDeleteTemplateResultSchema,
  CsvExternalChangeEvent: csvExternalChangeEventSchema,
  CsvLockRequest: csvLockRequestSchema,
  CsvLockStatusRequest: csvLockStatusRequestSchema,
  CsvLockStatus: csvLockStatusSchema,
  CsvLockResult: csvLockResultSchema,
  CsvSaveRequest: csvSaveRequestSchema,
  CsvSaveResult: csvSaveResultSchema,
  WatchdogSessionToken: watchdogSessionTokenSchema,
  WatchdogProtocolVersion: watchdogProtocolVersionSchema,
  RpcChannel: rpcChannelSchema,
  WatchdogRpcMethod: watchdogRpcMethodSchema,
  HandshakeMessage: handshakeMessageSchema,
  RpcRequest: rpcRequestSchema,
  RpcResponse: rpcResponseSchema,
  RpcError: rpcErrorSchema,
  SupervisorState: supervisorStateSchema,
  SessionTokenContext: sessionTokenContextSchema,
  WatchdogMarkerFile: watchdogMarkerFileSchema,
  WatchdogChannelDiagnostic: watchdogChannelDiagnosticSchema,
  WatchdogSupervisorStatusValue: watchdogSupervisorStatusValueSchema,
  WatchdogSupervisorStatus: watchdogSupervisorStatusSchema,
  WatchdogSupervisorEventType: watchdogSupervisorEventTypeSchema,
  WatchdogSupervisorEventResult: watchdogSupervisorEventResultSchema,
  WatchdogSupervisorEvent: watchdogSupervisorEventSchema,
  WatchdogSupervisorEventStreamPayload: watchdogSupervisorEventStreamPayloadSchema,
  WatchdogSupervisorRespawnRequest: watchdogSupervisorRespawnRequestSchema,
  WatchdogSupervisorServiceRequest: watchdogSupervisorServiceRequestSchema,
  WatchdogInstance: watchdogInstanceSchema,
  WatchdogStatus: watchdogStatusSchema,
  WatchdogEvent: watchdogEventSchema,
  WatchdogEventStreamPayload: watchdogEventStreamPayloadSchema,
  InjectMode: injectModeSchema,
  InjectScenario: injectScenarioSchema,
  InjectFailureKind: injectFailureKindSchema,
  InjectSelectorKind: injectSelectorKindSchema,
  InjectTarget: injectTargetSchema,
  ResolvedInjectTarget: resolvedInjectTargetSchema,
  InjectWhitelistScope: injectWhitelistScopeSchema,
  InjectWhitelistDuration: injectWhitelistDurationSchema,
  InjectWhitelistEntry: injectWhitelistEntrySchema,
  InjectWhitelistGate: injectWhitelistGateSchema,
  InjectStrictModeGate: injectStrictModeGateSchema,
  InjectStrictModeConfig: injectStrictModeConfigSchema,
  InjectCountdownConfig: injectCountdownConfigSchema,
  InjectCountdownPhase: injectCountdownPhaseSchema,
  InjectCountdownStreamPayload: injectCountdownStreamPayloadSchema,
  InjectResolveTargetInput: injectResolveTargetInputSchema,
  InjectResolveTargetResult: injectResolveTargetResultSchema,
  InjectReadyPoolInstance: injectReadyPoolInstanceSchema,
  InjectAction: injectActionSchema,
  NormalizedInjectAction: normalizedInjectActionSchema,
  InjectDryRunResult: injectDryRunResultSchema,
  InjectResult: injectResultSchema,
  InjectAuditRecord: injectAuditRecordSchema,
  R8Notification: r8NotificationSchema,
  NotificationAggregationConfig: notificationAggregationSchema,
  NotificationChannelConfig: notificationChannelConfigSchema,
  NotificationListRequest: notificationListRequestSchema,
  NotificationInvokeActionRequest: notificationInvokeActionSchema,
  NotificationEmitResponse: notificationEmitResponseSchema,
  PermissionGrant: permissionGrantSchema,
  SensitivePermissionOperation: sensitivePermissionOperationSchema,
  PermissionGrantScope: permissionGrantScopeSchema,
  PermissionTtlGrant: permissionTtlGrantSchema,
  PermissionPolicy: permissionPolicySchema,
  PermissionRequest: permissionRequestSchema,
  PermissionCheckRequest: permissionCheckRequestSchema,
  PermissionCheckResult: permissionCheckResultSchema,
  PermissionRevokeRequest: permissionRevokeRequestSchema,
  PermissionRevokeAllRequest: permissionRevokeAllRequestSchema,
  PermissionRevokeResponse: permissionRevokeResponseSchema,
  PermissionListActiveResponse: permissionListActiveResponseSchema,
  PermissionConfigurePolicyResponse: permissionConfigurePolicyResponseSchema,
  PermissionExpiryStreamPayload: permissionExpiryStreamPayloadSchema,
  BackupLegacyScope: backupLegacyScopeSchema,
  BackupCategory: backupCategorySchema,
  BackupCategoryEntry: backupCategoryEntrySchema,
  BackupManifest: backupManifestSchema,
  BackupSchedule: backupScheduleSchema,
  BackupCreateRequest: backupCreateRequestSchema,
  BackupExportClassifiedRequest: backupExportClassifiedRequestSchema,
  BackupDeleteRequest: backupDeleteRequestSchema,
  RestorePlan: restorePlanSchema,
  RestoreCategoryResult: restoreCategoryResultSchema,
  RestoreResult: restoreResultSchema,
  BackupScheduleResult: backupScheduleResultSchema,
  BackupBundle: backupBundleSchema,
  DiagnosticSection: diagnosticSectionSchema,
  DiagnosticRedactionLevel: diagnosticRedactionLevelSchema,
  DiagnosticScreenshotMode: diagnosticScreenshotModeSchema,
  DiagnosticRuleCategory: diagnosticRuleCategorySchema,
  DiagnosticRedactionRule: diagnosticRedactionRuleSchema,
  DiagnosticPackOptions: diagnosticPackOptionsSchema,
  DiagnosticPackSectionEntry: diagnosticPackSectionEntrySchema,
  DiagnosticPackManifest: diagnosticPackManifestSchema,
  DiagnosticPreviewSection: diagnosticPreviewSectionSchema,
  DiagnosticPreview: diagnosticPreviewSchema,
  DiagnosticScreenshotRequest: diagnosticScreenshotRequestSchema,
  DiagnosticScreenshotResult: diagnosticScreenshotResultSchema,
  DiagnosticRedactionRulesResponse: diagnosticRedactionRulesResponseSchema,
  DiagnosticListPacksResponse: diagnosticListPacksResponseSchema,
  DiagnosticExportRequest: diagnosticExportRequestSchema,
  DataOwnershipRootCategory: dataOwnershipRootCategorySchema,
  DataOwnershipPathKind: dataOwnershipPathKindSchema,
  DataOwnershipPathSummary: dataOwnershipPathSummarySchema,
  DataOwnershipListPathsResponse: dataOwnershipListPathsResponseSchema,
  DataOwnershipListEntriesRequest: dataOwnershipListEntriesRequestSchema,
  DataOwnershipEntry: dataOwnershipEntrySchema,
  DataOwnershipListEntriesResponse: dataOwnershipListEntriesResponseSchema,
  DataOwnershipExportAllRequest: dataOwnershipExportAllRequestSchema,
  CloudProvider: cloudProviderSchema,
  CloudSyncConflictPolicy: cloudSyncConflictPolicySchema,
  CloudSyncDirection: cloudSyncDirectionSchema,
  RemoteSkillManifest: remoteSkillManifestSchema,
  CloudSyncRequest: cloudSyncRequestSchema,
  CloudSyncResult: cloudSyncResultSchema,
  CloudSyncStatus: cloudSyncStatusSchema,
  CloudSyncRemoteListResponse: cloudSyncRemoteListResponseSchema,
  RecordingSession: recordingSessionSchema,
  RecordingStreamKind: recordingStreamKindSchema,
  RecordingSource: recordingSourceSchema,
  RecordingStatus: recordingStatusSchema,
  RecordingFsOp: recordingFsOpSchema,
  RecordingScreenshotRegion: recordingScreenshotRegionSchema,
  RecordingStreamFile: recordingStreamFileSchema,
  RecordingManifest: recordingManifestSchema,
  RecordingEvent: recordingEventSchema,
  RecordingEventStreamPayload: recordingEventStreamPayloadSchema,
  StdoutEvent: stdoutEventSchema,
  StdinEvent: stdinEventSchema,
  ScreenshotEvent: screenshotEventSchema,
  FsEvent: fsEventSchema,
  GitDiffEvent: gitDiffEventSchema,
  RecordingStartRequest: recordingStartRequestSchema,
  LegacyRecordingStartRequest: legacyRecordingStartRequestSchema,
  RecordingStopRequest: recordingStopRequestSchema,
  RecordingListRequest: recordingListRequestSchema,
  RecordingGetManifestRequest: recordingGetManifestRequestSchema,
  RecordingGetEventsRequest: recordingGetEventsRequestSchema,
  RecordingExportAsciinemaRequest: recordingExportAsciinemaRequestSchema,
  RecordingExportZipRequest: recordingExportZipRequestSchema,
  RecordingDeleteRequest: recordingDeleteRequestSchema,
  RecordingExportResult: recordingExportResultSchema,
  RecordingDeleteResult: recordingDeleteResultSchema,
  ReplaySpeedValue: replaySpeedValueSchema,
  ReplaySpeed: replaySpeedSchema,
  ReplayAnchorKind: replayAnchorKindSchema,
  ReplayAnchor: replayAnchorSchema,
  RecordingReplayState: recordingReplayStateSchema,
  AsciinemaCast: asciinemaCastSchema,
  RecordingGetReplayStateRequest: recordingGetReplayStateRequestSchema,
  RecordingGetEventsWindowRequest: recordingGetEventsWindowRequestSchema,
  RecordingGetEventsWindowResult: recordingGetEventsWindowResultSchema,
  RecordingGetCastRequest: recordingGetCastRequestSchema,
  RecordingGetCastResult: recordingGetCastResultSchema,
  RecordingListAnchorsRequest: recordingListAnchorsRequestSchema,
  RecordingListAnchorsResult: recordingListAnchorsResultSchema,
  RecordingGetScreenshotRequest: recordingGetScreenshotRequestSchema,
  RecordingScreenshotResult: recordingScreenshotResultSchema,
  RecordingGetFsSnapshotAtRequest: recordingGetFsSnapshotAtRequestSchema,
  RecordingFsSnapshotResult: recordingFsSnapshotResultSchema,
  GraphKind: graphKindSchema,
  GraphNodeKind: graphNodeKindSchema,
  GraphLayout: graphLayoutSchema,
  GraphExportFormat: graphExportFormatSchema,
  GraphNode: graphNodeSchema,
  GraphEdge: graphEdgeSchema,
  GraphSlice: graphSliceSchema,
  GraphSnapshot: graphSnapshotSchema,
  GraphSaveSnapshotRequest: graphSaveSnapshotRequestSchema,
  GraphSavedSnapshot: graphSavedSnapshotSchema,
  GraphExportRequest: graphExportRequestSchema,
  GraphExportResult: graphExportResultSchema,
  GraphWarmScopeRequest: graphWarmScopeRequestSchema,
  AttachedTopologyFavorite: attachedTopologyFavoriteSchema,
  AttachedTopologyFavoriteChangeRequest: attachedTopologyFavoriteChangeRequestSchema,
  AttachedTopologyFavoriteChangeResult: attachedTopologyFavoriteChangeResultSchema,
  AttachedTopologyRequest: attachedTopologyRequestSchema,
  AttachedTopologyResult: attachedTopologyResultSchema,
  FlowFilter: flowFilterSchema,
  FlowRequest: flowRequestSchema,
  FlowSnapshot: flowSnapshotSchema,
  FlowStats: flowStatsSchema,
  FlowWarning: flowWarningSchema,
  FlowExportRequest: flowExportRequestSchema,
  FlowExportResult: flowExportResultSchema,
  FlowEventStreamRequest: flowEventStreamRequestSchema,
  FlowEventStreamResponse: flowEventStreamResponseSchema,
  FlowEventStreamPayload: flowEventStreamPayloadSchema,
  FlowEventStreamUnsubscribeRequest: flowEventStreamUnsubscribeRequestSchema,
  DirtyKind: dirtyKindSchema,
  DirtySeverity: dirtySeveritySchema,
  DirtyFinding: dirtyFindingSchema,
  RecoveryRecommendedAction: recoveryRecommendedActionSchema,
  RecoverySnapshotReason: recoverySnapshotReasonSchema,
  RecoveryUserChoice: recoveryUserChoiceSchema,
  RecoverySnapshotFile: recoverySnapshotFileSchema,
  RecoverySnapshot: recoverySnapshotSchema,
  RecoveryAppliedAction: recoveryAppliedActionSchema,
  RecoveryReport: recoveryReportSchema,
  AppLifecycleMarker: appLifecycleMarkerSchema,
  RecoveryProbeSummary: recoveryProbeSummarySchema,
  RecoveryCheckDirtyRequest: recoveryCheckDirtyRequestSchema,
  RecoveryCheckDirtyResponse: recoveryCheckDirtyResponseSchema,
  RecoveryRestoreStateRequest: recoveryRestoreStateRequestSchema,
  RecoveryListSnapshotsResponse: recoveryListSnapshotsResponseSchema,
  RecoveryCreateCheckpointRequest: recoveryCreateCheckpointRequestSchema,
  RecoveryDismissRequest: recoveryDismissRequestSchema,
  RecoveryDismissResponse: recoveryDismissResponseSchema,
  ReplayState: replayStateSchema,
  OcrLanguage: ocrLanguageSchema,
  OcrTextBlock: ocrTextBlockSchema,
  OcrRecognizeRequest: ocrRecognizeRequestSchema,
  OcrDisabledResponse: ocrDisabledResponseSchema,
  OcrCapabilities: ocrCapabilitiesSchema,
  OcrSupportedLanguagesResponse: ocrSupportedLanguagesResponseSchema
} as const

export type R8RuntimeSchemaName = keyof typeof r8RuntimeSchemaRegistry

export function assertR8IpcRegistry(
  channels: readonly R8IpcChannelDefinition[] = R8_IPC_CHANNELS
): R8IpcChannelDefinition[] {
  const parsed = z.array(r8IpcChannelDefinitionSchema).parse(channels)
  const names = new Set<string>()
  for (const definition of parsed) {
    if (names.has(definition.channel)) {
      throw new Error(`Duplicate R8 IPC channel: ${definition.channel}`)
    }
    names.add(definition.channel)
  }
  return parsed
}
