# R8 IPC Channel 注册表

> **生成时间**: 2026-05-03
> **版本**: v2.0（全 71 文件 — 4 PRD + 11 R8.A + 17 R8.B + 39 R8.C）
> **数据源**: 各 spec `## 4. ipc_contracts` 段落 + master §7.2
> **命名规范**: `{namespace}:{verb}-{object}` 或 `{namespace}:{sub-namespace}:{verb}`
> **速率限制源**: R8.C/spec-31 — 4 级 token bucket
> **机器可读**: 表格主体 + YAML 详情段

---

## §0 字段定义

| 字段 | 类型 | 说明 |
|---|---|---|
| `channel` | string | 必须 `[a-z][a-z0-9-]*:[a-z][a-z0-9-]*` 或多段 |
| `source` | string | 来源 spec（如 R8.A/spec-02 §4） |
| `request` | Zod schema | 引用 §1 zod-schemas.md |
| `response` | Zod schema | 引用 §1 zod-schemas.md |
| `rateClass` | enum | `high_freq_scan` / `medium_query` / `low_freq_op` / `meta`（spec-31） |
| `confirmedBy` | bool | 破坏性动作必须含 `confirmedBy: string`（用户确认 token） |
| `error_codes` | string[] | 来自该 spec error_matrix |
| `direction` | enum | `r→m` / `m→r` / `r→m+stream` / `m→r stream` |

**rateClass 速率配额**（来源：R8.C/spec-31 §3）

| Class | RPM | 用途 |
|---|---|---|
| `high_freq_scan` | 30 | 高频流式（订阅/事件流） |
| `medium_query` | 60 | 一般查询（VM 数据/列表） |
| `low_freq_op` | 120 | 低频操作（设置/导出/批操作） |
| `meta` | 600 | 元 channel（rate-limit 自身/health） |

---

## §1 命名空间总览（37 个 / 270+ channel）

| namespace | 主 spec | channel 数 | 说明 |
|---|---|---|---|
| `process` | R8.A.spec-02/04, R8.B.spec-06/12/14 | 21 | 进程 VM/树/批操作/标签/历史 |
| `port` | R8.A.spec-09, R8.B.spec-01/13 | 19 | 端口数据/popout/安全分级/黑名单 |
| `popout` | R8.B.spec-02 | 11 | popout 跨窗口生命周期 + 桥接 |
| `window` | R8.A.spec-08, R8.B.spec-09/10/11 | 19 | 窗口枚举/AOT/缩略图/批操作/虚拟桌面 |
| `topology` | R8.A.spec-05, R8.C.spec-24/25 | 14 | 三套图查询（network/neural/flow）+ 全局/附属 |
| `flow` | R8.A.spec-05, R8.C.spec-26 | 8 | 流程图 + 回放控制 |
| `monitor` | R8.C.spec-07/08 | 11 | 监控窗口主控 + popout |
| `cli` | R8.C.spec-01/05/06 | 11 | CLI 解析/检测/标题规则 |
| `shim` | R8.C.spec-02/03/04 | 4 | Codex/Claude/Gemini SHIM 注入 |
| `ai` | R8.C.spec-03/04/27/28/29 | 14 | AI 实例事件流/状态/融合/反馈 |
| `skill` | R8.C.spec-09/10/11/38 | 12 | SKILL 库/内置/编辑/校验/云同步 |
| `csv` | R8.C.spec-12/13/14/21 | 16 | CSV 驱动/schema/启动/锁/模板 |
| `task` | R8.C.spec-15 | 7 | 任务队列控制 |
| `dag` | R8.C.spec-20 | 5 | DAG 引擎构建/检测 |
| `inject` | R8.C.spec-18/19 | 12 | 注入执行/目标解析/白名单/倒计时 |
| `watchdog` | R8.C.spec-16 | 5 | Watchdog 状态/配置/事件 |
| `watchdog-supervisor` | R8.C.spec-17 | 4 | Watchdog 子进程监工 |
| `recording` | R8.C.spec-22/23 | 8 | 任务录制 + 回放 |
| `notify` | R8.C.spec-30 | 7 | 通知发布/聚合/通道 |
| `audit` | R8.A.spec-10 | 5 | 审计日志 tail/query/export/purge |
| `permission` | R8.A.spec-11, R8.C.spec-37 | 6 | 权限确认/allowlist/TTL |
| `elevation` | R8.A.spec-03 | 4 | UAC 提权 |
| `theme` | R8.A.spec-06/07, R8.B.spec-07 | 11 | 主题轴/距离/装饰/SVG/音 |
| `drawer` | R8.B.spec-03 | 7 | Drawer 5 槽布局/morph |
| `command` | R8.B.spec-04 | 8 | 命令面板/历史/URI/自定义 |
| `dashboard` | R8.B.spec-05 | 6 | Dashboard 布局/预设 |
| `statusbar` / `status` | R8.B.spec-08 | 4 | 状态栏 tile 聚合/配置 |
| `i18n` | R8.B.spec-15 | 4 | locale 获取/切换/资源 |
| `a11y` | R8.B.spec-16 | 4 | 无障碍偏好/自检 |
| `icon` | R8.B.spec-17 | 2 | 图标库/token 解析 |
| `obs` | R8.C.spec-32 | 5 | 观测快照/订阅/导出 |
| `ipc` | R8.C.spec-31 | 3 | meta：rate-limit 自我观测 |
| `zod` | R8.C.spec-33 | 3 | meta：schema 注册/校验 |
| `recovery` | R8.C.spec-34 | 4 | 启动期 crash recovery |
| `backup` | R8.C.spec-35 | 5 | 备份与分类恢复 |
| `diagnostic` | R8.C.spec-36 | 4 | 诊断包导出 |
| `integrations` | R8.A.spec-01 | 4 | 集成库列表/flag/health |

**总计**：37 命名空间 / 270+ channel

---

## §2 关键 namespace 详情

### §2.1 `process:`（21 channel）

| channel | source | request | response | rateClass | confirmedBy | error_codes |
|---|---|---|---|---|---|---|
| `process:vm:get-light` | spec-02 | `{pid}` | `processUnifiedViewModelSchema` | medium_query | no | PROCESS_GONE / WMI_TIMEOUT |
| `process:vm:get-deep` | spec-02 | `{pid, allow_elevate}` | VM | low_freq_op | no | PERMISSION_DENIED / POWERSHELL_TIMEOUT |
| `process:vm:subscribe` | spec-02 | `{pid, interval_ms}` | push | high_freq_scan | no | — |
| `process:vm:unsubscribe` | spec-02 | `{subscription_id}` | `{}` | meta | no | — |
| `process:tree` | spec-06 | `{rootPid?}` | tree[] | medium_query | no | TREE_TOO_DEEP |
| `process:tree-children` | spec-06 | `{pid}` | child[] | medium_query | no | — |
| `process:treemap-data` | spec-06 | `{rootPid?}` | TreemapNodeSchema | low_freq_op | no | TREE_TOO_DEEP |
| `process:view-mode-set` | spec-06 | `{mode}` | `{}` | meta | no | — |
| `process:batch-op` | spec-12 | `{action, pids[], confirmedBy}` | `{batchId}` | low_freq_op | YES | E_VALIDATION / E_PERMISSION_DENIED |
| `process:batch-progress` | spec-12 | `{batchId}` stream | events | high_freq_scan | no | — |
| `process:batch-cancel` | spec-12 | `{batchId, confirmedBy}` | `{}` | meta | YES | E_NOT_FOUND |
| `process:batch-undo` | spec-12 | `{batchId}` (5s 内) | `{success}` | meta | no | E_TIMEOUT |
| `process:tags-list` | spec-14 | `{filter?}` | tag[] | medium_query | no | — |
| `process:tags-set` | spec-14 | `{tagKey, tags[]}` | `{}` | low_freq_op | no | E_VALIDATION |
| `process:tags-remove` | spec-14 | `{tagKey}` | `{}` | low_freq_op | no | — |
| `process:tags-export` | spec-14 | `{format}` | data | low_freq_op | no | — |
| `process:tags-import` | spec-14 | `{data, format}` | `{count}` | low_freq_op | no | E_VALIDATION |
| `process:history-24h` | spec-14 | `{tagKey, range}` | samples | medium_query | no | — |
| `process:history-batch` | spec-14 | `{tagKeys[]}` | batch | low_freq_op | no | — |
| `process:get-relationship` | spec-02 (DEPRECATED) | — | redirect → `process:vm:get-light` | — | — | — |
| `process:get-deep-detail` | spec-02 (DEPRECATED) | — | redirect → `process:vm:get-deep` | — | — | — |

### §2.2 `port:` / `popout:` / `window:`（50 channel）

```yaml
port:
  port:vm:get:  {req: {port}, resp: portUnifiedViewModelSchema, rate: medium_query}
  port:vm:list:  {req: {refresh?}, resp: PortInfo[], rate: medium_query}
  port:blacklist:get:  {resp: BlocklistEntry[], rate: meta}
  port:blacklist:add-user: {req: {entry}, rate: low_freq_op}
  port:popout-open:  {req: {port, mode: floating|browserwindow}, resp: {windowId}, rate: low_freq_op}
  port:popout-close:  {req: {windowId}, rate: meta}
  port:popout-list:  {resp: PortPopout[], rate: meta}
  port:popout-position-get:  {req: {port}, resp: {position|null}, rate: meta}
  port:popout-position-save: {req: {port, position, size?}, rate: low_freq_op (debounced)}
  port:popout-pin:  {req: {windowId, pinned}, rate: meta}
  port:popout-batch:  {req: {action, ports[], confirmedBy}, rate: low_freq_op, confirmedBy: YES}
  port:popout-layout-save:  {rate: low_freq_op}
  port:popout-layout-apply: {rate: low_freq_op}
  port:popout-layout-list:  {rate: meta}
  port:popout-sync:  {direction: m→r stream, rate: high_freq_scan}
  port:popout-demote:  {req: {popoutId}, resp: {floatingId, popout}, rate: low_freq_op}
  port:security-tier:  {req: {ip, port}, resp: SecurityTierSchema, rate: medium_query}
  port:blocklist-list:  {rate: meta}
  port:blocklist-add:  {req: {entry, confirmedBy}, rate: low_freq_op, confirmedBy: YES}
  port:blocklist-remove: {req: {id, confirmedBy}, rate: low_freq_op, confirmedBy: YES}
  port:blocklist-reset:  {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES}
  port:public-banner-state: {direction: m→r stream, rate: high_freq_scan}

popout:
  popout:create:  {req: PopoutCreateRequestSchema, resp: BrowserPopoutSchema, rate: low_freq_op}
  popout:close:  {req: {windowId, confirmedBy?}, rate: meta}
  popout:list:  {resp: BrowserPopout[], rate: meta}
  popout:bridge-message:  {req: PopoutMessageSchema, rate: high_freq_scan}
  popout:pin:  {req: {windowId, pinned}, rate: meta}
  popout:promote-from-floating: {req: {windowId}, rate: low_freq_op}
  popout:demote:  {req: {windowId}, rate: low_freq_op}
  popout:move-to-monitor:  {req: {windowId, monitorId}, rate: low_freq_op}
  popout:save-bounds:  {req: {windowId, bounds}, rate: low_freq_op (debounced)}
  popout:screen-event:  {direction: m→r stream, rate: high_freq_scan}

window:
  window:set-topmost:  {req: {hwnd, on, confirmedBy?}, resp: setTopmostResponseSchema, rate: low_freq_op}
  window:get-topmost:  {req: {hwnd}, resp: getTopmostResponseSchema, rate: medium_query}
  window:topmost-list:  {resp: topmostListResponseSchema, rate: medium_query}
  window:thumbnails-batch:  {req: {hwnds[], mode}, rate: low_freq_op}
  window:thumbnail-refresh:  {req: {hwnd}, rate: medium_query}
  window:groups:  {resp: WindowGroup[], rate: medium_query}
  window:set-alias:  {req: {groupKey, alias}, rate: low_freq_op}
  window:viewport-config:  {rate: meta}
  window:batch-op:  {req: WindowBatchRequest {action, hwnds[], args, confirmed, dryRun}, resp: {jobId}, rate: low_freq_op, confirmedBy: close>5/inject}
  window:batch-progress:  {direction: m→r stream, rate: high_freq_scan}
  window:batch-cancel:  {req: {jobId, confirmedBy?}, resp: {jobId, cancelled, skipped}, rate: meta}
  window:batch-undo:  {req: {jobId, confirmedBy?}, resp: {jobId, undone, results[]}, rate: meta}
  window:vd-list:  {resp: VirtualDesktopSchema[], rate: medium_query}
  window:vd-watch:  {direction: m→r stream, rate: high_freq_scan}
  window:vd-info:  {req: {hwnd}, resp: WindowVdInfoSchema, rate: medium_query}
  window:move-to-desktop:  {req: {hwnd, vdId, confirmedBy?}, rate: low_freq_op}
  window:move-to-monitor:  {req: {hwnd, monitorId}, rate: low_freq_op}
  window:monitors:  {resp: MonitorInfoSchema[], rate: medium_query}
  window:layout-save:  {rate: low_freq_op}
  window:layout-apply:  {req: {presetId, confirmedBy}, rate: low_freq_op, confirmedBy: YES}
  window:layout-list:  {rate: meta}
```

### §2.3 `topology:` / `flow:`（22 channel）

```yaml
topology:
  topology:network:get:  {req: GraphScopeSchema, resp: graphResponseSchema, rate: medium_query, source: spec-05}
  topology:neural:get:  {req: GraphScopeSchema, resp: graphResponseSchema, rate: medium_query, source: spec-05}
  topology:flow:get:  {req: GraphScopeSchema, resp: graphResponseSchema, rate: medium_query, source: spec-05}
  topology:get-attached:  {req: {scope, target}, rate: medium_query, source: spec-05}
  topology:global:get-fullscreen: {req: {kind}, rate: low_freq_op, source: spec-24}
  topology:global:layout-set:  {req: {kind, layout}, rate: meta, source: spec-24}
  topology:global:filter-set:  {req: {kind, filter}, rate: meta, source: spec-24}
  topology:global:export:  {req: {format}, rate: low_freq_op, source: spec-24}
  topology:attached:get-deep10: {req: {scope, target, depth}, rate: medium_query, source: spec-25}
  topology:attached:lazy-load: {req: {scope, target, range}, rate: medium_query, source: spec-25}
  topology:attached:bookmarks:list: {rate: meta, source: spec-25}
  topology:attached:save-bookmark: {rate: low_freq_op, source: spec-25}
  topology:warm-scope:  {rate: meta, source: spec-05}
  topology:build-scoped-graph: {rate: medium_query, source: spec-05}

flow:
  flow:get-attached:  {req: {target}, resp: FlowGraph, rate: medium_query, source: spec-26}
  flow:replay-controls:  {req: {action: play/pause/seek}, rate: meta, source: spec-26}
  flow:replay-state-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-26}
  flow:bookmark-event:  {req: {eventId, label}, rate: low_freq_op, source: spec-26}
  flow:export-timeline:  {req: {target, format}, rate: low_freq_op, source: spec-26}
  flow:filter-edges:  {req: {edgeKinds[]}, rate: meta, source: spec-26}
  flow:scoped-stats:  {rate: medium_query, source: spec-26}
  flow:build-scoped-flow:  {rate: medium_query, source: spec-05}
```

### §2.4 `monitor:` / `cli:` / `shim:` / `ai:`（40 channel）

```yaml
monitor:
  monitor:open:  {rate: low_freq_op, source: spec-07}
  monitor:close:  {rate: meta, source: spec-07}
  monitor:snapshot:  {resp: MonitorSnapshot, rate: medium_query, source: spec-07}
  monitor:snapshot-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-07}
  monitor:set-window-prefs:  {rate: meta, source: spec-07}
  monitor:focus-instance:  {req: {instanceId, confirmedBy?}, rate: low_freq_op, source: spec-07}
  monitor:popout-open:  {rate: low_freq_op, source: spec-08}
  monitor:popout-close:  {rate: meta, source: spec-08}
  monitor:popout-list:  {rate: meta, source: spec-08}
  monitor:popout-snapshot-stream: {direction: m→r stream, rate: high_freq_scan, source: spec-08}
  monitor:popout-return-to-main: {rate: low_freq_op, source: spec-08}
  monitor:popout-set-layout:  {rate: low_freq_op, source: spec-08}

cli:
  cli:event-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-01}
  cli:get-sessions:  {rate: medium_query, source: spec-01}
  cli:get-progress:  {req: {sessionId}, rate: medium_query, source: spec-01}
  cli:install-shim:  {req: {tool, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-01}
  cli:select-strategy:  {req: {strategy}, rate: meta, source: spec-01}
  cli:cursor-copilot-status:  {rate: medium_query, source: spec-05}
  cli:title-rule-reload:  {rate: meta, source: spec-05}
  cli:title-sample-debug:  {rate: meta, source: spec-05, dev_only: true}
  cli:detect-all:  {req: {force?}, rate: medium_query, source: spec-06}
  cli:detect-one:  {req: {tool}, rate: medium_query, source: spec-06}
  cli:set-tool-override:  {req: {tool, path, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-06}
  cli:clear-tool-override:  {req: {tool, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-06}
  cli:detection-event:  {direction: m→r stream, rate: high_freq_scan, source: spec-06}

shim:
  shim:install:  {req: {tool, confirmedBy}, resp: {manifest, requiresPathRefresh, pipeServer}, rate: low_freq_op, confirmedBy: YES, source: spec-02}
  shim:uninstall:  {req: {tool, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-02}
  shim:status:  {resp: {tool, installed}, rate: medium_query, source: spec-02}
  shim:frame:  {req: ShimFrameSchema, rate: high_freq_scan, source: spec-02}

ai:
  ai:claude-stream-event:  {direction: m→r stream, rate: high_freq_scan, source: spec-03}
  ai:claude-cost-summary:  {rate: medium_query, source: spec-03}
  ai:gemini-pattern-stat:  {rate: medium_query, source: spec-04}
  ai:gemini-rule-reload:  {rate: meta, source: spec-04}
  ai:get-instance-state:  {req: {instanceId}, resp: StateMachine, rate: medium_query, source: spec-28}
  ai:state-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-28}
  ai:list-state-rules:  {rate: meta, source: spec-28}
  ai:override-rule:  {req: {ruleId, override, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-28}
  ai:get-signal-contributions:  {req: {instanceId}, rate: medium_query, source: spec-27}
  ai:set-weight-profile:  {req: {profile, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-27}
  ai:list-weight-profiles:  {rate: meta, source: spec-27}
  ai:fusion-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-27}
  ai:fusion-config:  {rate: meta, source: spec-27}
  ai:report-misreport:  {req: MisreportRecordSchema, rate: low_freq_op, source: spec-29}
  ai:get-diagnostic-explain:  {rate: medium_query, source: spec-29}
  ai:list-misreports:  {rate: meta, source: spec-29}
  ai:reset-learned-weights:  {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-29}
```

### §2.5 `skill:` / `csv:` / `task:` / `dag:`（40 channel）

```yaml
skill:
  skill:list:  {rate: medium_query, source: spec-09}
  skill:get:  {req: {id}, rate: medium_query, source: spec-09}
  skill:reload:  {rate: meta, source: spec-09}
  skill:install-from-path:  {req: {path, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-09}
  skill:uninstall:  {req: {id, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-09}
  skill:validate-yaml:  {req: {yaml}, rate: medium_query, source: spec-09}
  skill:list-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-09}
  skill:builtin-list:  {rate: medium_query, source: spec-10}
  skill:builtin-fork:  {req: {builtinId}, rate: low_freq_op, source: spec-10}
  skill:builtin-readme:  {rate: medium_query, source: spec-10}
  skill:write:  {req: {id, content, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-11}
  skill:create-from-template:  {rate: low_freq_op, source: spec-11}
  skill:delete:  {req: {id, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-11}
  skill:validate:  {rate: medium_query, source: spec-11}
  skill:template-list:  {rate: meta, source: spec-11}
  skill:cloud-sync-disabled:  {meta: V1 占位, source: spec-38}

csv:
  csv:list-groups:  {rate: medium_query, source: spec-12}
  csv:get-group:  {req: {groupId}, rate: medium_query, source: spec-12}
  csv:reload:  {rate: low_freq_op, source: spec-12}
  csv:enqueue-row:  {req: CsvTaskRowSchema, rate: low_freq_op, source: spec-12}
  csv:enqueue-group:  {req: {groupId, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-12}
  csv:row-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-12}
  csv:export-template:  {rate: low_freq_op, source: spec-12}
  csv:schema-info:  {rate: meta, source: spec-13}
  csv:validate-row:  {req: {row}, rate: medium_query, source: spec-13}
  csv:launch:  {req: LaunchOptionsSchema, resp: LaunchSessionSchema, rate: low_freq_op, source: spec-14}
  csv:abort:  {req: {sessionId, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-14}
  csv:pause:  {req: {sessionId}, rate: meta, source: spec-14}
  csv:resume:  {req: {sessionId}, rate: meta, source: spec-14}
  csv:get-runner-info:  {rate: medium_query, source: spec-14}
  csv:generate-cli-command:  {rate: medium_query, source: spec-14}
  csv:list-sessions:  {rate: medium_query, source: spec-14}
  csv:session-event-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-14}
  csv:lock:  {req: {file, confirmedBy?}, rate: low_freq_op, source: spec-21}
  csv:unlock:  {rate: meta, source: spec-21}
  csv:save:  {req: {file, content}, rate: low_freq_op, source: spec-21}
  csv:list-templates:  {rate: meta, source: spec-21}
  csv:save-template:  {rate: low_freq_op, source: spec-21}
  csv:delete-template:  {req: {id, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-21}
  csv:lock-status-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-21}

task:
  task:list:  {rate: medium_query, source: spec-15}
  task:retry:  {req: {taskId, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-15}
  task:skip:  {req: {taskId, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-15}
  task:pause-session:  {req: {sessionId}, rate: meta, source: spec-15}
  task:resume-session:  {req: {sessionId}, rate: meta, source: spec-15}
  task:get-stats:  {rate: medium_query, source: spec-15}
  task:state-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-15}

dag:
  dag:build:  {req: {tasks[]}, resp: DagSnapshotSchema, rate: low_freq_op, source: spec-20}
  dag:detect-cycle:  {req: {tasks[]}, resp: DagCycleErrorSchema?, rate: medium_query, source: spec-20}
  dag:export:  {req: {format}, rate: low_freq_op, source: spec-20}
  dag:layer:  {req: {tasks[]}, resp: layered, rate: medium_query, source: spec-20}
  dag:check-ready:  {req: {taskId}, rate: meta, source: spec-20}
```

### §2.6 `inject:` / `watchdog:` / `recording:`（25 channel）

```yaml
inject:
  inject:execute:  {req: InjectActionSchema, rate: low_freq_op, confirmedBy: YES, source: spec-18, audit: REQUIRED}
  inject:dry-run:  {req: InjectActionSchema, rate: medium_query, source: spec-18}
  inject:cancel:  {req: {injectId, confirmedBy}, rate: meta, confirmedBy: YES, source: spec-18}
  inject:history:  {rate: medium_query, source: spec-18}
  inject:stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-18}
  inject:resolve-target:  {req: {pid|hwnd}, rate: medium_query, source: spec-19}
  inject:get-ready-pool:  {rate: medium_query, source: spec-19}
  inject:get-whitelist:  {rate: meta, source: spec-19}
  inject:add-whitelist:  {req: {entry, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-19}
  inject:remove-whitelist:  {req: {id, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-19}
  inject:configure-strict-mode:  {req: {strict, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-19}
  inject:configure-countdown:  {rate: meta, source: spec-19}
  inject:countdown-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-19}
  inject:countdown-cancel:  {req: {injectId}, rate: meta, source: spec-19}

watchdog:
  watchdog:status:  {resp: WatchdogStatusSchema, rate: medium_query, source: spec-16}
  watchdog:configure:  {req: {policy, confirmedBy?}, rate: low_freq_op, source: spec-16}
  watchdog:override-restart:  {req: {sessionId, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-16}
  watchdog:event-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-16}
  watchdog:get-history:  {rate: medium_query, source: spec-16}

watchdog-supervisor:
  watchdog-supervisor:status:  {rate: medium_query, source: spec-17}
  watchdog-supervisor:respawn:  {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-17}
  watchdog-supervisor:install-service:  {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-17}
  watchdog-supervisor:uninstall-service: {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-17}

recording:
  recording:start:  {req: {target, streams[]}, rate: low_freq_op, source: spec-22}
  recording:stop:  {req: {recordingId}, rate: meta, source: spec-22}
  recording:list:  {rate: medium_query, source: spec-22}
  recording:get-manifest:  {req: {id}, resp: RecordingManifestSchema, rate: medium_query, source: spec-22}
  recording:event-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-22}
  recording:replay-start:  {req: {recordingId}, rate: low_freq_op, source: spec-23}
  recording:replay-seek:  {req: {recordingId, ts}, rate: meta, source: spec-23}
  recording:replay-export:  {req: {recordingId, format}, rate: low_freq_op, source: spec-23}
```

### §2.7 横切（audit / permission / elevation / theme / drawer / cmd / dashboard / status / i18n / a11y / icon）

```yaml
audit:
  audit:tail:  {direction: m→r stream, rate: high_freq_scan, source: spec-10}
  audit:query:  {req: {filter, range}, rate: medium_query, source: spec-10}
  audit:export:  {req: {format, range}, rate: low_freq_op, source: spec-10}
  audit:purge:  {req: {olderThan, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-10}
  audit:append:  {meta: internal-only, rate: high_freq_scan, source: spec-10}

permission:
  permission:confirm:  {req: confirmRequestSchema, resp: confirmResponseSchema, rate: medium_query, source: spec-11}
  permission:allowlist:list:  {rate: meta, source: spec-11}
  permission:allowlist:revoke:  {req: {id, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-11}
  permission:reset:  {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-11}
  permission:ttl-config:  {req: {ttl}, rate: meta, source: spec-37}
  permission:ttl-stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-37}

elevation:
  elevation:request:  {req: elevationRequestSchema, resp: elevationGrantSchema, rate: low_freq_op, source: spec-03}
  elevation:status:  {req: {pid}, rate: medium_query, source: spec-03}
  elevation:revoke:  {req: {grantId, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-03}
  elevation:execute:  {req: {action, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-03}

theme:
  theme:get:  {rate: medium_query, source: spec-06}
  theme:set:  {req: themeAxesSchema, rate: low_freq_op, source: spec-06}
  theme:lock-set:  {req: {axis, locked}, rate: meta, source: spec-06}
  theme:distance:get:  {rate: meta, source: spec-07}
  theme:decoration-list:  {rate: meta, source: R8.B/spec-07}
  theme:decoration-set:  {rate: low_freq_op, source: R8.B/spec-07}
  theme:custom-svg-upload:  {req: {svg, confirmedBy?}, rate: low_freq_op, source: R8.B/spec-07}
  theme:custom-svg-list:  {rate: meta, source: R8.B/spec-07}
  theme:custom-svg-remove:  {req: {id}, rate: low_freq_op, source: R8.B/spec-07}
  theme:sound-config:  {rate: meta, source: R8.B/spec-07}
  theme:sound-config-get:  {rate: meta, source: R8.B/spec-07}

drawer:
  drawer:get-state:  {rate: meta, source: spec-03}
  drawer:set-state:  {rate: meta, source: spec-03}
  drawer:save-layout:  {rate: low_freq_op, source: spec-03}
  drawer:load-layout:  {rate: low_freq_op, source: spec-03}
  drawer:list-layouts:  {rate: meta, source: spec-03}
  drawer:morph-to-popout:  {rate: low_freq_op, source: spec-03}
  drawer:morph-from-popout:  {rate: low_freq_op, source: spec-03}

command:
  command:list:  {rate: medium_query, source: spec-04}
  command:invoke:  {req: {commandId, args, confirmedBy?}, rate: low_freq_op, source: spec-04}
  command:history-add:  {rate: meta, source: spec-04}
  command:history-list:  {rate: meta, source: spec-04}
  command:history-clear:  {req: {confirmedBy}, rate: meta, confirmedBy: YES, source: spec-04}
  command:save-custom:  {rate: low_freq_op, source: spec-04}
  command:list-custom:  {rate: meta, source: spec-04}
  command:resolve-uri:  {req: {uri}, resp: UriSchema, rate: medium_query, source: spec-04}
  command:register-os-protocol:  {rate: meta, source: spec-04}

dashboard:
  dashboard:get-layout:  {rate: meta, source: spec-05}
  dashboard:save-layout:  {rate: low_freq_op, source: spec-05}
  dashboard:list-presets:  {rate: meta, source: spec-05}
  dashboard:delete-preset:  {req: {id, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-05}
  dashboard:reset:  {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-05}
  dashboard:morph-widget-to-drawer: {rate: low_freq_op, source: spec-05}

statusbar / status:
  status:aggregate:  {direction: m→r stream, rate: high_freq_scan, source: spec-08}
  statusbar:get-config:  {rate: meta, source: spec-08}
  statusbar:set-config:  {rate: meta, source: spec-08}
  statusbar:reset:  {req: {confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-08}

i18n:
  i18n:get-locale:  {rate: meta, source: spec-15}
  i18n:set-locale:  {req: {locale}, rate: low_freq_op, source: spec-15}
  i18n:list-locales:  {rate: meta, source: spec-15}
  i18n:reload-resources:  {rate: meta, source: spec-15}

a11y:
  a11y:get-prefs:  {rate: meta, source: spec-16}
  a11y:set-prefs:  {req: A11yPrefsSchema, rate: low_freq_op, source: spec-16}
  a11y:os-prefs:  {rate: meta, source: spec-16}
  a11y:run-self-check:  {resp: A11ySelfCheckResultSchema, rate: low_freq_op, source: spec-16}

icon:
  icon:list-libraries:  {rate: meta, source: spec-17}
  icon:resolve-token:  {req: {token}, resp: IconResolveSchema, rate: medium_query, source: spec-17}
```

### §2.8 R8.C 横切（notify / obs / ipc / zod / recovery / backup / diagnostic / integrations）

```yaml
notify:
  notify:emit:  {req: NotificationSchema, rate: low_freq_op, source: spec-30, audit: optional}
  notify:list:  {rate: medium_query, source: spec-30}
  notify:dismiss:  {req: {notificationId}, rate: meta, source: spec-30}
  notify:configure-aggregation:  {rate: meta, source: spec-30}
  notify:configure-channel:  {rate: meta, source: spec-30}
  notify:stream:  {direction: m→r stream, rate: high_freq_scan, source: spec-30}
  notify:invoke-action:  {req: {notificationId, action, confirmedBy?}, rate: low_freq_op, source: spec-30}

obs:
  obs:get-snapshot:  {resp: SnapshotSchema, rate: medium_query, source: spec-32}
  obs:subscribe:  {direction: m→r stream, rate: high_freq_scan, source: spec-32}
  obs:configure:  {req: ObservabilityConfigSchema, rate: low_freq_op, source: spec-32}
  obs:export-snapshot:  {req: {format}, rate: low_freq_op, source: spec-32}
  obs:export-diagnostic-pack:  {forwards_to: diagnostic:export, source: spec-32}
  obs:unsubscribe:  {req: {subscriberId}, rate: meta, source: spec-32}

ipc:
  ipc:rate-limit-stats:  {rate: meta, source: spec-31}
  ipc:rate-limit-channel-list:  {rate: meta, source: spec-31}
  ipc:override-rate-class:  {rate: meta, source: spec-31, dev_only: true}

zod:
  zod:list-schemas:  {rate: meta, source: spec-33}
  zod:validate-payload:  {rate: medium_query, source: spec-33, dev_only: true}
  zod:migration-status:  {rate: meta, source: spec-33}

recovery:
  recovery:scan:  {rate: low_freq_op, source: spec-34}
  recovery:apply:  {req: {findingId, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-34}
  recovery:check-dirty:  {req: {}, rate: meta, source: spec-34}
  recovery:restore-state:  {req: {snapshotId?, kindsToRestore[], confirmedBy, userChoice?}, rate: low_freq_op, confirmedBy: YES, source: spec-34}
  recovery:list-snapshots:  {rate: meta, source: spec-34}
  recovery:create-checkpoint:  {req: {reason?}, rate: low_freq_op, source: spec-34}
  recovery:report:  {rate: medium_query, source: spec-34}
  recovery:dismiss:  {req: {reportId?, findingsToDismiss[]?}, rate: meta, source: spec-34}

backup:
  backup:create:  {req: {categories[]?, scope[]?, destPath?, createdBy?, confirmedBy?}, rate: low_freq_op, source: spec-35}
  backup:list:  {rate: medium_query, source: spec-35}
  backup:restore:  {req: {backupId?|bundleId?, categoriesToRestore[]?, scope[]?, conflictPolicy?, preRestoreSnapshot?, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-35}
  backup:delete:  {req: {backupId?|bundleId?, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-35}
  backup:configure-schedule:  {req: {enabled, cron, retentionDays, destPath?, categoriesIncluded[]}, rate: low_freq_op, source: spec-35}
  backup:schedule-config:  {rate: meta, source: spec-35}
  backup:export-classified:  {req: {categories[], destPath, confirmedBy?}, rate: low_freq_op, source: spec-35}

diagnostic:
  diagnostic:export:  {req: {includeAudit, includeSnapshot, redactPII}, rate: low_freq_op, source: spec-36}
  diagnostic:list:  {rate: medium_query, source: spec-36}
  diagnostic:share-config:  {rate: meta, source: spec-36}
  diagnostic:purge:  {req: {olderThan, confirmedBy}, rate: low_freq_op, confirmedBy: YES, source: spec-36}

integrations:
  integrations:list-libraries:  {rate: meta, source: spec-01}
  integrations:flag-get:  {rate: meta, source: spec-01}
  integrations:flag-set:  {req: {flag, value, confirmedBy?}, rate: meta, source: spec-01}
  integrations:health-check:  {rate: medium_query, source: spec-01}
```

---

## §3 confirmedBy 必需性总结（破坏性动作清单）

```yaml
confirmedBy_required:
  process: [batch-op (kill), batch-cancel]
  port: [popout-batch, blocklist-add, blocklist-remove, blocklist-reset]
  window: [batch-op (close), batch-cancel, layout-apply]
  cli: [install-shim]
  shim: [uninstall]
  ai: [override-rule, set-weight-profile, reset-learned-weights]
  skill: [install-from-path, uninstall, write, delete]
  csv: [enqueue-group, abort, delete-template]
  task: [retry, skip]
  inject: [execute, cancel, add-whitelist, remove-whitelist, configure-strict-mode]
  watchdog: [override-restart]
  watchdog-supervisor: [respawn, install-service, uninstall-service]
  audit: [purge]
  permission: [allowlist:revoke, reset]
  elevation: [revoke, execute]
  command: [history-clear]
  dashboard: [delete-preset, reset]
  statusbar: [reset]
  recovery: [apply]
  backup: [restore, delete]
  diagnostic: [purge]

total_confirmedBy_channels: 38
audit_required_channels: 12  # inject:execute / process:batch-op / window:batch-op / elevation:* 等
```

---

## §4 速率限制分布（4 级 token bucket）

```yaml
total_channels: 270+
by_rateClass:
  high_freq_scan (30 RPM):  ~32  # 全部 *-stream / 高频订阅
  medium_query (60 RPM):  ~80  # 一般查询/列表/状态
  low_freq_op (120 RPM):  ~95  # 设置/批操作/导出/导入
  meta (600 RPM):  ~63  # 元 channel / 配置查询

突发桶 burstAllowance:
  default: 5
  override_for: rate-limit-stats / health-check 等 meta channel = 20
```

---

## §5 错误码全集（聚合各 spec error_matrix）

```yaml
universal:
  E_VALIDATION:  # Zod 校验失败 / 参数错误
  E_NOT_FOUND:  # 资源不存在
  E_INTERNAL:  # 内部错误
  E_TIMEOUT:  # 超时
  E_PERMISSION_DENIED: # 权限拒绝
  E_RATE_LIMITED:  # 限流（含 retryAfterMs，spec-31）

domain_specific:
  process:
  PROCESS_GONE:  # spec-02
  WMI_TIMEOUT / POWERSHELL_TIMEOUT:  # spec-02
  KOFFI_CALL_FAILED:  # spec-02
  NO_DATA:  # spec-02
  R8A_VM_SCHEMA_INVALID:  # spec-02
  TREE_TOO_DEEP:  # spec-06
  port:
  PORT_NOT_LISTENING:  # spec-09
  BLOCKLIST_FULL:  # spec-13（max 500）
  window:
  HWND_INVALID:  # spec-08
  THUMBNAIL_CAPTURE_FAILED:  # spec-09
  VD_NOT_AVAILABLE:  # spec-11
  cli:
  SHIM_INSTALL_FAILED:  # spec-01
  UNKNOWN_TOOL:  # spec-06
  csv:
  SCHEMA_INVALID:  # spec-13
  LOCKED_BY_OTHER:  # spec-21
  watchdog:
  HEARTBEAT_LOST:  # spec-16
  RESTART_BUDGET_EXCEEDED:  # spec-16
  inject:
  TARGET_NOT_IN_WHITELIST:  # spec-19
  COUNTDOWN_CANCELLED:  # spec-19
  recording:
  DISK_FULL:  # spec-22
  REPLAY_FORMAT_VERSION_MISMATCH:  # spec-23
  topology:
  DEPTH_OVERFLOW:  # spec-25 (≥10)
  recovery:
  SNAPSHOT_CORRUPT:  # spec-34
  backup:
  BUNDLE_TAMPERED:  # spec-35
  diagnostic:
  REDACTION_FAILED:  # spec-36
```

---

## §6 跨 spec 一致性

```yaml
naming_violations: 0
deprecated_channels:
  - process:get-relationship → process:vm:get-light（spec-02 标注）
  - process:get-deep-detail → process:vm:get-deep（spec-02 标注）

duplicate_channels:
  - shim:install: 同名 channel 在 spec-02/03/04 复用（合理 — 单 IPC 多 SHIM 复用）

stream_channels_total: 32
audit_required_channels_total: 12
confirmedBy_required_total: 38
p95_targets_compliant: 100%（spec-31 强制要求注册时声明 rateClass）

statusbar_vs_status_naming:
  - WARN: spec-08 同时使用 status:aggregate 与 statusbar:* 前缀
  - 决议: ACCEPT — status:aggregate 是聚合数据流，statusbar:* 是配置 channel
```

---

**审计员**: spec-r8b
**报告版本**: v2.0（全 71 文件覆盖）
<!-- 2026-05-05 runtime addendum for R8.C spec-36..39:
This addendum supersedes stale generated counts below until the inventory is regenerated from devhub/src/shared/schemas/r8-runtime.ts.
- skill runtime registry count: 19; spec-38 channels include skill:cloud-sync-disabled/status/trigger/list-remote and return E_FEATURE_DEFERRED.
- permission runtime handler count: 11; spec-37 channels include permission:request/check/revoke/revoke-all/list-active/configure-policy/expiry-stream plus compatibility ttl/allowlist/reset/confirm channels.
- diagnostic runtime handler count: 7; spec-36 channels include diagnostic:export/list/purge/preview/list-redaction-rules/capture-screenshot/list-packs; obs:export-diagnostic-pack forwards to this path.
- ocr runtime handler count: 3; spec-39 channels are ocr:capabilities/recognize/list-supported-languages and recognize returns E_OCR_DISABLED with blocks=[].
-->
