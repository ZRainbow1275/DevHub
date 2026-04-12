# 进程管理改进 — 技术设计 Spec

> 对应 PRD: 2.5 进程动态神经流线图 / 2.6 进程列表显示优化

---

## 1. 动态神经流线关系图

### 1.1 设计理念

抛弃传统的静态拓扑图，采用 **神经网络风格的动态关系流线图**：
- 每个进程是一个"神经元"节点
- 进程间关系是"突触"连线
- 数据流/信号流通过连线上的粒子动画可视化
- 整体呈现有机的、生命感的动态图

### 1.2 节点设计

```
┌─────────────────────────────────┐
│ Node (Process Neuron)           │
├─────────────────────────────────┤
│ 视觉属性：                      │
│   - 大小: 按 CPU+内存 动态缩放   │
│   - 颜色: 按进程类型着色          │
│     • System: 冷蓝               │
│     • User App: 暖橙             │
│     • AI Tool: 荧光绿            │
│     • Service: 银灰              │
│   - 脉动: 活跃进程有呼吸光效     │
│   - 边框: 高 CPU 时边框变红+加粗  │
├─────────────────────────────────┤
│ 信息层：                         │
│   Level 0 (缩略): 名称 + PID     │
│   Level 1 (标准): + CPU% + 内存  │
│   Level 2 (展开): 完整卡片视图    │
└─────────────────────────────────┘
```

### 1.3 连线设计

```
连线类型：
├── 父子关系 (Parent-Child)
│   └── 实线，粗细随通信频率变化
├── 端口共享 (Shared Port)
│   └── 虚线，标注端口号
├── 文件锁竞争 (File Lock)
│   └── 红色虚线，标注文件路径
└── 网络连接 (Network)
    └── 蓝色流线，标注协议+端口

动画：
├── 数据流方向: 粒子沿连线流动
├── 流速: 反映实际通信频率
└── 脉冲: 新建连接时闪烁
```

### 1.4 交互模式

| 操作 | 行为 |
|------|------|
| 点击节点 | 高亮该节点所有关联连线+节点（其余半透明） |
| 双击节点 | 展开进程详情面板 |
| 右键节点 | 操作菜单（结束/优先级/打开位置） |
| 滚轮缩放 | 图的整体缩放，缩小时自动降低信息密度 |
| 拖拽空白 | 平移画布 |
| 拖拽节点 | 移动节点，物理引擎自动调整布局 |
| 搜索框 | 输入进程名/PID，聚焦到目标节点 |

### 1.5 技术方案

```
渲染层: @xyflow/react (已有) + 自定义粒子动画 (Canvas overlay)
布局算法: Force-directed (d3-force) 替代 dagre 的层级布局
数据源: SystemProcessScanner 增强 → 输出进程关系图数据结构
更新策略: 
  - 轮询间隔: 2s (进程列表) / 5s (关系计算)
  - 增量更新: diff 算法，仅更新变化的节点/边
  - 动画帧: requestAnimationFrame 驱动粒子流动
```

---

## 2. 进程列表增强

### 2.1 排序功能

```typescript
interface ProcessSortConfig {
  field: 'name' | 'pid' | 'cpu' | 'memory' | 'threads' | 'handles' | 'startTime'
  direction: 'asc' | 'desc'
}
```

- 列头点击切换排序方向（↑/↓ 图标指示）
- 支持多级排序（Shift+点击追加排序条件）
- 排序状态持久化到 AppStore

### 2.2 真实进程勘探

通过 Windows API / PowerShell / WMI 获取深度进程信息：

```typescript
interface ProcessDeepInfo {
  // 基础
  pid: number
  name: string
  path: string
  commandLine: string
  workingDirectory: string
  startTime: Date
  
  // 资源
  cpuPercent: number
  memoryMB: number
  threadCount: number
  handleCount: number
  ioReads: number
  ioWrites: number
  
  // 网络
  networkConnections: NetworkConnection[]
  listeningPorts: number[]
  
  // 模块
  loadedModules: string[]  // DLL 列表
  
  // 环境
  environmentVariables: Record<string, string>
  
  // 关联
  parentPid: number
  childPids: number[]
  relatedPids: number[]  // 通过端口/文件/管道关联的进程
}
```

### 2.3 进程卡片增强

```
┌─────────────────────────────────────────────────┐
│ ⚙ node.exe                          PID: 12345 │
│ CPU: ██████░░░░ 62%    MEM: ███░░░░░░░ 340MB   │
│ THR: 24   HDL: 1,203   NET: 5 conn   IO: 2.3MB │
├─────────────────────────────────────────────────┤
│ CMD: node server.js --port 3000                 │
│ CWD: D:\Projects\my-app                         │
├─────────────────────────────────────────────────┤
│ [结束进程] [进程树] [优先级▾] [文件位置] [详情▾] │
└─────────────────────────────────────────────────┘

展开详情面板：
┌─────────────────────────────────────────────────┐
│ 📡 网络连接                                     │
│   :3000 LISTENING (TCP)                         │
│   → 192.168.1.5:443 ESTABLISHED                │
│ 📦 子进程                                       │
│   └─ worker.exe (PID: 12346) CPU: 12%           │
│ 🔗 关联进程                                     │
│   └─ nginx.exe (PID: 8080) via :3000            │
│ 📋 环境变量 (NODE_ENV=production, PORT=3000...) │
└─────────────────────────────────────────────────┘
```

---

## 3. 进程关系图数据结构

### 3.1 Backend 输出

```typescript
interface ProcessRelationGraph {
  nodes: ProcessNode[]
  edges: ProcessEdge[]
  timestamp: number
}

interface ProcessNode {
  pid: number
  name: string
  type: 'system' | 'user' | 'ai_tool' | 'service'
  metrics: { cpu: number; memory: number }
}

interface ProcessEdge {
  source: number  // PID
  target: number  // PID
  type: 'parent_child' | 'shared_port' | 'network' | 'file_lock' | 'pipe'
  metadata: {
    port?: number
    protocol?: string
    filePath?: string
  }
  weight: number  // 通信强度 0-1
}
```
