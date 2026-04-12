# Spec-03: 端口拓扑深度增强

> **关联 PRD**: prd-master.md → G4
> **优先级**: P1 | **预估复杂度**: Medium-High

---

## 1. 问题分析

### 1.1 当前实现

**PortRelationshipGraph.tsx** (372 行):
- dagre 层级布局（左到右）
- 3 种节点: ProcessNode, PortNode, ExternalNode
- 只读，无点击交互
- 无法聚焦到单个端口
- 外部节点检测简单（仅 foreignAddress 非 0.0.0.0）

**PortView.tsx** (540 行):
- 搜索: 按端口号文本搜索
- 过滤: 全部/常用开发端口/仅监听
- 卡片/列表/关系图三种视图
- 切换到关系图后无法与列表联动

### 1.2 核心缺失

| 缺失能力 | 影响 |
|----------|------|
| 单端口聚焦 | 无法深入分析一个端口的完整上下文 |
| 进程关联深度 | 端口→PID 后无法继续追踪进程树 |
| 连接状态可视化 | LISTENING/ESTABLISHED 无视觉区分 |
| 流量方向 | 无法看到数据流入/流出方向 |
| 端口组 | 同进程多端口无法聚合显示 |

---

## 2. 设计方案

### 2.1 端口聚焦面板

**交互流程**: 
```
列表中点击端口 → 右侧展开聚焦面板 → 显示该端口的完整关联
```

**聚焦面板布局**:
```
┌─ 端口 :3000 聚焦分析 ─────────────────────────────────┐
│                                                          │
│  ┌─ 基本信息 ──────────────────────────────────────┐    │
│  │ 端口: 3000    协议: TCP    状态: LISTENING       │    │
│  │ 本地: 0.0.0.0:3000                               │    │
│  │ 进程: node.exe (PID: 12345)                      │    │
│  │ 命令: vite --port 3000                           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 占用进程详情 ──────────────────────────────────┐    │
│  │ CPU: 12.3%  内存: 256MB  启动: 2h ago            │    │
│  │ 同进程其他端口: :3001(WS), :24678(HMR)           │    │
│  │ 子进程: esbuild(PID:12346), sass(PID:12347)     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 活跃连接 (8) ─────────────────────────────────┐    │
│  │ ESTABLISHED  127.0.0.1:52431 ← Chrome           │    │
│  │ ESTABLISHED  127.0.0.1:52432 ← Chrome           │    │
│  │ ESTABLISHED  192.168.1.5:8080 → API Server      │    │
│  │ TIME_WAIT    127.0.0.1:52420                     │    │
│  │ ...                                               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 迷你关系图 ────────────────────────────────────┐    │
│  │       [Chrome] ←── [:3000] ──→ [node.exe]       │    │
│  │                      ↕                            │    │
│  │                   [:3001]                         │    │
│  │                      ↕                            │    │
│  │               [192.168.1.5:8080]                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [释放端口] [聚焦进程] [在神经图中查看] [复制信息]      │
└──────────────────────────────────────────────────────────┘
```

### 2.2 后端扩展 — 端口关联数据

```typescript
// 新增 IPC 通道
'port:get-focus-data': (port: number) => PortFocusData

interface PortFocusData {
  port: PortInfo                    // 端口基本信息
  process: ProcessInfoExtended      // 占用进程详情 (复用 Spec-02 扩展)
  siblingPorts: PortInfo[]          // 同进程其他端口
  connections: PortConnection[]     // 活跃连接列表
  processChildren: ProcessInfo[]    // 进程的子进程
}

interface PortConnection {
  localAddress: string              // 本地地址:端口
  foreignAddress: string            // 远程地址:端口
  state: string                     // ESTABLISHED/TIME_WAIT/etc.
  foreignProcessName?: string       // 远程进程名 (本地连接可识别)
  direction: 'inbound' | 'outbound' // 连接方向
}
```

### 2.3 神经关系图集成

端口拓扑复用 Spec-02 的 `NeuralGraphEngine`，但使用端口为中心的视角:

```typescript
// 端口神经图模式
interface PortNeuralGraphConfig {
  centerNode: 'port'                    // 以端口为中心
  visibleRelations: [
    'port-owned-by-process',            // 端口 → 占用进程
    'process-binds-sibling-port',       // 进程 → 同进程其他端口
    'port-connected-to-external',       // 端口 → 远程地址
    'process-has-children',             // 进程 → 子进程
  ]
  
  // 力导引参数 — 端口为中心的辐射布局
  forces: {
    radial: { radius: 150, center: focusedPort }  // 关联节点围绕端口排列
    charge: { strength: -80 }
    link: { distance: 100 }
  }
}
```

**节点类型扩展**:

| 节点类型 | 视觉 | 大小映射 |
|----------|------|----------|
| 端口 (LISTENING) | 金色圆形 + 脉冲 | 固定中等 |
| 端口 (ESTABLISHED) | 蓝色圆形 + 稳定光 | 连接数 |
| 端口 (TIME_WAIT) | 灰色圆形 + 渐隐 | 固定小 |
| 进程 | 红色六边形 | CPU + 内存 |
| 外部地址 | 虚线菱形 | 连接数 |
| 子进程 | 浅红色小圆 | CPU |

**流线动画**:
- LISTENING 端口: 向外辐射的等待脉冲（缓慢呼吸）
- ESTABLISHED: 双向粒子流（稳定速度）
- TIME_WAIT: 残余粒子渐灭
- 新连接建立: 流线从远程节点"射向"端口

### 2.4 列表与图的联动

```
操作:                          效果:
列表中选中端口 :3000      →   图中聚焦到 :3000 节点，周围高亮
图中点击端口节点          →   列表滚动到该端口，展开聚焦面板
图中点击进程节点          →   跳转到进程 Tab，聚焦该进程
列表过滤 (仅 LISTENING)   →   图中非 LISTENING 节点淡出
```

---

## 3. 端口组概念

同一进程绑定的多个端口聚合显示:

```
┌─ node.exe (PID: 12345) ── 端口组 ───────────────┐
│  :3000 LISTENING (HTTP)                           │
│  :3001 LISTENING (WebSocket)                      │
│  :24678 LISTENING (HMR)                           │
│  共 12 个 ESTABLISHED 连接                        │
└──────────────────────────────────────────────────┘
```

- 列表模式: 可按进程分组显示端口
- 图模式: 端口组作为一个聚合节点，展开后分散为独立端口

---

## 4. 文件修改清单

| 文件 | 修改类型 | 内容 |
|------|----------|------|
| `types-extended.ts` | 修改 | 新增 PortFocusData, PortConnection 类型 |
| `PortScanner.ts` | 修改 | 新增 getPortFocusData 方法, 连接方向判断 |
| `portHandlers.ts` | 修改 | 新增 `port:get-focus-data` 通道 |
| `PortView.tsx` | 修改 | 添加排序/聚焦面板/图联动 |
| `PortRelationshipGraph.tsx` | **重写** | 集成 NeuralGraphEngine |
| `preload/index.ts` | 修改 | 暴露新 IPC 通道 |
| 新建 `PortFocusPanel.tsx` | 新增 | 端口聚焦详情面板 |
| 新建 `PortNeuralConfig.ts` | 新增 | 端口视角的神经图配置 |

---

## 5. 验收标准

- [ ] 点击端口展开聚焦面板，显示完整关联信息
- [ ] 聚焦面板包含: 基本信息/进程详情/同进程端口/活跃连接/迷你图
- [ ] 活跃连接列表正确区分 inbound/outbound 方向
- [ ] 神经关系图以端口为中心辐射布局
- [ ] LISTENING/ESTABLISHED/TIME_WAIT 节点视觉区分明显
- [ ] 粒子流动动画正确反映连接状态
- [ ] 列表选中 ↔ 图聚焦 双向联动
- [ ] 列表过滤同步影响图的显示
- [ ] 端口组聚合显示同进程多端口
- [ ] "在神经图中查看" 跳转到进程 Tab 的神经图
