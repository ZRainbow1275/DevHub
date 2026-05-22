# RCA-03 — 架构技术债账本

> 类型：技术债登记表
> 对象：DevHub v2 主干源码（`D:/Desktop/CREATOR ONE/devhub/src/`）
> 目的：把研究 Agent 报告里发现的所有架构性问题登记成一本可逐条注销的账本
> 更新：每次 R7 实现阶段修一条，在"偿还状态"列打 [PAID]

---

## 一、账本总览

| 债务 ID | 类型 | 严重度 | 账期 | R7 偿还 |
|--------|------|-------|------|--------|
| D01 | 扫描器双实例 | CRITICAL | R4 起 | `spec/03` |
| D02 | PowerShell 超时不 kill 子进程 | CRITICAL | R3 起 | `spec/03` / `spec/05` |
| D03 | 生命周期 dispose 链缺失 | CRITICAL | R2 起 | `spec/04` |
| D04 | IPC 广播无 backpressure | HIGH | R4 起 | `spec/05` |
| D05 | AppNotification 无 metadata 字段 | HIGH | R3 起 | `contracts/22` |
| D06 | AITaskHistory 无 taskAlias 字段 | HIGH | R4 起 | `contracts/22` |
| D07 | 外部窗口 SetWindowText 通道缺失 | CRITICAL | R2 起 | `spec/07` / `contracts/23` |
| D08 | WindowGroup.hwnd 跨重启失配 | HIGH | R4 起 | `spec/09` |
| D09 | LayoutEngine 未真调 SetWindowPos | HIGH | R4 起 | `spec/10` |
| D10 | NeuralGraphEngine 容器 0 尺寸回退 | HIGH | R5 起 | `spec/17` |
| D11 | `[data-density]` 只由主题默认写入，无独立 UI | MEDIUM | R5 起 | `spec/19` |
| D12 | TOOL_INFO 用 Emoji 字符串 | MEDIUM | R2 起 | `spec/20` / `contracts/25` |
| D13 | ScriptSelector dropdown 无 Portal | MEDIUM | R1 起 | `spec/13` |
| D14 | PortFocusPanel 作 overlay 挤占主列 | MEDIUM | R3 起 | `spec/15` |
| D15 | Sidebar < 1000 只折叠自己，主内容未 reflow | MEDIUM | R3 起 | `spec/18` |
| D16 | IPC handler 缺 Zod schema 校验 | MEDIUM | R4 起 | `contracts/22` / `contracts/23` |
| D17 | ProcessNameCache 无 LRU 淘汰 | LOW | R3 起 | `spec/04` |
| D18 | previousCpuTimes 无 LRU 淘汰 | LOW | R3 起 | `spec/04` |
| D19 | `as unknown as AIWindowAlias` 不安全断言 | LOW | R5 起 | `contracts/22` |
| D20 | PortScanner CSV 解析无边界检查 | LOW | R5 起 | `contracts/22` |
| D21 | TaskHistoryHandlers 无日期格式校验 | LOW | R5 起 | `contracts/22` |
| D22 | 未启用 React `<Profiler>` / `why-did-you-render` | LOW | R4 起 | `spec/06` |
| D23 | `AuditLogger` 只记 destructive，无性能事件 | LOW | R3 起 | `spec/06` |
| D24 | 监控 Tab 无虚拟化（万级列表会 hang） | LOW | R3 起 | `spec/18` |
| D25 | 无统一的 IpcErrorCode 枚举 | LOW | R4 起 | `contracts/23` |
| D26 | 无统一的错误处理中间件（ipcMain.handle 各自 try/catch） | LOW | R3 起 | `contracts/23` |
| D27 | 无统一的重试策略（各 scanner 各自写 retry） | LOW | R4 起 | `spec/04` |
| D28 | 不同 theme 的 `DecorationSet` 实现重复 | LOW | R5 起 | `spec/19` |
| D29 | Zustand store 无 `devtools` middleware（线上排障困难） | LOW | R3 起 | `spec/06` |
| D30 | 缺少 `electron-log` 集中日志（console 满天飞） | LOW | R2 起 | `spec/06` |

---

## 二、Top 10 债务的详细描述

### D01 扫描器双实例

**位置**：
- `devhub/src/main/services/BackgroundScannerManager.ts:36-47`（第一份实例）
- `devhub/src/main/ipc/processHandlers.ts:20`（第二份实例）

**症状**：
- 同一个 `SystemProcessScanner` 和 `PortScanner` 被 `new` 两次
- 两份独立持有 setInterval、独立调用 PowerShell、独立维护缓存
- 渲染端订阅 `scanner:subscribe` 拿到的是 BackgroundScannerManager 的数据
- 但渲染端调 `process:scan` 直接走 processHandlers.ts 里的另一份
- 实际运行时每 5s 发生 2x netstat、2x `Get-CimInstance Win32_Process`

**偿还方案（详见 `spec/03`）**：
引入 `ScannerRegistry`（单例工厂），`processHandlers.ts` 从注册表获取实例而不是 new

```typescript
// R7 目标形态
class ScannerRegistry {
  private static instance: ScannerRegistry
  private scanners = new Map<ScannerKind, IScanner>()

  static getInstance(): ScannerRegistry { ... }
  register<K extends ScannerKind>(kind: K, scanner: IScannerFor<K>): void { ... }
  get<K extends ScannerKind>(kind: K): IScannerFor<K> { ... }
}

// processHandlers.ts 改写
const processScanner = ScannerRegistry.getInstance().get('process')
const portScanner = ScannerRegistry.getInstance().get('port')
```

### D02 PowerShell 超时不 kill

**位置**：
- `devhub/src/main/services/SystemProcessScanner.ts:54-59, 1248-1253`
- `PortScanner.ts:19, 156-160`
- `AITaskTracker.ts:187-227`
- 以及所有 `execFileAsync('powershell'...)` 调用点

**症状**：
- `withTimeout(psPromise, 3000, null)` 的 3s 超时只是让调用方拿到 fallback 值
- 真实的 PowerShell 子进程 **继续跑** 直到 OS 超时（默认 30s 或更长）
- 每次超时积累一个僵尸子进程

**偿还方案（详见 `spec/05`）**：
新增 `PowerShellGateway` 单例：
- 全局并发信号量上限 2（超过则排队）
- 每次调用必须传 AbortController
- 超时时调 `child.kill('SIGKILL')` + `tree-kill(child.pid)`
- 进程池化：避免为每次短查询 spawn 新 powershell（保留 1 个长连接 powershell 实例，通过 stdin 发命令）

### D03 生命周期 dispose 链缺失

**位置**：
- `devhub/src/main/index.ts:321-339`（`app.on('before-quit')`）
- `cleanupProcessHandlers()` 只 unregister IPC handler，不 dispose scanner

**症状**：
- 应用退出时，`scannerManager.stopAll()` 清理了 BackgroundScannerManager 实例的 setInterval
- 但 `processHandlers.ts:20` 创建的**另一份** scanner 从未被 dispose
- 导致其 setInterval 继续跑到 Electron 进程被 OS 强杀

**偿还方案（详见 `spec/04`）**：
定义统一的 `IDisposable` 接口：
```typescript
interface IDisposable {
  readonly disposed: boolean
  dispose(): Promise<void>
}
```
所有 scanner / IPC handler / store 实现此接口；`app.on('will-quit')` 注册的清理函数遍历 `DisposalRegistry.all()` 调用 dispose。

### D04 IPC 广播无 backpressure

**位置**：
- `devhub/src/main/services/ScannerCache.ts:173-176`（`emit('processes:updated', diff)`）
- `devhub/src/main/ipc/scannerHandlers.ts` 的订阅分发

**症状**：
- 每次扫描到差异就发送一次 diff
- 渲染端 Zustand store 收到后走 `applyDiffToArray()` 重算
- 100 个进程全变时，主进程一次性推 100 条 diff
- 渲染端卡顿

**偿还方案（详见 `spec/05`）**：
- 主进程侧批处理：500ms 内的 diff 合并为 1 条发送
- `diff` 带 `seq` 字段，丢帧时可以从 `scanner:snapshot` 拉最新全量
- 渲染端使用 `requestAnimationFrame` 节流

### D05/D06 数据模型缺字段

**位置**：
- `devhub/src/shared/types-extended.ts:402-410`（AppNotification / AITaskHistory 定义）

**症状**：
- `NotificationService.notifyTaskComplete()` 把 `metadata` 计算出来但 `AppNotification` 没这字段，metadata 被丢
- `AITaskHistory` 无 `taskAlias` 字段，历史面板读不到别名

**偿还方案（详见 `contracts/22`）**：
```typescript
// R7 目标形态
interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  icon?: string
  actions?: NotificationAction[]
  createdAt: number
  read: boolean
  metadata?: AppNotificationMetadata  // R7 新增
}

interface AppNotificationMetadata {
  taskId?: string
  windowHwnd?: number
  aliasOrToolName?: string
  projectId?: string
}

interface AITaskHistory {
  // ... 既有字段
  taskAlias?: string  // R7 新增
  windowHwnd?: number  // R7 新增
}
```

### D07 外部窗口 SetWindowText 通道缺失

**位置**：
- `devhub/src/main/services/WindowManager.ts`（缺少 `setTitle()` 方法）
- `devhub/src/main/ipc/windowHandlers.ts`（缺少 `window:set-title` channel）

**症状**：
- 用户在 UI 点 "重命名" → 只改 `AIAliasManager` 的 electron-store
- 任务栏 / Alt-Tab 看到的仍是原 title
- 用户感知 "根本没改"

**偿还方案（详见 `spec/07`）**：
新增 IPC channel `window:set-title`，主进程通过 PowerShell 或 `ffi-napi` 调 `user32.dll!SetWindowTextW`

### D08 WindowGroup.hwnd 跨重启失配

**位置**：
- `devhub/src/main/services/WindowManager.ts:113-131`（`loadFromDisk()`）

**症状**：
- 保存 group 时记录当前 hwnd
- OS 重启后 hwnd 全变
- 恢复 group 时拿老 hwnd 去 focus，全部失败

**偿还方案（详见 `spec/09`）**：
不持久化 hwnd，改持久化 `{ processName, titleHash, className, workingDir }`，重启后跑匹配算法映射到当前 hwnd

### D09 LayoutEngine 未真调 SetWindowPos

**位置**：
- `devhub/src/renderer/components/monitor/LayoutPreview.tsx`
- `devhub/src/main/services/WindowManager.ts:stackWindows()`

**症状**：
- `LayoutPreview` 在 JS 层画出 2×2 预览
- 点"应用"走 `stackWindows()` 但后端只打 `console.log`
- 真实窗口位置不变

**偿还方案（详见 `spec/10`）**：
改写 `LayoutEngine` 服务，基于 PowerShell 或 `node-ffi-napi` 调 `user32.dll!SetWindowPos`；先计算目标 rect 再批量下发；失败有回滚

### D10 NeuralGraphEngine 容器 0 尺寸回退

**位置**：
- `devhub/src/renderer/components/monitor/topology/NeuralGraphEngine.ts:233-259`（init）
- `NeuralGraphEngine.ts:354-434`（setData）

**症状**：
- `init()` 读 `container.getBoundingClientRect()` 为 0 时回退到 800×600
- `forceCenter(400, 300)` 写死
- 实际容器可能只有 300×200 → 节点聚集左上角
- `setData` 被调时更新 viewBox 但不重启 simulation

**偿还方案（详见 `spec/17`）**：
- 用 `ResizeObserver` 监听容器尺寸
- 尺寸变化时 `forceCenter.x(w/2).y(h/2); simulation.alpha(1).restart()`
- 初次挂载用 `requestAnimationFrame` 等一帧再读取尺寸

---

## 三、债务偿还顺序（给 R7 实现 Agent）

R7 建议的偿还顺序（不严格等于 spec 批次顺序，因部分债务横跨多份 spec）：

```
批次 1：D01 → D02 → D03 → D04  （扫描器 + PS + lifecycle + IPC）
批次 2：D05 → D06 → D07 → D16  （数据模型 + SetWindowText 通道）
批次 3：D08 → D09 → D27  （窗口分组 + 布局引擎 + 重试策略）
批次 4：D10 → D13 → D14 → D15 → D24  （渲染 / 响应式）
批次 5：D11 → D12 → D28  （主题 / 图标）
批次 6：D17 → D18 → D19 → D20 → D21 → D22 → D23 → D25 → D26 → D29 → D30  （小额债务清单扫描）
```

---

## 四、债务偿还后的"回归断言"

每条债务声明 `PAID` 前，必须有对应的断言：

| 债务 | 断言 |
|------|------|
| D01 | `grep -rn "new SystemProcessScanner\|new PortScanner" src/main` 结果仅出现在 `ScannerRegistry.ts` |
| D02 | 长跑 60 分钟后 `tasklist | findstr powershell` 的行数 ≤ 2 |
| D03 | 应用退出 5s 后，`DisposalRegistry.remaining.size === 0`（内部埋点） |
| D04 | 1 分钟 IPC 广播总数 ≤ 120（每 500ms 1 条） |
| D05 | `notification.metadata.aliasOrToolName` 在 Playwright E2E 中 assert 存在 |
| D06 | `history[0].taskAlias` 读取无 undefined |
| D07 | Playwright 断言任务栏 accessibility API 能读到新 title |
| D08 | 重启后 group 内 hwnd 被重新映射（日志打印 matched count） |
| D09 | Playwright 驱动 + Win32 截图对比，位置误差 ≤ 5px |
| D10 | 容器从 300×200 resize 到 800×600 后 500ms 内节点重分布（E2E 截图对比） |

---

## 五、账本维护规则

1. R7 实现 Agent 每修完一条债务，必须在本文件对应行改 "R7 偿还" 列为 `[PAID @ <commit-sha>]`
2. 新发现的债务在本文件末尾追加 `D31` `D32`，不允许改已有编号
3. 每次 release 后，本账本作为 changelog 的一部分随版本一起归档
4. 债务状态与 `00-acceptance-matrix.md` 的 Status 列互为参考
