# Spec-02: 进程管理系统级增强

> **关联 PRD**: prd-master.md → G2, G3
> **优先级**: P1 | **预估复杂度**: High

---

## 1. 问题分析

### 1.1 当前实现差距

**与 Windows 资源管理器对比**:

| 能力 | Windows 资源管理器 | DevHub 当前 | 差距 |
|------|-------------------|-------------|------|
| 多列排序 | 任意列升降序 | 无排序 | **严重缺失** |
| 搜索过滤 | 实时搜索 | 无搜索 | **严重缺失** |
| 进程树 | 完整父子树 | 仅直接子进程 | 部分缺失 |
| 资源详情 | 线程/句柄/磁盘IO | CPU/内存 | 部分缺失 |
| 结束进程 | 结束进程 + 结束进程树 | 仅结束单进程 | 部分缺失 |
| 性能历史 | 实时趋势图 | 无 | **严重缺失** |
| 虚拟化 | 原生高性能 | 全量 DOM 渲染 | 性能风险 |

### 1.2 进程关系图现状

`TopologyView.tsx` (298 行) + `useProcessTopology.ts` (275 行):
- dagre 层级布局（静态、无动画）
- 节点不可拖拽
- 关系仅限: project→process→port/window
- 无进程间父子关系连线
- 无数据流动画

---

## 2. 设计方案

### 2.1 模块 A: 列表排序过滤系统

#### A.1 排序引擎

```typescript
interface SortConfig {
  column: SortColumn
  direction: 'asc' | 'desc'
}

type SortColumn = 
  | 'name'       // 进程名称 (字典序)
  | 'pid'        // PID (数值)
  | 'cpu'        // CPU% (数值)
  | 'memory'     // 内存MB (数值)
  | 'port'       // 绑定端口 (数值，null排最后)
  | 'startTime'  // 启动时间 (时间戳)
  | 'status'     // 状态 (枚举序: running > idle > waiting)
  | 'type'       // 类型 (枚举序: ai-tool > dev-server > build > database > other)

// 支持多列排序 (Shift+点击追加)
type SortState = SortConfig[]  // 最多3级
```

**交互方式**:
- 列表模式: 表头点击切换排序 (↑↓↕ 图标)
- 卡片模式: 工具栏下拉选择排序字段
- Shift+点击追加次级排序
- 当前排序状态显示在标题行

#### A.2 过滤系统

```typescript
interface FilterState {
  search: string              // 模糊搜索 (名称/PID/命令/目录)
  status: Set<ProcessStatus>  // 状态过滤
  type: Set<ProcessType>      // 类型过滤
  cpuMin?: number             // CPU 下限
  memoryMin?: number          // 内存下限
  hasPort?: boolean           // 是否绑定端口
}
```

**UI 布局**:
```
┌─ 过滤工具栏 ─────────────────────────────────────────┐
│ [🔍 搜索进程...]  [状态▾] [类型▾] [CPU>▾] [清除过滤] │
└─────────────────────────────────────────────────────────┘
```

- 搜索框: debounce 300ms, 支持 PID 精确匹配 (`pid:1234`) 和名称模糊匹配
- 状态过滤: 多选 checkbox dropdown
- 类型过滤: 多选 chip group (AI工具 / 开发服务器 / 构建 / 数据库 / 其他)
- CPU/内存阈值: slider 或直接输入
- 过滤结果计数: "显示 45/128 个进程"

#### A.3 虚拟列表

```typescript
// 使用 @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual'

// 列表模式: 固定行高 40px
// 卡片模式: 动态行高，估算 120px
// 分组模式: 组头 48px + 子项 40px
```

---

### 2.2 模块 B: 真实进程勘探

#### B.1 后端扩展 — ProcessInfo 增强

```typescript
// 扩展 ProcessInfo (types-extended.ts)
interface ProcessInfoExtended extends ProcessInfo {
  ppid: number                    // 父进程 PID
  parentName?: string             // 父进程名称
  childPids: number[]             // 直接子进程 PID 列表
  siblingPids: number[]           // 兄弟进程 PID 列表
  threadCount: number             // 线程数
  handleCount: number             // 句柄数
  ports: number[]                 // 绑定的所有端口 (多端口)
  relatedWindowHwnds: number[]    // 关联窗口句柄列表
  cpuHistory: number[]            // CPU 历史 (最近 60 秒, 每 2 秒采样)
  memoryHistory: number[]         // 内存历史
  commandLine: string             // 完整命令行
  userName?: string               // 运行用户
  priority?: number               // 进程优先级
}
```

#### B.2 后端扩展 — 完整进程树

```typescript
// SystemProcessScanner 新增方法
interface ProcessRelationship {
  ancestors: ProcessInfo[]        // 祖先链 (直到 System 进程)
  self: ProcessInfoExtended       // 自身 (含扩展信息)
  children: ProcessInfo[]         // 直接子进程
  descendants: ProcessInfo[]      // 所有后代 (递归)
  siblings: ProcessInfo[]         // 兄弟进程 (同父)
  relatedPorts: PortInfo[]        // 关联端口 (自身+子进程)
  relatedWindows: WindowInfo[]    // 关联窗口 (自身+子进程)
}

// IPC 新增通道
'process:get-full-relationship': (pid: number) => ProcessRelationship
```

#### B.3 PowerShell 查询优化

```powershell
# 单次查询获取完整进程树 (避免多次调用)
Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, 
  CommandLine, ThreadCount, HandleCount, Priority, 
  @{N='User';E={$_.GetOwner().User}},
  KernelModeTime, UserModeTime, WorkingSetSize |
  ConvertTo-Csv -NoTypeInformation
```

#### B.4 前端进程详情面板

```
┌─ 进程详情: node.exe (PID: 12345) ──────────────────────┐
│                                                          │
│  ┌─ 基本信息 ──────────────────────────────────────┐    │
│  │ 名称: node.exe    状态: running    类型: dev-server│    │
│  │ PID: 12345        PPID: 6789      优先级: Normal  │    │
│  │ 用户: ZRainbow    启动: 2h 15m ago               │    │
│  │ 命令: node ./node_modules/.bin/vite --port 3000  │    │
│  │ 目录: D:\Projects\my-app                         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 资源监控 ──────────────────────────────────────┐    │
│  │ CPU ████████░░░░░░ 45.2%  [sparkline ~~~~~]     │    │
│  │ MEM ██████░░░░░░░░ 312MB  [sparkline ~~~~~]     │    │
│  │ 线程: 12   句柄: 456                              │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 关联 ──────────────────────────────────────────┐    │
│  │ 端口: :3000 (LISTENING), :3001 (LISTENING)       │    │
│  │ 窗口: 2 个 (Vite Dev Server, HMR)               │    │
│  │ 子进程: 3 个 (esbuild, sass, postcss)            │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [结束进程] [结束进程树] [打开目录] [复制命令]          │
└──────────────────────────────────────────────────────────┘
```

---

### 2.3 模块 C: 神经关系图

#### C.1 设计理念

**不是拓扑图，是一个活的神经系统**:
- 节点是神经元：大小 = 资源占用，颜色 = 状态，脉动 = 活跃度
- 连线是轴突：粗细 = 关联强度，粒子流 = 数据流方向
- 布局是力导引：自然聚类，活跃节点靠近中心
- 新进程 = 神经元生长动画，死进程 = 衰退消散

#### C.2 力模型参数

```typescript
interface NeuralForceConfig {
  // 中心引力 — 保持图形居中
  centerForce: { strength: 0.03 }
  
  // 电荷斥力 — 节点互斥
  chargeForce: {
    strength: (node) => -node.resourceWeight * 100  // 越大的节点斥力越大
    distanceMax: 300
  }
  
  // 链接力 — 有关系的节点相互吸引
  linkForce: {
    distance: (link) => link.type === 'parent-child' ? 80 : 120
    strength: (link) => link.weight
  }
  
  // 碰撞力 — 防止重叠
  collisionForce: {
    radius: (node) => node.visualRadius + 5
  }
  
  // 垂直分层力 — 父进程在上，子进程在下
  yForce: {
    strength: 0.05
    y: (node) => node.depth * 150
  }
}
```

#### C.3 节点视觉映射

```typescript
// 节点大小: 基于 CPU + 内存的综合权重
nodeRadius = clamp(
  15,  // 最小
  Math.sqrt(cpu * 2 + memoryMB / 50) * 5,
  60   // 最大
)

// 节点颜色: 基于类型和状态
nodeColor = {
  'ai-tool':     { base: '#d64545', glow: '#ff6b6b' },  // 红色系 (构成主义 accent)
  'dev-server':  { base: '#c9a227', glow: '#ffd700' },  // 金色系
  'build':       { base: '#3b82f6', glow: '#60a5fa' },  // 蓝色系
  'database':    { base: '#8b5cf6', glow: '#a78bfa' },  // 紫色系
  'other':       { base: '#6b7d8a', glow: '#94a3b8' },  // 灰色系
}

// 节点脉动: CPU 活跃度映射为呼吸动画速率
pulseSpeed = map(cpu, 0, 100, 3000, 500)  // CPU 越高脉动越快
```

#### C.4 流线动画

```typescript
// 连线上的粒子流动
interface FlowParticle {
  position: number   // 0~1 沿路径的位置
  speed: number      // 基于关联强度
  opacity: number    // 渐变淡入淡出
  size: number       // 粒子大小
}

// 粒子渲染 (Canvas 层)
// - 父→子关系: 向下流动的蓝色粒子
// - 进程→端口: 向外流动的金色粒子
// - 进程→窗口: 向外流动的绿色粒子
// - 粒子数量 ∝ 连接活跃度
```

#### C.5 交互设计

| 操作 | 效果 |
|------|------|
| 鼠标悬停节点 | 高亮该节点 + 所有直接关联节点/连线，其余淡出至 20% |
| 点击节点 | 锚定聚焦，展开详情面板，关联节点围绕排列 |
| 双击节点 | 聚焦到该节点的子图（过渡动画缩放） |
| 拖拽节点 | 临时固定位置，释放后回归力导引 |
| 滚轮缩放 | 缩放级别 0.2x ~ 3x |
| 右键节点 | 上下文菜单（结束进程、查看详情、复制信息） |
| 搜索框 | 高亮匹配节点，非匹配节点淡出 |

#### C.6 生命周期动画

```
新进程出现:
  1. 从父节点位置生成一个小点
  2. 0.5s 内"生长"到目标大小
  3. 建立连线（连线从 opacity 0 → 1）
  4. 力导引调整周围节点位置

进程消失:
  1. 节点脉动加速（0.3s）
  2. 节点缩小 + opacity 淡出 (0.5s)
  3. 连线同步消失
  4. 周围节点回填空隙
```

---

### 2.4 模块 D: 卡片增强

#### D.1 增强卡片布局

```
┌─ ProcessCard (增强版) ─────────────────────────────────┐
│ ┌────┐  node.exe                         ▶ running    │
│ │icon│  PID: 12345 · :3000 :3001 · 🪟 2             │
│ └────┘  D:\Projects\my-app                            │
│─────────────────────────────────────────────────────────│
│ CPU  ████████░░ 45%  [▁▂▃▅▇█▇▅▃▂]  30s trend        │
│ MEM  ██████░░░░ 312M [▃▃▃▃▅▅▅▇▇▇]  30s trend        │
│─────────────────────────────────────────────────────────│
│ [⊘ 结束] [📂 打开] [📋 复制] [🔍 关系图] [⋯ 更多]    │
└─────────────────────────────────────────────────────────┘
```

**新增元素**:
- 多端口显示（不再只显示一个 port）
- 关联窗口数量指示
- CPU/内存 sparkline 趋势图（最近 30 秒）
- 快捷操作栏（常驻，非悬停显示）
- "关系图" 按钮：点击切换到神经图并聚焦此进程

#### D.2 Sparkline 组件

```typescript
interface SparklineProps {
  data: number[]           // 时序数据
  width: number            // 宽度
  height: number           // 高度 (16-24px)
  color: string            // 线条颜色
  fillOpacity?: number     // 面积填充透明度
  threshold?: number       // 告警阈值线
  animate?: boolean        // 是否动画新数据点
}
```

---

## 3. 文件修改清单

| 文件 | 修改类型 | 内容 |
|------|----------|------|
| `types-extended.ts` | 修改 | 扩展 ProcessInfo，新增 ProcessRelationship |
| `SystemProcessScanner.ts` | 修改 | 扩展扫描字段，新增全关联查询 |
| `processHandlers.ts` | 修改 | 新增 `process:get-full-relationship` 通道 |
| `ProcessView.tsx` | **重写** | 排序/过滤/虚拟列表/增强卡片 |
| `TopologyView.tsx` | **重写** | 替换为 NeuralGraph 组件 |
| `useProcessTopology.ts` | **重写** | 适配力导引布局 |
| `processStore.ts` | 修改 | 新增排序/过滤状态 |
| `preload/index.ts` | 修改 | 暴露新 IPC 通道 |
| 新建 `NeuralGraph.tsx` | 新增 | 神经关系图核心组件 |
| 新建 `NeuralGraphEngine.ts` | 新增 | d3-force 封装 |
| 新建 `ParticleRenderer.ts` | 新增 | Canvas 粒子系统 |
| 新建 `Sparkline.tsx` | 新增 | 微型趋势图组件 |
| 新建 `ProcessFilterBar.tsx` | 新增 | 过滤工具栏组件 |
| 新建 `ProcessDetailPanel.tsx` | 新增 | 进程详情面板 |
| `package.json` | 修改 | 新增依赖: @tanstack/react-virtual |

**注**: d3-force 不需额外安装 — 使用 d3-force 单独包，避免引入全量 d3。

---

## 4. 验收标准

### 列表功能
- [ ] 支持 name/pid/cpu/memory/port/startTime/status/type 8列排序
- [ ] 点击表头切换升/降序，图标指示当前状态
- [ ] Shift+点击支持多列排序（最多3级）
- [ ] 搜索框实时过滤，支持 `pid:1234` 语法
- [ ] 状态/类型多选过滤
- [ ] 500+ 进程虚拟滚动流畅 (60fps)

### 进程勘探
- [ ] 进程详情面板显示完整信息（PPID/线程/句柄/用户/命令）
- [ ] 进程树显示祖先链 + 后代 + 兄弟
- [ ] 关联端口显示所有绑定端口（非仅一个）
- [ ] 关联窗口可点击聚焦

### 神经关系图
- [ ] 力导引布局自然聚类
- [ ] 节点大小反映资源占用
- [ ] 连线有粒子流动动画
- [ ] 悬停高亮关联子图
- [ ] 点击展开详情
- [ ] 拖拽节点临时固定
- [ ] 新进程生长动画
- [ ] 200 节点不卡顿

### 卡片
- [ ] 多端口显示
- [ ] sparkline 趋势图
- [ ] 快捷操作栏常驻
- [ ] "关系图"按钮聚焦到神经图
