import { z } from 'zod'

export const featureFlagNameSchema = z.string().regex(/^R8\.[A-C]\.[a-z0-9.-]+$/)
export const featureFlagStatusSchema = z.enum(['enabled', 'disabled', 'deferred'])

export const featureFlagDefinitionSchema = z.object({
  name: featureFlagNameSchema,
  status: featureFlagStatusSchema,
  defaultEnabled: z.boolean(),
  source: z.string().min(1),
  description: z.string().min(8),
  dependsOn: z.array(featureFlagNameSchema).default([])
})

export type FeatureFlagName = z.infer<typeof featureFlagNameSchema>
export type FeatureFlagStatus = z.infer<typeof featureFlagStatusSchema>
export type FeatureFlagDefinition = z.infer<typeof featureFlagDefinitionSchema>
export interface FeatureFlagEvaluationOptions {
  platform?: string
}

function defineFlag(
  name: FeatureFlagName,
  source: string,
  description: string,
  options: { status?: FeatureFlagStatus; defaultEnabled?: boolean; dependsOn?: FeatureFlagName[] } = {}
): FeatureFlagDefinition {
  return featureFlagDefinitionSchema.parse({
    name,
    source,
    description,
    status: options.status ?? 'enabled',
    defaultEnabled: options.defaultEnabled ?? true,
    dependsOn: options.dependsOn ?? []
  })
}

export const R8A_FEATURE_FLAGS = [
  defineFlag('R8.A.libs', 'R8.A/spec-01', 'R8.A integration library group gate for installed and guarded optional packages.'),
  defineFlag('R8.A.libs.wmi-client', 'R8.A/spec-01', 'Primary WMI integration for high-frequency process data.'),
  defineFlag('R8.A.libs.systeminformation', 'R8.A/spec-01 + R8.C/spec-24', 'Primary cross-platform network connection inventory for topology port sources.'),
  defineFlag('R8.A.libs.chokidar', 'R8.A/spec-01', 'File watcher integration for low-frequency runtime and skill library updates.'),
  defineFlag('R8.A.libs.better-queue', 'R8.A/spec-01', 'Durable queue primitive used by R8.C task orchestration contracts.'),
  defineFlag('R8.A.libs.sudo-prompt', 'R8.A/spec-01', 'One-shot Windows UAC child-process elevation integration.'),
  defineFlag('R8.A.libs.tree-kill', 'R8.A/spec-01', 'Recursive tree kill integration guarded by permission checks.'),
  defineFlag('R8.A.libs.node-window-manager', 'R8.A/spec-01', 'Optional native window-control adapter.'),
  defineFlag('R8.A.libs.node-window-mgr', 'R8.A/spec-01', 'Alias gate for node-window-manager naming used by legacy R8 specs.'),
  defineFlag('R8.A.libs.koffi', 'R8.A/spec-01', 'Direct Win32 FFI integration for user32 and related APIs.'),
  defineFlag('R8.A.libs.win32-displayconfig', 'R8.A/spec-01', 'Monitor and DPI display configuration integration.'),
  defineFlag('R8.A.libs.nut-js', 'R8.A/spec-01', 'Keyboard and mouse automation integration reserved for R8.C.', { status: 'disabled', defaultEnabled: false }),
  defineFlag('R8.A.libs.node-pty', 'R8.A/spec-01', 'Pseudo-terminal support for future terminal-style AI control.'),
  defineFlag('R8.A.libs.xyflow', 'R8.A/spec-01', 'Large-graph rendering engine candidate.'),
  defineFlag('R8.A.libs.cytoscape', 'R8.A/spec-01 + R8.C/spec-21 + R8.C/spec-24', 'Shared Cytoscape graph renderer for DAG editor and global topology surfaces.'),
  defineFlag('R8.A.libs.cytoscape-dagre', 'R8.A/spec-01 + R8.C/spec-21 + R8.C/spec-24', 'Cytoscape DAG layout extension for layered task and topology graphs.', { dependsOn: ['R8.A.libs.cytoscape'] }),
  defineFlag('R8.A.libs.d3-force', 'R8.A/spec-01', 'Existing force-directed graph layout engine.'),
  defineFlag('R8.A.libs.dagre', 'R8.A/spec-01', 'Layered graph layout integration.'),
  defineFlag('R8.A.libs.graphlib', 'R8.A/spec-01', 'Graph data structure primitive for DAG and topology contracts.'),
  defineFlag('R8.A.libs.elkjs', 'R8.A/spec-01', 'Layered graph layout with explicit EPL exception tracking.'),
  defineFlag('R8.A.libs.webcola', 'R8.A/spec-01', 'Constrained graph layout integration.'),
  defineFlag('R8.A.libs.mermaid', 'R8.A/spec-01', 'Mermaid diagram rendering integration for graph documentation surfaces.'),
  defineFlag('R8.A.libs.vis-timeline', 'R8.A/spec-01', 'Timeline visualization integration for replay and recording surfaces.'),
  defineFlag('R8.A.libs.cmdk', 'R8.A/spec-01', 'Command palette primitive integration.'),
  defineFlag('R8.A.libs.xstate', 'R8.A/spec-01', 'State machine primitive reserved for R8.C AI state orchestration.'),
  defineFlag('R8.A.libs.resizable-panels', 'R8.A/spec-01', 'Resizable panel primitive integration.'),
  defineFlag('R8.A.libs.radix-dialog', 'R8.A/spec-01', 'Accessible dialog and drawer primitive integration.'),
  defineFlag('R8.A.libs.radix-dropdown', 'R8.A/spec-01', 'Accessible dropdown primitive integration.'),
  defineFlag('R8.A.libs.radix-tooltip', 'R8.A/spec-01', 'Accessible tooltip primitive integration.'),
  defineFlag('R8.A.libs.grid-layout', 'R8.A/spec-01', 'Dashboard grid layout primitive integration.'),
  defineFlag('R8.A.libs.tanstack-table', 'R8.A/spec-01', 'Dense table primitive integration.'),
  defineFlag('R8.A.libs.tanstack-virtual', 'R8.A/spec-01', 'Virtual list primitive integration.'),
  defineFlag('R8.A.libs.arborist', 'R8.A/spec-01', 'Tree view primitive integration.'),
  defineFlag('R8.A.libs.framer-motion', 'R8.A/spec-01', 'Motion primitive integration with reduced-motion safeguards.'),
  defineFlag('R8.A.libs.sparklines', 'R8.A/spec-01', 'Compact metric sparkline integration for status and monitoring panels.'),
  defineFlag('R8.A.libs.react-hook-form', 'R8.A/spec-01', 'Typed form primitive integration.'),
  defineFlag('R8.A.libs.date-fns', 'R8.A/spec-01', 'Local date formatting integration.'),
  defineFlag('R8.A.libs.papaparse', 'R8.A/spec-01', 'CSV parsing integration for R8.C real task row ingestion.'),
  defineFlag('R8.A.libs.lucide', 'R8.A/spec-01', 'Lucide icon source without emoji glyphs.'),
  defineFlag('R8.A.libs.tabler', 'R8.A/spec-01', 'Tabler technical icon source without emoji glyphs.'),
  defineFlag('R8.A.libs.tabler-icons', 'R8.A/spec-01', 'Spec-name alias for the installed Tabler icon library without emoji glyphs.'),
  defineFlag('R8.A.libs.radix-icons', 'R8.A/spec-01', 'Radix primitive-aligned icon source without emoji glyphs.'),
  defineFlag('R8.A.libs.heroicons', 'R8.A/spec-01', 'Heroicons source without emoji glyphs.'),
  defineFlag('R8.A.libs.react-scan', 'R8.A/spec-01', 'Render performance inspection integration.', { status: 'disabled', defaultEnabled: false }),
  defineFlag('R8.A.libs.license-checker', 'R8.A/spec-01', 'Dependency license validation integration.'),
  defineFlag('R8.A.process.unified-vm', 'R8.A/spec-02', 'ProcessUnifiedViewModel light and deep data boundary.', { dependsOn: ['R8.A.libs.wmi-client'] }),
  defineFlag('R8.A.process.uac-spawn', 'R8.A/spec-03', 'One-shot elevation flow with admin relaunch fallback.', { dependsOn: ['R8.A.libs.sudo-prompt'] }),
  defineFlag('R8.A.process.card-list-parity', 'R8.A/spec-04', 'Card and list process views expose the same VM field markers.', { dependsOn: ['R8.A.process.unified-vm'] }),
  defineFlag('R8.A.topology.discover', 'R8.A/spec-05', 'First-glance topology entries for process, port, and window details.', { dependsOn: ['R8.A.libs.xyflow', 'R8.A.libs.d3-force'] }),
  defineFlag('R8.A.theme.4d-axis', 'R8.A/spec-06', 'Palette, density, radius, and motion coordinated theme axes.'),
  defineFlag('R8.A.theme.default-delta', 'R8.A/spec-07', 'Visible non-color distance between default theme presets.', { dependsOn: ['R8.A.theme.4d-axis'] }),
  defineFlag('R8.A.window.aot', 'R8.A/spec-08', 'Always-on-top controls through typed UI state and IPC.', { dependsOn: ['R8.A.libs.node-window-manager'] }),
  defineFlag('R8.A.port.card-improve', 'R8.A/spec-09', 'Port-card spacing, labels, security markers, and graph entries.'),
  defineFlag('R8.A.audit.log', 'R8.A/spec-10', 'Redacted audit trail for destructive, elevation, and window actions.'),
  defineFlag('R8.A.permission.prompt', 'R8.A/spec-11', 'Second confirmation and allowlist control for destructive actions.', { dependsOn: ['R8.A.audit.log'] })
] as const satisfies readonly FeatureFlagDefinition[]

export const R8B_FEATURE_FLAGS = [
  defineFlag('R8.B.port', 'R8.B/prd', 'Aggregate gate for R8.B port detail, popout, layout, and security surfaces.'),
  defineFlag('R8.B.port.popout-system', 'R8.B/spec-01', 'Port popout entry system with four real trigger surfaces.', { dependsOn: ['R8.A.port.card-improve'] }),
  defineFlag('R8.B.popout.browserwindow', 'R8.B/spec-02', 'BrowserWindow-backed popouts with bridge-safe multi-display migration.', { dependsOn: ['R8.B.port.popout-system'] }),
  defineFlag('R8.B.drawer.system', 'R8.B/spec-03', 'Five-slot drawer system for top, right, bottom, floating, and status surfaces.'),
  defineFlag('R8.B.command.palette', 'R8.B/spec-04', 'cmdk command palette and URI command resolution.', { dependsOn: ['R8.A.libs.cmdk'] }),
  defineFlag('R8.B.dashboard.grid', 'R8.B/spec-05', 'React-grid-layout dashboard workspace with persisted presets.', { dependsOn: ['R8.A.libs.grid-layout'] }),
  defineFlag('R8.B.process.treemap-tree', 'R8.B/spec-06', 'Process treemap and virtualized tree views over the unified process VM.', { dependsOn: ['R8.A.process.unified-vm'] }),
  defineFlag('R8.B.theme.decorations', 'R8.B/spec-07', 'Theme decorations, geometric treatments, sound config, and SVG extension slots.', { dependsOn: ['R8.A.theme.4d-axis'] }),
  defineFlag('R8.B.statusbar.extension', 'R8.B/spec-08', 'Twelve-tile status bar aggregation with six visible status badges.'),
  defineFlag('R8.B.window.thumbnail-wall', 'R8.B/spec-09', 'Window thumbnail wall grouped by stable five-tuple fingerprints.', { dependsOn: ['R8.A.libs.koffi'] }),
  defineFlag('R8.B.window.batch-ops', 'R8.B/spec-10', 'Window batch operations with lasso selection, confirmation, progress, and undo.'),
  defineFlag('R8.B.window.virtual-desktop', 'R8.B/spec-11', 'Virtual desktop layout mapping and named workspace controls.', { dependsOn: ['R8.A.libs.koffi', 'R8.A.libs.win32-displayconfig'] }),
  defineFlag('R8.B.process.batch-ops', 'R8.B/spec-12', 'Process batch operations with explicit confirmation and short undo window.', { dependsOn: ['R8.A.process.unified-vm'] }),
  defineFlag('R8.B.port.security-tier', 'R8.B/spec-13', 'Port security tier classifier with user blocklist and public exposure banners.'),
  defineFlag('R8.B.process.tags-history', 'R8.B/spec-14', 'Process tag keys and twenty-four-hour history sampling.'),
  defineFlag('R8.B.i18n.scaffold', 'R8.B/spec-15', 'Locale scaffold with zh-CN primary resources and en-US placeholder surface.'),
  defineFlag('R8.B.a11y.full', 'R8.B/spec-16', 'Accessibility preferences, reduced-motion handling, and self-check hooks.'),
  defineFlag('R8.B.icon.library', 'R8.B/spec-17', 'Four installed icon libraries and brand logo resolution without emoji glyphs.')
] as const satisfies readonly FeatureFlagDefinition[]

export const R8C_FEATURE_FLAGS = [
  defineFlag('R8.C.cli', 'R8.C/prd', 'Aggregate gate for R8.C CLI detection, parsing, stream, and strategy contracts.'),
  defineFlag('R8.C.csv', 'R8.C/prd', 'Aggregate gate for R8.C CSV ingestion, queueing, template, and launch contracts.'),
  defineFlag('R8.C.dag', 'R8.C/prd', 'Aggregate gate for R8.C DAG orchestration, editor, export, and layer contracts.'),
  defineFlag('R8.C.inject', 'R8.C/prd', 'Aggregate gate for R8.C guarded injection, countdown, stream, and target contracts.'),
  defineFlag('R8.C.recording', 'R8.C/prd', 'Aggregate gate for R8.C recording, replay, event stream, and export contracts.'),
  defineFlag('R8.C.skill', 'R8.C/prd', 'Aggregate gate for R8.C skill library, built-in, validation, and install contracts.'),
  defineFlag('R8.C.watchdog', 'R8.C/prd', 'Aggregate gate for R8.C watchdog engine, supervisor, and event stream contracts.'),
  defineFlag('R8.C.cli.parser', 'R8.C/spec-01', 'CLI output parser framework for normalized AI progress events.', { dependsOn: ['R8.A.libs.node-pty'] }),
  defineFlag('R8.C.shim.codex', 'R8.C/spec-02', 'Codex stream-json shim integration over the shared parser.', { dependsOn: ['R8.C.cli.parser'] }),
  defineFlag('R8.C.shim.claude', 'R8.C/spec-03', 'Claude stream-json shim integration over the shared parser.', { dependsOn: ['R8.C.cli.parser'] }),
  defineFlag('R8.C.shim.gemini', 'R8.C/spec-04', 'Gemini stdout parser shim integration over the shared parser.', { dependsOn: ['R8.C.cli.parser'] }),
  defineFlag('R8.C.cli.cursor-copilot', 'R8.C/spec-05', 'Cursor and Copilot title-pattern task detection.'),
  defineFlag('R8.C.cli.detect', 'R8.C/spec-06', 'Startup CLI tool detection with bounded five-second probes.'),
  defineFlag('R8.C.monitor.window', 'R8.C/spec-07', 'AI monitor window main panel with queue and progress visibility.'),
  defineFlag('R8.C.monitor.popout', 'R8.C/spec-08', 'AI monitor BrowserWindow popout using the R8.B popout bridge.', { dependsOn: ['R8.C.monitor.window', 'R8.B.popout.browserwindow'] }),
  defineFlag('R8.C.skill.library', 'R8.C/spec-09', 'Agent Skill YAML library loading and validation.'),
  defineFlag('R8.C.skill.builtin', 'R8.C/spec-10', 'Built-in Skill catalog seeded from local project files.', { dependsOn: ['R8.C.skill.library'] }),
  defineFlag('R8.C.skill.editor', 'R8.C/spec-11', 'Skill editing surface backed by schema validation.', { dependsOn: ['R8.C.skill.library'] }),
  defineFlag('R8.C.csv.driver', 'R8.C/spec-12', 'CSV task driver core for real row ingestion.'),
  defineFlag('R8.C.csv.schema', 'R8.C/spec-13', 'Eighteen-column CSV task schema and validator.', { dependsOn: ['R8.C.csv.driver'] }),
  defineFlag('R8.C.csv.launch', 'R8.C/spec-14', 'CSV launch entry points for DevHub UI and CLI execution.', { dependsOn: ['R8.C.csv.driver', 'R8.C.csv.schema'] }),
  defineFlag('R8.C.csv.launch.python', 'R8.C/spec-14', 'Python child launcher option kept user-controlled and disabled by default.', { status: 'disabled', defaultEnabled: false, dependsOn: ['R8.C.csv.launch'] }),
  defineFlag('R8.C.csv.launch.cli', 'R8.C/spec-14', 'CLI child launcher option for reproducible batch starts.', { dependsOn: ['R8.C.csv.launch'] }),
  defineFlag('R8.C.task.queue', 'R8.C/spec-15', 'Durable AI task queue abstraction for CSV and manual launches.', { dependsOn: ['R8.C.csv.launch'] }),
  defineFlag('R8.C.task.queue.engine', 'R8.C/spec-15', 'Queue engine selector contract currently bound to better-queue semantics.', { dependsOn: ['R8.C.task.queue'] }),
  defineFlag('R8.C.watchdog.engine', 'R8.C/spec-16', 'Watchdog reliability policy engine for stalled and failed AI instances.', { dependsOn: ['R8.C.task.queue'] }),
  defineFlag('R8.C.watchdog.engine.strict', 'R8.C/spec-16', 'Strict watchdog mode with zero retry fail-fast semantics.', { status: 'disabled', defaultEnabled: false, dependsOn: ['R8.C.watchdog.engine'] }),
  defineFlag('R8.C.watchdog.subprocess', 'R8.C/spec-17', 'Watchdog subprocess isolation contract.', { dependsOn: ['R8.C.watchdog.engine'] }),
  defineFlag('R8.C.watchdog.subprocess.windows-service', 'R8.C/spec-17', 'Windows Service watchdog mode requiring explicit administrator setup.', { status: 'disabled', defaultEnabled: false, dependsOn: ['R8.C.watchdog.subprocess'] }),
  defineFlag('R8.C.inject.engine', 'R8.C/spec-18', 'Automated injection engine guarded by target resolution and audit gates.', { dependsOn: ['R8.C.task.queue', 'R8.A.libs.nut-js'] }),
  defineFlag('R8.C.inject.engine.audit-full-content', 'R8.C/spec-18', 'Full-content injection audit trail mode.', { dependsOn: ['R8.C.inject.engine', 'R8.A.audit.log'] }),
  defineFlag('R8.C.inject.targets', 'R8.C/spec-19', 'Injection target whitelist and readiness resolution.', { dependsOn: ['R8.C.inject.engine'] }),
  defineFlag('R8.C.inject.targets.strict-mode', 'R8.C/spec-19', 'Strict target matching mode for automated injection with no fuzzy fallback.', { status: 'disabled', defaultEnabled: false, dependsOn: ['R8.C.inject.targets'] }),
  defineFlag('R8.C.dag.orchestrator', 'R8.C/spec-20', 'DAG orchestrator with cycle detection and ready-layer evaluation.', { dependsOn: ['R8.C.task.queue'] }),
  defineFlag('R8.C.dag.editor', 'R8.C/spec-21', 'DAG editor data contract for graph, table, JSON, and timeline views.', { dependsOn: ['R8.C.dag.orchestrator'] }),
  defineFlag('R8.C.recording.engine', 'R8.C/spec-22', 'Task recording engine for stdout, stdin, screenshot, filesystem, and git-diff streams.'),
  defineFlag('R8.C.recording.engine.screenshot', 'R8.C/spec-22', 'Recording screenshot stream capture gate.', { dependsOn: ['R8.C.recording.engine'] }),
  defineFlag('R8.C.recording.engine.fs', 'R8.C/spec-22', 'Recording filesystem event stream gate.', { dependsOn: ['R8.C.recording.engine'] }),
  defineFlag('R8.C.recording.engine.git-diff', 'R8.C/spec-22', 'Recording git-diff stream gate.', { dependsOn: ['R8.C.recording.engine'] }),
  defineFlag('R8.C.recording.replay', 'R8.C/spec-23', 'Task replay timeline over recorded event streams.', { dependsOn: ['R8.C.recording.engine'] }),
  defineFlag('R8.C.topology.global', 'R8.C/spec-24', 'Fullscreen topology primary entry for network and neural graph systems.'),
  defineFlag('R8.C.topology.attached', 'R8.C/spec-25', 'Attached topology with depth ten and lazy expansion after depth seven.', { dependsOn: ['R8.C.topology.global'] }),
  defineFlag('R8.C.flow.attached', 'R8.C/spec-26', 'Attached flow graph as the third graph system.', { dependsOn: ['R8.C.recording.engine'] }),
  defineFlag('R8.C.signal.fusion', 'R8.C/spec-27', 'AI signal fusion across CLI, process, window, and user feedback sources.', { dependsOn: ['R8.C.cli.parser'] }),
  defineFlag('R8.C.state.three-layer', 'R8.C/spec-28', 'Three-layer AI state machine for system, task, and UI states.', { dependsOn: ['R8.C.signal.fusion'] }),
  defineFlag('R8.C.feedback.loop', 'R8.C/spec-29', 'Misreport feedback loop for user-corrected signal learning.', { dependsOn: ['R8.C.signal.fusion'] }),
  defineFlag('R8.C.notify.system', 'R8.C/spec-30', 'Unified notification system with aggregation and action dispatch.'),
  defineFlag('R8.C.ipc.rate-limit', 'R8.C/spec-31', 'IPC token-bucket rate-limit self-observation channels.'),
  defineFlag('R8.C.observability.panel', 'R8.C/spec-32', 'Observability snapshot, stream, and export panel contracts.', { dependsOn: ['R8.C.ipc.rate-limit'] }),
  defineFlag('R8.C.zod.sot', 'R8.C/spec-33', 'Zod source-of-truth schemas with TypeScript inference and runtime validation.'),
  defineFlag('R8.C.recovery.crash', 'R8.C/spec-34', 'Crash recovery scan and dirty-state remediation.'),
  defineFlag('R8.C.backup.restore', 'R8.C/spec-35', 'Backup and classified restore for settings, CSV, skills, and audit data.', { dependsOn: ['R8.C.recovery.crash'] }),
  defineFlag('R8.C.diagnostic.export', 'R8.C/spec-36', 'Opt-in diagnostic pack export with redaction.', { dependsOn: ['R8.A.audit.log', 'R8.C.observability.panel'] }),
  defineFlag('R8.C.permission.ttl', 'R8.C/spec-37', 'Time-bounded permissions with automatic expiry.', { dependsOn: ['R8.A.permission.prompt'] }),
  defineFlag('R8.C.skill.cloud-sync', 'R8.C/spec-38', 'Cloud sync interface intentionally deferred and disabled.', { status: 'deferred', defaultEnabled: false, dependsOn: ['R8.C.skill.library'] }),
  defineFlag('R8.C.ocr.interface', 'R8.C/spec-39', 'OCR interface intentionally hard-disabled until a future batch.', { status: 'disabled', defaultEnabled: false })
] as const satisfies readonly FeatureFlagDefinition[]

export const R8_FEATURE_FLAGS = [
  ...R8A_FEATURE_FLAGS,
  ...R8B_FEATURE_FLAGS,
  ...R8C_FEATURE_FLAGS
] as const satisfies readonly FeatureFlagDefinition[]

export const featureFlagRegistrySchema = z.array(featureFlagDefinitionSchema).superRefine((flags, context) => {
  const names = new Set<string>()
  for (const flag of flags) {
    if (names.has(flag.name)) {
      context.addIssue({ code: 'custom', message: `Duplicate feature flag: ${flag.name}`, path: [flag.name] })
    }
    names.add(flag.name)
  }

  for (const flag of flags) {
    for (const dependency of flag.dependsOn) {
      if (!names.has(dependency)) {
        context.addIssue({ code: 'custom', message: `Unknown feature flag dependency: ${dependency}`, path: [flag.name, 'dependsOn'] })
      }
    }
  }
})

export const R8_FEATURE_FLAG_DEFAULTS = Object.fromEntries(
  R8_FEATURE_FLAGS.map(flag => [flag.name, flag.defaultEnabled])
) as Record<FeatureFlagName, boolean>

export const R8A_FEATURE_FLAG_DEFAULTS = Object.fromEntries(
  R8A_FEATURE_FLAGS.map(flag => [flag.name, flag.defaultEnabled])
) as Partial<Record<FeatureFlagName, boolean>>

const HARD_DISABLED_FLAGS = new Set<FeatureFlagName>([
  'R8.C.ocr.interface'
])

const WINDOWS_DEFAULT_ONLY_FLAGS = new Set<FeatureFlagName>([
  'R8.C.cli.cursor-copilot'
])

export function resolveFeatureFlagDefault(name: FeatureFlagName, options: FeatureFlagEvaluationOptions = {}): boolean {
  const platform = options.platform ?? (typeof process === 'undefined' ? 'unknown' : process.platform)
  if (WINDOWS_DEFAULT_ONLY_FLAGS.has(name) && platform !== 'win32') {
    return false
  }
  return R8_FEATURE_FLAG_DEFAULTS[name] ?? false
}

export function isFeatureEnabled(
  name: FeatureFlagName,
  overrides: Partial<Record<FeatureFlagName, boolean>> = {},
  options: FeatureFlagEvaluationOptions = {}
): boolean {
  if (HARD_DISABLED_FLAGS.has(name)) {
    return false
  }
  return overrides[name] ?? resolveFeatureFlagDefault(name, options)
}

export function assertFeatureFlagRegistry(flags: readonly FeatureFlagDefinition[] = R8_FEATURE_FLAGS): FeatureFlagDefinition[] {
  return featureFlagRegistrySchema.parse(flags)
}
