# contracts/23 — IPC 契约主清单



> 目的：汇总所有 `ipcMain.handle` / `webContents.send` 通道，给出请求/响应 schema、权限、限流、错误码

> 主目录：`devhub/src/main/ipc/*.ts` 与 `devhub/src/renderer/api/*.ts`

> 所有 channel 受 spec/05 限流 + spec/22 schema 验证



---



## 一、命名规范



| 方向 | 前缀 | 形式 | 示例 |

|------|------|------|------|

| renderer → main（请求） | 无 | `domain:action` | `process:get-list`, `port:get-detail-incremental` |

| main → renderer（推送） | `broadcast:` | `broadcast:<domain>:<event>` | `broadcast:process:snapshot`, `broadcast:ai-task:state-change` |

| 双向事件 | `event:` | `event:<domain>:<name>` | `event:window:moved` |



---



## 二、Channel 清单（按域分组）



### 2.1 扫描/基础 (spec/03~05)



| Channel | 方向 | Request | Response | 限流 bucket | 权限 |

|---------|------|---------|----------|------------|------|

| `scanner:get-metrics` | R→M | `{ id: ScannerId }` | `ScannerMetrics` | high | none |

| `scanner:pause` | R→M | `{ id: ScannerId, durationMs: number }` | `{ ok: boolean }` | low | user |

| `scanner:resume` | R→M | `{ id: ScannerId }` | `{ ok: boolean }` | low | user |

| `broadcast:scanner:health` | M→R | - | `{ id; healthy; lastError? }` | moderate | - |



### 2.2 进程 (spec/14)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `process:get-list` | R→M | `{ filter?: string }` | `ProcessInfo[]` | high | none |

| `process:get-deep-detail` | R→M | `{ pid: number }` | `PartialDeepDetail` | moderate | none |

| `process:probe-access` | R→M | `{ pid: number }` | `AccessReport` | low | none |

| `process:kill` | R→M | `{ pid: number; force?: boolean }` | `{ ok; reason? }` | low | user-confirm |

| `broadcast:process:snapshot` | M→R | - | `ProcessInfo[]`（含 meta：增量/全量） | moderate | - |

| `app:relaunch-as-admin` | R→M | `{}` | `{ ok; reason? }` | low | uac-prompt |



### 2.3 端口 (spec/15)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `port:get-list` | R→M | `{}` | `PortInfo[]` | high | none |

| `port:get-detail-incremental` | R→M | `{ localPort; protocol }` | `PortDetail`（含 `cachedAgeSec`） | moderate | none |

| `port:switch-query-mode` | R→M | `{ mode: 'light' \| 'full' }` | `{ ok }` | low | user |

| `broadcast:port:snapshot` | M→R | - | `PortInfo[]` | moderate | - |



### 2.4 窗口 (spec/07, 09, 10, 12)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `window:get-list` | R→M | `{}` | `WindowInfo[]` | high | none |

| `window:focus` | R→M | `{ hwnd }` | `{ ok }` | low | user |

| `window:minimize` | R→M | `{ hwnd }` | `{ ok }` | low | user |

| `window:maximize` | R→M | `{ hwnd }` | `{ ok }` | low | user |

| `window:restore` | R→M | `{ hwnd }` | `{ ok }` | low | user |

| `window:close` | R→M | `{ hwnd; graceful: boolean }` | `{ ok }` | low | user-confirm |

| `window:kill-owner` | R→M | `{ hwnd }` | `{ ok }` | low | user-confirm |

| `window:set-always-on-top` | R→M | `{ hwnd; value: boolean }` | `{ ok }` | low | user |

| `window:screenshot` | R→M | `{ hwnd }` | `{ dataUrl }` | low | user |

| `window:set-title` | R→M | `{ hwnd; title: string }` | `{ ok; reason? }` | low | user |

| `window:set-position` | R→M | `{ hwnd; rect; monitorId? }` | `{ ok }` | low | user |

| `window:jump-to-process` | R→M | `{ hwnd }` | `{ pid }` | low | none |

| `window:jump-to-port` | R→M | `{ hwnd }` | `{ portInfo? }` | low | none |

| `window:jump-to-ai-task` | R→M | `{ hwnd }` | `{ taskKey? }` | low | none |

| `window:favorite-toggle` | R→M | `{ fingerprint }` | `{ ok; favorite }` | low | user |

| `window:copy-title` | R→M | `{ hwnd }` | `{ ok }` | low | none |

| `window:open-working-dir` | R→M | `{ hwnd }` | `{ ok; path }` | low | user |

| `broadcast:window:snapshot` | M→R | - | `WindowInfo[]` | moderate | - |

| `broadcast:window:title-changed` | M→R | - | `{ hwnd; oldTitle; newTitle }` | high | - |



### 2.5 AI 别名 (spec/07)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `ai-alias:list` | R→M | `{}` | `AIAlias[]` | low | none |

| `ai-alias:create` | R→M | `{ toolId; displayName; fingerprint; applyToExternalWindow }` | `AIAlias` | low | user |

| `ai-alias:rename` | R→M | `RenameIntent` | `RenameResult` | low | user |

| `ai-alias:rename-and-apply` | R→M | `RenameIntent (with applyToExternalWindow=true)` | `RenameResult` | low | user |

| `ai-alias:delete` | R→M | `{ id }` | `{ ok }` | low | user |

| `broadcast:ai-alias:changed` | M→R | - | `{ id; action }` | low | - |



### 2.6 AI 任务 (spec/08, 11)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `ai-task:get-active` | R→M | `{}` | `Array<{ taskKey; state; progress }>` | moderate | none |

| `ai-task:get-history` | R→M | `{ aliasId?; limit? }` | `AITaskHistory[]` | low | none |

| `ai-task:acknowledge-completion` | R→M | `{ taskKey }` | `{ ok }` | low | user |

| `broadcast:ai-task:state-change` | M→R | - | `{ taskKey; state; progress; confidence }` | moderate | - |

| `broadcast:ai-task:completed` | M→R | - | `AITaskHistory` | low | - |



### 2.7 窗口组 (spec/09)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `window-group:list` | R→M | `{}` | `WindowGroup[]` | low | none |

| `window-group:create` | R→M | `{ name; color }` | `WindowGroup` | low | user |

| `window-group:rename` | R→M | `{ id; name }` | `WindowGroup` | low | user |

| `window-group:delete` | R→M | `{ id }` | `{ ok }` | low | user |

| `window-group:add-window` | R→M | `{ groupId; fingerprint }` | `WindowGroup` | low | user |

| `window-group:remove-window` | R→M | `{ groupId; fingerprint }` | `WindowGroup` | low | user |

| `window-group:set-auto-rule` | R→M | `{ groupId; rule }` | `WindowGroup` | low | user |

| `window-group:resolve-hwnds` | R→M | `{ groupId }` | `Array<{ fingerprint; hwnd? }>` | low | none |

| `window-group:focus-all` | R→M | `{ groupId }` | `{ focused: number }` | low | user |

| `window-group:apply-layout` | R→M | `{ groupId; preset: TilePreset }` | `ApplyLayoutResult` | low | user |



### 2.8 布局 (spec/10)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `layout:apply` | R→M | `ApplyLayoutIntent` | `ApplyLayoutResult` | low | user |

| `layout:snapshot-save` | R→M | `{ name; scope; presetKind? }` | `WindowLayoutSnapshot` | low | user |

| `layout:snapshot-list` | R→M | `{}` | `WindowLayoutSnapshot[]` | low | none |

| `layout:snapshot-apply` | R→M | `{ id }` | `ApplyLayoutResult` | low | user |

| `layout:snapshot-delete` | R→M | `{ id }` | `{ ok }` | low | user |

| `layout:list-monitors` | R→M | `{}` | `MonitorInfo[]` | low | none |



### 2.9 项目 (spec/13, 21)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `project:list` | R→M | `{}` | `ProjectMetadata[]` | moderate | none |

| `project:open` | R→M | `{ id }` | `{ ok }` | low | user |

| `project:run-script` | R→M | `{ id; scriptName; envOverrides? }` | `{ runId }` | low | user |

| `project:stop-script` | R→M | `{ runId }` | `{ ok }` | low | user |

| `project:rename` | R→M | `{ id; newName }` | `ProjectMetadata` | low | user |

| `project:add-note` | R→M | `{ id; note }` | `ProjectMetadata` | low | user |

| `project:set-group` | R→M | `{ id; groupId? }` | `ProjectMetadata` | low | user |

| `project:archive` | R→M | `{ id }` | `ProjectMetadata` | low | user |

| `project:restore` | R→M | `{ id }` | `ProjectMetadata` | low | user |

| `project:get-health` | R→M | `{ id }` | `ProjectMetadata['healthScore']` | low | none |

| `project:batch-update` | R→M | `{ ids: string[]; patch: Partial<ProjectMetadata> }` | `{ updated: number }` | low | user |

| `project:compute-git-status` | R→M | `{ id }` | `GitStatus` | low | none |

| `broadcast:project:script-output` | M→R | - | `{ runId; stream: 'stdout' \| 'stderr'; data: string }` | high | - |

| `broadcast:project:script-exit` | M→R | - | `{ runId; exitCode; durationMs }` | low | - |



### 2.10 拓扑 / 流程 (spec/02)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `topology:build-graph` | R→M | `TopologyScope` | `TopologyGraph`（LEGACY：仅供旧入口回归） | moderate | none |

| `topology:build-scoped-graph` | R→M | `TopologyScopeSchema` | `ScopedTopologyGraph` | 60/min | none |

| `flow:build-scoped-flow` | R→M | `TopologyScopeSchema` | `ScopedFlow` | 60/min | none |

| `flow:get-attached` | R→M | `FlowRequest` | `FlowSnapshot` | 60/min | none |

| `flow:filter-edges` | R→M | `FlowRequest` | `FlowSnapshot` | 60/min | none |

| `flow:scoped-stats` | R→M | `FlowRequest` | `FlowStats` | 60/min | none |

| `flow:export-timeline` | R→M | `FlowExportRequest` | `FlowExportResult` | low | none |

| `flow:event-stream` | R→M / M→R | `FlowEventStreamRequest` | `FlowEventStreamResponse` / `FlowEventStreamPayload` | 30/min | none |

| `flow:event-stream:unsubscribe` | R→M | `FlowEventStreamUnsubscribeRequest` | `FlowEventStreamResponse` | meta | none |

| `topology:warm-scope` | R→M | `TopologyScopeSchema` | `{ ok; nodeCount; edgeCount; source }` | 60/min | none |



### 2.11 主题 (spec/19)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `theme:get-state` | R→M | `{}` | `ThemeState` | low | none |

| `theme:set-palette` | R→M | `{ palette: PaletteName }` | `ThemeState` | low | user |

| `theme:set-density` | R→M | `{ density: DensityLevel }` | `ThemeState` | low | user |

| `theme:set-radius-family` | R→M | `{ radiusFamily: RadiusFamily }` | `ThemeState` | low | user |

| `theme:set-motion-level` | R→M | `{ motionLevel: MotionLevel }` | `ThemeState` | low | user |

| `theme:apply-preset` | R→M | `{ presetName: string }` | `ThemeState` | low | user |

| `theme:list-presets` | R→M | `{}` | `ThemePreset[]` | low | none |



### 2.12 观测/调试 (spec/06)



| Channel | 方向 | Request | Response | 限流 | 权限 |

|---------|------|---------|----------|-----|------|

| `obs:get-metrics` | R→M | `{}` | `SystemMetrics` | high | dev-only |

| `obs:dump-state` | R→M | `{ dir?: string }` | `{ path }` | low | dev-only |

| `obs:trigger-gc` | R→M | `{}` | `{ before; after }` | low | dev-only |



---



## 三、错误返回规范



所有 IPC 失败统一返回 envelope：



```typescript

interface IPCError {

  ok: false

  code: string          // 见 spec/XX 错误矩阵

  message: string       // 用户可读

  detail?: unknown      // DEV 模式可能含 stack

  retryable: boolean

}

```



---



## 四、权限分级



| 级别 | 含义 | 操作 |

|------|------|------|

| `none` | 无副作用 | 直接执行 |

| `user` | 操作生效立即可见 | 直接执行，UI 显示确认 toast |

| `user-confirm` | 有破坏性风险 | 弹确认对话框（"确定 kill PID 1234?"） |

| `uac-prompt` | 需 UAC | 触发系统 UAC 对话 |

| `dev-only` | 仅 DEV | 非 DEV 模式 reject |



---



## 五、总计



- Request channels：**76**

- Broadcast channels：**11**

- 错误码：见各 spec 的错误矩阵（合计 120+）

- 均通过 spec/05 限流 bucket + spec/22 Zod schema



---



## 六、检查表



- [ ] 新 channel 进本文件

- [ ] Request/Response schema 在 `shared/schemas/`

- [ ] 主进程 handler 调用 `.parse()`

- [ ] 渲染端 preload bridge 列入白名单

- [ ] 加入对应 spec 的 error matrix

- [ ] 限流 bucket 指定

- [ ] 权限级别标注



---



## 七、Renderer Preload 白名单（X2 权威来源）



> 本节是 `X2` 的自动化校验基线，目标是把 `renderer -> preload -> main` 的真实公开桥接面固定下来。

> `src/preload/preloadContract.test.ts` 只校验本节，不把上文的全量目录、历史条目、内部链路和产品规划条目混入 renderer 白名单。

> 额外说明：`ipc:ack-seq` 只在 preload 内部用于 diff ACK 遥测，不对 renderer 暴露，因此**刻意不在本节出现**。



### 7.1 Renderer invoke 白名单



- `a11y:get-prefs`

- `a11y:os-prefs`

- `a11y:run-self-check`

- `a11y:set-prefs`

- `ai-alias:get-all`

- `ai-alias:remove`

- `ai-alias:rename`

- `ai-alias:rename-and-apply`

- `ai-alias:set`

- `ai-task:calibrate`

- `ai-task:get-active`

- `ai-task:get-all`

- `ai-task:get-by-id`

- `ai-task:get-confidence-report`

- `ai-task:get-detection-config`

- `ai-task:get-history`

- `ai-task:get-profile`

- `ai-task:get-progress`

- `ai-task:get-state-history`

- `ai-task:get-statistics`

- `ai-task:get-timeline`

- `ai-task:mark-false-positive`

- `ai-task:record-completion-oracle`

- `ai-task:scan`

- `ai-task:set-detection-config`

- `ai-task:set-profile`

- `ai-task:start-tracking`

- `ai-task:stop-tracking`

- `ai:claude-cost-summary`

- `ai:fusion-config`

- `ai:get-instance-state`

- `ai:get-diagnostic-explain`

- `ai:get-signal-contributions`

- `ai:gemini-pattern-stat`

- `ai:gemini-rule-reload`

- `ai:list-weight-profiles`

- `ai:list-misreports`

- `ai:list-state-rules`

- `ai:override-rule`

- `ai:report-misreport`

- `ai:reset-learned-weights`

- `ai:set-weight-profile`

- `app:relaunch-as-admin`

- `backup:configure-schedule`

- `backup:create`

- `backup:delete`

- `backup:export-classified`

- `backup:list`

- `backup:restore`

- `backup:schedule-config`

- `cli:clear-tool-override`

- `cli:cursor-copilot-status`

- `cli:detect-all`

- `cli:detect-one`

- `cli:get-progress`

- `cli:get-sessions`

- `cli:install-shim`

- `cli:select-strategy`

- `cli:set-tool-override`

- `cli:title-rule-reload`

- `monitor:close`

- `monitor:focus-instance`

- `monitor:open`

- `monitor:popout-close`

- `monitor:popout-list`

- `monitor:popout-open`

- `monitor:popout-return-to-main`

- `monitor:popout-set-layout`

- `monitor:set-window-prefs`

- `monitor:snapshot`

- `command:history-clear`

- `command:history-add`

- `command:history-list`

- `command:invoke`

- `command:list`

- `command:list-custom`

- `command:register-os-protocol`

- `command:resolve-uri`

- `command:save-custom`

- `csv:delete-template`

- `csv:abort`

- `csv:enqueue-group`

- `csv:lock`

- `csv:save`

- `csv:unlock`

- `csv:enqueue-row`

- `csv:export-template`

- `csv:generate-cli-command`

- `csv:get-runner-info`

- `csv:launch`

- `csv:list-sessions`

- `csv:list-templates`

- `csv:pause`

- `csv:resume`

- `csv:save-template`

- `csv:schema-info`

- `csv:validate-row`

- `data-ownership:export-all`

- `data-ownership:list-entries`

- `data-ownership:list-paths`

- `dag:build`

- `dag:check-ready`

- `dag:detect-cycle`

- `dag:export`

- `dag:layer`

- `dashboard:delete-preset`

- `dashboard:get-layout`

- `dashboard:list-presets`

- `dashboard:morph-widget-to-drawer`

- `dashboard:reset`

- `dashboard:save-layout`

- `dev:export-diagnostic-bundle`

- `dev:get-runtime-metrics`

- `dev:get-throttle-report`

- `dev:reset-runtime-metrics`

- `diagnostic:capture-screenshot`

- `diagnostic:export`

- `diagnostic:list`

- `diagnostic:list-packs`

- `diagnostic:list-redaction-rules`

- `diagnostic:preview`

- `diagnostic:purge`

- `dialog:open-directory`

- `drawer:get-state`

- `drawer:list-layouts`

- `drawer:load-layout`

- `drawer:morph-from-popout`

- `drawer:morph-to-popout`

- `drawer:save-layout`

- `drawer:set-state`

- `flow:build-scoped-flow`

- `flow:event-stream`

- `flow:event-stream:unsubscribe`

- `flow:export-timeline`

- `flow:filter-edges`

- `flow:get-attached`

- `flow:scoped-stats`

- `groups:add`

- `groups:list`

- `groups:remove`

- `i18n:get-locale`

- `i18n:list-locales`

- `i18n:reload-resources`

- `i18n:set-locale`

- `icon:list-libraries`

- `icon:resolve-token`

- `inject:add-whitelist`

- `inject:cancel`

- `inject:configure-countdown`

- `inject:configure-strict-mode`

- `inject:countdown-cancel`

- `inject:countdown-complete`

- `inject:dry-run`

- `inject:execute`

- `inject:first-time-confirm`

- `inject:get-ready-pool`

- `inject:get-whitelist`

- `inject:history`

- `inject:remove-whitelist`

- `inject:resolve-target`

- `integrations:flag-get`

- `integrations:flag-set`

- `integrations:health-check`

- `integrations:list-libraries`

- `ipc:override-rate-class`

- `ipc:rate-limit-channel-list`

- `ipc:rate-limit-stats`

- `ipc:request-resync`

- `notification:clear-history`

- `notification:get-config`

- `notification:get-history`

- `notification:get-unread-count`

- `notification:mark-all-read`

- `notification:mark-read`

- `notification:set-config`

- `notify:configure-aggregation`

- `notify:configure-channel`

- `notify:dismiss`

- `notify:emit`

- `notify:invoke-action`

- `notify:list`

- `obs:configure`

- `obs:export-diagnostic-pack`

- `obs:export-snapshot`

- `obs:get-snapshot`

- `obs:subscribe`

- `obs:unsubscribe`

- `ocr:capabilities`

- `ocr:list-supported-languages`

- `ocr:recognize`

- `permission:allowlist`

- `permission:check`

- `permission:configure-policy`

- `permission:confirm`

- `permission:expiry-stream`

- `permission:list-active`

- `permission:request`

- `permission:reset`

- `permission:revoke`

- `permission:revoke-all`

- `permission:ttl-config`

- `popout:bridge-message`

- `popout:close`

- `popout:create`

- `popout:demote`

- `popout:list`

- `popout:move-to-monitor`

- `popout:pin`

- `popout:promote-from-floating`

- `popout:save-bounds`

- `port:popout-batch`

- `port:popout-close`

- `port:popout-demote`

- `port:popout-list`

- `port:popout-open`

- `port:popout-pin`

- `port:popout-position-get`

- `port:popout-position-save`

- `port:popout-sync`

- `port:blocklist-add`

- `port:blocklist-list`

- `port:blocklist-remove`

- `port:blocklist-reset`

- `port:cancel-query`

- `port:check`

- `port:detect-conflicts`

- `port:find-available`

- `port:get-detail-incremental`

- `port:get-focus-data`

- `port:is-available`

- `port:release`

- `port:scan`

- `port:scan-common`

- `port:security-tier`

- `port:public-banner-state`

- `port:topology`

- `process:batch-cancel`

- `process:batch-op`

- `process:batch-undo`

- `process:cleanup-zombies`

- `process:get-basic-info`

- `process:get-connections`

- `process:get-deep-detail`

- `process:get-environment`

- `process:get-full-relationship`

- `process:get-groups`

- `process:get-history`

- `process:history-24h`

- `process:history-batch`

- `process:get-modules`

- `process:get-tree`

- `process:kill`

- `process:kill-tree`

- `process:open-file-location`

- `process:probe-access`

- `process:scan`

- `process:set-priority`

- `process:tags-export`

- `process:tags-import`

- `process:tags-list`

- `process:tags-remove`

- `process:tags-set`

- `process:tree`

- `process:tree-children`

- `process:treemap-data`

- `process:view-mode-set`

- `process:start`

- `process:status`

- `process:stop`

- `project:get-dependencies`

- `project:get-git-info`

- `project:get-git-info-batch`

- `project:open-in-editor`

- `projects:add`

- `projects:discover`

- `projects:get`

- `projects:list`

- `projects:remove`

- `projects:scan`

- `projects:scan-directory`

- `projects:update`

- `projects:watcher-start`

- `projects:watcher-status`

- `projects:watcher-stop`

- `recording:delete`

- `recording:export-asciinema`

- `recording:export-zip`

- `recording:get-cast`

- `recording:get-events`

- `recording:get-events-window`

- `recording:get-fs-snapshot-at`

- `recording:get-manifest`

- `recording:get-replay-state`

- `recording:get-screenshot`

- `recording:list`

- `recording:list-anchors`

- `recording:replay-export`

- `recording:replay-seek`

- `recording:replay-start`

- `recording:start`

- `recording:stop`

- `recovery:check-dirty`

- `recovery:create-checkpoint`

- `recovery:dismiss`

- `recovery:list-snapshots`

- `recovery:report`

- `recovery:restore-state`

- `recovery:scan`

- `scanner:retry`

- `scanner:snapshot`

- `scanner:status`

- `settings:get`

- `settings:update`

- `shell:open-path`

- `shim:status`

- `shim:uninstall`

- `skill:builtin-fork`

- `skill:builtin-list`

- `skill:builtin-readme`

- `skill:cloud-sync-disabled`

- `skill:cloud-sync-list-remote`

- `skill:cloud-sync-status`

- `skill:cloud-sync-trigger`

- `skill:create-from-template`

- `skill:delete`

- `skill:get`

- `skill:install-from-path`

- `skill:list`

- `skill:reload`

- `skill:template-list`

- `skill:uninstall`

- `skill:validate`

- `skill:validate-yaml`

- `skill:write`

- `status:aggregate`

- `statusbar:get-config`

- `statusbar:reset`

- `statusbar:set-config`

- `system:get-drives`

- `tags:add`

- `tags:list`

- `tags:remove`

- `task-history:add`

- `task-history:clear-old`

- `task-history:complete`

- `task-history:get`

- `task-history:list`

- `task-history:statistics`

- `task-history:update`

- `task:export-results`

- `task:get-stats`

- `task:list`

- `task:retry`

- `task:skip`

- `theme:custom-svg-list`

- `theme:custom-svg-remove`

- `theme:custom-svg-upload`

- `theme:decoration-list`

- `theme:decoration-set`

- `theme:sound-config`

- `theme:sound-config-get`

- `tool:status`

- `topology:attached:favorite-change`

- `topology:attached:get-deep10`

- `topology:build-global-graph`

- `topology:build-scoped-graph`

- `topology:export`

- `topology:global:get-fullscreen`

- `topology:list-snapshots`

- `topology:network`

- `topology:neural`

- `topology:save-snapshot`

- `topology:warm-scope`

- `topology:warm-scope-global`

- `watchdog-supervisor:install-service`

- `watchdog-supervisor:respawn`

- `watchdog-supervisor:status`

- `watchdog-supervisor:uninstall-service`

- `watchdog:configure`

- `watchdog:get-history`

- `watchdog:override-restart`

- `watchdog:status`

- `window:add-to-group`

- `window:always-on-top`

- `window:apply-layout`

- `window:batch-cancel`

- `window:batch-op`

- `window:batch-undo`

- `window:cascade-layout`

- `window:close-group`

- `window:close-window`

- `window:create-group`

- `window:delete-snapshot`

- `window:focus`

- `window:focus-group`

- `window:get-favorites`

- `window:get-groups`

- `window:get-layouts`

- `window:get-monitor-info`

- `window:get-topmost`

- `window:groups`

- `window:layout-apply`

- `window:layout-list`

- `window:layout-save`

- `window:list-snapshots`

- `window:list-topmost`

- `window:maximize-window`

- `window:minimize-all`

- `window:minimize-group`

- `window:minimize-window`

- `window:monitors`

- `window:move`

- `window:move-to-desktop`

- `window:move-to-monitor`

- `window:open-working-dir`

- `window:preview-layout`

- `window:remove-group`

- `window:remove-layout`

- `window:rename-group`

- `window:restore-all`

- `window:restore-group`

- `window:restore-layout`

- `window:restore-previous`

- `window:restore-snapshot`

- `window:restore-window`

- `window:save-layout`

- `window:save-snapshot`

- `window:scan`

- `window:screenshot`

- `window:send-keys`

- `window:set-alias`

- `window:set-opacity`

- `window:set-title`

- `window:set-topmost`

- `window:stack-layout`

- `window:tile-group`

- `window:tile-layout`

- `window:toggle-favorite`

- `window:thumbnail-refresh`

- `window:thumbnails-batch`

- `window:update-snapshot`

- `window:vd-info`

- `window:vd-list`

- `window:viewport-config`

- `zod:list-schemas`

- `zod:migration-status`

- `zod:validate-payload`



- `csv:enqueue-group`

- `csv:export-template`

- `csv:get-group`

- `csv:list-groups`

- `csv:reload`

- `csv:validate-header`

- `task:abort-session`

- `task:pause-session`

- `task:resume-session`

### 7.2 Renderer send 白名单



- `log:clear`

- `log:subscribe`

- `scanner:subscribe`

- `window:close`

- `window:force-close`

- `window:hide-to-tray`

- `window:maximize`

- `window:minimize`



### 7.3 Renderer on 白名单



- `ai:fusion-stream`

- `ai:claude-stream-event`

- `ai:state-stream`

- `cli:event-stream`

- `cli:detection-event`

- `csv:external-change-stream`

- `monitor:snapshot-stream`

- `monitor:popout-snapshot-stream`

- `csv:lock-status-stream`

- `csv:row-stream`

- `csv:session-event-stream`

- `inject:countdown-stream`

- `inject:first-time-required`

- `task:state-stream`

- `window:vd-watch`

- `watchdog-supervisor:event-stream`

- `watchdog:event-stream`

- `recording:event-stream`

- `skill:list-stream`

- `status:aggregate`

- `ai-task:completed`

- `ai-task:started`

- `ai-task:status-changed`

- `ai-task:updated`

- `log:entry`

- `navigate-to-task`

- `notification:new`

- `notify:desktop-bell`

- `notify:statusbar`

- `notify:stream`

- `obs:subscribe`

- `flow:event-stream`

- `popout:bridge-message`

- `popout:screen-event`

- `port:conflict`

- `process:batch-progress`

- `process:status-change`

- `process:updated`

- `process:zombie-detected`

- `projects:auto-discovered`

- `projects:watcher-detected`

- `r8:command-event`

- `scanner:aiTasks:diff`

- `scanner:failed`

- `scanner:ports:diff`

- `scanner:processes:diff`

- `scanner:snapshot:push`

- `scanner:summary:update`

- `scanner:windows:diff`

- `task-history:record-added`

- `task-history:record-updated`

- `tool:complete`

- `window:batch-progress`

- `window:close-confirm`

- `window:updated`
