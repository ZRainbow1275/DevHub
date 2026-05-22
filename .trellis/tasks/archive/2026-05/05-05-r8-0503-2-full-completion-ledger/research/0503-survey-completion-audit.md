# prompts/0503 Survey Completion Audit

Generated: 2026-05-16

## Objective Restatement

Continue implementation toward all development goals described under `prompts/0503`, without treating survey checkboxes or final-acceptance checkboxes as completed unless a concrete DevHub artifact proves the behavior.

## Authority Boundary

- `prompts/0503` is a survey and final-acceptance source set, not the later PRD/spec implementation set.
- `prompts/0503-2` remains the active detailed PRD/spec implementation set tracked by `0503-2-completion-ledger.md`.
- User-facing final acceptance items in `prompts/0503/28-final-acceptance-checklist.md` must not be checked by the agent merely because code exists; they require real product verification evidence and, where stated, user-visible acceptance.

## Mechanical Checkbox Baseline

| File | Open | Checked | Pending markers | Audit status |
|---|---:|---:|---:|---|
| `prompts\0503\00-master-v2.md` | 0 | 0 | 0 | reference |
| `prompts\0503\00-overview.md` | 0 | 0 | 0 | reference |
| `prompts\0503\01-meta-vision-survey.md` | 0 | 0 | 0 | survey |
| `prompts\0503\02-global-experience-survey.md` | 0 | 0 | 0 | survey |
| `prompts\0503\03-theme-design-language-survey.md` | 0 | 0 | 0 | survey |
| `prompts\0503\04-process-module-survey.md` | 24 | 27 | 0 | implementation evidence required |
| `prompts\0503\05-port-module-survey.md` | 13 | 15 | 0 | implementation evidence required |
| `prompts\0503\06-window-module-survey.md` | 25 | 4 | 5 | implementation evidence required |
| `prompts\0503\07-ai-task-orchestration-survey.md` | 74 | 21 | 1 | implementation evidence required |
| `prompts\0503\08-topology-flow-attached-survey.md` | 20 | 5 | 1 | implementation evidence required |
| `prompts\0503\09-cross-cutting-survey.md` | 5 | 25 | 0 | implementation evidence required |
| `prompts\0503\10-integration-libraries-survey.md` | 0 | 0 | 0 | reference |
| `prompts\0503\11-roadmap-rollback-survey.md` | 58 | 7 | 0 | implementation evidence required |
| `prompts\0503\12-cross-module-jump-survey.md` | 70 | 0 | 1 | implementation evidence required |
| `prompts\0503\13-perception-vs-reality-survey.md` | 35 | 0 | 3 | implementation evidence required |
| `prompts\0503\14-three-graph-systems-survey.md` | 102 | 0 | 0 | implementation evidence required |
| `prompts\0503\15-ai-detection-zero-error-survey.md` | 28 | 0 | 0 | implementation evidence required |
| `prompts\0503\16-csv-task-driver-deep-survey.md` | 68 | 0 | 1 | implementation evidence required |
| `prompts\0503\17-watchdog-engineering-survey.md` | 55 | 0 | 7 | implementation evidence required |
| `prompts\0503\18-auto-inject-engineering-survey.md` | 66 | 0 | 6 | implementation evidence required |
| `prompts\0503\19-popout-dock-engineering-survey.md` | 48 | 0 | 4 | implementation evidence required |
| `prompts\0503\20-theme-quantitative-diff-survey.md` | 20 | 0 | 1 | implementation evidence required |
| `prompts\0503\21-edge-case-failure-survey.md` | 9 | 0 | 0 | implementation evidence required |
| `prompts\0503\22-user-journey-storyboard.md` | 30 | 0 | 0 | implementation evidence required |
| `prompts\0503\23-extensibility-plugin-survey.md` | 54 | 0 | 0 | implementation evidence required |
| `prompts\0503\24-legal-compliance-survey.md` | 38 | 0 | 0 | implementation evidence required |
| `prompts\0503\25-community-ecosystem-survey.md` | 67 | 0 | 0 | implementation evidence required |
| `prompts\0503\26-market-best-practices-comparison.md` | 33 | 0 | 3 | implementation evidence required |
| `prompts\0503\27-easter-egg-shortcuts-survey.md` | 74 | 0 | 0 | implementation evidence required |
| `prompts\0503\28-final-acceptance-checklist.md` | 285 | 0 | 0 | user-facing acceptance checklist |
| `prompts\0503\99-research-snapshot.md` | 0 | 0 | 3 | stale source snapshot |
| `prompts\0503\refs\market-research.md` | 0 | 0 | 0 | reference |
| `prompts\0503\refs\source-snapshot-v2.md` | 0 | 0 | 6 | stale source snapshot |
| `prompts\0503\refs\spec-gap-analysis.md` | 0 | 0 | 0 | reference |

Totals: 34 Markdown files, 1301 open checkboxes, 104 checked checkboxes, 42 pending markers.

## Prompt-to-Artifact Checklist

| Requirement source | Concrete deliverable | Current evidence | Gap status |
|---|---|---|---|
| `28-final-acceptance-checklist.md` A.1.6 | Top monitor navigation exposes process, port, window, AI task, and topology entries | 2026-05-16 implementation adds `topology` to `MonitorPanel` and verifies it with `MonitorPanel.test.tsx` | advanced, not user-accepted |
| `00-overview.md` and `00-master-v2.md` topology visibility pain | Topology must not feel disappeared; attached graph entries must be complemented by a visible global entry | Existing activity bar/status/command entries remain; 2026-05-16 adds direct MonitorPanel top entry | advanced |
| `28-final-acceptance-checklist.md` A.4.4/A.4.5 | Topology/flow entries visible in detail panels and global monitor navigation | Detail panel entries already exist in process/port/window tests; global topology tab now exists; `FullScreenTopologyView.test.tsx` verifies the `flow` graph-kind button and the `topology.flow` command intent call the real global graph bridge | advanced, not user-accepted |
| `08-topology-flow-attached-survey.md` Q-8.A.3 and `28-final-acceptance-checklist.md` C.6.2 | Cmd+K search should expose object relationship/topology entries for concrete process, port, and window rows | 2026-05-16 adds scanner-backed `topology.process.*`, `topology.port.*`, and `topology.window.*` commands that emit real focused global topology navigation events | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.6.3 and G.2.2 | Statusbar must expose a persistent topology button and show current active process count | Existing statusbar topology button remains functional; 2026-05-16 adds visible active process count from `processStore` and verifies it in `StatusBar.test.tsx` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.1.1 | Process cards should show PID, name, CPU, memory, status, and parent process | 2026-05-16 extends real `SystemProcessScanner` rows with PPID/parent name and renders parent metadata on process cards | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.1.2 | Process cards should expose a top-right Network/topology entry badge | Existing `ProcessCard` renders `CardEdgeGraphBadge`; 2026-05-16 strengthens regression evidence for process graph metadata and navigation isolation | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.1.5 | Process cards should support double-click to enter the detail panel | 2026-05-16 adds a card-surface double-click detail entry and verifies that the graph badge remains isolated from the shortcut | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.1.3 | Process card context menu should include kill, detail, popout, and copy PID basics | Existing menu already exposes detail and kill; 2026-05-16 adds real clipboard-backed `复制 PID`; 2026-05-19 adds real `弹出进程` BrowserWindow popout actions for process card and list row through `window.devhub.r8.popout.create({ surface: 'process', targetId: pid, mode: 'browserwindow', route: '/monitor' })` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.2.1 | Process list fields should stay aligned with process cards | 2026-05-16 adds the same PPID/parent-name VM field to process list rows and list headers | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.2.4 | Process list rows should open `ProcessDetailDrawer` on click | 2026-05-16 adds a list-row surface click path into the existing left drawer and verifies multi-select clicks remain isolated | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.3.1 | ProcessDetailPanel should expose the required 基础/资源/网络/环境/模块 tabs | Existing panel exposes the five required tabs plus relationship tabs; 2026-05-16 adds regression evidence in `ProcessDetailPanel.test.tsx` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.3.2 | ProcessDetailPanel detail header should expose a visible `看图` top button that jumps to topology | 2026-05-16 changes the attached-topology header button to visible `看图` text and verifies it still opens the attached graph/flow view | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.3.3 and G.2.3 | Process detail relationship view should embed both topology and flow/relationship graph views | Existing `ProcessDetailPanel` renders `AttachedGraphView` and `AttachedFlowView`; 2026-05-16 strengthens regression evidence for both views | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.7.2 | Users should be able to recognize the process topology graph in plain language | 2026-05-16 adds a visible `ProcessModuleTour` relationship step that selects the current real PID and emits the same topology navigation event as the process-card graph badge | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` C.7.3 | Process module Tour should cover Card/List switching, relationship graph entry, and operation menu in three steps | 2026-05-16 adds a persisted 3-step Tour with live PID/name evidence, disabled no-process actions, real view-mode switching, and real `ProcessCard` context-menu opening | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.1.1 | Port cards should show port, protocol, PID, state, and security tier | 2026-05-16 adds explicit field audit markers and regression evidence for the real card values and local security tier | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.1.2 | Port security tiers should have clear color coding | 2026-05-16 adds explicit tier/tone/label metadata, distinct WAN orange styling, and regression coverage for all four R8 security tiers | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.1.3 | Port cards should support detaching as floating popouts | Existing `PortCard` opens real floating popouts through click/context-menu/drag and can promote through the BrowserWindow popout bridge; focused regression evidence exists in `PortView.port-popout.test.tsx` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.1.4 | Port cards should expose a top-right topology entry badge | Existing `PortCard` renders `CardEdgeGraphBadge`; 2026-05-16 adds regression evidence that the badge switches to the real relationship graph view | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.2.1 | Port tab should expose cards, list, and relationship modes | 2026-05-16 adds root-level mode audit metadata and regression coverage for all three real modes | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.2.2 | Port view-mode switching should be immediate and persistent | 2026-05-16 persists the selected port view mode in localStorage and verifies rehydration on mount | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.2.3 | Relationship mode should default to a graph of all currently monitored ports | 2026-05-16 adds `data-relationship-scope="all-monitored-ports"` evidence and verifies `buildFlowData()` includes every supplied monitored port by default | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.3.1 | Port focus panel should embed topology and neural/flow graph views | Existing `PortFocusPanel` renders `AttachedGraphView` and `AttachedFlowView`; 2026-05-16 strengthens root-kind/root-id evidence for both views | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.3.2 | Port focus panel should detach as a popout | 2026-05-16 adds a `PortFocusPanel` detach action that calls the real `window.devhub.r8.popout.create` BrowserWindow bridge for the selected port | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.3.3 | Port focus panel should render cache-first progressively without blank waiting | Existing incremental cache path remains; 2026-05-16 verifies stale cache fallback still renders snapshot content and attached graph section | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.3.4 | Stale data warning should display at top of port focus panel | 2026-05-16 adds top-position stale warning audit metadata and regression coverage | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.4.1 | Force-release port operation should require second confirmation | Existing `ConfirmDialog` remains in the release path; 2026-05-16 adds regression evidence that cancel does not call `releasePort` and confirm does | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.4.2 | Long-pressing a port card should open an advanced menu | 2026-05-16 adds a 1500ms long-press advanced menu with graph, popout, and release actions that reuse existing real handlers | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.4.3 | Port operations should produce audit logs | Existing `PortScanner.releasePort()` writes `port:release` audit entries; 2026-05-16 adds regression evidence for refused protected-process release logging | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.5.1 | Port relationship view should show the real port-to-process owns relation | 2026-05-16 adds explicit `relationshipKind="owns"` metadata on real port-to-process edges and regression coverage in `PortRelationshipGraph.test.tsx` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.5.2 | Port relationship view should show real remote connects relations | 2026-05-16 adds concrete-remote-only `flowRemote` nodes and `relationshipKind="connects"` edges from real `PortInfo.foreignAddress` values; wildcard/zero addresses are ignored | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.5.3 | Port relationship view depth should be adjustable | 2026-05-16 adds a relationship-depth slider on `PortRelationshipGraph` and verifies depth 1/2/3 filtering without rescanning or fake data | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.6.1 | Users should be able to recognize the port popout and relationship graph in plain language | 2026-05-16 adds a visible `PortModuleTour` whose real actions open the existing port popout and switch to the existing relationship graph for the current scanned port | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.6.2 | Port module Tour should cover Pop-out, security tier, and relationship graph entry in three steps | 2026-05-16 adds a persisted 3-step Tour with live security-tier counts, disabled no-port actions, and regression coverage in `PortView.port-popout.test.tsx` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` D.6.3 | Port cards should no longer feel too small or cramped | 2026-05-16 adds an explicit breathing-room density marker and verifies the 96px minimum-height contract | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.1.1 | Window list/card surfaces should show hwnd, title, process, and always-on-top state | 2026-05-16 adds visible HWND and topmost state to `WindowCard` and `WindowItem`, sourced from `listTopmostWindows()` state | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.1.2 | Multiple same-app windows should be distinguishable | 2026-05-16 adds `data-window-instance-key=processName:pid:hwnd` and visible HWND/PID fields to card and list rows | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.1.3 | Window titles should redact sensitive information | 2026-05-16 adds renderer-side title redaction for token/api_key/secret/password/Bearer/sk/AWS/JWT shapes across visible title surfaces | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.4.1 and G.2.5 | Window detail should embed both topology graph and flow/relationship graph views | Existing `WindowView` relationship panel renders `AttachedGraphView` and `AttachedFlowView`; 2026-05-16 strengthens regression evidence for both views | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.5.1 | Users should be able to recognize the window relationship view in plain language | 2026-05-16 adds a visible `WindowModuleTour` identity step whose action opens the existing relationship panel for the selected real HWND | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.5.2 | Window module Tour should cover instance disambiguation, operation matrix, and always-on-top in three steps | 2026-05-16 adds a persisted 3-step Tour with live HWND/PID/process evidence, disabled no-window actions, and regression coverage in `WindowView.test.tsx` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.5.3 | Window operations should provide visual feedback | 2026-05-16 strengthens the Tour-triggered Always-on-top path by verifying the real `setWindowTopmost` call and success toast; 2026-05-19 routes card/list focus quick actions and AI-card focus/minimize/maximize/restore/close quick actions through the existing `handleWindowOperation()` toast feedback path, with regressions proving card focus shows `窗口已前置` and minimize/maximize show visible success feedback | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.5.4 | Keyboard injection should display the target window before sending | 2026-05-16 adds `send-safe-keys` confirmation text naming the concrete HWND/title before calling the real `sendKeysToWindow()` path | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` E.5.5 | Keyboard injection failures should be explicit | 2026-05-16 adds failure toast text containing the target HWND/title and key combination | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.3.3 | CSV prompt column should support `@skill:xxx` reference syntax | 2026-05-16 adds prompt-level `@skill:<name>` parsing in `CsvTaskDriver`; valid prompt references are validated against loaded skill names and mapped to runtime row `skill` while preserving the original prompt | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.3.4 | Missing SKILL should fail startup with a clear prompt | 2026-05-16 rejects missing and malformed prompt skill references before runtime rows are created, with `inputArgs` errors such as `skill not found: missing-skill` | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.3.5 | SKILL sandbox levels should execute correctly | 2026-05-16 adds SKILL metadata `license`, `sandbox`, and `mcpServers`; Node SKILL execution now enforces read-only/read-write/system boundaries through a preload guard and verifies read-only write blocking plus system child-process execution | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.3.6 | SKILL should be MCP-compatible | 2026-05-16 adds `mcpServers` metadata and passes it to system SKILL scripts; regression coverage starts a real local stdio JSON-RPC MCP server and calls `initialize`, `tools/list`, and `tools/call` from a SKILL | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.1 | CSV 18 columns should all be supported | Shared `CSV_COLUMN_NAMES` remains the fixed 18-column source of truth; schema, docs, template export, and runtime launch tests cover the 18-column path | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.2 | CSV launch should validate duplicate ids, path existence, and API key leakage before startup | 2026-05-16 adds duplicate `taskId` rejection, opt-in real `inputFile` checks via `require_input_file`, and likely API key leak detection over `inputArgs`/prompt text | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.3 | CSV should support sequential and parallel execution modes | `StoreBackedTaskQueueService.startReadyTasks()` enforces global `concurrent` and per-`parallelGroup` limits; tests verify concurrent 1 and parallel group scheduling from CSV groups | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.4 | CSV prompt should support `{{cwd}}` / `{{file}}` interpolation | 2026-05-16 adds prompt interpolation in `CsvTaskDriver` from `inputArgs.cwd` and `inputFile`, with regression coverage proving the expanded runtime prompt carries the real cwd and file path | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.5 | CSV prompt should support `@file:` external file references | 2026-05-16 adds bounded local `@file:<path>` expansion from real files and rejects unreadable references before creating runtime rows | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.6 | Re-running the same task id should be idempotent or user-selectable | Queue resume logic skips prior succeeded rows with matching rowHash and supports `forceRerun`; regression tests cover resume skip, forced rerun, and rowHash change rerun | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.7 | Failed tasks should be rerunnable without disturbing completed tasks | Retry and on_fail paths keep transitions explicit; tests cover retry scheduling/backoff, manual retry, fixture retry, and failed SKILL recovery leaving completed rows untouched | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` F.4.8 | Task results should produce exportable artifacts as CSV/JSON | 2026-05-19 adds a unified `task:export-results` workflow: Zod request/result schemas, IPC/preload/global bridge, `R8RuntimeService.exportTaskResults()` writing real CSV and JSON files from current task queue state, and `R8OpsPanel` user action showing returned artifact paths/files | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` H.1.1 / J.1.6 | Startup should pass a 60-second packet-capture zero-egress check | 2026-05-19 adds `scripts/verify-zero-egress-capture.mjs`, a real Windows `pktmon` runner that checks preconditions, starts NIC packet counters, launches `pnpm dev`, observes 60 seconds, parses packet counters, and writes JSON evidence. Current shell is non-admin, so preflight returns blocked instead of pass. | runner implemented, administrator live capture blocked |
| `28-final-acceptance-checklist.md` K.8 | Vendor logo fair-use statement should exist in README and About page | README already contains the public trademark/fair-use notice; 2026-05-19 adds a real Advanced settings About/fair-use section covering vendor name/logo identification-only use, no endorsement/agency claim, AGPL-3.0 license boundary, and NOTICE/SBOM dependency-license evidence | advanced, not user-accepted |
| `28-final-acceptance-checklist.md` B-E sections | Theme, process, port, window behavior must be user-visible and testable | Covered piecemeal by R8.A/B/C ledgers, not audited directly against this 285-item user checklist | open |
| `17-watchdog-engineering-survey.md` | Watchdog engineering behaviors | Covered by `0503-2` spec-16/spec-17 partial ledger; packaged InnerWatchdog entrypoint build/run proof is now verified, but parent-side JSON-RPC servers, full bidirectional heartbeat, orphan/takeover, and OS collector adapters remain incomplete | partial |
| `16-csv-task-driver-deep-survey.md` | CSV task driver semantics and artifacts | Covered by `0503-2` spec-12/spec-15/spec-20 partial/verified rows | partial |
| `18-auto-inject-engineering-survey.md` | Auto-inject diagnostics and real execution paths | Covered by `0503-2` spec-18/spec-19 partial rows | partial |

## Current Implementation Slice

### 2026-05-16 A.1.6 Monitor Topology Entry

Implemented:

- `MonitorPanel` now has a top-level `topology` tab between `AI 任务` and `R8 运营`.
- The tab renders the existing `FullScreenTopologyView`, preserving existing process/port/window attached topology entry points.
- The previous regression expectation that topology must not be a top-level tab was replaced with the `prompts/0503` final-acceptance requirement that topology must be visible in the top navigation.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/MonitorPanel.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
```

Result:

- `MonitorPanel.test.tsx`: 1 file passed, 1 test passed.
- TypeScript typecheck passed.

Not claimed:

- The agent has not marked `28-final-acceptance-checklist.md` A.1.6 as `[x]`, because that document says final acceptance must be user-verifiable.
- Flow as a separate global top navigation entry remains an open acceptance question.

### 2026-05-16 A.4.5 Global Flow Entry Evidence

Implemented:

- The newly visible MonitorPanel `拓扑` tab opens the existing `FullScreenTopologyView`.
- `FullScreenTopologyView` already exposes `网络拓扑`, `神经关系`, and `流程图` graph-kind buttons through `GraphKindSwitcher`.
- Added regression coverage proving the `流程图` button calls the real `window.devhub.r8.topology.buildGlobalGraph` bridge with `graphKind: 'flow'`.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx --maxWorkers=1
```

Result:

- 2 files passed, 4 tests passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the flow entry in the running app.

### 2026-05-16 A.4.5 Direct Flow Command Entry

Implemented:

- `R8RuntimeService.listCommands()` now includes `topology.flow` as a real command-palette navigation entry titled `打开全局流程图`.
- `R8RuntimeService.invokeCommand({ commandId: 'topology.flow' })` emits the existing `r8:command-event` bridge with `{ type: 'topology-navigate', graphKind: 'flow' }`.
- `App` preserves the existing global topology route while passing the one-shot graph-kind intent through `globalTopologyNavigation`.
- `FullScreenTopologyView` consumes pending flow intents both on first render and while already mounted, then calls `window.devhub.r8.topology.buildGlobalGraph` with `graphKind: 'flow'`.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx src/renderer/utils/globalTopologyNavigation.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "pinyin|MonitorPanel|global topology navigation|FullScreenTopologyView|opens fullscreen topology|scanner object commands"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- 5 files passed, 13 tests passed, 120 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 653 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the command entry in the running app.

### 2026-05-16 Q-8.A.3 Object Topology Command Entries

Implemented:

- `R8RuntimeService.listCommands()` now adds scanner-backed object relationship commands from real `ScannerCache` rows:
  - `topology.process.<pid>` for process graph focus.
  - `topology.port.<port>.<pid>` for port graph focus.
  - `topology.window.<hwnd>` for window graph focus.
- Each command uses `handler: 'topology:open'`, a validated `devhub://` target, and a concrete global graph node id.
- Topology commands include Chinese, pinyin, and English discovery keywords, including `拓扑`, `关系`, `tuopu`, `guanxi`, `流程图`, and `liucheng`.
- `R8RuntimeService.invokeCommand()` rejects stale missing targets, records command history, and emits `{ type: 'topology-navigate', selectedNodeId }`.
- `App` consumes `selectedNodeId` through the existing global topology bridge so the real `FullScreenTopologyView` opens focused on the selected scanner object.

Verified by:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "scanner object commands|opens fullscreen topology"
pnpm -C devhub exec vitest run src/renderer/components/command/R8CommandPalette.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "pinyin|scanner object commands|opens fullscreen topology"
```

Result:

- 1 file passed, 2 tests passed, 107 skipped by filter.
- 2 files passed, 3 tests passed, 120 skipped by filter.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies command-palette discovery in the running app.

### 2026-05-16 C.6.3 Statusbar Topology Active Count

Implemented:

- The existing `StatusBar` topology badge now reads active running processes from `useProcessStore`.
- The badge renders `data-active-process-count`, shows the visible process count next to `拓扑`, and keeps the existing click behavior to open global topology.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/statusbar/StatusBar.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/statusbar/StatusBar.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx src/renderer/utils/globalTopologyNavigation.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "R8.B StatusBar|pinyin|MonitorPanel|global topology navigation|FullScreenTopologyView|opens fullscreen topology|scanner object commands"
pnpm -C devhub typecheck
```

Result:

- 1 file passed, 4 tests passed.
- Combined focused statusbar/command/topology suite passed: 6 files passed, 17 tests passed, 120 skipped by filter.
- TypeScript typecheck passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the statusbar in the running app.

### 2026-05-16 C.1.1 / C.2.1 Process Parent Field Parity

Implemented:

- `SystemProcessScanner` now reads `ParentProcessId` in the normal Win32 process scan and carries it into `ProcessInfo.ppid`.
- During scan normalization, DevHub resolves `parentName` from the same real process snapshot when the parent PID is present.
- `PROCESS_VM_FIELDS` now includes `ppid` and `parentName`, so card/list/detail VM surfaces advertise the same parent-process contract.
- `ProcessCard` and `ProcessItem` now both render the parent process label while preserving existing PID, name, CPU, memory, status, port, command, and tag surfaces.
- The list header adds a `父进程` column so list/card field parity is visible rather than hidden in metadata.

Verified by:

```bash
npx --no-install gitnexus impact SystemProcessScanner --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact ProcessView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/SystemProcessScanner.test.ts --maxWorkers=1 -t "parent process metadata"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `SystemProcessScanner` returned `MEDIUM` risk with 12 direct upstream references; the slice stayed additive on the existing `ProcessInfo` data shape.
- GitNexus impact for `ProcessView` returned `LOW` risk with no upstream impacted symbols.
- `ProcessView.test.tsx` passed: 1 file passed, 6 tests passed.
- Focused `SystemProcessScanner.test.ts` parent metadata case passed: 1 test passed, 57 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies process-card/list parent fields in the running app.

### 2026-05-16 C.1.2 Process Card Topology Badge Evidence

Implemented:

- No UI structure change was required; `ProcessCard` already renders a top-right `CardEdgeGraphBadge`.
- Regression evidence now asserts the process-card badge exposes `data-graph-entry="process-card-attached-topology"`, `data-graph-kind="attached"`, `data-graph-scope="process"`, and the real PID target id.
- The same test verifies the badge click dispatches the existing `devhub:monitor-navigate` relationship scope and remains isolated from the double-click detail shortcut.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|attached topology tab|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessDetailPanel.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- `ProcessView.test.tsx` passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the process-card badge in the running app.

### 2026-05-16 C.1.5 Process Card Double-Click Detail Entry

Implemented:

- `ProcessCard` now exposes a card-surface double-click shortcut that calls the same real detail path as the existing detail button.
- The card root carries `data-detail-entry="process-card-double-click"` for regression evidence and UI auditability.
- Interactive controls inside the card, including the existing relationship graph badge, are excluded from the double-click shortcut so graph navigation remains independent.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "ProcessCard|global topology|attached graph|WindowView attached topology|PortFocusPanel"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- `ProcessView.test.tsx` passed: 1 file passed, 2 tests passed.
- Combined process/port/window relation-entry suite passed: 4 files passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.
- GitNexus impact for `ProcessView` returned `LOW` risk with no upstream impacted symbols; the installed CLI still does not expose `detect_changes`, so no detect-changes result is claimed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies double-click behavior in the running app.

### 2026-05-16 C.1.3 Process Context Menu Copy PID

Implemented:

- The process card right-click menu now includes `复制 PID` and writes the real PID string to the browser clipboard.
- The same `复制 PID` action is available from the process list-row context menu, keeping card/list operations aligned.
- Existing menu operations for detail, directory, command copy, process tree, tag edit, and kill remain unchanged.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|global topology|attached graph|WindowView attached topology|PortFocusPanel"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- `ProcessView.test.tsx` passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 4 files passed, 12 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

Not claimed:

- This 2026-05-16 slice did not close the process popout path; the 2026-05-19 slice below adds and verifies it.
- The final acceptance checkbox remains unchecked until the user verifies the full menu behavior in the running app.

### 2026-05-19 C.1.3 Process Context Menu Popout

Implemented:

- `ProcessCard` now exposes a `弹出进程` context-menu action that calls the existing real `window.devhub.r8.popout.create()` bridge with `surface: 'process'`, the concrete PID as `targetId`, `mode: 'browserwindow'`, route `/monitor`, and a process-specific title.
- `ProcessItem` list rows expose the same `弹出进程` context-menu action, keeping card and list operations aligned.
- The implementation reuses the existing R8 BrowserWindow popout surface schema, which already accepts `process`, and does not add a mock window, fake popout record, or new IPC bypass.
- Success and failure states are surfaced through the existing toast system, so a rejected IPC call remains visible instead of silently pretending the popout opened.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1 --reporter=verbose
pnpm -C devhub exec eslint src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx --max-warnings=0
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx
```

Result:

- `ProcessView.test.tsx` passed: 1 file, 8 tests.
- New tests prove both the process card and process list-row context menus call the real popout bridge with the concrete PID target and `/monitor` route.
- Touched-file ESLint passed with zero warnings.
- TypeScript no-emit passed.
- `check:no-emoji` passed with `No emoji found in 778 files`.
- Targeted devhub diff whitespace check passed with only the existing LF-to-CRLF warning for `ProcessView.tsx`.

Not claimed:

- The final `prompts/0503/28-final-acceptance-checklist.md` checkbox remains unchecked until the user performs UI acceptance in the running app.

### 2026-05-19 E.5.3 Window Operation Visual Feedback Closure

Implemented:

- Regular window card/list focus quick actions now route through the same `handleWindowOperation('focus', window)` path as the operation panel, so they show the existing success/error toast rather than silently calling `focusWindow()`.
- AI window card focus, minimize, maximize, restore, and close quick actions now route through `handleWindowOperation()` as well, so they reuse the existing visible feedback strings for foregrounding, minimize, maximize, restore, and close outcomes.
- The existing operation panel feedback remains unchanged for move/resize, opacity, screenshot, copy title, navigation, favorite, title update, keyboard injection, close, and kill-process actions.
- No fake operation result is introduced: toast state follows the real hook return value or caught error path.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 --reporter=verbose
pnpm -C devhub exec eslint src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx --max-warnings=0
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
```

Result:

- `WindowView.test.tsx` passed: 1 file, 18 tests.
- New regressions prove the card focus quick action calls the real `focusWindow(hwnd)` hook and renders the visible success feedback `窗口已前置`, and that minimize/maximize operations call the real hooks while rendering `窗口已最小化` / `窗口已最大化`.
- Touched-file ESLint passed with zero warnings.
- TypeScript no-emit passed.
- `check:no-emoji` passed with `No emoji found in 778 files`.
- Targeted devhub diff whitespace check passed with only the existing LF-to-CRLF warning for `WindowView.tsx`.

Not claimed:

- The final `prompts/0503/28-final-acceptance-checklist.md` checkbox remains unchecked until the user verifies the full window operation matrix in the running app.

### 2026-05-16 C.2.4 Process List Row Drawer Entry

Implemented:

- `ProcessItem` list rows now use the same existing `onShowDetail(pid)` path as the detail button to open `ProcessDetailDrawer`.
- The row root carries `data-detail-entry="process-row-click-drawer"` for auditability against the final acceptance requirement.
- Ctrl, Meta, and Shift selection gestures still update selection without opening the drawer, preserving batch-selection behavior.
- Interactive row children remain isolated from the row shortcut through the shared process-surface guard.

Verified by:

```bash
npx --no-install gitnexus impact ProcessView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `ProcessView` returned `LOW` risk with no upstream impacted symbols.
- `ProcessView.test.tsx` passed: 1 file passed, 6 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies list-row drawer opening in the running app.

### 2026-05-16 C.3.1 Process Detail Required Tabs Evidence

Implemented:

- No UI structure change was required; `ProcessDetailPanel` already exposes the five required tabs: `基础`, `资源`, `网络`, `环境`, and `模块`.
- Regression evidence now also asserts the adjacent `关联` and `关系视图` entries, including the relationship tab's `data-graph-entry="process-detail-tab"` and `data-graph-kind="attached"` markers.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessDetailPanel.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|global topology|attached graph|WindowView attached topology|PortFocusPanel"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- `ProcessDetailPanel.test.tsx` passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 4 files passed, 13 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the detail panel tabs in the running app.

### 2026-05-16 C.3.2 Process Detail Header Look-At-Graph Entry

Implemented:

- The `ProcessDetailPanel` header attached-topology action now shows the explicit Chinese label `看图`.
- The button keeps `data-graph-entry="process-detail-attached-topology"` and `data-graph-kind="attached"`, and its title explains that it opens the process relationship view.
- The neighboring global topology button now uses visible `全局拓扑` text and a matching title.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessDetailPanel.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|attached topology tab|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessDetailPanel.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- `ProcessDetailPanel.test.tsx` passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.
- GitNexus impact lookup for `ProcessDetailPanel` returned `Target 'ProcessDetailPanel' not found`; no impact result is claimed for that symbol.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the visible `看图` header button in the running app.

### 2026-05-16 C.3.3 / G.2.3 Process Detail Attached Graph Evidence

Implemented:

- No UI structure change was required; `ProcessDetailPanel` already renders the attached relationship view for a selected process.
- Regression evidence now asserts the attached relationship tab renders both `AttachedGraphView` and `AttachedFlowView` with `data-root-kind="process"` and the selected real PID.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessDetailPanel.test.tsx --maxWorkers=1 -t "attached topology tab"
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|attached topology tab|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- Focused `ProcessDetailPanel.test.tsx` attached topology case passed: 1 test passed, 2 skipped by filter.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the process-detail relationship panel in the running app.

### 2026-05-16 D.1.1 Port Card Required Field Evidence

Implemented:

- `PortCard` now exposes `data-r8a-fields="port,protocol,pid,state,securityTier"` on the card root for field-level auditability.
- The visible port, protocol, PID, state, and security-tier surfaces now carry explicit `data-port-field` markers.
- The security tier still comes from the existing `classifyPortSecurity` path through `SecurityTierBadge`; no fake or static tier was introduced.

Verified by:

```bash
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "required port card fields|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- Focused `PortView.port-popout.test.tsx` field/topology cases passed: 2 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the port card fields in the running app.

### 2026-05-16 D.1.2 Port Security Tier Visual Coding

Implemented:

- `SecurityTierBadge` now exposes `data-security-tier`, `data-security-tone`, and `data-security-label` for visual-audit and accessibility checks.
- The `WAN-Capable` tier now uses a distinct orange tone instead of reusing the warning/yellow tone reserved for `LAN`.
- The existing R8 four-tier model remains intact: `Local`, `LAN`, `WAN-Capable`, and `Suspicious`.

Verified by:

```bash
npx --no-install gitnexus impact SecurityTierBadge --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact PortFocusPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/port/SecurityTierBadge.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "SecurityTierBadge|required port card fields"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- GitNexus target lookup for `SecurityTierBadge` and `PortFocusPanel` returned `Target not found`; no impact result is claimed for those symbols.
- Focused badge/card suite passed: 2 files passed, 5 tests passed, 15 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the security-tier colors in the running app.

### 2026-05-16 D.1.3 Port Card Popout Evidence

Implemented:

- No production code change was required for basic card popout support. `PortCard` already opens floating popouts through explicit click, context menu, drag threshold, and the new long-press advanced-menu path.
- Existing `PortPopoutHost` renders real floating port cards and `usePortPopoutManager.promote()` can promote them through the BrowserWindow popout bridge.
- Regression evidence covers click/context-menu/drag popout triggers and the new long-press advanced-menu popout trigger.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "opens a floating port card|long press"
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/main/services/PortScanner.test.ts docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- Focused `PortView.port-popout.test.tsx` popout evidence is covered by existing trigger tests and the long-press advanced-menu test.
- `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies card popouts in the running app.

### 2026-05-16 D.1.4 Port Card Topology Badge Evidence

Implemented:

- No UI structure change was required; `PortCard` already renders a top-right `CardEdgeGraphBadge`.
- Regression evidence now asserts the port-card badge exposes `data-graph-entry="port-card-attached-topology"`, `data-graph-kind="attached"`, `data-graph-scope="port"`, and the real port target id.
- Clicking the badge switches `PortView` into the existing relationship graph view and renders the real `PortFocusPanel` relationship section.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "card edge topology badge"
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|global topology|attached graph|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- Focused `PortView.port-popout.test.tsx` badge case passed: 1 test passed, 14 skipped by filter.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the port-card badge in the running app.

### 2026-05-16 D.2.1 / D.2.2 Port View Modes and Persistence

Implemented:

- `PortView` now exposes `data-port-view-modes="cards,list,relationship"` and `data-port-view-mode` on the root for auditability.
- The selected port view mode is persisted under `devhub:port-view-mode` and restored on mount.
- The existing card, list, and relationship render paths remain unchanged; the update only adds persistence and observable mode state.

Verified by:

```bash
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "three port view modes|persisted port view mode|required port card fields|breathing-room"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- Focused `PortView.port-popout.test.tsx` mode/field/breathing-room cases passed: 4 tests passed, 15 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

Not claimed:

- The final acceptance checkboxes remain unchecked until the user verifies mode switching in the running app.

### 2026-05-16 D.2.3 Port Relationship Mode Default Scope

Implemented:

- `PortRelationshipGraph` root now exposes `data-relationship-scope="all-monitored-ports"` to make the default graph scope inspectable.
- `data-focus-port` remains only a selection/highlight hint; it does not narrow the graph's input set.
- Regression coverage now verifies `buildFlowData()` includes every supplied monitored port by default, including ports owned by different real PIDs.
- The UI depth-control test also verifies the default rendered scope marker.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx --maxWorkers=1
```

Result:

- Focused `PortRelationshipGraph` suite passed: 2 files passed, 6 tests passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies relationship mode in the running app.

### 2026-05-16 D.3.1 Port Focus Panel Attached Graph Evidence

Implemented:

- No UI structure change was required; `PortFocusPanel` already renders both `AttachedGraphView` and `AttachedFlowView`.
- Regression evidence now asserts both attached views receive `data-root-kind="port"` and the selected real port id.
- The existing header attached-graph button still focuses the real relation section.

Verified by:

```bash
npx --no-install gitnexus impact PortFocusPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortFocusPanel.test.tsx --maxWorkers=1 -t "attached graph"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus target lookup for `PortFocusPanel` returned `Target not found`; no impact result is claimed for that symbol.
- Focused `PortFocusPanel.test.tsx` attached graph case passed: 1 test passed, 3 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the port focus relationship panel in the running app.

### 2026-05-16 D.3.2 Port Focus Panel Detach Popout

Implemented:

- `PortFocusPanel` now exposes `data-detach-capability="browserwindow-popout"` on the panel root.
- The header now has a `port-focus-detach-popout-button` action with `data-r8b-detach-surface="browserwindow"`.
- The action calls the existing real preload bridge `window.devhub.r8.popout.create()` with `surface="port"`, the selected real port number, a focus-panel route, explicit BrowserWindow bounds, and a deterministic title.
- The implementation does not fabricate a detached panel in renderer state. If the bridge is unavailable or fails, the visible `port-focus-detach-state` reports `unavailable` or `failed`.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortFocusPanel.test.tsx --maxWorkers=1 -t "detach|attached graph|stale|轻量模式"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- Focused `PortFocusPanel.test.tsx` suite passed: 1 file passed, 4 tests passed, 2 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the detached BrowserWindow in the running Electron app.

### 2026-05-16 D.3.3 / D.3.4 Port Focus Cache and Stale Warning

Implemented:

- `PortFocusPanel` stale cache warning now exposes `data-testid="port-stale-warning"`, `data-stale-source`, and `data-stale-position="top"`.
- Regression evidence now verifies a cache/stale incremental result renders the stale warning at the top of the content area.
- The same test verifies the panel still renders snapshot content and the attached topology section instead of a blank waiting state.

Verified by:

```bash
npx --no-install gitnexus impact PortFocusPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortFocusPanel.test.tsx --maxWorkers=1 -t "stale|轻量模式|attached graph"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus target lookup for `PortFocusPanel` returned `Target not found`; no impact result is claimed for that symbol.
- Focused `PortFocusPanel.test.tsx` stale/light/attached cases passed: 3 tests passed, 2 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

Not claimed:

- The final acceptance checkboxes remain unchecked until the user verifies cache/stale behavior in the running app.

### 2026-05-16 D.4.1 Port Release Confirmation Evidence

Implemented:

- No UI structure change was required; both port card and list release paths already open the shared `ConfirmDialog`.
- Regression evidence now verifies the card release path does not call `releasePort` before confirmation.
- The same test verifies cancel keeps `releasePort` untouched and confirm calls `releasePort(3000)` exactly once.

Verified by:

```bash
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "requires confirmation|three port view modes|persisted port view mode"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- Focused `PortView.port-popout.test.tsx` release/mode cases passed: 3 tests passed, 17 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the release confirmation in the running app.

### 2026-05-16 D.4.2 Port Card Long-Press Advanced Menu

Implemented:

- `PortCard` now starts a 1500ms long-press timer on pointer down and cancels it on pointer up or mouse leave.
- A completed long press opens a real advanced action menu with `role="menu"` and `data-long-press-threshold-ms="1500"`.
- The menu reuses existing real handlers for relationship graph navigation, floating popout opening, and release confirmation. It does not introduce placeholder actions.
- Drag popout behavior remains isolated: the long-press path stops the pointer-up drag trigger after the menu opens.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "long press"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/main/services/PortScanner.test.ts docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- Focused `PortView.port-popout.test.tsx` long-press suite passed: 1 file passed, 1 test passed, 20 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies long-press behavior in the running app.

### 2026-05-16 D.4.3 Port Operation Audit Log Evidence

Implemented:

- No production code change was required for the release operation. `PortScanner.releasePort()` already writes structured `port:release` audit entries through the shared `AuditLogger`.
- The audit path covers refused protected-process releases, refused non-development-process releases, and accepted release attempts before the process termination call.
- Regression coverage now proves a protected-process release refusal calls `auditLogger.log('port:release', { port, pid, processName }, 'refused', 'protected process')`.

Verified by:

```bash
pnpm -C devhub exec vitest run src/main/services/PortScanner.test.ts --maxWorkers=1 -t "Port Operation Audit Logging"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/main/services/PortScanner.test.ts docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- Focused `PortScanner.test.ts` audit suite passed: 1 file passed, 1 test passed, 16 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies audit log output in the running app and local log file.

### 2026-05-16 D.5.1 / D.5.2 / D.5.3 Port Relationship View Semantics and Depth

Implemented:

- `PortRelationshipGraph` now exports a typed `buildFlowData()` contract for relationship evidence instead of hiding all graph semantics inside render-only state.
- Real port-to-process edges now carry `relationshipKind="owns"`, `sourceKind="port"`, `targetKind="process"`, and the real `port`/`pid` metadata.
- Real remote connections now render as `flowRemote` nodes only when `PortInfo.foreignAddress` is concrete. Wildcard and zero addresses such as `*:*`, `0.0.0.0`, `0.0.0.0:0`, and `[::]:0` are ignored rather than fabricated into remote peers.
- Port-to-remote edges now carry `relationshipKind="connects"`, `edgeType="port-external"`, and the real remote address from scanner data.
- The relationship graph header now exposes a `关系视图节点深度` range control with observable root metadata `data-relationship-depth` and `data-relationship-depth-range="1-3"`.
- Depth 1 shows port/process ownership, depth 2 adds process/window ownership, and depth 3 adds real remote connection nodes. Filtering is local to the already-built graph and does not trigger extra scanners or fake data.

Verified by:

```bash
npx --no-install gitnexus impact PortRelationshipGraph --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- GitNexus target lookup for `PortRelationshipGraph` returned `Target not found`; no impact result is claimed for that symbol.
- Focused `PortRelationshipGraph` suite passed: 2 files passed, 5 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with the existing LF-to-CRLF warning only; Trellis task context validation passed.

Not claimed:

- The final acceptance checkboxes remain unchecked until the user verifies the relationship graph in the running app.
- No fake remote endpoints are added for listening sockets or wildcard/zero foreign addresses.

### 2026-05-16 D.6.3 Port Card Breathing Room Evidence

Implemented:

- `PortCard` now exposes `data-r8a-density="breathing-room"` next to the existing `data-r8a-min-height="96"` contract.
- The existing inline style remains bound to `var(--r8a-port-card-min-height, 96px)`, preserving the R8.A minimum-height fallback.
- The check is evidence-only for the existing card layout; no card content was removed or compressed.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "required port card fields|card edge topology badge|breathing-room"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- Focused `PortView.port-popout.test.tsx` field/topology/breathing-room cases passed: 3 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies port-card spacing in the running app.

### 2026-05-16 E.4.1 / G.2.5 Window Detail Attached Graph Evidence

Implemented:

- No UI structure change was required; `WindowView` already embeds the selected window relationship panel.
- Regression evidence now asserts that the panel renders both `AttachedGraphView` and `AttachedFlowView` with the selected real window `hwnd`.
- Existing tests still verify the header relationship button focuses the real panel, the global topology button selects `window-<hwnd>`, and the card edge graph badge focuses the relationship panel.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "attached topology header"
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Result:

- Focused `WindowView.test.tsx` suite passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the window-detail relationship panel in the running app.

### 2026-05-16 C.7.2 / C.7.3 Process Module Tour Evidence

Implemented:

- `ProcessView` now renders a persisted `ProcessModuleTour`.
- Step 1 switches the existing process view mode through `setViewMode()` and keeps the existing localStorage persistence contract.
- Step 2 selects the current real PID and emits the existing `devhub:monitor-navigate` topology event.
- Step 3 switches to card mode and opens the existing `ProcessCard` context menu for the current real process.
- When no process exists, Tour actions stay disabled and explicitly state that no sample process is created.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/MonitorCardEdgeBadge.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- `MonitorCardEdgeBadge.test.tsx` passed: 5 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 660 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the process Tour wording in the running app.

### 2026-05-16 C.7.4 / C.7.5 Process NEW Badge and F1 Help Evidence

Implemented:

- `ProcessView` now shows a process-module `NEW` badge during the R8 30-day release window anchored at `2026-05-16T00:00:00+08:00`.
- The badge exposes verification metadata for release-window status, configured day window, and remaining days.
- `ProcessView` now registers F1 through the existing `useGlobalShortcuts` hook and opens a contextual process help panel.
- A visible header `帮助 F1` button opens the same help panel for users who do not discover the shortcut first.
- `ProcessModuleHelp` is embedded/offline and states the real data source (`SystemProcessScanner`), current view, real process count, and current PID/name when one exists.
- When no process exists, help still opens but states that operations wait for real scanner results and no sample process is generated.

Verified by:

```bash
npx --no-install gitnexus impact ProcessView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/MonitorCardEdgeBadge.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- GitNexus impact for `ProcessView` returned LOW risk with 0 upstream impacted symbols/processes.
- `MonitorCardEdgeBadge.test.tsx` passed: 8 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 662 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the running app and confirms the release-window badge visibility.

### 2026-05-16 E.1.1 / E.1.2 Window Identity Field Evidence

Implemented:

- `WindowCard` now renders visible title, process name, PID, HWND, and always-on-top state.
- `WindowItem` list rows now render the same process name, PID, HWND, and always-on-top state.
- Both surfaces expose `data-window-instance-key` using the real `processName:pid:hwnd` tuple for same-app instance disambiguation.
- Topmost state uses the existing `listTopmostWindows()` state, not hard-coded UI.

Verified by:

```bash
npx --no-install gitnexus impact WindowView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- GitNexus impact for `WindowView` returned LOW risk with 0 upstream impacted symbols/processes.
- `WindowView.test.tsx` passed: 9 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 662 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the running app with multiple same-app windows.

### 2026-05-16 E.1.3 Window Title Redaction Evidence

Implemented:

- Added `redactWindowTitle()` for renderer-side display redaction.
- Redaction covers `api_key=...`, `token=...`, `secret=...`, `password=...`, Bearer tokens, OpenAI-style `sk-...` keys, AWS access keys, and JWT-looking values.
- `WindowView` applies redacted titles to visible cards, list rows, grouped windows, AI title badges, selected-window relationship headers, and safe-key injection target text.
- Raw window titles remain available to matching, rename, copy-title, and persistence paths; this is a display/privacy layer only.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/window/windowTitleRedaction.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- Focused WindowView + window title redaction suites passed: 2 files passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the running app with real sensitive-title windows.

### 2026-05-16 E.5.1 / E.5.2 Window Module Tour Evidence

Implemented:

- `WindowView` now renders a persisted `WindowModuleTour` on the windows tab.
- Step 1 shows the selected concrete HWND/PID/process tuple and opens the existing relationship panel for that HWND.
- Step 2 switches to cards mode and selects the current real window so the existing `WindowOperationPanel` is visible.
- Step 3 calls the real `handleSetWindowTopmost()` path for the current window and keeps the existing toast feedback.
- When `windows` is empty, Tour actions stay disabled and explicitly state that no sample window is created.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- `WindowView.test.tsx` passed: 6 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 659 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies the window Tour and relationship wording in the running app.
- This 2026-05-16 slice only strengthened the Always-on-top Tour path; the 2026-05-19 E.5.3 slice closes the local quick-action visual-feedback gap.

### 2026-05-16 E.5.4 / E.5.5 Window Safe Keyboard Injection Prompt and Failure Feedback

Implemented:

- `send-safe-keys` is now part of the shared window operation catalog and `WindowOperationKind`.
- `WindowOperationPanel` exposes the operation through the existing operation matrix instead of adding a disconnected debug control.
- `WindowView` prompts for an allowed key combination, asks for target-specific confirmation, then calls the existing `sendKeysToWindow()` hook.
- The send path remains the real existing stack: renderer hook -> preload `windowManager.sendKeys` -> IPC `WINDOW_SEND_KEYS` -> `WindowManager.sendKeysToWindow()`.
- Before the send call, the user sees which concrete HWND/title will receive the keyboard event.
- If the send call returns false, the error toast includes the target window and key combination.
- `ToastProvider` now generates monotonic toast IDs so the pre-send info toast and result toast cannot collide in the same millisecond.

Verified by:

```bash
npx --no-install gitnexus impact WindowView --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact ToastProvider --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx src/shared/window-operations-catalog.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- GitNexus impact for `WindowView` returned LOW risk with 0 upstream impacted symbols/processes.
- GitNexus impact for `ToastProvider` returned LOW risk with 0 upstream impacted symbols/processes.
- Focused WindowView + operation catalog suites passed: 2 files passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 662 files.

Not claimed:

- The final acceptance checkbox remains unchecked until the user verifies keyboard injection against a real external window in the running app.

### 2026-05-16 F.1.2 AI Monitor 12-State Taxonomy Evidence

Implemented:

- Expanded the shared `AIMonitorState` taxonomy from the legacy 8 visible states to 12 distinct states: `initializing`, `idle`, `thinking`, `receiving-input`, `coding`, `compiling`, `validating`, `waiting-input`, `awaiting-human`, `stuck`, `completed`, and `error`.
- Updated the real `CompletionStateMachine` path so young running processes classify as `initializing`, stdin/input evidence classifies as `receiving-input`, explicit user approval prompts classify as `awaiting-human`, and long non-terminal idle tasks classify as `stuck`.
- Kept the existing legacy `AITaskState` and R8.C spec-28 three-layer FSM intact; the expanded taxonomy is an additive monitor-state layer, not a destructive replacement.
- Updated AI task cards, AI progress timeline, and AI window cards so the new states have visible labels and progress semantics instead of collapsing back to generic `running` or `waiting`.
- Updated the contract-model Zod registry so the documented AIMonitorState contract accepts the expanded taxonomy while preserving prior legacy contract aliases.

Verified by:

```bash
npx --no-install gitnexus impact AITaskTracker --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact DetectionEngine --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact SignalDiagnosticPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/main/services/detection/DetectionEngine.test.ts src/shared/detection/derive-progress.test.ts src/shared/schemas/contract-models.test.ts --maxWorkers=1
pnpm -C devhub typecheck
```

Result:

- GitNexus impact for `AITaskTracker` returned MEDIUM risk with 7 direct importers; no HIGH or CRITICAL result was returned.
- GitNexus target lookup for `DetectionEngine` returned `Target not found`; no impact result is claimed for that symbol.
- GitNexus impact for `SignalDiagnosticPanel` returned LOW risk with 0 upstream impacted symbols/processes.
- Focused detection/progress/contract suite passed: 3 files passed, 21 tests passed.
- TypeScript typecheck passed after one transient WSL `UtilAcceptVsock` interruption was retried successfully.

Not claimed:

- The final F.1.2 acceptance checkbox remains unchecked until the user verifies the AI task monitor in the running app.
- F.1.8 through F.1.10 remain user-measured accuracy targets and are not claimed by unit tests alone.

### 2026-05-16 F.1.7 AI Detection Correct/Incorrect Feedback Evidence

Implemented:

- `SignalDiagnosticPanel` now exposes an explicit local feedback section after the real diagnostic explanation loads.
- Users can mark the current detection as `正确` or `错误`; both actions use the existing typed preload bridge and require the existing 3-second confirmation countdown before writing feedback.
- Added `correct-detection` to the local feedback kind schema. Correct feedback persists through the same local SQLite/fallback pipeline and applies a bounded positive `user_feedback` weight adjustment.
- Incorrect feedback maps the visible task state to the existing false-state feedback kinds (`false-idle`, `false-thinking`, `false-completion`, `false-error`, or `false-progress`) instead of inventing fake success.
- `MisreportButton` remains backward-compatible for existing error feedback while supporting custom labels and messages for the correct/incorrect UI.

Verified by:

```bash
npx --no-install gitnexus impact MisreportButton --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact SignalDiagnosticPanel --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact WeightAdjuster --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact misreportKindSchema --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/views/monitor/MisreportButton.test.tsx src/renderer/views/monitor/SignalDiagnosticPanel.test.tsx src/main/services/feedback/MisreportLogger.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "Misreport feedback|MisreportButton|SignalDiagnosticPanel|stores SQLite-backed signal misreports"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `MisreportButton` and `SignalDiagnosticPanel` returned LOW risk with 0 upstream impacted symbols/processes.
- GitNexus impact for `WeightAdjuster` returned LOW risk with 3 direct importers.
- GitNexus target lookup for `misreportKindSchema` returned `Target not found`; no impact result is claimed for that symbol.
- Focused feedback suite passed: 4 files passed, 7 tests passed, 108 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.1.7 acceptance checkbox remains unchecked until the user verifies the feedback controls in the running app.
- Positive feedback is local and bounded; it does not upload telemetry or claim measured accuracy thresholds.

### 2026-05-16 F.1.6 AI Detection Source Citation Evidence

Implemented:

- `SignalDiagnosticPanel` now renders each diagnostic reason with an explicit `source=<signal>` citation and numeric `contribution=<pct>%` next to the human-readable explanation.
- The source citation comes from the typed `DiagnosticExplain.topReasons[].sourceCitation` payload produced by the existing local diagnostic service and is not inferred by the renderer.
- The panel preserves the existing detailed reason text and recent state-transition trace, so users can connect a visible detection result to signal source, contribution share, and state history.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/views/monitor/SignalDiagnosticPanel.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
```

Result:

- Focused `SignalDiagnosticPanel` test passed: 1 file passed, 1 test passed.
- TypeScript typecheck passed.

Not claimed:

- The final F.1.6 acceptance checkbox remains unchecked until the user verifies the diagnostic panel in the running app with real AI task signals.

### 2026-05-16 F.1.1 AI Tool Process Detection Evidence

Implemented:

- `R8RuntimeService.detectToolFromModuleList()` now recognizes all five target tools from real scanner snapshots: `codex`, `claude`, `gemini`, `cursor`, and `copilot`.
- Codex, Claude, and Gemini no longer depend only on PATH/version probes when the process/task/window scanner already has a real row for the running tool.
- Copilot module-list detection was tightened: plain `gh.exe` rows such as `gh auth status` are no longer sufficient unless the row contains real Copilot evidence.
- Existing user override and version probe paths remain intact, so explicit executable paths still use the real `execa`/`execFile` probe chain.

Verified by:

```bash
npx --no-install gitnexus impact R8RuntimeService --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact detectToolFromModuleList --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact rowLooksLikeTool --repo devhub --direction upstream --include-tests
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "detects all five|five-tool detection|CLI detection GWT"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- GitNexus impact for `R8RuntimeService` returned LOW risk with 5 upstream impacted files including runtime IPC and tests.
- GitNexus target lookup for `detectToolFromModuleList` and `rowLooksLikeTool` returned `Target not found`; no impact result is claimed for those private methods.
- Focused runtime detection suite passed: 1 file passed, 3 tests passed, 107 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.1.1 acceptance checkbox remains unchecked until the user verifies detection against actual local Codex/Claude/Gemini/Cursor/Copilot processes in the running app.

### 2026-05-16 F.1.4 AI State Flip Debounce Evidence

Implemented:

- Added a shared `stabilizeStateTransition()` helper for task/monitor state transitions.
- `AITaskTracker` now debounces non-terminal heuristic task and monitor state flips with a 750ms or two-observation stability gate.
- Terminal `completed`, `error`, and `stuck` monitor/task paths remain immediate, so the debounce cannot hide real failures or completion decisions.
- Existing completion confirmation windows remain intact; this slice adds a separate anti-flapping gate for general state changes.

Verified by:

```bash
pnpm -C devhub exec vitest run src/main/services/detection/DetectionEngine.test.ts src/main/services/AITaskTracker.test.ts --maxWorkers=1 -t "debounces single-sample|cancels confirmation|confirmation|determineState"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- Focused detection/tracker suite passed: 2 files passed, 11 tests passed, 40 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.1.4 acceptance checkbox remains unchecked until the user verifies state stability in a running app session with real AI tool output.

### 2026-05-16 F.1.5 Real Stdout State Evidence

Verified existing implementation:

- `R8RuntimeService.parseCliChunk()` accepts real stdout/stderr/title/system chunks, routes them through `CLIOutputParser`, persists bounded CLI event/session history, emits `cli:event-stream`, queues monitor snapshots, forwards Claude stream/error handling, and records stdout through the recording engine.
- `AITaskTracker` subscribes to CLI parser events, matches events to real task IDs/PIDs/aliases, and applies parsed CLI progress to task state, monitor state, phase, action text, progress estimate, and signal contributions.
- `CLIOutputParser` supports line/shim/NDJSON/SSE strategy paths and fuses real line/shim progress for the same instance.

Verified by:

```bash
pnpm -C devhub exec vitest run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "parses line-based|parses shim|fuses line and shim|parseCliChunk|captures parsed stdout|cli:event-stream"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- Focused parser/runtime stdout suite passed: 2 files passed, 4 tests passed, 113 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.1.5 acceptance checkbox remains unchecked until the user verifies a live tool session where state changes follow real stdout rather than a test-fed chunk.

### 2026-05-16 F.2.1 Continuous Progress and Fine-Grained State Evidence

Verified existing and extended implementation:

- `deriveProgress()` no longer exposes only a small fixed set of legacy values: active coding progress can be time-derived as a continuous percentage, explicit runtime progress can carry exact values from 0 to 99, and terminal completion/error states remain fixed at 100.
- The shared progress state contract covers more than the required four active states: `initializing`, `thinking`, `receiving-input`, `coding`, `compiling`, `validating`, `waiting-input`, `awaiting-human`, `stuck`, `completed`, `error`, and `idle`.
- `ProgressBar` renders exact determinate `aria-valuenow` values while showing confidence-range labels when available.
- The F.2.2 and F.2.3 slices strengthen F.2.1 by proving exact 0% retry resets and continuous long-task movement within a 30-second window.

Verified by:

```bash
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts src/renderer/components/monitor/ai-task/ProgressBar.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
```

Result:

- Focused progress UI/derivation suite passed: 2 files passed, 16 tests passed.
- TypeScript typecheck passed.

Not claimed:

- The final F.2.1 acceptance checkbox remains unchecked until the running UI is manually verified with real task progress across the relevant states.

### 2026-05-16 F.2.2 Retry Progress Reset Evidence

Implemented:

- `R8RuntimeService` now emits a real `task-progress` event with `percent: 0` when a persisted queue task enters retry, is manually promoted from `retrying` to `queued`, or is queued again after a real `execute-skill` recovery.
- The reset reuses the existing `csv:session-event-stream` and `cli:event-stream` paths; it does not fabricate task success or create a parallel mock progress path.
- Non-CSV/custom queue session ids are guarded so retry state transitions cannot crash the runtime by forcing an invalid CSV session event.
- `AITaskTracker` treats an exact real CLI progress signal of `0` as a reset instead of preserving the prior high-water estimate.
- `AITaskView` passes the real `ProgressEstimate.percentage` into `deriveProgress`, and shared progress derivation now allows active coding progress to display 0-99 rather than forcing every coding task back into the old 40-75 fallback band.

Verified by:

```bash
npx --no-install gitnexus impact R8RuntimeService --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact StoreBackedTaskQueueService --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact AITaskTracker --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact deriveProgress --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact AITaskView --repo devhub --direction upstream --include-tests
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/AITaskTracker.test.ts --maxWorkers=1 -t "retry progress|CLI parser subscription"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "zero-percent progress|loads 18 column"
pnpm -C devhub typecheck
```

Result:

- GitNexus impact returned LOW for `R8RuntimeService`, `StoreBackedTaskQueueService`, `deriveProgress`, and `AITaskView`; `AITaskTracker` returned MEDIUM with direct callers/tests identified.
- Focused progress derivation test passed: 1 file passed, 11 tests passed.
- Focused tracker retry/parser test passed: 1 file passed, 3 tests passed, 42 skipped by filter.
- Focused runtime retry/CSV launch test passed: 1 file passed, 2 tests passed, 109 skipped by filter.
- TypeScript typecheck passed.

Not claimed:

- The final F.2.2 acceptance checkbox remains unchecked until the running UI is verified with a real retrying task and the user confirms the visible progress returns to 0%.

### 2026-05-16 F.2.3 Long Task Progress Refresh Evidence

Implemented:

- Preserved the existing active task card `setInterval(..., 1000)` render tick, which is well inside the F.2.3 requirement of at least one progress update per 30 seconds.
- Added a guard in `AITaskView` so explicit progress only overrides the time-derived progress curve when it is a high-confidence runtime signal or an exact 0% retry reset. Lower-confidence heuristic estimates no longer freeze the visible long-task progress at a stale explicit value.
- Added a regression test proving a 24-hour estimated coding task that has already run for more than 10 minutes produces a higher derived progress value after 30 seconds.

Verified by:

```bash
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts --maxWorkers=1
pnpm -C devhub typecheck
```

Result:

- Focused progress derivation suite passed: 1 file passed, 12 tests passed.
- TypeScript typecheck passed.

Not claimed:

- The final F.2.3 acceptance checkbox remains unchecked until the running UI is verified on a real >10 minute task and the user confirms progress visibly refreshes at least once per 30 seconds.

### 2026-05-16 F.2.4 Progress Confidence Interval Evidence

Implemented:

- Added `ProgressConfidenceRange` and `DerivedProgress.confidenceRange` to the shared progress derivation contract.
- Determinate progress now derives a bounded label such as `约 40%-54%` from the current progress percentage and confidence score.
- `ProgressBar` renders the confidence interval label for users while preserving exact `aria-valuenow` for assistive technology and automated verification.
- Existing indeterminate states remain percentage-free and idle progress remains hidden.

Verified by:

```bash
npx --no-install gitnexus impact deriveProgress --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact ProgressBar --repo devhub --direction upstream --include-tests
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts src/renderer/components/monitor/ai-task/ProgressBar.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- GitNexus impact for `deriveProgress` returned LOW risk with 1 upstream test file.
- GitNexus impact for `ProgressBar` returned LOW risk with 0 upstream impacted files in the indexed graph.
- Focused progress suite passed: 2 files passed, 14 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.2.4 acceptance checkbox remains unchecked until the running UI is verified with real task progress confidence data.

### 2026-05-16 F.2.5 Stuck Detection CPU/Silence Evidence

Implemented:

- Tightened `deriveMonitorState()` so `stuck` requires long non-terminal idle/activity silence and recent average CPU below 1%.
- A long idle task with sustained CPU above 1% no longer becomes `stuck`; it remains classified through the active CPU path.
- Existing F.1.2 expanded taxonomy and F.1.4 debounce remain intact.

Verified by:

```bash
pnpm -C devhub exec vitest run src/main/services/detection/DetectionEngine.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- Focused detection suite passed: 1 file passed, 8 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.2.5 acceptance checkbox remains unchecked until the running app is verified with a live stdout-silent, low-CPU task.

### 2026-05-16 F.3.3/F.3.4 CSV Prompt SKILL Reference Evidence

Implemented:

- Added `CsvTaskDriver` parsing for `inputArgs.prompt` tokens in the form `@skill:<name>`.
- Valid prompt skill references are checked against the current loaded `skillNames` set before a runtime row is created.
- A valid prompt reference maps the runtime row `skill` to the referenced skill while preserving the original prompt text for the actual runner.
- Missing or malformed prompt skill references are rejected at load time with explicit `inputArgs` row errors and no runtime row.

Verified by:

```bash
npx --no-install gitnexus impact CsvTaskDriver --repo devhub --direction upstream --depth 3
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "@skill|unknown skills|loads a real CSV"
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Result:

- GitNexus impact for `CsvTaskDriver` returned LOW risk with 2 direct upstream files.
- Focused CSV prompt-skill suite passed: 1 file passed, 5 tests passed, 6 skipped by filter.
- Full `CsvTaskDriver.test.ts` passed: 1 file passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.3.3/F.3.4 acceptance checkboxes remain unchecked until the running product is verified with a real CSV file and current local SKILL library state.

### 2026-05-16 F.3.5/F.3.6 SKILL Sandbox And MCP Evidence

Implemented:

- Extended SKILL Zod metadata with `license`, `sandbox`, and `mcpServers` while keeping defaults for older local SKILL files.
- Built-in SKILL manifests now include `license=MIT`, `sandbox=read-only`, and `mcpServers=[]`.
- Added a generated Node preload guard for task-queue SKILL execution. `read-only` blocks filesystem write methods, child-process methods, and network modules; `read-write` permits filesystem writes but still blocks child-process/network; `system` permits explicit child-process execution.
- Non-Node SKILL runtimes now require `system` sandbox because DevHub cannot truthfully enforce the Node preload guard for those runtimes.
- Added `DEVHUB_SKILL_MCP_SERVERS_JSON` for system SKILL scripts and validated `mcpServers` metadata as local stdio server declarations.

Verified by:

```bash
npx --no-install gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --maxWorkers=1 -t "SKILL|skill|sandbox|MCP|mcp|builtin|metadata"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
```

Result:

- GitNexus impact for `R8RuntimeService` returned LOW risk with 2 direct upstream files.
- Focused SKILL metadata/sandbox/MCP suite passed: 3 files passed, 13 tests passed, 127 skipped by filter.
- The MCP regression used a real local stdio JSON-RPC server and verified `initialize`, `tools/list`, and `tools/call` from the executed SKILL script.
- TypeScript typecheck passed.
- Zod SoT verification passed.

Not claimed:

- The final F.3.5/F.3.6 acceptance checkboxes remain unchecked until the running product is verified with user-authored local SKILL files and the user accepts the sandbox/MCP behavior.

### 2026-05-16 F.4.4/F.4.5 CSV Prompt Interpolation And File Reference Evidence

Implemented:

- Added `{{cwd}}` interpolation from `inputArgs.cwd`; if omitted, the DevHub process cwd is used.
- Added `{{file}}` interpolation from `inputArgs.file` or the 18-column CSV `inputFile` value.
- Added `@file:<path>` expansion for real local text files, resolving relative paths against `inputArgs.cwd` when present.
- `@file:` expansion is bounded to regular files up to 64 KiB and reports explicit `inputArgs` row errors for missing, unreadable, directory, or oversized references.

Verified by:

```bash
npx --no-install gitnexus impact CsvTaskDriver --repo devhub --direction upstream --depth 3
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "@file|interpolates|@skill|loads a real CSV"
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- GitNexus impact for `CsvTaskDriver` returned LOW risk with 2 direct upstream files.
- Focused CSV prompt interpolation/file-reference suite passed: 1 file passed, 6 tests passed, 7 skipped by filter.
- Full `CsvTaskDriver.test.ts` passed: 1 file passed, 13 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.4.4/F.4.5 acceptance checkboxes remain unchecked until runtime review with a user-supplied CSV file.

### 2026-05-16 F.4.2 CSV Pre-Launch Validation Evidence

Implemented:

- Added duplicate `taskId` detection per CSV group; every duplicate row receives an explicit `taskId` error and no runtime row.
- Added opt-in required input-file validation through `inputArgs.require_input_file=true` or `inputArgs.requireInputFile=true`, resolving paths against `inputArgs.cwd`.
- Added likely secret detection for `sk-...`, `ghp_...`, `api_key=...`, and `Bearer ...` patterns in `inputArgs` and prompt text.

Verified by:

```bash
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "duplicate task ids|required inputFile|API key|@file|loads a real CSV"
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Result:

- Focused CSV pre-launch validation suite passed: 1 file passed, 6 tests passed, 10 skipped by filter.
- Full `CsvTaskDriver.test.ts` passed: 1 file passed, 16 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

Not claimed:

- The final F.4.2 acceptance checkbox remains unchecked until runtime review with user-provided CSV files.

### 2026-05-16 F.4 Remaining CSV Evidence Audit

Audited:

- F.4.1: fixed 18-column source of truth in `CSV_COLUMN_NAMES`, strict header validation, template export, and runtime launch coverage remain in place.
- F.4.3: sequential execution is represented by `concurrent=1`; parallel execution is represented by `concurrent>1` plus `parallel_group` / `parallelGroupOverrides`.
- F.4.6: resume idempotency uses stable row hashes; matching succeeded rows are skipped, changed rows rerun, and `forceRerun` can override skip.
- F.4.7: failed rows can re-enter retry paths without marking queued tasks as fake successes; retry fixtures and state-machine tests cover this.
- F.4.8: unified generic task-result export packaging is now implemented. `task:export-results` validates through Zod, writes real CSV and JSON files from current `TaskRun` rows, includes `output_path`/`artifactsPath`, returns per-file bytes and SHA-256 hashes, and is exposed from the R8 Ops panel.

Verified by:

```bash
pnpm -C devhub exec vitest run src/shared/schemas/csv-task-row.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "fixed 18 column|parallel group limits|resume skip|force rerun|retry transitions|CSV fixtures|queues CSV rows|generates CSV launch commands|schedules CSV groups|loads 18 column CSV"
```

Result:

- Coverage audit suite passed: 3 files passed, 10 tests passed, 124 skipped by filter.

Not claimed:

- Final F.4.8 user acceptance remains unchecked until the user verifies the export action in the running app with their own CSV/task queue data.
- No F.4 final acceptance checkbox is checked by the agent; runtime/user acceptance remains required.

### 2026-05-19 F.4.8 Unified Task Result CSV/JSON Export Closure

Implemented:

- Added `taskResultExportRequestSchema`, `taskResultExportPayloadSchema`, and `taskResultExportResultSchema` to the shared R8 Zod registry.
- Added executable `task:export-results` IPC coverage and preload/global renderer typing.
- `R8RuntimeService.exportTaskResults()` now selects real task queue rows by all/session/runIds scope, writes JSON and CSV artifact files under a real output directory, and returns artifact directory, file paths, byte sizes, SHA-256 hashes, run ids, and task count.
- The CSV export includes concrete task result fields including run id, task id, session id, status, attempts, timing, exit/error fields, `artifactsPath`, tool, prompt, group, `output_path`, and row hash.
- `R8OpsPanel` exposes a user-facing `Export task results CSV/JSON` action and renders the returned artifact path, file formats, and byte sizes.

Verified by:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/R8OpsPanel.test.tsx src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "exports real task results|exports task results|registers a handler" --reporter=verbose
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/components/monitor/R8OpsPanel.tsx src/renderer/components/monitor/R8OpsPanel.test.tsx --max-warnings=0
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Result:

- Focused Vitest passed: 3 files passed, 3 selected tests passed, 162 skipped.
- `R8RuntimeService.test.ts` creates a real queued task, completes it, exports to a real temp directory, reads both JSON and CSV files back, verifies task status/artifactsPath, CSV escaping, byte counts, and SHA-256 format.
- `R8OpsPanel.test.tsx` verifies the UI calls `window.devhub.r8.task.exportResults({ format: 'both', confirmedBy: 'r8-ops-task-export' })` and renders the returned artifact path plus JSON/CSV file summaries.
- `r8RuntimeHandlers.test.ts` verifies every R8 IPC contract channel has a registered handler, including the new `task:export-results` channel.
- TypeScript no-emit, touched-file ESLint, Zod SoT, no-emoji, no-cloud-deps, no-OCR-deps, and targeted whitespace checks passed.
- GitNexus pre-change impact for `R8RuntimeService` and `R8OpsPanel` was LOW. GitNexus full `detect_changes(scope=all)` reported critical risk because the shared `devhub` worktree already contains 88 dirty files and 795 changed symbols outside this slice; this is recorded as a dirty-tree limitation rather than a failure of the focused F.4.8 checks.

Not claimed:

- Final `prompts/0503/28-final-acceptance-checklist.md` user checkbox remains unchecked until a human verifies the export in the running application.

### 2026-05-19 K.8 In-App About Fair-Use Closure

Implemented:

- Added a real Advanced settings `关于与商标声明` section in `SettingsDialog` instead of relying only on README text.
- The section states that vendor names and logos are used only for tool/service identification and interoperability, with no sponsorship, endorsement, agency, or commercial affiliation claim.
- The section records the project license boundary as AGPL-3.0 and points to NOTICE plus CycloneDX SBOM as the third-party dependency license evidence chain.
- Added a renderer regression in `SettingsDialog.statusbar.test.tsx` that opens Advanced settings and asserts the fair-use/About content is visible in the component tree.

Verified by:

```bash
pnpm -C devhub exec vitest run src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1 -t "About fair-use" --reporter=verbose
pnpm -C devhub exec vitest run src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1 --reporter=verbose
pnpm -C devhub exec eslint src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --max-warnings=0
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
```

Result:

- Focused About/fair-use Vitest passed with 1 selected test.
- Full `SettingsDialog.statusbar.test.tsx` passed with 1 file and 6 tests.
- Touched-file ESLint passed.
- TypeScript typecheck passed.
- No-emoji gate passed with `No emoji found in 778 files`.
- GitNexus pre-change impact for `SettingsDialog` and `AdvancedPanel` was LOW with no upstream affected processes.

Not claimed:

- The final K.8 user acceptance checkbox remains unchecked until a human verifies the About page in the running application.
- No project relicensing or legal owner sign-off is claimed.

### 2026-05-19 H.1.1 Zero-Egress Capture Runner

Implemented:

- Added `scripts/verify-zero-egress-capture.mjs` as a real Windows `pktmon` runner for the 60-second startup packet-capture acceptance item.
- Added package scripts:
  - `check:zero-egress-capture`
  - `check:zero-egress-capture:preflight`
  - `check:zero-egress-capture:self-test`
- The runner checks Windows, `pktmon`, and Administrator preconditions; starts NIC packet counters; launches `pnpm dev`; observes the requested duration; parses packet counter JSON; writes JSON evidence under `out/zero-egress-capture`; and fails on non-zero packet counts.
- If the shell lacks Administrator privileges, the runner exits with code `2` and reports `ready=false` instead of faking a pass.
- README now documents the 60-second packet-level workflow and distinguishes automated dependency/no-outbound guards from the real Administrator-only capture.

Verified by:

```bash
pnpm -C devhub check:zero-egress-capture:self-test
pnpm -C devhub check:zero-egress-capture:preflight
pnpm -C devhub exec eslint scripts/verify-zero-egress-capture.mjs --max-warnings=0
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Result:

- Self-test passed.
- Preflight found Windows and `pktmon`, but returned `ready=false` and exit code `2` because `ZRAINBOW\ZRainbow` is not running as Administrator.
- Touched-script ESLint passed.
- No-emoji gate passed with `No emoji found in 779 files`.
- No-cloud and no-OCR dependency gates passed.

Not claimed:

- H.1.1 / J.1.6 are not fully complete in this shell because the real 60-second packet capture requires an Administrator shell and must produce a passing JSON report with `packetCount=0`.

### 2026-05-19 B.3.4 Density Electron E2E Closure

Implemented:

- Hardened the Settings dialog overlay to use the project modal z-index token (`--z-tier-modal`) so it stays above drawer-system layers during real Electron interaction.
- Hardened the density E2E close action to target the exact `关闭` button instead of matching both the dialog close label and the button text.
- Preserved the existing density implementation path: Settings updates `informationDensity`, the document root receives `data-density`, `project-list-scroll` receives the matching `data-density`, and the virtualized project list exposes the live `data-estimated-row-height` contract.

Verified by:

```bash
pnpm -C devhub test:e2e --grep "P1.2-a" --reporter=line --workers=1
```

Result:

- The focused Electron E2E passed with 1 test in 12.0 seconds.
- The test verifies compact density writes `document.documentElement.dataset.density="compact"`, project-list `data-density="compact"`, and `data-estimated-row-height="64"`.
- The same test then verifies comfortable density writes `document.documentElement.dataset.density="comfortable"`, project-list `data-density="comfortable"`, `data-estimated-row-height="144"`, and persisted `settings.appearance.informationDensity="comfortable"`.

Not claimed:

- Broader manual visual acceptance for every density-affected surface remains a user-facing acceptance item.

### 2026-05-19 B.1.3 Theme Visual-Continuity E2E Closure

Implemented:

- Extended the existing `P8.2 外观四轴设置可真实应用并跨重启持久化` Electron E2E with real renderer frame sampling during a Settings-driven theme switch.
- The sampler captures 40 `requestAnimationFrame` frames while switching from `modern-light` to `cyberpunk` and fails on blank-shell conditions: zero shell area, `display:none`, `visibility:hidden`, `opacity:0`, or missing body content.
- The same E2E still verifies four-axis theme state, semantic token changes, persisted appearance settings, application relaunch, and store-backed restore.
- Hardened the Electron E2E close helper to avoid leaving a hanging `electronApp.close()` promise during teardown; it now first requests `app.quit()` and then terminates only the spawned Electron test process if graceful shutdown does not emit `close`.

Verified by:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub test:e2e --grep "P8.2" --reporter=line --workers=1
git -C devhub diff --check -- e2e/example.spec.ts
```

Result:

- Touched-file ESLint passed.
- Focused Electron P8.2 E2E passed with 1 test in 23.2 seconds.
- Targeted whitespace check passed.

Not claimed:

- Human visual acceptance for every theme pair remains open.
- The frame sampler proves no blank shell during this real theme-switch path; it is not a manual perceptual review of every theme, density, radius, and motion combination.
- The same P8.2 run also upgrades B.1.4 local evidence: it persisted the Paper Zen preset, closed the first Electron app, launched a second Electron app, and verified restored density, motion, palette, and radius state from the real settings store.
- The rerun also upgrades B.7.1/B.7.2 local browser evidence: the running Electron renderer changed topology graph tokens from seeded `modern-light` values to cyberpunk `--topology-node-process=#00ffff`, `--topology-edge-network=#39ff14`, and `--topology-node-label=#ffffff`.
- `check:theme-seasonal-visual-contract` now upgrades B.7.3 from explicit-token evidence to a real WCAG ratio gate: high-contrast chart/topology text tokens must be at least 4.5:1 and graph series/node/edge tokens at least 3:1 against each palette's `--surface-950`.
- The P8.2 rerun also upgrades B.5.1-B.5.3 with real Settings preview evidence: the Electron renderer shows `theme-preview-editor`, card/button/table/chart preview examples, updates `theme-live-preview` to `#112233`, and keeps the document palette at `modern-light` before any apply action.

### 2026-05-19 Mechanical 0503 Ledger Coverage Verifier

Implemented:

- Added `scripts/verify-0503-ledgers.mjs` under this Trellis task to mechanically verify prompt-to-ledger coverage.
- The verifier recursively counts Markdown files under `prompts/0503` and `prompts/0503-2`, parses the survey acceptance ledger and R8 completion ledger, and fails on missing or extra rows.
- The verifier also requires explicit blocker markers for administrator zero-egress capture, project license/legal decisions, multi-display hardware, and Windows Service UAC execution so completion reports cannot hide non-local blockers.
- The verifier now validates the persisted `research/r8-external-blockers-current.json` structure and fails if any required external blocker gate is missing.
- The verifier now exposes `--strict-complete` as the final completion gate; it must fail while partial R8 rows, failed external blocker gates, or `prompts/0503` product/legal/user acceptance rows remain.
- In strict mode, the verifier also requires a fresh `research/r8-external-blockers-current.json`; the default freshness window is 60 minutes and can be overridden with `--max-external-report-age-minutes=<n>`.
- The verifier has a `--self-test` mode for internal path normalization, status counting, Markdown table escaping, and truncation helpers.
- Running with `--write-report` writes `research/0503-ledger-verification.json`.
- `check:r8-external-blockers` now supports `--write-report <path>` and emits persisted JSON for display, virtual desktop, admin, Windows Service, zero-egress preflight, and project license/legal-decision gates.

Verified by:

```bash
node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --write-report
node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --self-test
node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --strict-complete --write-report
pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json
```

The external-blocker command exits non-zero by design in this environment. The persisted report records one renderable Electron/BrowserWindow display, two registry virtual desktop IDs, `foregroundHookOptIn=true`, `admin=false`, `devhub-watchdog` not installed, zero-egress preflight `windows=true`, `pktmonAvailable=true`, `admin=false`, `preflightExitCode=2`, `packageJsonLicense=AGPL-3.0-or-later`, `licenseFileExists=true`, and no explicit legal-decision evidence.

`pnpm -C devhub check:license` remains a distinct dependency-license gate and passed with 472 production package entries validated plus 1 documented manifest exception; that does not close the product/legal project-license decision gate.

Result:

- `prompts/0503` recursive Markdown coverage: 34 expected, 34 ledger rows, 0 missing, 0 extra.
- `prompts/0503-2` recursive Markdown coverage: 81 expected, 81 ledger rows, 0 missing, 0 extra.
- R8 completion evidence status counts: 74 verified, 5 partial, 2 not-applicable.
- Required blocker marker checks: 4 checked, 0 missing.
- Structured external blocker gate checks: 7 required gates, 0 missing, 7 currently failed by real environment evidence.
- Verifier self-test passed.
- Strict completion gate fails by design with `partialRows=5`, `missingEvidenceRows=0`, `failedExternalGateIds=7`, and `surveyAcceptanceRows=3`.
- Strict completion JSON includes `partialRowDetails` with each row's `nextAction`, plus `failedExternalGateDetails` with the concrete evidence string for every failed gate.
- Strict completion JSON also includes `surveyAcceptanceRows` for `22-user-journey-storyboard.md`, `24-legal-compliance-survey.md`, and `28-final-acceptance-checklist.md`.
- Running with `--write-strict-report` writes the human-readable strict checklist to `research/0503-strict-completion-report.md`.
- Latest strict run recorded `externalReportFresh=true` and still failed because the real blocker gates remain failed.
- Root package scripts now expose `pnpm check:0503-ledgers`, `pnpm check:0503-ledgers:self-test`, and `pnpm check:0503-strict`; `check:0503-strict` refreshes external blocker evidence before invoking the strict completion gate.

Not claimed:

- The verifier proves coverage and blocker visibility; it does not convert the 5 partial `prompts/0503-2` rows or final user acceptance into complete status.
