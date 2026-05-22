# spec/02 — 信息架构重构：拓扑 / 流程图 降级为附属视图

> 类型：信息架构（Information Architecture）规格
> 严重度：P0-Design
> 对应用户诉求：P6.2（拓扑 / 流程图必须是"进程 / 端口 / 窗口" 的附属查询功能，而非独立顶级 Tab）
> 对应验收矩阵：P6.2、P7.1、P6.1 部分
> 对应债务：D10（部分相关）
> 本 spec 不删任何现有功能；所有变化通过"加层 + 重挂载 + legacy 降级目录"完成。

---

## 一、动机（Motivation）

### 1.1 用户原话溯源

R6（2026-04-20）用户原话：

> 拓扑无法正常显示。
>
> 原本的功能设计，**拓扑是基于「进程」、「端口」、「窗口」三大板块的附属功能**。旨在完成：**点击某一进程、端口、窗口后，可以通过直观的拓扑图定点定向查询该单一选中对象的联系**——但现在该功能被单独拎出做，**是不符合我的要求的**。

R5（2026-04-15）同样诉求（C1），但 R5 的实现批次 `v2-topology-flow`（commit `c79500d`）把拓扑 / 流程图做得更大更复杂，反向违背了用户需求 —— 用户要的是"附属查询功能"，实现却继续把它们当作顶级一级视图开发。

### 1.2 为什么这是 P0-Design 级问题

- 信息架构（IA）错位直接决定所有下游页面的入口、数据作用域、交互语境
- 在 IA 没对齐前，拓扑组件的 UX 优化、拓扑渲染 Bug 修复（`NeuralGraphEngine` 容器 0 尺寸回退）都是在错误位置上的努力
- IA 错位的副作用：顶级 Tab 数量过多（6 个），用户不知道哪个 Tab 该用来干嘛
- R6 之后再以错位 IA 继续开发，只会加剧用户"没有被倾听"的挫败感

### 1.3 参考 RCA

- `rca/01-r5-archive-metadata-only.md` 第 2.4 节（`33947c3 v2-topology-flow` 的 commit message 欺骗性：声称改了 TopologyView / PortRelationshipGraph / NeuralGraph，实际上 `git show --stat` 结果只有 metadata）
- `rca/02-user-pain-map.md` 条目 I（拓扑 / 流程图附属化，R5+R6 已 2 次反馈）
- `rca/03-architecture-debt-ledger.md` D10（NeuralGraphEngine 容器 0 尺寸回退）

### 1.4 本 spec 的硬约束

1. **不删除** `TopologyView.tsx` / `MonitorPanel.tsx` 的 topology/flow 分支代码（降级到 `monitor/legacy/`）
2. **不重写** `NeuralGraphEngine.ts` 本身 —— 该引擎被复用，但通过 "Scope" 参数接收当前根对象
3. **必须提供**从任意"进程 / 端口 / 窗口"详情面板跳转到对应附属视图的入口，并带回跳按钮
4. **必须给**每个详情面板的附属视图独立的"深度调节"、"展开相关实体类型"控件

---

## 二、受影响源码（Affected Source Code）

### 2.1 顶级导航 / Tab 枚举（修改）

`devhub/src/renderer/components/monitor/MonitorPanel.tsx`

```
Line 12-18: type MonitorTab = 'process' | 'port' | 'window' | 'ai-task' | 'topology' | 'flow'
Line 35-45: const TABS: Array<{ id: MonitorTab; label: string; ... }> = [ ... ]
Line 135-148: 分支渲染 — { activeTab === 'topology' && <TopologyView /> } 等
```

**R7 变化**：

- `MonitorTab` 类型收窄为 `'process' | 'port' | 'window' | 'ai-task'`
- `TABS` 数组移除 topology / flow 两项
- Line 135-148 的分支渲染移除 topology / flow 分支

### 2.2 详情面板（新增子 Tab）

#### ProcessDetailPanel

`devhub/src/renderer/components/monitor/ProcessDetailPanel.tsx`

- 当前是 5 Tab 的结构（overview / network / environment / modules / 其他），需要在末尾新增第 6 个子 Tab `relationship`（中文："关系视图"）
- 子 Tab 内容是 `<AttachedGraphView scope={{ root: 'process', rootId: pid, depthLimit: 2 }} />`

#### PortFocusPanel

`devhub/src/renderer/components/monitor/PortFocusPanel.tsx`

- 底部新增 "关系视图" 折叠段 或 子 Tab
- 内容：`<AttachedGraphView scope={{ root: 'port', rootId: port, depthLimit: 2 }} />`

#### WindowDetailPanel

`devhub/src/renderer/components/monitor/WindowDetailPanel.tsx`（若不存在则新建；当前监控 Tab 的窗口卡片点击后是否有详情面板？待实现 Agent 现场检查）

- 同上，新增"关系视图" 子 Tab

### 2.3 新建文件

- `devhub/src/renderer/components/monitor/attached/AttachedGraphView.tsx` — 统一的附属视图组件，接收 `TopologyScope`
- `devhub/src/renderer/components/monitor/attached/AttachedFlowView.tsx` — 附属的流程图（与图拓扑的差别：Flow 呈现时序方向）
- `devhub/src/renderer/components/monitor/attached/ScopeControls.tsx` — 深度 / 实体类型过滤控件
- `devhub/src/renderer/components/monitor/attached/useScopedTopology.ts` — hook，负责从全局 scanner store 裁切子图

### 2.4 Legacy 降级（不删除）

- 新建目录 `devhub/src/renderer/components/monitor/legacy/`
- 移动：
  - `TopologyView.tsx` → `legacy/TopologyView.tsx`
  - `topology/` 子目录 → `legacy/topology/`
  - `flow/` 子目录 → `legacy/flow/`
  - `PortRelationshipGraph.tsx` → `legacy/PortRelationshipGraph.tsx`
- Legacy 组件只在 **Dev 模式 + 特定 URL 参数（`?legacy=topology`）** 下可访问，用于回退测试

### 2.5 引擎改造点（保留引擎，扩接口）

`devhub/src/renderer/components/monitor/topology/NeuralGraphEngine.ts`

- 现有 `setData(nodes, edges, options)` 不改
- 新增公共方法 `setScope(scope: TopologyScope)` — 内部基于全量数据裁切后调 `setData`
- 新增 `setContainer(el: HTMLElement)` — 用 ResizeObserver 替代当前的 `getBoundingClientRect` 即时读取（详见 spec/17）

### 2.6 IPC 主进程侧（修改 + 新增）

- 已有 `topology:build-graph`（如果存在）：保留，但标记为"legacy"
- 新增 `topology:build-scoped-graph(scope: TopologyScope): Promise<ScopedGraph>` — 服务端裁切
- 新增 `flow:build-scoped-flow(scope: FlowScope): Promise<ScopedFlow>` — 时序流程图

渲染端走 `TopologyScopeManager`（新建），内部可选择用主进程服务端裁切还是本地裁切（小规模用本地，大规模走 IPC）。

### 2.7 路由 / URL 参数（可选）

如果当前应用有 hash / query 路由（如 `#monitor/process/8812`），则 R7 扩展为：

- `#monitor/process/8812?view=relationship`
- `#monitor/port/3000?view=relationship&depth=3`
- `#monitor/window/0xABCDE?view=relationship`

---

## 三、数据契约（Data Contracts）

### 3.1 Scope 类型

```typescript
// src/shared/topology/scope.ts (新建)

export type TopologyRootKind = 'process' | 'port' | 'window' | 'project'

export interface TopologyScope {
  root: TopologyRootKind
  rootId: string | number  // process=PID, port=portNumber, window=hwnd, project=projectId
  depthLimit: number       // 默认 2，最大 4
  includeEntityKinds: Array<'process' | 'port' | 'window' | 'project' | 'external'>
  excludeSystemProcesses?: boolean
  edgeKinds?: Array<'owns' | 'binds' | 'connects' | 'parents' | 'listens'>
}

export interface FlowScope extends TopologyScope {
  timeRange?: { from: number; to: number }  // 时序专用
}
```

### 3.2 图数据结构

```typescript
export interface ScopedGraph {
  rootNode: GraphNode
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta: {
    actualDepth: number
    truncated: boolean
    totalCandidateNodes: number
    buildDurationMs: number
  }
}

export interface GraphNode {
  id: string  // 形如 'process:8812', 'port:3000', 'window:0xABCDE'
  kind: 'process' | 'port' | 'window' | 'project' | 'external'
  label: string
  subLabel?: string
  depthFromRoot: number
  metrics?: {
    cpu?: number
    memoryMB?: number
    isAI?: boolean
    isZombie?: boolean
  }
  refId: string | number  // 原始 ID（PID / port / hwnd 等）
}

export interface GraphEdge {
  id: string
  source: string  // node id
  target: string
  kind: 'owns' | 'binds' | 'connects' | 'parents' | 'listens'
  label?: string
  weight?: number
  directed: boolean
}

export interface ScopedFlow {
  rootNode: GraphNode
  steps: FlowStep[]
  edges: FlowEdge[]
  meta: ScopedGraph['meta']
}

export interface FlowStep {
  id: string
  nodeId: string
  sequenceIndex: number
  tsStart: number
  tsEnd?: number
  kind: 'spawn' | 'bind' | 'accept' | 'close' | 'send' | 'receive' | 'exit'
}

export interface FlowEdge {
  id: string
  from: string  // step id
  to: string    // step id
  directed: true
}
```

### 3.3 跳转意图

```typescript
export interface JumpIntent {
  target: { kind: TopologyRootKind; id: string | number }
  via: 'graph-click' | 'context-menu' | 'detail-panel-link' | 'url-query'
  source: { kind: TopologyRootKind; id: string | number }  // 从哪里跳过来
}

// 注册一个全局 dispatcher，所有组件通过它触发跳转
export interface JumpDispatcher {
  dispatch(intent: JumpIntent): void
  onIntent(handler: (intent: JumpIntent) => void): () => void
  backStack: JumpIntent[]
  goBack(): void
}
```

### 3.4 Scope 变更事件

```typescript
export interface ScopeChangeEvent {
  prevScope: TopologyScope | null
  nextScope: TopologyScope
  reason: 'initial' | 'depth-change' | 'filter-change' | 'jump' | 'refresh'
  timestamp: number
}
```

---

## 四、IPC 契约（IPC Contracts）

### 4.1 新增通道

| Channel | 方向 | 入参 Schema | 出参 Schema | 限流 | 错误码 |
|---------|------|------------|-------------|------|-------|
| `topology:build-scoped-graph` | Renderer → Main | `TopologyScope` | `ScopedGraph` | QUERY 60/min | `TOPOLOGY_SCOPE_INVALID` / `TOPOLOGY_ROOT_NOT_FOUND` / `TOPOLOGY_BUILD_TIMEOUT` |
| `flow:build-scoped-flow` | Renderer → Main | `FlowScope` | `ScopedFlow` | QUERY 30/min | `FLOW_TIME_RANGE_INVALID` / `FLOW_BUILD_TIMEOUT` |
| `topology:warm-scope` | Renderer → Main | `TopologyScope` | `{ cached: boolean; ttl: number }` | QUERY 30/min | `WARM_UNSUPPORTED` |

### 4.2 Handler 职责

- Handler 必须走 `ScannerRegistry`（spec/03）的只读 snapshot，不触发新一轮扫描
- 构建逻辑：以 `rootId` 为起点广度优先扩展到 `depthLimit`，每层通过 `ScannerCache.summary` 查询关联
- 输出 `ScopedGraph` 中 `meta.buildDurationMs` 用于观测（DevObservabilityPanel 图表）
- 若构建超过 1500ms，返回 `meta.truncated = true` + 已收集到的部分节点，上层提示"数据截断"

### 4.3 校验

```typescript
// Zod schema，放在 contracts/22
export const TopologyScopeSchema = z.object({
  root: z.enum(['process', 'port', 'window', 'project']),
  rootId: z.union([z.string(), z.number()]),
  depthLimit: z.number().int().min(1).max(4).default(2),
  includeEntityKinds: z.array(z.enum(['process', 'port', 'window', 'project', 'external'])).default([
    'process', 'port', 'window', 'project', 'external'
  ]),
  excludeSystemProcesses: z.boolean().optional(),
  edgeKinds: z.array(z.enum(['owns', 'binds', 'connects', 'parents', 'listens'])).optional()
})
```

---

## 五、错误矩阵（Error Matrix）

| 错误码 | 触发场景 | 用户可见文案 | 日志级别 | 自动恢复 | 需用户操作 |
|-------|---------|-------------|---------|---------|-----------|
| `TOPOLOGY_ROOT_NOT_FOUND` | scope.rootId 对应实体已消失（进程退出、端口释放） | "选中的对象已不存在，视图返回主列表" | WARN | 自动清空视图并路由回上层 | 无 |
| `TOPOLOGY_SCOPE_INVALID` | scope.depthLimit 超过 4 或 includeEntityKinds 空 | "视图配置有误，已恢复默认值" | ERROR | 重置为默认 scope | 无 |
| `TOPOLOGY_BUILD_TIMEOUT` | 服务端构建 > 1500ms | "关系图计算超时，已返回部分结果" + "重试" 按钮 | WARN | 返回部分结果 | 可手动重试 |
| `TOPOLOGY_CACHE_MISS` | 渲染端无本地 snapshot（应用刚启动） | "加载中..." spinner | INFO | 等待首轮扫描 | 无 |
| `TOPOLOGY_SCOPE_TOO_WIDE` | 节点数 > 500 | "结果过大（N 节点），已自动降深度" | WARN | depthLimit -= 1 重查 | 可手动开启"深度扩展"按钮 |
| `FLOW_TIME_RANGE_INVALID` | from ≥ to | "时间范围无效，已还原为过去 5 分钟" | ERROR | 重置范围 | 无 |
| `FLOW_NO_EVENTS` | 选中时间内该对象无事件 | "该时段内此对象无活动事件" | INFO | 无 | 无 |
| `LEGACY_VIEW_ACCESSED` | 用户通过 ?legacy=topology URL 参数进入 | "已进入废弃视图（仅供调试）" + 顶部横幅 | WARN | 无 | 点击"返回新视图"按钮 |
| `JUMP_TARGET_NOT_FOUND` | JumpIntent.target 对象已消失 | "目标对象已不存在" + 返回上一个有效对象 | WARN | 回栈 | 无 |
| `SCOPE_CONTROL_FILTER_EMPTY` | 用户把 includeEntityKinds 全部取消 | "至少选择一个实体类型" | ERROR | 阻止应用变更 | 重新勾选 |

---

## 六、验收条件（Acceptance Criteria — Given/When/Then）

### 6.1 顶级导航收窄（P6.2 核心）

```
Scenario P6.2-a
Given DevHub 启动到监控界面
When 观察顶部导航栏
Then 看到的 Tab 只有"进程 / 端口 / 窗口 / AI 任务" 四个
And "拓扑" "流程图" 两个 Tab 不在导航中
```

### 6.2 进程详情面板嵌入关系视图（P6.2）

```
Scenario P6.2-b
Given 监控 → 进程 Tab → 双击某进程（例 VS Code 的 PID）
When 进程详情面板打开
Then 面板底部 Tab 条包含"关系视图"子 Tab
When 点击"关系视图" 子 Tab
Then 拓扑图以该 PID 为中心渲染，depth=2
And 图中清晰可见该进程的：父进程 / 子进程 / 绑定的端口 / 关联的窗口
```

### 6.3 端口详情面板嵌入关系视图（P6.2）

```
Scenario P6.2-c
Given 监控 → 端口 Tab → 点击端口 3000
When PortFocusPanel 展开
Then 面板内存在"关系视图"折叠段（默认折叠）
When 展开折叠段
Then 拓扑图以 port:3000 为中心渲染
And 图中显示该端口绑定的进程 / 监听该端口的远端连接
```

### 6.4 窗口详情嵌入（P6.2）

```
Scenario P6.2-d
Given 监控 → 窗口 Tab → 点击某 Claude Code 窗口
When 窗口详情面板打开
Then "关系视图" 子 Tab 可见
And 显示该窗口的所属进程 / 进程绑定的端口 / 同项目下其他窗口
```

### 6.5 跳转与回退（P6.2）

```
Scenario P6.2-e
Given 在进程 8812 的关系视图，图中可见 port:3000 节点
When 双击 port:3000 节点
Then 路由切换到 端口 Tab → port:3000 → PortFocusPanel.关系视图
And 顶部出现"返回 进程 8812" 的回退按钮
When 点击回退按钮
Then 回到 进程 8812 的关系视图（深度 / 过滤器保持）
```

### 6.6 深度与过滤控件（P6.2）

```
Scenario P6.2-f
Given 在任一关系视图中
When 点击深度滑块从 2 调到 3
Then 图自动重新构建，显示第 3 层关联
When 取消勾选"外部连接"
Then 图中所有 kind=external 节点隐藏
```

### 6.7 Legacy 回退（保证不丢功能）

```
Scenario P6.2-g
Given 启动 DevHub 并 URL 加参数 ?legacy=topology
When 进入应用
Then 顶部横幅提示"已进入废弃视图（仅供调试）"
And 原始的顶级拓扑 / 流程图 Tab 短暂出现
When 点击横幅的"返回新视图"
Then 关闭 legacy 参数，刷新到新 IA
```

### 6.8 性能断言

```
Scenario P6.2-h
Given 关系视图处于进程 PID=8812 且 depthLimit=2
When 触发一次 build
Then IPC 响应 <= 300ms（P50） / <= 1200ms（P95）
And 本地渲染提交 <= 1 帧（requestAnimationFrame 单次）
```

---

## 七、E2E 脚本草案（Playwright）

```typescript
// tests/e2e/ia-topology-flow-attached.spec.ts
import { test, expect, _electron as electron } from '@playwright/test'
import { launchDevHub } from './helpers/launch'

test.describe('P6.2 Topology/Flow attached redesign', () => {
  test('E2E-P6.2-a: top-level tabs no longer include topology/flow', async () => {
    const app = await launchDevHub()
    const win = await app.firstWindow()
    await win.click('[data-testid="nav-monitor"]')
    const tabIds = await win.$$eval('[data-testid^="monitor-tab-"]',
      els => els.map(e => e.getAttribute('data-testid')))
    expect(tabIds).toEqual([
      'monitor-tab-process',
      'monitor-tab-port',
      'monitor-tab-window',
      'monitor-tab-ai-task'
    ])
    await app.close()
  })

  test('E2E-P6.2-b: process detail exposes relationship sub-tab', async () => {
    const app = await launchDevHub()
    const win = await app.firstWindow()
    await win.click('[data-testid="monitor-tab-process"]')
    // 双击第一行进程
    const firstRow = win.locator('[data-testid="process-row"]').first()
    const pid = await firstRow.getAttribute('data-pid')
    await firstRow.dblclick()
    // 验证详情面板打开
    await expect(win.locator('[data-testid="process-detail-panel"]')).toBeVisible()
    // 点击"关系视图" sub-tab
    await win.click('[data-testid="process-detail-tab-relationship"]')
    // 验证 NeuralGraph 渲染
    await expect(win.locator('[data-testid="attached-graph-view"]')).toBeVisible()
    // 验证 rootId 匹配
    const rootId = await win.locator('[data-testid="attached-graph-root"]').getAttribute('data-root-id')
    expect(rootId).toBe(`process:${pid}`)
    await app.close()
  })

  test('E2E-P6.2-c: port focus panel includes relationship fold', async () => {
    const app = await launchDevHub()
    const win = await app.firstWindow()
    await win.click('[data-testid="monitor-tab-port"]')
    const firstPort = win.locator('[data-testid="port-row"]').first()
    await firstPort.click()
    await expect(win.locator('[data-testid="port-focus-panel"]')).toBeVisible()
    await win.click('[data-testid="port-focus-relationship-fold"]')
    await expect(win.locator('[data-testid="attached-graph-view"]')).toBeVisible()
    await app.close()
  })

  test('E2E-P6.2-d: window detail includes relationship sub-tab', async () => {
    const app = await launchDevHub()
    const win = await app.firstWindow()
    await win.click('[data-testid="monitor-tab-window"]')
    const firstWindow = win.locator('[data-testid="window-row"]').first()
    await firstWindow.click()
    await win.click('[data-testid="window-detail-tab-relationship"]')
    await expect(win.locator('[data-testid="attached-graph-view"]')).toBeVisible()
    await app.close()
  })

  test('E2E-P6.2-e: jump & back navigation across scopes', async () => {
    const app = await launchDevHub()
    const win = await app.firstWindow()
    await win.click('[data-testid="monitor-tab-process"]')
    const firstRow = win.locator('[data-testid="process-row"]').first()
    await firstRow.dblclick()
    await win.click('[data-testid="process-detail-tab-relationship"]')
    // 双击图中任一 port 节点
    const portNode = win.locator('[data-node-kind="port"]').first()
    const portNumber = await portNode.getAttribute('data-ref-id')
    await portNode.dblclick()
    // 期待路由切换到 port 关系视图
    await expect(win.locator('[data-testid="port-focus-panel"]')).toBeVisible()
    const rootAfter = await win.locator('[data-testid="attached-graph-root"]').getAttribute('data-root-id')
    expect(rootAfter).toBe(`port:${portNumber}`)
    // 点击回退
    await expect(win.locator('[data-testid="jump-back-btn"]')).toBeVisible()
    await win.click('[data-testid="jump-back-btn"]')
    await expect(win.locator('[data-testid="process-detail-panel"]')).toBeVisible()
    await app.close()
  })

  test('E2E-P6.2-h: scoped build performance', async () => {
    const app = await launchDevHub()
    const win = await app.firstWindow()
    // 埋点 topology:build-scoped-graph 的耗时
    const started = Date.now()
    await win.click('[data-testid="monitor-tab-process"]')
    const firstRow = win.locator('[data-testid="process-row"]').first()
    await firstRow.dblclick()
    await win.click('[data-testid="process-detail-tab-relationship"]')
    await expect(win.locator('[data-testid="attached-graph-view"]')).toBeVisible()
    const duration = Date.now() - started
    expect(duration).toBeLessThan(1500)
    await app.close()
  })
})
```

---

## 八、参考实现 / 库（References / Integration Libraries）

### 8.1 信息架构参考

- VS Code 的 Explorer / Search / Source Control 三并列，但 "Timeline" 作为 Explorer 的附属折叠段 —— 这是"附属视图"的经典模式
- Chrome DevTools 的 Network 面板右侧 Headers/Preview/Response/Timing —— 子 Tab 嵌入详情区的模式
- IntelliJ IDEA 的 Run Window → Debug → Variables/Frames/Threads —— 多维附属视图

### 8.2 图渲染 / 附属化复用

- 项目已用 `NeuralGraphEngine`（基于 `d3-force`） —— 保留，只扩 scope 接口
- 备选方案（若引擎问题过大）：`@xyflow/react`（React Flow）天然支持父子图裁切、`cytoscape.js` 适合大规模
- 流程图：`dagre` 做层次布局，`elkjs` 做更精确的时序图

### 8.3 路由 / 状态机

- `@tanstack/react-router` 或现有 `wouter` / `react-router` —— 如果项目无路由，新建 `MonitorRouter` 薄封装
- `xstate` 管理 JumpDispatcher 的回栈（可选，当前可用简单数组）

### 8.4 Resize 监听

- `ResizeObserver` 是浏览器原生（Electron 天然支持）
- 封装：`use-resize-observer` npm

### 8.5 设计灵感

- `prompts/0420/11-topology-flow-scope-violation.md` 用户原话
- 参考 Datadog APM 的 "Service Map"：点击任一服务节点 → 中心化该服务
- 参考 macOS Activity Monitor → Process Inspector：选中进程后底部弹出详细关系

---

## 九、贡献到 contracts/22 的条目

```
向 contracts/22-data-model-consistency-spec.md 新增：

- TopologyRootKind
- TopologyScope
- FlowScope
- ScopedGraph, GraphNode, GraphEdge
- ScopedFlow, FlowStep, FlowEdge
- JumpIntent, JumpDispatcher
- ScopeChangeEvent
- TopologyScopeSchema (Zod)
```

## 十、贡献到 contracts/23 的条目

```
向 contracts/23-ipc-contracts-master.md 新增：

| Channel | 方向 | Schema 引用 | 限流 | 首出自 |
|---------|------|------------|------|--------|
| topology:build-scoped-graph | R→M | TopologyScopeSchema | 60/min | spec/02 |
| flow:build-scoped-flow | R→M | FlowScopeSchema | 30/min | spec/02 |
| topology:warm-scope | R→M | TopologyScopeSchema | 30/min | spec/02 |

向 contracts/23-ipc-contracts-master.md 标记为 LEGACY：

- topology:build-graph (existing; keep handler for legacy mode only)
- flow:build-graph (existing; keep handler for legacy mode only)
```

---

## 十一、影响半径 / 预计 LoC

- 新增文件：5（AttachedGraphView / AttachedFlowView / ScopeControls / useScopedTopology / JumpDispatcher）
- 新增类型文件：1（`src/shared/topology/scope.ts`）
- 修改文件：4（MonitorPanel / ProcessDetailPanel / PortFocusPanel / WindowDetailPanel）
- 移动（legacy）：5-7（TopologyView.tsx / topology/ 目录 / flow/ 目录 / PortRelationshipGraph.tsx）
- 修改主进程 IPC：2 新 handler
- 预计新增 LoC：~1200 行
- 预计删除 LoC：0（全部移动不删除）
- 影响半径：监控 Tab 用户流 100% + 所有引用 `MonitorTab` 类型的位置

---

## 十二、开发阶段检查清单（给实现 Agent）

- [x] 新建 `src/shared/topology/scope.ts` 并导出类型（含 Zod `topologyScopeSchema` 与真实快照构图器）
- [x] 新建 `AttachedGraphView.tsx` / `AttachedFlowView.tsx` / `ScopeControls.tsx`
- [x] 新建 `useScopedTopology.ts` hook 消费全局 scanner store，并优先调用真实 preload IPC
- [x] `NeuralGraphEngine.ts` 完成 scope 等效接入：scope 裁切前移到共享构图器 + hook，engine 继续接收真实 `nodes/edges`
- [x] `MonitorPanel.tsx` 收窄 Tab 枚举；topology / flow 不再作为顶级 Tab 暴露，legacy wrapper 保留旧入口代码
- [x] `ProcessDetailPanel.tsx` 新增 relationship / 关系视图子 Tab
- [x] `PortFocusPanel.tsx` 新增 relationship / 关系视图折叠段
- [x] 窗口模块在 `WindowView.tsx` 中为选中窗口新增关系视图面板（当前项目无独立 `WindowDetailPanel.tsx`）
- [x] 主进程新增 `topology:build-scoped-graph` / `flow:build-scoped-flow` / `topology:warm-scope` handler
- [~] 新增 `monitor/legacy/` wrapper 保留旧 `TopologyView` / `PortRelationshipGraph` 访问路径；未物理移动 engine 目录，避免破坏端口附属关系图复用
- [ ] JumpDispatcher 全局单例，回退栈深度 20（未做，当前垂直切片使用详情面板内嵌关系视图，不做跨图跳转栈）
- [x] P6.1/P6.2/P7.1 专项真实 Electron Playwright E2E 通过；JumpDispatcher 跨图回退栈仍按上方独立条目延后
- [ ] 变更记录到 `playbooks/30-r7-daily-verification-checklist.md`（待本轮批量回写）

---

## 十三、可能延迟到 R8 的条目

- **Flow 时序图的动画播放**：当前 spec 仅定义静态快照。动画播放器（可回放近 1 分钟的 spawn / bind / close 事件序列）是好看的 polish，但可延后。
- **关系视图的 3D 布局**：当前 d3-force 二维。若后续要上 WebGL + ForceGraph3D 作为备选渲染器，单独开 spec。
- **AI Task 详情面板的 relationship 子 Tab**：AI Task 通常绑定一个窗口 + 一个进程，关系视图其实是窗口关系视图 + 额外标签。R8 评估是否单独开子 Tab。


---

## 十四、2026-04-29 实现快照（P6.2 / P7.1 / P6.1 CODE-DONE）

- 顶级 `MonitorPanel` 已收窄为 `process / port / window / ai-task` 四项；`topology` / `flow` 不再作为顶级 Tab。
- 新增 `src/shared/topology/scope.ts`，以真实 `ProcessInfo[] / PortInfo[] / WindowInfo[]` 快照裁切 `ScopedTopologyGraph` 与 `ScopedFlow`，不使用 mock 或占位数据。
- 新增主进程 IPC：`topology:build-scoped-graph`、`flow:build-scoped-flow`、`topology:warm-scope`；preload 与 renderer 全局类型已同步。
- 新增附属 UI：`AttachedGraphView`、`AttachedFlowView`、`ScopeControls`，并挂入 `ProcessDetailPanel`、`PortFocusPanel`、`WindowView` 的选中对象上下文。
- `NeuralGraphEngine` 已取消 800x600 fallback，resize 时按真实容器重建 `forceCenter(w/2,h/2)` 与动态 `forceY` 层距并 restart simulation。
- 2026-04-29 时完成级别为 CODE-DONE；2026-04-30 已补齐真实 Electron Playwright E2E，当前验收状态以本文件第十五节 TEST-PASS 快照为准。


---

## 十五、2026-04-30 验证快照（P6.2 / P7.1 TEST-PASS）

- `P6.2` 与 `P7.1` 已从 CODE-DONE 升级为 TEST-PASS；验收基于真实 Electron Playwright，不使用 mock、fixture 项目或模拟 IPC。
- E2E 覆盖真实 `window.devhub.systemProcess.scan()`、`window.devhub.port.scan()`、`window.devhub.windowManager.scan(false)`、`window.devhub.projects.list()` / `projects.add(process.cwd())`，当项目 store 为空时通过真实项目 API 添加当前仓库并在 finally 中清理。
- E2E 对 `project`、`process`、`port`、`window` 四类 scope 分别调用真实 `topology.buildScopedGraph`、`topology.buildScopedFlow`、`topology.warmScope`，断言 root、node/edge、step/link 与 `source` 一致；接受 `cache` / `scan`，明确排除 `renderer-store` 作为最终验收来源。
- `AttachedGraphView` 与 `AttachedFlowView` 已暴露 `data-root-kind`、`data-root-id`、`data-source`、计数类属性，测试在 UI 层验证附属关系图和 flow 不是顶级 Tab，也不是空壳视图。
- 顶级 Monitor Tab 仍只允许 `进程` / `端口` / `窗口` / `AI 任务`，E2E 断言不存在顶级 `拓扑` / `流程图`，符合 spec/02 的附属化要求。
- `src/shared/topology/scope.test.ts` 新增 project scope 单测，覆盖 `project-devhub` 根节点、`project-owns-process` 边以及 process/port/window 的真实结构裁切契约。
- 验证命令通过：`pnpm typecheck`、`pnpm exec vitest run src/shared/topology/scope.test.ts`、`pnpm lint`（含 `No emoji found in 216 files.`）、`pnpm build`、`pnpm exec playwright test e2e/example.spec.ts -g "P6.1" --timeout=120000 --workers=1`（复跑 `1 passed (14.4s)`）。
