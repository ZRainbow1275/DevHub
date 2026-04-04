# Task: process-relationship-graph

## Overview

设计并实现进程关系图（Process Topology Graph），以可视化方式呈现 **端口（Port）↔ 进程（Process）↔ 窗口（Window）** 的关联关系，并支持可选的项目（Project）分组。该组件将作为 MonitorPanel 的新 Tab 集成到现有监控面板中。

## Requirements

### 数据模型层

- **R1**: 定义关系图节点类型 `TopologyNode`，支持四种节点类别：`project`、`process`、`port`、`window`
- **R2**: 定义关系图边类型 `TopologyEdge`，支持三种边类别：`project-owns-process`、`process-binds-port`、`process-owns-window`
- **R3**: 新增 `useProcessTopology` 聚合 hook，同时消费 `processStore`、`portStore`、`windowStore`，通过 `pid` 字段做 join，输出统一的节点和边数据结构

### 图渲染层

- **R4**: 选型并集成图渲染库（推荐 `@xyflow/react`，原 reactflow），支持自定义节点和边样式
- **R5**: 实现四种自定义节点组件（ProjectNode、ProcessNode、PortNode、WindowNode），遵循 Soviet Constructivism 设计风格
- **R6**: 实现力导向/层次化布局算法，Project 在顶层、Process 在中间层、Port/Window 在底层
- **R7**: 支持节点交互：hover 高亮关联链路、click 展示详情面板、拖拽调整位置

### 集成层

- **R8**: 在 MonitorPanel 中新增 "Topology" Tab，作为第五个标签页
- **R9**: 新增 Soviet Constructivism 风格的拓扑图标（TopologyIcon）
- **R10**: 从 `devhub/src/renderer/components/monitor/index.ts` 导出 `TopologyView` 组件

### 性能与实时更新

- **R11**: 统一三个 store 数据源的刷新策略，使用 debounce（300ms）合并多个 store 更新，避免图布局频繁抖动
- **R12**: 仅在节点/边数据实际变化时重新计算布局（shallow compare），增量更新节点位置
- **R13**: 节点数量预估 10-50 进程 + 10-30 端口 + 20-80 窗口，无需虚拟化但需确保 60fps 交互流畅

### 统计概览

- **R14**: 顶部显示统计卡片区（复用 StatCard 组件）：总进程数、总端口数、总窗口数、关联项目数

## Acceptance Criteria

- [ ] `TopologyNode` 和 `TopologyEdge` 类型在 `types-extended.ts` 中定义，与现有 ProcessInfo/PortInfo/WindowInfo 类型兼容
- [ ] `useProcessTopology` hook 正确聚合三个 store 的数据，输出 `{ nodes: TopologyNode[], edges: TopologyEdge[] }`
- [ ] 图渲染库已安装并在 package.json 中声明
- [ ] `TopologyView` 组件可在 MonitorPanel 的 "Topology" Tab 中正确渲染
- [ ] 四种自定义节点样式遵循 Soviet Constructivism 设计语言（直角 2px、粗描边、工业配色）
- [ ] hover 节点时高亮该节点及其所有关联边和邻居节点
- [ ] click 节点时展示侧边详情面板（显示完整的 ProcessInfo/PortInfo/WindowInfo 数据）
- [ ] 三个 store 中的任意数据更新后，关系图在 500ms 内反映最新状态，且不出现布局跳跃
- [ ] 统计卡片正确显示实时数据计数
- [ ] 空状态处理：无进程数据时显示提示信息
- [ ] ErrorBoundary 包裹关系图组件，图渲染崩溃不影响其他 Tab

## Technical Notes

### 1. 数据关联核心

三大实体通过 `pid` 字段形成星型关联拓扑：
- `ProcessInfo.pid` → 进程主键
- `PortInfo.pid` → 端口所属进程
- `WindowInfo.pid` → 窗口所属进程
- `ProcessInfo.projectId?` / `PortInfo.projectId?` → 可选项目分组

关系拓扑：**Project --(1:N)--> Process --(1:N)--> Port** 以及 **Process --(1:N)--> Window**

### 2. 数据聚合策略

三个 store 各自独立且异步刷新（进程 5s、端口 10s、窗口按需）。`useProcessTopology` hook 需要：
- 同时订阅三个 Zustand store 的 selector
- 通过 `pid` 做 join 构建图结构
- 使用 `useMemo` + shallow compare 避免不必要的重渲染
- debounce 合并多个 store 的快速连续更新

### 3. 后端关联逻辑

`SystemProcessScanner.scan()` 已实现 Process-Port 的 join：
```typescript
const portMap = new Map(portInfo.map(p => [p.pid, p.port]))
```
关系图在 renderer 端做全部关联计算，无需新增 IPC 通道。

### 4. 图渲染库选型推荐

**首选：`@xyflow/react` v12+**
- React 原生组件，与现有 React 18 技术栈完美匹配
- 自定义节点能力极强，可深度定制 Soviet Constructivism 风格
- 内置力导向/层次化布局支持（配合 `@dagrejs/dagre`）
- MIT 协议，无商业限制
- 活跃社区，TypeScript 原生支持
- bundle size 约 300KB（gzipped ~80KB），对 Electron 应用可接受

**备选：纯 SVG + d3-force**
- 更轻量但开发量大幅增加
- 仅在 bundle size 敏感时考虑

### 5. 设计风格约束

必须遵循项目 Soviet Constructivism 美学：
- 直角：`borderRadius: '2px'`
- 粗描边：`border-l-3` 系列
- 对角线装饰：`deco-diagonal` 类
- 工业配色：`accent`（红色系）、`gold`、`steel`、`success`、`info`
- 大写追踪字体：`uppercase tracking-wider`
- Display 字体：`var(--font-display)`
- 动画：`animate-card-stagger` + `animationDelay`

### 6. 新增文件清单（预估）

```
devhub/src/
├── shared/types-extended.ts          # 追加 TopologyNode, TopologyEdge 类型
├── renderer/
│   ├── hooks/useProcessTopology.ts   # 新增：数据聚合 hook
│   ├── components/monitor/
│   │   ├── TopologyView.tsx          # 新增：关系图主组件
│   │   ├── topology/
│   │   │   ├── ProcessNode.tsx       # 新增：进程自定义节点
│   │   │   ├── PortNode.tsx          # 新增：端口自定义节点
│   │   │   ├── WindowNode.tsx        # 新增：窗口自定义节点
│   │   │   ├── ProjectNode.tsx       # 新增：项目自定义节点
│   │   │   ├── TopologyEdge.tsx      # 新增：自定义边组件
│   │   │   └── TopologyDetailPanel.tsx # 新增：节点详情侧边板
│   │   ├── MonitorPanel.tsx          # 修改：添加 Topology Tab
│   │   └── index.ts                  # 修改：导出 TopologyView
│   └── components/icons/index.tsx    # 修改：添加 TopologyIcon
```

## Out of Scope

- 不涉及后端 IPC 通道的新增或修改
- 不修改现有的 ProcessView、PortView、WindowView 组件
- 不实现进程关系图的持久化存储（布局位置不保存）
- 不实现进程关系的历史时间线回溯
- 不实现跨机器的进程拓扑（仅本机）
- 不涉及 AI Task Tab 的任何修改
