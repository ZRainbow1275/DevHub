import { z } from 'zod'

export const schemaVersionV1Schema = z.literal(1)
export const schemaVersionV2Schema = z.literal(2)

export const scannerIdSchema = z.enum(['process', 'port', 'window', 'ai-tool', 'project'])
export const scannerMetricsSchema = z.object({
  lastRunAt: z.number().int().nonnegative(),
  lastDurationMs: z.number().nonnegative(),
  lastResultSize: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  p95DurationMs: z.number().nonnegative()
})

export type ScannerContractShape = {
  id: z.infer<typeof scannerIdSchema>
  start: () => Promise<void>
  stop: () => Promise<void>
  getSnapshot: () => unknown
  subscribe: (fn: (snapshot: unknown) => void) => () => void
  getMetrics: () => z.infer<typeof scannerMetricsSchema>
}

export const iScannerSchema = z.custom<ScannerContractShape>((value) => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return scannerIdSchema.safeParse(candidate.id).success
    && typeof candidate.start === 'function'
    && typeof candidate.stop === 'function'
    && typeof candidate.getSnapshot === 'function'
    && typeof candidate.subscribe === 'function'
    && typeof candidate.getMetrics === 'function'
}, 'Expected scanner contract object with lifecycle methods')

export const moduleInfoSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  version: z.string().optional(),
  baseAddress: z.string().optional()
})

export const connectionInfoSchema = z.object({
  localAddress: z.string().min(1),
  localPort: z.number().int().min(0).max(65535),
  remoteAddress: z.string().optional(),
  remotePort: z.number().int().min(0).max(65535).optional(),
  state: z.string().min(1),
  protocol: z.enum(['tcp', 'udp'])
})

export const accessReportSchema = z.object({
  pid: z.number().int().positive(),
  elevationRequired: z.boolean(),
  scanAttempted: z.boolean(),
  scanResult: z.enum(['ok', 'access-denied', 'not-found', 'timeout', 'wmi-error']),
  currentUser: z.string(),
  targetProcessUser: z.string().optional(),
  suggestion: z.enum(['relaunch-as-admin', 'retry', 'none']),
  triedAt: z.number().int().positive()
})

export const processInfoSchema = z.object({
  pid: z.number().int().positive(),
  name: z.string().min(1),
  parentPid: z.number().int().positive().optional(),
  cpuPercent: z.number().nonnegative().optional(),
  memoryBytes: z.number().nonnegative().optional(),
  user: z.string().optional(),
  commandLine: z.string().optional(),
  workingDir: z.string().optional(),
  startTime: z.number().int().nonnegative().optional(),
  threadCount: z.number().int().nonnegative().optional()
})

export const partialDeepDetailSchema = processInfoSchema.extend({
  basicAvailable: z.boolean(),
  extendedAvailable: z.boolean(),
  modulesAvailable: z.boolean(),
  networkAvailable: z.boolean(),
  environmentAvailable: z.boolean(),
  modules: z.array(moduleInfoSchema).optional(),
  connections: z.array(connectionInfoSchema).optional(),
  environment: z.record(z.string(), z.string()).optional(),
  accessReport: accessReportSchema
})

export const portInfoSchema = z.object({
  protocol: z.enum(['tcp', 'udp']),
  localAddress: z.string().min(1),
  localPort: z.number().int().min(0).max(65535),
  state: z.string().min(1),
  pid: z.number().int().positive().optional(),
  processName: z.string().optional()
})

export const portDetailSchema = portInfoSchema.extend({
  processCommandLine: z.string().optional(),
  serviceName: z.string().optional(),
  cachedAgeSec: z.number().nonnegative().optional(),
  queryMode: z.enum(['light', 'full']).optional()
})

export const windowRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive()
})

export const windowFingerprintSchema = z.object({
  processExe: z.string().min(1),
  windowClass: z.string().min(1),
  titleRoot: z.string(),
  cliArgsHash: z.string().optional(),
  workingDirHash: z.string().optional(),
  userId: z.string().min(1)
})

export const toolIdSchema = z.string().min(1)

export const tilePresetSchema = z.enum([
  'two-left-right',
  'two-top-bottom',
  'three-left-rightsplit',
  'four-grid',
  'n-column-grid',
  'cascade',
  'custom',
  'tile-auto',
  'tile-horizontal',
  'tile-vertical'
])

export const windowInfoSchema = z.object({
  hwnd: z.number().int().positive(),
  fingerprint: windowFingerprintSchema,
  title: z.string(),
  pid: z.number().int().positive(),
  processName: z.string().min(1),
  rect: windowRectSchema,
  monitorId: z.string(),
  isVisible: z.boolean(),
  isMinimized: z.boolean(),
  isMaximized: z.boolean(),
  alwaysOnTop: z.boolean(),
  zIndex: z.number().int(),
  aiToolId: toolIdSchema.optional(),
  aliasId: z.string().optional()
})

export const groupAutoRuleSchema = z.object({
  kind: z.string().min(1),
  value: z.string().min(1)
}).passthrough()

export const windowGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  fingerprints: z.array(windowFingerprintSchema),
  autoRule: groupAutoRuleSchema.optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
})

export const windowLayoutSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.enum(['selected', 'group', 'all-visible']),
  presetKind: tilePresetSchema.optional(),
  windows: z.array(z.object({
    fingerprint: windowFingerprintSchema,
    rect: windowRectSchema,
    monitorId: z.string().min(1)
  })),
  createdAt: z.number().int().nonnegative()
})

export const aiAliasSchema = z.object({
  id: z.string().min(1),
  toolId: toolIdSchema,
  displayName: z.string().min(1),
  fingerprint: windowFingerprintSchema,
  applyToExternalWindow: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
})

export const renameIntentSchema = z.object({
  aliasId: z.string().min(1),
  newName: z.string().min(1),
  source: z.enum(['user-inline-edit', 'user-settings', 'auto-detect']),
  applyToExternalWindow: z.boolean(),
  targetHwnd: z.number().int().positive().optional(),
  requestedAt: z.number().int().nonnegative()
})

export const renameResultSchema = z.object({
  ok: z.boolean(),
  storeUpdated: z.boolean(),
  windowTitleUpdated: z.boolean(),
  reason: z.enum(['win32-error', 'access-denied', 'hwnd-not-found']).optional(),
  appliedAt: z.number().int().nonnegative()
})

export const aiMonitorStateSchema = z.enum([
  'initializing',
  'idle',
  'thinking',
  'receiving-input',
  'coding',
  'compiling',
  'validating',
  'waiting-input',
  'awaiting-human',
  'stuck',
  'completed',
  'error',
  'starting',
  'running',
  'tool-use',
  'finalizing',
  'failed',
  'stalled'
])

export const aiTaskPhaseSchema = z.enum(['prompt', 'thinking', 'tool-call', 'streaming', 'finalize'])

export const aiTaskKeySchema = z.object({
  aliasId: z.string().min(1),
  sessionId: z.string().optional(),
  startedAt: z.number().int().nonnegative()
})

export const derivedProgressSchema = z.object({
  mode: z.enum(['hidden', 'indeterminate', 'determinate']),
  percent: z.number().min(0).max(100).optional(),
  phase: aiTaskPhaseSchema.optional(),
  elapsedMs: z.number().int().nonnegative(),
  estimatedRemainingMs: z.number().int().nonnegative().optional(),
  confidence: z.number().min(0).max(1)
})

export const toolProfileSchema = z.object({
  toolId: toolIdSchema,
  signals: z.object({
    exitCodePolicy: z.enum(['required', 'optional']),
    windowSilenceTimeoutMs: z.number().int().nonnegative(),
    stdoutPatterns: z.object({
      done: z.array(z.instanceof(RegExp)),
      error: z.array(z.instanceof(RegExp))
    }),
    cpuIdleThreshold: z.number().nonnegative(),
    cpuIdleDurationMs: z.number().int().nonnegative()
  }),
  weights: z.object({
    windowTitle: z.number().nonnegative(),
    cpu: z.number().nonnegative(),
    stdout: z.number().nonnegative(),
    exitCode: z.number().nonnegative()
  }),
  debounceMs: z.number().int().nonnegative()
})

export const detectionSignalNameSchema = z.enum([
  'terminal_keywords',
  'cpu_idle',
  'low_output_rate',
  'prompt_detected',
  'child_process_exit',
  'time_threshold'
])

export const signalResultSchema = z.object({
  name: detectionSignalNameSchema,
  kind: z.enum(['textual', 'numeric', 'event']),
  raw: z.union([z.number(), z.boolean(), z.string()]),
  normalized: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  triggeredAt: z.number().int().nonnegative().optional(),
  reason: z.string().min(1)
})

export const signalContributionSchema = z.object({
  name: detectionSignalNameSchema,
  result: signalResultSchema,
  weight: z.number().nonnegative(),
  weightedContribution: z.number().min(0).max(1)
})

export const calibrationSampleSchema = z.object({
  taskKey: z.string().min(1),
  toolType: toolIdSchema,
  capturedAt: z.number().int().nonnegative(),
  expected: z.enum(['completed', 'running', 'error', 'cancelled']),
  observed: z.enum(['completed', 'running', 'error', 'cancelled', 'idle', 'thinking', 'coding', 'compiling', 'waiting']),
  signals: z.record(z.string(), z.number().min(0).max(1)),
  completionDelayMs: z.number().int().nonnegative().optional(),
  source: z.enum(['manual', 'bench', 'runtime']),
  notes: z.string().optional()
})

export const aiTaskHistorySchema = z.object({
  taskKey: aiTaskKeySchema,
  aliasId: z.string().min(1),
  taskAlias: z.string().min(1),
  toolId: toolIdSchema,
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  endState: z.enum(['completed', 'failed', 'stalled']),
  confidence: z.number().min(0).max(1),
  notificationSent: z.boolean()
})

export const topologyRootKindSchema = z.enum(['process', 'port', 'window', 'ai-task'])
export const topologyEntityKindSchema = z.enum(['process', 'port', 'window', 'ai-task', 'module'])
export const topologyEdgeKindSchema = z.enum(['parent-child', 'listen-on', 'owns-window', 'ai-running-in'])

export const topologyScopeSchema = z.object({
  root: topologyRootKindSchema,
  rootId: z.union([z.string().min(1), z.number().int().positive()]),
  depthLimit: z.number().int().min(0).max(8),
  includeEntityKinds: z.array(topologyEntityKindSchema),
  edgeKinds: z.array(topologyEdgeKindSchema),
  showOrphan: z.boolean()
})

export const topologyNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  depth: z.number().int().nonnegative(),
  label: z.string(),
  data: z.unknown()
})

export const topologyEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  kind: z.string().min(1),
  weight: z.number().optional()
})

export const topologyGraphSchema = z.object({
  nodes: z.array(topologyNodeSchema),
  edges: z.array(topologyEdgeSchema),
  meta: z.object({
    generatedAt: z.number().int().nonnegative(),
    scope: topologyScopeSchema
  })
})

export const paletteNameSchema = z.enum([
  'constructivism',
  'modern-light',
  'warm-light',
  'cyberpunk',
  'swiss',
  'dark',
  'light',
  'synthwave',
  'nord',
  'solarized-dark',
  'solarized-light',
  'vscode-dark',
  'paper',
  'terminal-green',
  'ocean'
])
export const densityLevelSchema = z.enum(['compact', 'normal', 'standard', 'comfortable'])
export const radiusFamilySchema = z.enum(['sharp', 'soft', 'round'])
export const motionLevelSchema = z.enum(['reduced', 'balanced', 'expressive'])

export const themeStateSchema = z.object({
  palette: paletteNameSchema,
  density: densityLevelSchema,
  radiusFamily: radiusFamilySchema,
  motionLevel: motionLevelSchema,
  schemaVersion: schemaVersionV2Schema.default(2)
})

export const themePresetSchema = z.object({
  name: z.string().min(1),
  palette: paletteNameSchema,
  density: densityLevelSchema,
  radiusFamily: radiusFamilySchema,
  motionLevel: motionLevelSchema
})

export const appNotificationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  level: z.enum(['info', 'success', 'warning', 'error']),
  source: z.enum(['ai-task', 'scanner', 'system', 'user']),
  timestamp: z.number().int().nonnegative(),
  metadata: z.object({
    aiTask: z.object({
      aliasId: z.string().min(1),
      taskAlias: z.string().min(1),
      toolId: toolIdSchema,
      durationMs: z.number().int().nonnegative(),
      endState: aiMonitorStateSchema
    }).optional(),
    processId: z.number().int().positive().optional(),
    windowHwnd: z.number().int().positive().optional()
  }),
  actions: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    payload: z.unknown().optional()
  })).optional()
})

export const ipcEnvelopeSchema = z.object({
  seq: z.number().int().nonnegative(),
  ts: z.number().int().nonnegative(),
  channel: z.string().min(1),
  batch: z.boolean().optional(),
  batchSeq: z.object({
    first: z.number().int().nonnegative(),
    last: z.number().int().nonnegative()
  }).optional(),
  truncated: z.object({
    reason: z.enum(['size', 'rate', 'count']),
    originalCount: z.number().int().nonnegative()
  }).optional(),
  payload: z.unknown()
})

export const contractSchemaRegistry = {
  IScanner: iScannerSchema,
  ScannerId: scannerIdSchema,
  ScannerMetrics: scannerMetricsSchema,
  ProcessInfo: processInfoSchema,
  PartialDeepDetail: partialDeepDetailSchema,
  AccessReport: accessReportSchema,
  ModuleInfo: moduleInfoSchema,
  ConnectionInfo: connectionInfoSchema,
  PortInfo: portInfoSchema,
  PortDetail: portDetailSchema,
  WindowInfo: windowInfoSchema,
  WindowFingerprint: windowFingerprintSchema,
  WindowGroup: windowGroupSchema,
  WindowLayoutSnapshot: windowLayoutSnapshotSchema,
  TilePreset: tilePresetSchema,
  AIAlias: aiAliasSchema,
  RenameIntent: renameIntentSchema,
  RenameResult: renameResultSchema,
  AIMonitorState: aiMonitorStateSchema,
  AITaskKey: aiTaskKeySchema,
  DerivedProgress: derivedProgressSchema,
  AITaskPhase: aiTaskPhaseSchema,
  DetectionSignalName: detectionSignalNameSchema,
  SignalResult: signalResultSchema,
  SignalContribution: signalContributionSchema,
  CalibrationSample: calibrationSampleSchema,
  ToolProfile: toolProfileSchema,
  AITaskHistory: aiTaskHistorySchema,
  TopologyScope: topologyScopeSchema,
  TopologyRootKind: topologyRootKindSchema,
  TopologyGraph: topologyGraphSchema,
  TopologyNode: topologyNodeSchema,
  TopologyEdge: topologyEdgeSchema,
  ThemeState: themeStateSchema,
  PaletteName: paletteNameSchema,
  DensityLevel: densityLevelSchema,
  RadiusFamily: radiusFamilySchema,
  MotionLevel: motionLevelSchema,
  ThemePreset: themePresetSchema,
  AppNotification: appNotificationSchema,
  IPCEnvelope: ipcEnvelopeSchema
} as const

export type ContractSchemaName = keyof typeof contractSchemaRegistry
