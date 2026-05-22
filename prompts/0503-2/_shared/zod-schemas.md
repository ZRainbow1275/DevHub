# R8 Zod Schema 注册表

> **生成时间**: 2026-05-03
> **数据源**: 已落地 4 PRD + 58 spec 的 `## 3. data_contracts` 段落
> **命名规范**: PascalCase + Schema 后缀（部分 R8.A 用 camelCase，详见 §5 一致性问题）
> **总命中**: ~265 schema export
> **版本**: v1.0（第一轮）

---

## §0 Schema 总览（按业务域分类）

| 业务域 | 数量 | 主要锚点 |
|---|---|---|
| Process | 13 | R8.A.spec-02（VM 锚点） |
| Topology / Graph | 11 | R8.A.spec-05 + R8.C.prd |
| Theme | 13 | R8.A.spec-06/07 + R8.B.spec-07 |
| Permission / Elevation / Audit | 14 | R8.A.spec-03/10/11 |
| Port | 7 | R8.A.spec-09 + R8.B.spec-13 |
| Window / Popout | 16 | R8.B.spec-02/09/10/11 |
| Drawer | 4 | R8.B.spec-03 |
| Command / cmdk | 6 | R8.B.spec-04 |
| Dashboard | 4 | R8.B.spec-05 |
| Statusbar / a11y / i18n / icon | 8 | R8.B.spec-08/15/16/17 |
| CLI / SHIM | 12 | R8.C.spec-01/02/03/04/05 |
| AI Task / Signal Fusion / State Machine / Feedback | 22 | R8.C.spec-27/28/29 |
| Skill | 8 | R8.C.spec-09/10/11 |
| CSV | 8 | R8.C.spec-12/13/14 |
| Task Queue / DAG | 9 | R8.C.spec-15/20/21 |
| Watchdog / Inject / Recording | 18 | R8.C.spec-16/17/18/19/22 |
| Notification | 5 | R8.C.spec-30 |
| Observability / Rate-Limit / Crash / Zod | 32 | R8.C.spec-31/32/33/34 |
| Integrations | 2 | R8.A.spec-01 |

---

## §1 共享 Schema（多 spec 引用）

### §1.1 ProcessUnifiedViewModelSchema 家族

| Schema | 定义 | 引用方 |
|---|---|---|
| `processUnifiedViewModelSchema` | R8.A.spec-02 §3 | R8.A.spec-04（card/list parity） / R8.B.spec-06 / R8.B.spec-12 / R8.B.spec-14 / R8.C.spec-07 |
| `processBasicFieldsSchema` | R8.A.spec-02 §3 | 嵌套于 unified VM |
| `processAdvancedFieldsSchema` | R8.A.spec-02 §3 | 嵌套于 unified VM |
| `processSecurityFieldsSchema` | R8.A.spec-02 §3 | 嵌套于 unified VM |
| `processRelationshipsSchema` | R8.A.spec-02 §3 | 嵌套于 unified VM |
| `integrityLevelSchema` | R8.A.spec-02 §3 | R8.A.spec-03（提权决策） |
| `fieldSourceSchema` | R8.A.spec-02 §3 | R8.A.spec-04（来源标记） |
| `fieldErrorCodeSchema` | R8.A.spec-02 §3 | error_matrix |
| `fieldCategorySchema` | R8.A.spec-03 §3 | 提权字段分类 |
| `elevationRequestSchema` / `elevationGrantSchema` / `elevationStatusSchema` | R8.A.spec-03 §3 | UAC IPC |

### §1.2 Theme 家族（4 维轴 + 装饰）

| Schema | 定义 | 引用方 |
|---|---|---|
| `PaletteSchema` | R8.A.prd §7.5 | R8.A.spec-06/07 |
| `DensitySchema` | R8.A.prd §7.5 | R8.A.spec-06 |
| `RadiusFamilySchema` / `radiusFamilySchema` | R8.A.prd §7.5 / R8.A.spec-06 | UI 主题应用 |
| `MotionLevelSchema` / `motionLevelSchema` | R8.A.prd / R8.A.spec-06 | R8.B.spec-16 reduced-motion 检测 |
| `DecorationSetSchema` | R8.A.prd §7.5 | R8.B.spec-07 |
| `ThemeAxisSchema` / `themeAxesSchema` | R8.A.prd / R8.A.spec-06 | R8.B.spec-17 icon 联动 |
| `themeAxesLockSchema` | R8.A.spec-06 §3 | 用户锁定单轴 |
| `themeChangeToastSchema` | R8.A.spec-06 §3 | 主题切换 UI 反馈 |
| `themeDistanceTableSchema` | R8.A.spec-07 §3 | 默认轴差异表 |
| `DecorationKindSchema` | R8.B.spec-07 §3 | 装饰类型 enum |
| `DecorationApplyPositionSchema` | R8.B.spec-07 §3 | 装饰应用位置 |
| `ThemeDecorationConfigSchema` | R8.B.spec-07 §3 | 装饰配置 |
| `CustomSvgEntrySchema` | R8.B.spec-07 §3 | 用户上传 SVG |
| `ThemeSoundConfigSchema` | R8.B.spec-07 §3 | 7 主题音 |

### §1.3 Topology 家族（三套图）

| Schema | 定义 | 引用方 |
|---|---|---|
| `GraphKindSchema` | R8.A.prd §7.8 + R8.C.prd | R8.A.spec-05（network/neural/flow） |
| `graphKindSchema` | R8.A.spec-05 §3 | R8.A.spec-05 内部使用（小写变体） |
| `graphScopeSchema` / `GraphScopeSchema` | R8.A.spec-05 + R8.C.prd | 三端附属作用域 |
| `networkEdgeKindSchema` | R8.A.spec-05 §3 | OS 层硬连接 |
| `neuralEdgeKindSchema` | R8.A.spec-05 §3 | 业务/语义软连接 |
| `graphNodeSchema` / `graphEdgeSchema` / `graphResponseSchema` | R8.A.spec-05 §3 | 通用 IPC 响应 |
| `NetworkTopologyEdgeSchema` | R8.C.prd §7 | 待 spec-23/24/25 引用 |
| `NeuralRelationshipEdgeSchema` | R8.C.prd §7 | 待 spec-23/24/25 引用 |
| `FlowEdgeSchema` | R8.C.prd §7 | 待 spec-26 引用 |
| `TopologyEntryPointSchema` | R8.A.prd §7 | R8.A.spec-05 三端入口注册 |

### §1.4 Port / Security 家族

| Schema | 定义 | 引用方 |
|---|---|---|
| `portStateSchema` | R8.A.spec-09 §3 | LISTENING/ESTABLISHED 等 8 状态 |
| `securityTierSchema`（小写） | R8.A.spec-09 §3 | local/lan/wan/suspicious |
| `SecurityTierSchema`（大写） | R8.B.prd + R8.B.spec-13 | Local/LAN/WAN-Capable/Suspicious |
| `portUnifiedViewModelSchema` | R8.A.spec-09 §3 | 端口卡渲染 |
| `BlocklistEntrySchema` | R8.B.spec-13 §3 | 用户黑名单 |

**注意**: `securityTierSchema`（4 值小写）和 `SecurityTierSchema`（4 值大写带 Capable/Suspicious）为命名变体 — 建议统一，详见 §5 P0。

### §1.5 Popout / Window 家族

| Schema | 定义 | 引用方 |
|---|---|---|
| `PopoutTriggerSchema` | R8.B.prd + R8.B.spec-01 | 4 触发器 enum |
| `PopoutKindSchema` | R8.B.spec-01 §3 | 6 种 popout 类型 |
| `PopoutWindowSchema` | R8.B.prd | R8.C.spec-08（MonitorPopoutSchema extend） |
| `PortPopoutSchema` / `PortPopoutStateSchema` / `PortPopoutActionSchema` | R8.B.spec-01 §3 | popout IPC |
| `PopoutSyncPolicySchema` | R8.B.spec-01 §3 | 主子窗状态同步策略 |
| `BrowserPopoutSchema` | R8.B.spec-02 §3 | BrowserWindow 升级 |
| `PopoutCreateRequestSchema` / `PopoutMessageSchema` | R8.B.spec-02 §3 | popout IPC |
| `ScreenEventSchema` | R8.B.spec-02 §3 | 多显示器迁移事件 |
| `setTopmostRequestSchema` / `setTopmostResponseSchema` | R8.A.spec-08 §3 | AOT IPC |
| `getTopmostRequestSchema` / `getTopmostResponseSchema` / `topmostListResponseSchema` | R8.A.spec-08 §3 | AOT 查询 |
| `WindowViewModeSchema` | R8.B.spec-09 §3 | card/list/wall |
| `ThumbnailWallEntrySchema` / `ThumbnailWallViewportSchema` | R8.B.spec-09 + R8.B.prd | 缩略图墙渲染 |
| `WindowGroupSchema` | R8.B.spec-09 §3 | sha256 5-tuple 分组 |
| `VirtualDesktopSchema` / `MonitorInfoSchema` / `WindowVdInfoSchema` | R8.B.spec-11 §3 | 虚拟桌面 + 多显示器 |
| `WindowLayoutPresetSchema` | R8.B.spec-11 §3 | 命名布局预设 |
| `MonitorPopoutSchema` | R8.C.spec-08 §3 | extend `PopoutWindowSchema` |

### §1.6 Drawer / Command / Dashboard 家族

| Schema | 定义 | 引用方 |
|---|---|---|
| `DrawerSlotSchema` | R8.B.prd + R8.B.spec-03 | 5 槽 enum |
| `DrawerScopeSchema` | R8.B.spec-03 §3 | global/monitor/project/ai-task |
| `DrawerStateSchema` / `DrawerContentRegistrySchema` | R8.B.spec-03 §3 | 状态 + 内容注册 |
| `CommandTypeSchema` | R8.B.spec-04 §3 | 命令类型 enum |
| `CommandPaletteEntrySchema` | R8.B.prd + R8.B.spec-04 | 命令条目 |
| `UriScopeSchema` / `UriSchema` | R8.B.spec-04 §3 | `devhub://` URI |
| `CommandHistoryEntrySchema` / `CustomCommandSchema` | R8.B.spec-04 §3 | 命令历史 + 自定义 |
| `WidgetIdSchema` / `BreakpointSchema` / `GridItemSchema` / `DashboardLayoutSchema` | R8.B.spec-05 §3 | Dashboard 网格 |

### §1.7 Statusbar / a11y / i18n / icon

| Schema | 定义 |
|---|---|
| `A11yPrefsSchema` / `A11ySelfCheckResultSchema` | R8.B.spec-16 §3 |
| `LocaleSchema` / `LocaleManifestSchema` | R8.B.spec-15 §3 |
| `IconLibrarySchema` / `IconResolveSchema` | R8.B.spec-17 §3 |

### §1.8 CLI / SHIM 家族

| Schema | 定义 | 引用方 |
|---|---|---|
| `CliEventTypeSchema` | R8.C.prd | 跨 SHIM 引用 |
| `CliEventSchema` | R8.C.prd | R8.C.spec-01/02/03/04 |
| `ProgressDataPointSchema` | R8.C.prd | R8.C.spec-01/07 |
| `ParserDescriptorSchema` / `ParseSessionSchema` | R8.C.spec-01 §3 | 解析器注册 |
| `CodexMarkerSchema` / `ShimManifestSchema` / `ShimFrameSchema` | R8.C.spec-02 §3 | Codex SHIM |
| `GeminiPatternRuleSchema` / `GeminiParseStateSchema` | R8.C.spec-04 §3 | Gemini SHIM |
| `TitlePatternRuleSchema` / `TitleSampleSchema` / `CursorCopilotSignalSchema` | R8.C.spec-05 §3 | Cursor/Copilot 检测 |

### §1.9 AI Task / 信号融合 / 状态机 / 反馈

| Schema | 定义 |
|---|---|
| `MisreportRecordSchema` / `WeightAdjustmentSchema` / `DiagnosticExplainSchema` | R8.C.spec-29 §3 |
| 信号融合相关 schemas | R8.C.spec-27 §3 |
| 状态机相关 schemas | R8.C.spec-28 §3 |

### §1.10 Skill / CSV / DAG / Task

| Schema | 定义 | 引用方 |
|---|---|---|
| `SkillSchema` | R8.C.prd + R8.C.spec-09 §3 | R8.C.spec-10/11 |
| `SkillVariableSchema` | R8.C.prd | R8.C.spec-09 |
| `SkillLoadErrorSchema` | R8.C.spec-09 §3 | error_matrix |
| `SkillEditorBufferSchema` / `SkillValidationResultSchema` / `SkillTemplateSchema` | R8.C.spec-11 §3 | Monaco 编辑器 |
| `CsvTaskRowSchema`（PRD 版 + spec-13 版） | R8.C.prd + R8.C.spec-13 §3 | R8.C.spec-12/14/15 |
| `PrioritySchema` | R8.C.prd | R8.C.spec-15 队列优先级 |
| `RunnerKindSchema` / `CsvMetadataSchema` / `LaunchOptionsSchema` / `LaunchSessionSchema` | R8.C.spec-14 §3 | 3 启动入口 |
| `CsvFileGroupSchema` / `CsvDriverStateSchema` | R8.C.spec-12 §3 | 驱动状态 |
| `DependencyConditionSchema` / `DependencyClauseSchema` / `ParsedDependencySchema` | R8.C.spec-20 §3 | DAG 依赖语法 |
| `DagNodeSchema` / `DagEdgeSchema` / `DagSnapshotSchema` / `DagCycleErrorSchema` | R8.C.spec-20 §3 | DAG 引擎 |
| `DagViewKindSchema` / `EditorStateSchema` / `NodeTemplateSchema` / `SaveResultSchema` | R8.C.spec-21 §3 | DAG 编辑器 |
| `RecordingStreamKindSchema` / `RecordingManifestSchema` / `RecordingEventSchema`（discriminatedUnion） | R8.C.spec-22 §3 | 任务录制 |
| `StdoutEventSchema` / `StdinEventSchema` / `ScreenshotEventSchema` / `FsEventSchema` / `GitDiffEventSchema` | R8.C.spec-22 §3 | 录制 5 流 |

### §1.11 Watchdog / Inject

| Schema | 定义 |
|---|---|
| `HeartbeatSourceSchema` / `WatchdogStatusSchema` | R8.C.prd |
| `InjectModeSchema` | R8.C.prd | sendinput/pty/uia/clipboard-paste |
| `InjectScenarioSchema` | R8.C.prd | 6 场景 enum |
| `InjectActionSchema` | R8.C.prd | 注入动作 |

### §1.12 Notification

| Schema | 定义 |
|---|---|
| `NotificationLevelSchema` | R8.C.prd + R8.C.spec-30 §3 |
| `NotificationChannelSchema` | R8.C.prd + R8.C.spec-30 §3 |
| `NotificationSchema` | R8.C.prd + R8.C.spec-30 §3 |
| `NotificationAggregationConfigSchema` | R8.C.prd + R8.C.spec-30 §3 |
| `ChannelConfigSchema` | R8.C.spec-30 §3 |

### §1.13 Cross-cut（横切）

| Schema | 定义 | 用途 |
|---|---|---|
| `auditActorSchema` / `auditTargetSchema` / `auditOutcomeSchema` / `auditEventSchema` | R8.A.spec-10 §3 | 审计日志 |
| `AuditOperationSchema` / `AuditLogEntrySchema` | R8.A.prd §7 | 跨 spec 引用 |
| `riskLevelSchema` / `dangerousActionSchema` / `dangerousActionMatrixSchema` | R8.A.spec-11 §3 | 权限分级 |
| `confirmRequestSchema` / `confirmResponseSchema` / `allowlistEntrySchema` | R8.A.spec-11 §3 | 权限确认 |
| `PermissionTierSchema` / `PermissionMemoryEntrySchema` | R8.A.prd §7 | 24h 权限记忆 |
| `channelRegistrationSchema` / `rateLimitVerdictSchema` / `rateLimitStatsSchema` / `rateLimitStatsResponseSchema` / `rateLimitOverrideRequestSchema` | R8.C.spec-31 §3 | IPC rate limit |
| `metricKindSchema` / `metricSampleSchema` / `observabilitySnapshotSchema` / `observabilitySnapshotRequestSchema` / `observabilityConfigSchema` / `observabilityConfigureResponseSchema` / `observabilityExportSnapshotRequestSchema` / `observabilityExportSnapshotResponseSchema` / `observabilityDiagnosticPackRequestSchema` / `observabilityDiagnosticPackResponseSchema` / `observabilitySubscribeRequestSchema` / `observabilitySubscribeResponseSchema` / `observabilityUnsubscribeRequestSchema` / `observabilityUnsubscribeResponseSchema` | R8.C.spec-32 §3 | 观测面板 snapshot / stream / export |
| `SchemaMetaSchema` / `IpcSchemaPairSchema` / `SchemaValidationVerdictSchema` / `SchemaMigrationStepSchema` | R8.C.spec-33 §3 | Zod source-of-truth |
| `DirtyFindingSchema` / `RecoverySnapshotSchema` / `RecoveryReportSchema` | R8.C.spec-34 §3 | 启动期 crash recovery |
| `integrationLibrarySchema` / `integrationManifestSchema` | R8.A.spec-01 §3 | 17 集成库注册 |

---

## §2 Schema 跨 spec 引用矩阵（高引用 Top 10）

| Schema | 定义位置 | 跨 spec 引用次数 |
|---|---|---|
| `processUnifiedViewModelSchema` | R8.A.spec-02 | 7 处（spec-04/spec-06/spec-12/spec-14/R8.C.spec-07/R8.B.spec-09/treemap） |
| `GraphKindSchema` / `graphKindSchema` | R8.A.prd + R8.C.prd + R8.A.spec-05 | 3 处 |
| `SkillSchema` | R8.C.prd + R8.C.spec-09 | 3 处（spec-10/11/15） |
| `CsvTaskRowSchema` | R8.C.prd + R8.C.spec-13 | 4 处（spec-12/14/15/22） |
| `PopoutWindowSchema` | R8.B.prd | 2 处（R8.C.spec-08 extend） |
| `auditEventSchema` / `AuditLogEntrySchema` | R8.A.spec-10 + R8.A.prd | 跨所有 spec audit 路径 |
| `NotificationSchema` | R8.C.prd + R8.C.spec-30 | R8.C.spec-29（misreport 通知） |
| `LocaleSchema` | R8.B.spec-15 | 全 spec i18n 字符串外置 |
| `SecurityTierSchema` | R8.B.spec-13 + R8.B.prd | R8.A.spec-09 / R8.B.spec-01 |
| `DrawerSlotSchema` | R8.B.spec-03 + R8.B.prd | R8.B.spec-08（statusbar 槽） |

---

## §3 Source-of-Truth 单点权威

```yaml
single_source_of_truth_recommendation:
  ProcessUnifiedViewModelSchema: R8.A.spec-02
  GraphKindSchema: R8.C.prd（master 锚点）
  CsvTaskRowSchema: R8.C.spec-13（schema 单源）
  SkillSchema: R8.C.spec-09（不在 PRD 复述全文）
  NotificationSchema: R8.C.spec-30
  AuditLogEntrySchema: R8.A.spec-10
  ThemeAxisSchema: R8.A.spec-06

duplication_risks:
  - PopoutTriggerSchema: R8.B.prd 与 R8.B.spec-01 都定义（2 处） → 推荐 spec-01 单源
  - DrawerSlotSchema: R8.B.prd 与 R8.B.spec-03 都定义（2 处） → 推荐 spec-03 单源
  - SecurityTierSchema: R8.B.prd 与 R8.B.spec-13 都定义（2 处） → 推荐 spec-13 单源
  - ThumbnailWallEntrySchema / ThumbnailWallViewportSchema: R8.B.prd 与 R8.B.spec-09 都定义 → 推荐 spec-09 单源
  - NotificationLevelSchema / NotificationChannelSchema / NotificationSchema / NotificationAggregationConfigSchema: R8.C.prd 与 R8.C.spec-30 都定义 → 推荐 spec-30 单源
  - GraphKindSchema: R8.A.prd 与 R8.C.prd 与 R8.A.spec-05（三处） → 推荐 R8.C.prd §7 全局 schema 注册表 单源
  - CsvTaskRowSchema: R8.C.prd 与 R8.C.spec-13（两处） → 推荐 spec-13 单源
  - SkillSchema: R8.C.prd 与 R8.C.spec-09（两处） → 推荐 spec-09 单源
  - CliEventSchema: R8.C.prd 与 R8.C.spec-01（一致） → R8.C.spec-01 单源

resolution_via_R8C_spec33:
  - R8.C.spec-33 即"Zod source-of-truth"：自动校验 schema 在 prd / spec / 实现的同步性
  - SchemaMigrationStepSchema 提供版本化迁移路径
```

---

## §4 命名一致性（PASS / WARN）

```yaml
casing_inconsistency:
  R8.A 系列: camelCase（processUnifiedViewModelSchema / themeAxesSchema / graphScopeSchema 等）
  R8.B 系列: PascalCase（PopoutTriggerSchema / DrawerSlotSchema 等）
  R8.C 系列: PascalCase（CliEventSchema / SkillSchema 等）

decision: WARN（不阻塞 — 已落地 spec 内部一致即可，跨 batch 引用时按 import 名称即可）

suffix_convention: 100% 用 Schema 后缀

zod_method_distribution:
  z.object(): 多数
  z.enum(): ~25
  z.discriminatedUnion(): 2（PopoutMessageSchema / RecordingEventSchema）
  z.lazy(): 1（ProcessTreeNodeSchema 自递归）
  z.record(): 1（dangerousActionMatrixSchema）
```

---

## §5 待修复清单

### §5.1 P0（重复定义需收敛 — 单源化）

```yaml
- name: PopoutTriggerSchema
  duplicated_in: [R8.B.prd, R8.B.spec-01]
  source_of_truth: R8.B.spec-01
  prd_action: 改为 import 引用 + 链接

- name: DrawerSlotSchema
  duplicated_in: [R8.B.prd, R8.B.spec-03]
  source_of_truth: R8.B.spec-03

- name: SecurityTierSchema
  duplicated_in: [R8.B.prd, R8.B.spec-13]
  source_of_truth: R8.B.spec-13

- name: ThumbnailWallEntrySchema / ThumbnailWallViewportSchema
  duplicated_in: [R8.B.prd, R8.B.spec-09]
  source_of_truth: R8.B.spec-09

- name: NotificationSchema 全家族（4 个）
  duplicated_in: [R8.C.prd, R8.C.spec-30]
  source_of_truth: R8.C.spec-30

- name: GraphKindSchema
  duplicated_in: [R8.A.prd, R8.C.prd, R8.A.spec-05]
  source_of_truth: R8.C.prd（feedback#5 全局图体系单点权威）

- name: CsvTaskRowSchema / SkillSchema
  duplicated_in: [R8.C.prd, R8.C.spec-13/spec-09]
  source_of_truth: 各 spec
```

### §5.2 P1（命名变体可接受但需审计登记）

```yaml
- securityTierSchema (R8.A.spec-09 小写 4 值) vs SecurityTierSchema (R8.B 大写带 Capable/Suspicious)
  rationale: R8.A 阶段简化版 vs R8.B 阶段精细化版
  decision: ACCEPT — R8.B 阶段升级语义，向后兼容

- graphKindSchema (R8.A.spec-05 小写) vs GraphKindSchema (R8.A.prd / R8.C.prd 大写)
  rationale: R8.A 阶段限定 3 enum vs 全局精确 ('network-topology'/'neural-relationship'/'flow')
  decision: ACCEPT — R8.A 实施时映射

- riskLevelSchema (R8.A.spec-11 小写) — R8.A camelCase 惯例
  decision: ACCEPT
```

### §5.3 P2（待 R8.C 后续 spec 落地后扩展）

```yaml
- 待 spec-23 落地: TopologyServiceSchema 单例锁
- 待 spec-24 落地: TopologyGlobalEntrySchema
- 待 spec-25 落地: TopologyAttachedEntrySchema
- 待 spec-26 落地: FlowReplaySchema / FlowEventReplayPolicySchema
- 待 spec-35-39 落地: BackupBundleSchema / DiagnosticPackSchema / HealthCheckSchema 等
```

---

## §6 引用关系（spec 维度）

```yaml
high_dependency_specs:
  R8.A.spec-02 (ProcessUnifiedViewModel):
  被引用: R8.A.spec-04 / R8.B.spec-06/12/14 / R8.C.spec-07
  引用: 集成库 R8.A.spec-01

  R8.B.spec-01 (PopoutSystem):
  被引用: R8.B.spec-02/03 / R8.C.spec-08
  引用: R8.A.spec-09（端口数据）

  R8.C.spec-01 (CLIOutputParser):
  被引用: R8.C.spec-02/03/04/05/06/27/28
  引用: R8.A.spec-01（node-pty）

  R8.C.spec-13 (CSVSchema):
  被引用: R8.C.spec-12/14/15/22
  引用: 无

  R8.C.spec-33 (ZodSourceOfTruth):
  被引用: 全 R8 spec（meta）
  引用: 集成库（zod）
```

---

**审计员**: spec-r8b
**报告版本**: v1.0

---

## implementation_status_2026-05-05

- `devhub/src/shared/schemas/_meta.ts` now defines `SCHEMA_VERSION`, `SchemaMeta`, `IpcSchemaPair`, `SchemaValidationVerdict`, `SchemaMigrationStep`, and zod IPC request/response schemas.
- `devhub/src/shared/schemas/index.ts` is the central schema entry point. It uses namespace exports for per-domain modules and exports the runtime registry through `r8-runtime` to avoid duplicate symbol collisions.
- `devhub/src/main/services/zod/SchemaRegistry.ts`, `IpcSchemaGuard.ts`, and `SchemaMigration.ts` provide the executable SoT services for registry listing, safe validation, IPC boundary errors, and reversible migration metadata.
- `devhub/scripts/verify-zod-sot.ts` enforces index coverage, runtime registry meta schemas, guarded zod IPC handlers, and duplicate runtime type detection with an explicit legacy allowlist.
- Verified with `pnpm check:zod-sot`, `pnpm typecheck`, targeted Vitest, `pnpm lint`, `pnpm check:license`, full Vitest, and diff whitespace checks.

## implementation_status_2026-05-05_spec34_recovery

- Added `devhub/src/shared/schemas/recovery.ts` as the executable source of truth for `DirtyKind`, `DirtySeverity`, `DirtyFinding`, `RecoverySnapshot`, `RecoveryReport`, `AppLifecycleMarker`, `RecoveryProbeSummary`, and recovery IPC request/response schemas.
- Registered recovery schemas in `r8RuntimeSchemaRegistry`: `DirtyKind`, `DirtySeverity`, `DirtyFinding`, `RecoveryRecommendedAction`, `RecoverySnapshotReason`, `RecoveryUserChoice`, `RecoverySnapshotFile`, `RecoverySnapshot`, `RecoveryAppliedAction`, `RecoveryReport`, `AppLifecycleMarker`, `RecoveryProbeSummary`, `RecoveryCheckDirtyRequest`, `RecoveryCheckDirtyResponse`, `RecoveryRestoreStateRequest`, `RecoveryListSnapshotsResponse`, `RecoveryCreateCheckpointRequest`, `RecoveryDismissRequest`, and `RecoveryDismissResponse`.
- Updated shared schema exports with `RecoverySchemas` namespace export from `devhub/src/shared/schemas/index.ts`.
- Updated R8 IPC schema pairs for `recovery:check-dirty`, `recovery:restore-state`, `recovery:list-snapshots`, `recovery:create-checkpoint`, `recovery:dismiss`, and legacy-compatible `recovery:scan` / `recovery:report`.
- Verification: `pnpm -C devhub check:zod-sot` passed after spec-34 registration.

## implementation_status_2026-05-05_spec35_backup_restore

- `devhub/src/shared/schemas/r8-runtime.ts` now registers executable spec-35 Zod contracts: `BackupLegacyScope`, `BackupCategory`, `BackupCategoryEntry`, `BackupManifest`, `BackupSchedule`, `BackupCreateRequest`, `BackupExportClassifiedRequest`, `BackupDeleteRequest`, `RestorePlan`, `RestoreCategoryResult`, `RestoreResult`, `BackupScheduleResult`, and compatibility `BackupBundle`.
- `BackupBundle` remains backward-compatible with legacy `bundleId`, `scope`, `path`, `bytes`, and `createdAt`, while classified backups also expose `backupId`, `artifactPath`, `zipPath`, schema version, category hashes, redacted fields, and warnings.
- `backup:configure-schedule`, `backup:schedule-config`, and `backup:export-classified` are synchronized with the R8 IPC registry, preload whitelist, and renderer global types.
- Verified with targeted Vitest for schema registry, IPC handlers, preload contract, classified backup creation, selective restore, tamper rejection, export/delete, and schedule validation.

## implementation_status_2026-05-05_spec36_39_resilience

- `devhub/src/shared/schemas/r8-runtime.ts` now registers executable spec-36 diagnostic contracts: `DiagnosticSection`, `DiagnosticRedactionRule`, `DiagnosticPackOptions`, `DiagnosticPreviewSection`, `DiagnosticPreview`, `DiagnosticScreenshotRequest`, `DiagnosticScreenshotResult`, and `DiagnosticPackManifest`.
- The same runtime schema source registers spec-37 permission TTL contracts: `SensitivePermissionOperation`, `PermissionGrantScope`, `PermissionTtlGrant`, `PermissionPolicy`, `PermissionRequest`, `PermissionCheckRequest`, `PermissionCheckResult`, `PermissionRevokeRequest`, `PermissionRevokeAllRequest`, `PermissionRevokeResponse`, `PermissionListActiveResponse`, `PermissionConfigurePolicyResponse`, and `PermissionExpiryStreamPayload`.
- The same runtime schema source registers spec-38 cloud-sync deferred contracts: `CloudSyncProvider`, `CloudSyncRemoteManifest`, `CloudSyncConflictPolicy`, `CloudSyncRequest`, `CloudSyncResult`, `CloudSyncStatus`, and `CloudSyncRemoteListResponse`.
- The same runtime schema source registers spec-39 disabled OCR contracts: `OcrLanguage`, `OcrRecognizeRequest`, `OcrTextBlock`, `OcrDisabledResponse`, `OcrCapabilities`, and `OcrSupportedLanguagesResponse`.
- IPC schema pairs, preload bridge methods, renderer global types, and `r8RuntimeSchemaRegistry` are synchronized for spec-36..39.
- Verification: `pnpm check:zod-sot`, `pnpm typecheck`, schema/IPC/preload Vitest, focused spec-36..39 service Vitest, `pnpm lint`, `pnpm check:license`, `pnpm check:no-cloud-deps`, `pnpm check:no-ocr-deps`, and `git diff --check` passed on 2026-05-05.

## implementation_status_2026-05-14_ipc_registry_owner_coverage

- `devhub/src/main/ipc/r8RuntimeHandlers.test.ts` now verifies R8 IPC registry coverage through the same owner split used by the real main-process startup sequence: `setupR8RuntimeHandlers`, `setupA11yHandlers`, and `setupProcessHandlers`.
- The coverage test filters registrations back to `R8_IPC_CHANNELS`, asserts no missing R8 channel, asserts no duplicate R8 handler registration, and keeps the existing contract-only fallback assertion for non-executable channels such as `audit:query`.
- This closes the previous registry coverage gap where `a11y:get-prefs`, `a11y:set-prefs`, `a11y:os-prefs`, `a11y:run-self-check`, `process:tags-list`, `process:tags-set`, and `process:history-24h` were correctly owned by external executable handler modules but were not included in the isolated R8 runtime handler test.
- Verification passed on 2026-05-14 with:
  - `pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts -t "registers a handler for every R8 IPC contract channel" --maxWorkers=1`
  - `pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1`
  - `pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts -t "zod|Zod|schema|Schema|preload|IPC" --maxWorkers=1`
  - `pnpm -C devhub exec eslint src/main/ipc/r8RuntimeHandlers.test.ts`
  - `pnpm -C devhub check:zod-sot`
  - `pnpm -C devhub exec tsc --noEmit --pretty false`
  - `pnpm -C devhub check:no-emoji`
  - `git -C devhub diff --check -- src/main/ipc/r8RuntimeHandlers.test.ts`
