# 端口拓扑完善 — 技术设计 Spec

> 对应 PRD: 2.7 端口拓扑完善

---

## 1. 单端口聚焦视图

### 1.1 设计目标

从端口拓扑全景图中点击任意端口，进入 **单端口聚焦模式**，展示该端口的完整关联生态。

### 1.2 聚焦视图结构

```
                    ┌──────────────┐
                    │ Remote Addr  │
                    │ 192.168.1.5  │
                    └──────┬───────┘
                           │ TCP ESTABLISHED
                           ▼
┌──────────┐    ┌─────────────────────┐    ┌──────────┐
│ nginx    │───►│    PORT :3000       │◄───│ client   │
│ PID:8080 │    │  ┌───────────────┐  │    │ PID:9999 │
└──────────┘    │  │ node.exe      │  │    └──────────┘
                │  │ PID: 12345    │  │
                │  │ CPU: 62%      │  │
                │  │ STATE: LISTEN │  │
                │  └───────────────┘  │
                └─────────────────────┘
                           │
                    ┌──────┴───────┐
                    │ Traffic Stats│
                    │ IN: 2.3 MB/s │
                    │ OUT: 1.1 MB/s│
                    └──────────────┘
```

### 1.3 关联维度

| 维度 | 数据源 | 展示方式 |
|------|--------|---------|
| 占用进程 | `netstat` / WMI | 中心节点（含进程详情） |
| 监听/连接状态 | `netstat -an` | 节点颜色（绿=LISTEN, 蓝=ESTABLISHED, 红=CLOSE_WAIT） |
| 远程连接 | `netstat -an` | 外围节点，连线标注协议+状态 |
| 进程树 | 进程管理模块 | 子节点展开 |
| 网络流量 | Performance Counter (可选) | 流线动画粗细 |
| 端口冲突 | 扫描同端口占用 | 红色高亮警告 |

### 1.4 交互

- **点击端口节点** → 展开聚焦视图（动画过渡）
- **返回按钮** → 回到全景拓扑
- **右键端口** → 复制端口号 / 结束占用进程 / 查看完整连接列表
- **实时刷新** → 连接状态每 3s 更新

---

## 2. 端口-进程交叉关系图

### 2.1 神经流线图风格

与进程关系图共享同一套视觉语言（神经流线图），但以端口为核心：

```
节点类型：
├── 端口节点 (六边形): 端口号 + 协议 + 状态
├── 进程节点 (圆形): 进程名 + PID
└── 远程地址节点 (方形): IP + Port

连线类型：
├── 进程 → 端口: 占用关系 (LISTEN/BIND)
├── 端口 → 远程: 连接关系 (ESTABLISHED/TIME_WAIT)
└── 进程 ↔ 进程: 通过同一端口的间接关联
```

### 2.2 数据结构

```typescript
interface PortTopologyGraph {
  portNodes: PortNode[]
  processNodes: ProcessNode[]
  remoteNodes: RemoteNode[]
  edges: TopologyEdge[]
}

interface PortNode {
  port: number
  protocol: 'TCP' | 'UDP'
  state: 'LISTENING' | 'ESTABLISHED' | 'CLOSE_WAIT' | 'TIME_WAIT'
  connectionCount: number
}

interface RemoteNode {
  address: string
  port: number
  connectionState: string
}

interface TopologyEdge {
  source: string  // node id
  target: string  // node id
  type: 'bind' | 'connect' | 'indirect'
  traffic?: { inBytes: number; outBytes: number }
}
```

---

## 3. 端口冲突检测增强

```
冲突检测规则：
├── 同端口多进程 LISTEN → 红色高亮 + 告警通知
├── 常用端口被非预期进程占用 → 黄色警告
│   (如 :80 被非 nginx/httpd 占用)
├── 项目配置端口与实际监听端口不一致 → 信息提示
└── 用户已知端口列表 → 自定义规则
```
