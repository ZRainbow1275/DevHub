# contracts/22 — 数据模型一致性规格

> 严重度：P0（所有 spec 所依赖的 source of truth）
> 目的：汇总 spec/02~21 产出的所有类型，确保主/渲染/持久化三端统一，避免 R5 级"字段漏传"事故
> 位置：`devhub/src/shared/types/`

---

## 一、原则

1. **唯一真源** — 所有类型定义在 `shared/types/*.ts`，主/渲染均从此导入
2. **禁止 renderer-only / main-only 类型** — 若跨 IPC 传输，必在 shared
3. **Zod runtime 校验** — 每个类型配 Zod schema，IPC 边界进行 parse
4. **版本字段** — 持久化结构必有 `schemaVersion`，配迁移函数
5. **最小字段** — 不传整对象，传 id + 必要字段

---

## 二、类型清单（按 spec 归集）

### 2.1 扫描层 (spec/03~06)

```typescript
// shared/types/scanner.ts
export interface IScanner<T> {
  id: ScannerId
  start(): Promise<void>
  stop(): Promise<void>
  getSnapshot(): T
  subscribe(fn: (snapshot: T) => void): Unsubscribe
  getMetrics(): ScannerMetrics
}

export interface ScannerMetrics {
  lastRunAt: number
  lastDurationMs: number
  lastResultSize: number
  errorCount: number
  p95DurationMs: number
}

export type ScannerId = 'process' | 'port' | 'window' | 'ai-tool' | 'project'
```

### 2.2 进程 (spec/14)

```typescript
// shared/types/process.ts
export interface ProcessInfo {
  pid: number
  name: string
  parentPid?: number
  cpuPercent?: number
  memoryBytes?: number
  user?: string
  commandLine?: string
  workingDir?: string
  startTime?: number
  threadCount?: number
}

export interface PartialDeepDetail extends ProcessInfo {
  basicAvailable: boolean
  extendedAvailable: boolean
  modulesAvailable: boolean
  networkAvailable: boolean
  environmentAvailable: boolean
  modules?: ModuleInfo[]
  connections?: ConnectionInfo[]
  environment?: Record<string, string>
  accessReport: AccessReport
}

export interface AccessReport {
  pid: number
  elevationRequired: boolean
  scanAttempted: boolean
  scanResult: 'ok' | 'access-denied' | 'not-found' | 'timeout' | 'wmi-error'
  currentUser: string
  targetProcessUser?: string
  suggestion: 'relaunch-as-admin' | 'retry' | 'none'
  triedAt: number
}

export interface ModuleInfo { name: string; path: string; version?: string; baseAddress?: string }
export interface ConnectionInfo { localAddress: string; localPort: number; remoteAddress?: string; remotePort?: number; state: string; protocol: 'tcp' | 'udp' }
```

### 2.3 端口 (spec/15)

```typescript
// shared/types/port.ts
export interface PortInfo {
  protocol: 'tcp' | 'udp'
  localAddress: string
  localPort: number
  state: 'LISTENING' | 'ESTABLISHED' | ...
  pid?: number
  processName?: string
}

export interface PortDetail extends PortInfo {
  processCommandLine?: string
  serviceName?: string
  cachedAgeSec?: number              // R7 NEW
  queryMode?: 'light' | 'full'       // R7 NEW
}
```

### 2.4 窗口 (spec/07, 09, 10, 12)

```typescript
// shared/types/window.ts
export interface WindowInfo {
  hwnd: number                  // 瞬时值
  fingerprint: WindowFingerprint  // 跨重启稳定
  title: string
  pid: number
  processName: string
  rect: { x: number; y: number; width: number; height: number }
  monitorId: string
  isVisible: boolean
  isMinimized: boolean
  isMaximized: boolean
  alwaysOnTop: boolean
  zIndex: number
  aiToolId?: ToolId
  aliasId?: string
}

export interface WindowFingerprint {
  processExe: string
  windowClass: string
  titleRoot: string          // 去可变部分（路径/时间戳）
  cliArgsHash?: string
  workingDirHash?: string
  userId: string
}

export interface WindowGroup {
  id: string
  name: string
  color: string
  fingerprints: WindowFingerprint[]
  autoRule?: GroupAutoRule
  createdAt: number
  updatedAt: number
}

export interface WindowLayoutSnapshot {
  id: string
  name: string
  scope: 'selected' | 'group' | 'all-visible'
  presetKind?: TilePreset
  windows: Array<{ fingerprint: WindowFingerprint; rect: { x: number; y: number; width: number; height: number }; monitorId: string }>
  createdAt: number
}

export type TilePreset =
  | 'two-left-right'
  | 'two-top-bottom'
  | 'three-left-rightsplit'
  | 'four-grid'
  | 'n-column-grid'
  | 'cascade'
  | 'custom'
```

### 2.5 AI 别名 (spec/07)

```typescript
// shared/types/ai-alias.ts
export interface AIAlias {
  id: string
  toolId: ToolId
  displayName: string
  fingerprint: WindowFingerprint
  applyToExternalWindow: boolean
  createdAt: number
  updatedAt: number
}

export interface RenameIntent {
  aliasId: string
  newName: string
  source: 'user-inline-edit' | 'user-settings' | 'auto-detect'
  applyToExternalWindow: boolean
  targetHwnd?: number
  requestedAt: number
}

export interface RenameResult {
  ok: boolean
  storeUpdated: boolean
  windowTitleUpdated: boolean
  reason?: 'win32-error' | 'access-denied' | 'hwnd-not-found'
  appliedAt: number
}
```

### 2.6 AI 任务检测 (spec/08, 11)

```typescript
// shared/types/ai-task.ts
export type AIMonitorState =
  | 'idle' | 'starting' | 'running' | 'waiting-input'
  | 'tool-use' | 'finalizing' | 'completed' | 'failed' | 'stalled'

export interface AITaskKey {
  aliasId: string
  sessionId?: string
  startedAt: number
}

export interface DerivedProgress {
  mode: 'hidden' | 'indeterminate' | 'determinate'
  percent?: number
  phase?: AITaskPhase
  elapsedMs: number
  estimatedRemainingMs?: number
  confidence: number
}

export type AITaskPhase = 'prompt' | 'thinking' | 'tool-call' | 'streaming' | 'finalize'

export interface ToolProfile {
  toolId: ToolId
  signals: {
    exitCodePolicy: 'required' | 'optional'
    windowSilenceTimeoutMs: number
    stdoutPatterns: { done: RegExp[]; error: RegExp[] }
    cpuIdleThreshold: number
    cpuIdleDurationMs: number
  }
  weights: {
    windowTitle: number
    cpu: number
    stdout: number
    exitCode: number
  }
  debounceMs: number
}

export interface AITaskHistory {
  taskKey: AITaskKey
  aliasId: string
  taskAlias: string           // alias displayName at completion time
  toolId: ToolId
  startedAt: number
  endedAt: number
  durationMs: number
  endState: 'completed' | 'failed' | 'stalled'
  confidence: number
  notificationSent: boolean
}
```

### 2.7 项目 (spec/21)

```typescript
// shared/types/project.ts — 见 spec/21 第四节
```

### 2.8 拓扑 (spec/02, 17)

```typescript
// shared/types/topology.ts
export interface TopologyScope {
  root: TopologyRootKind
  rootId: string | number
  depthLimit: number
  includeEntityKinds: Array<'process' | 'port' | 'window' | 'ai-task' | 'module'>
  edgeKinds: Array<'parent-child' | 'listen-on' | 'owns-window' | 'ai-running-in'>
  showOrphan: boolean
}

export type TopologyRootKind = 'process' | 'port' | 'window' | 'ai-task'

export interface TopologyGraph {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  meta: { generatedAt: number; scope: TopologyScope }
}

export interface TopologyNode {
  id: string
  kind: TopologyNode['kind']
  depth: number
  label: string
  data: unknown
}

export interface TopologyEdge {
  source: string
  target: string
  kind: string
  weight?: number
}
```

### 2.9 主题 (spec/19)

```typescript
// shared/types/theme.ts
export interface ThemeState {
  palette: PaletteName
  density: DensityLevel
  radiusFamily: RadiusFamily
  motionLevel: MotionLevel
  schemaVersion: 2
}

export type PaletteName = 'cyberpunk' | 'synthwave' | 'nord' | 'solarized-dark' | 'solarized-light' | 'vscode-dark' | 'paper' | 'terminal-green' | 'ocean'
export type DensityLevel = 'compact' | 'normal' | 'comfortable'
export type RadiusFamily = 'sharp' | 'soft' | 'round'
export type MotionLevel = 'reduced' | 'balanced' | 'expressive'

export interface ThemePreset {
  name: string
  palette: PaletteName
  density: DensityLevel
  radiusFamily: RadiusFamily
  motionLevel: MotionLevel
}
```

### 2.10 通知 (spec/07, 08)

```typescript
// shared/types/notification.ts
export interface AppNotification {
  id: string
  title: string
  body: string
  level: 'info' | 'success' | 'warning' | 'error'
  source: 'ai-task' | 'scanner' | 'system' | 'user'
  timestamp: number
  metadata: {
    aiTask?: {
      aliasId: string
      taskAlias: string          // R7 NEW — 关键
      toolId: ToolId
      durationMs: number
      endState: AIMonitorState
    }
    processId?: number
    windowHwnd?: number
  }
  actions?: Array<{ id: string; label: string; payload?: unknown }>
}
```

### 2.11 IPC 信封 (spec/05)

```typescript
// shared/types/ipc.ts
export interface IPCEnvelope<T> {
  seq: number
  ts: number
  channel: string
  batch?: boolean
  batchSeq?: { first: number; last: number }
  truncated?: { reason: 'size' | 'rate' | 'count'; originalCount: number }
  payload: T
}
```

---

## 三、Zod Schema

每个 interface 配 Zod schema。示例：

```typescript
// shared/schemas/process.ts
import { z } from 'zod'

export const AccessReportSchema = z.object({
  pid: z.number().int().positive(),
  elevationRequired: z.boolean(),
  scanAttempted: z.boolean(),
  scanResult: z.enum(['ok', 'access-denied', 'not-found', 'timeout', 'wmi-error']),
  currentUser: z.string(),
  targetProcessUser: z.string().optional(),
  suggestion: z.enum(['relaunch-as-admin', 'retry', 'none']),
  triedAt: z.number().int().positive(),
})

export const PartialDeepDetailSchema = z.object({
  pid: z.number().int().positive(),
  name: z.string().min(1),
  // ...
  accessReport: AccessReportSchema,
})
```

IPC handler 用：

```typescript
ipcMain.handle('process:get-deep-detail', async (_, input) => {
  const result = await ProcessService.getDeepDetail(input)
  return PartialDeepDetailSchema.parse(result)  // 严格验证
})
```

---

## 四、持久化结构版本

| Store | 当前版本 | R7 版本 | 迁移 |
|-------|---------|---------|------|
| ai-alias | v1 | v2 | v1 无 `applyToExternalWindow`，补默认 false |
| window-group | v1 | v2 | v1 用 hwnd，v2 用 fingerprint（重新计算） |
| theme | v1 | v2 | v1 只有 palette，v2 补 density/radius/motion 默认值 |
| ai-task-history | - | v1 | 新 store |
| layout-snapshots | - | v1 | 新 store |

迁移脚本位于 `devhub/src/main/services/store/migrations/*.ts`。

---

## 五、检查表（开发时自查）

- [ ] 新增类型在 `shared/types/` 下
- [ ] 配套 Zod schema 在 `shared/schemas/`
- [ ] IPC handler 在返回前 parse
- [ ] electron-store 的 schema 升级配迁移函数
- [ ] 类型变更同步更新 contracts/23 的 IPC 契约

---

## 六、2026-04-29 实现快照：X1 CODE-DONE

- `devhub/src/shared/schemas/contract-models.ts` 已作为 R7 数据模型 schema registry 落地，覆盖本文件列出的 Scanner、Process、Port、Window、AI Alias、AI Task、Topology、Theme、Notification、IPCEnvelope 等模型。
- `contractSchemaRegistry` 提供稳定的 `ContractSchemaName -> Zod schema` 映射，便于 CI 或后续 migration 脚本断言类型清单覆盖率。
- `contract-models.test.ts` 将当前 41 个 runtime schema 模型名作为固定清单逐项断言存在 schema，并覆盖权限详情、主题 v2 默认版本、窗口布局 fingerprint 持久化等关键行为。
- 2026-04-30 X1 复验补齐：`IScanner` 已加入 runtime lifecycle schema，验证 scanner id 与 `start` / `stop` / `getSnapshot` / `subscribe` / `getMetrics` 生命周期方法；固定清单新增 registry 双向一致断言，防止 schema registry 与合同测试清单漂移。
- 2026-04-29 P4.2-b 补充：`DetectionSignalName`、`SignalResult`、`SignalContribution`、`CalibrationSample` 已加入 schema registry，覆盖 AI 感测信号解释、置信度贡献和校准样本的 runtime parse 边界；`CalibrationResult` 已进入 shared types，并通过 `ai-task:calibrate` IPC 返回。
- 本轮验证：`pnpm typecheck`、`pnpm exec vitest run src/shared/schemas/contract-models.test.ts ...`、`pnpm exec vitest run src/main/services/detection/DetectionEngine.test.ts src/main/services/AITaskTracker.test.ts src/preload/preloadContract.test.ts`、`pnpm lint` 通过。
- 边界：旧 IPC handler 尚未全部改为 registry parse；当前完成的是模型级 runtime schema 覆盖与可测 registry，不把全量 IPC 接入包装成已完成。
