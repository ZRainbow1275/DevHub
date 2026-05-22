# 08 — 拓扑/流程图（附属化）决策（提炼版）

> **派生自**: `prompts/0503/08-topology-flow-attached-survey.md`
> **核心痛点**: 「拓扑和流程图原本是基于进程/端口/窗口的附属功能...但现在功能没有了」
> **已知真相**: R7 spec/02 已实现附属化（TopologyScope + ScopedGraph + IPC），用户感知"消失"是 UX 可见性问题
> **R8.A 优先级 #8**

---

## A. 入口可见性

### A.1 详情面板入口（[Q-8.A.1] [ACCEPT]）
**用户回答**: E — 子 Tab + 角标 + 顶部主按钮

- 保持子 Tab（现状）
- 子 Tab 旁加 NetworkIcon 角标
- 顶部独立大按钮 "查看关系图"

### A.2 卡片快捷入口（[Q-8.A.2] [ACCEPT]）
**用户回答**: B + C
- 卡片右上角 NetworkIcon 角标 → 点击直接进全屏关系图
- Hover 时显示"查看关系图"按钮

### A.3 命令面板入口（[Q-8.A.3] [ACCEPT]）
**用户回答**: C
- Cmd+K → 输入"关系" / "topology" → 选目标对象 → 进图
- 历史关系视图记忆（最近查看的 5 个）

### A.4 首次发现引导（[Q-8.A.4] [ACCEPT]）
**用户回答**: D
- 首次打开详情面板 → 气泡 Tooltip
- 欢迎页 / 启动 Tour 含此项
- 设置项可重置 Tour

### A.5 空态提示（[Q-8.A.5] [ACCEPT]）
**用户回答**: C
- 空态插画 + 文案（"该对象当前无关联，可能是独立运行"）
- 排查建议（"扩大深度试试" / "检查是否还在运行"）

---

## B. 视图配置

### B.1 视图类型（[Q-8.B.1] [ACCEPT]）
**用户回答**: 全选

5 种视图共存:
- **力导向图（Force-directed）** — 当前 NeuralGraphEngine d3-force
- **层级图（Hierarchical / Dagre）**
- **同心圆（Radial）**
- **网格（Grid）**
- **流程图（Flowchart）** — 时序 / 事件序列

### B.2 默认视图（[Q-8.B.2] [ACCEPT]）
**用户回答**: A 默认 + D 后续记忆 — Force 默认，记忆用户偏好

### B.3 切换方式（[Q-8.B.3] [ACCEPT]）
**用户回答**: D — 全部
- 顶部 Tab
- 工具栏图标按钮组
- 命令面板（"切换为层级图"）

---

## C. 节点交互

### C.1 节点行为（[Q-8.C.1] [ACCEPT]）
**用户回答**: Hover=C / Click=C / Double-click=C / Right-click=A

| 事件 | 行为 |
|------|------|
| Hover | 高亮 + mini 卡片 |
| Click | 选中（高亮 + 侧边详情）+ 移到中心 |
| Double-click | 跳转详情面板 + 以该节点为新根重建图（用户偏好） |
| Right-click | 上下文菜单（kill / close / open detail / copy / focus） |

### C.2 节点视觉编码（[Q-8.C.2] [ACCEPT]）
**用户回答**: 全选

- 颜色 = 节点类型（process/port/window/project/external）
- 大小 = CPU% 或 RSS
- 边框 = 是否 AI 工具
- 形状 = 类型（process=圆 / port=方 / window=六边形 / project=星形）
- 标签 = 名称 + 关键属性
- 角标 = 状态（异常/正常）

### C.3 边视觉编码（[Q-8.C.3] [ACCEPT]）
**用户回答**: 全选

- 粗细 = 流量 / 频率
- 颜色 = 边类型（owns / parents / listens / connects）
- 箭头 = 方向
- 虚线/实线 = 持久 vs 瞬时
- 悬停高亮

---

## D. 深度与过滤

### D.1 深度控件（[Q-8.D.1] [ACCEPT]）
**用户回答**: D — 滑块 + 双击节点扩展该节点更多深度

### D.2 实体过滤（[Q-8.D.2] [ACCEPT]）
**用户回答**: C — 颜色 chip + Checkbox 列表

### D.3 边过滤（[Q-8.D.3] [ACCEPT]）
**用户回答**: C — 颜色 chip + Checkbox 列表

---

## E. 跨视图跳转

### E.1 跳转栈（[Q-8.E.1] [ACCEPT]）
**用户回答**: D — 回退栈深度 20 + 前进键 + Alt+← / →

### E.2 跳转动画（[Q-8.E.2] [ACCEPT]）
**用户回答**: D — CSS view-transition

---

## F. 流程图（Flow）

### F.1 时序范围（[Q-8.F.1] [ACCEPT]）
**用户回答**: D — 用户可调（默认 30 分钟）

### F.2 布局（[Q-8.F.2] [ACCEPT]）
**用户回答**: D — 全选（横向时间线 + 纵向时间线 + 泳道图）

### F.3 事件类型（[Q-8.F.3] [ACCEPT]）
**用户回答**: 全选

- spawn / exit / bind / release / accept / close
- window-open / window-close
- task-start / task-complete（AI 任务）
- file-change（关键文件改动）

### F.4 回放（[Q-8.F.4] [ACCEPT]）
**用户回答**: D — 时间游标可拖 + 自动播放（1x/2x/5x）+ 暂停 / 跳到事件

---

## G. 性能与可观测

### G.1 节点数上限（[Q-8.G.1] [ACCEPT]）
**用户回答**: D — 自适应（500 默认 + 自适应降级）

### G.2 渲染性能预算（[Q-8.G.2] [ACCEPT]）
**用户回答**: 分级
- 节点 < 200: A — < 16ms / 帧（60 FPS 严格）
- 节点 200-500: B — < 33ms / 帧（30 FPS）
- 节点 > 500: C — 仅限制初次渲染时长（< 1.5s）

### G.3 历史快照（[Q-8.G.3] [ACCEPT]）
**用户回答**: B — 用户可手动保存命名快照（轻量起步）

---

## H. 自由填写

### H.1 全局拓扑视图（[Q-8.H.1] [CHANGE]）
**用户回答**: 「**是，作为一级入口**」

→ 与"附属化"并存：
- ActivityBar 增加 "Topology Global" 一级 Tab
- 同时三大模块详情内保留附属图（A.1 决策）
- 11.A.3 已确认 R8 不延后这一项

### H.2 附属图最大层数（[Q-8.H.2] [CHANGE]）
**用户回答**: 「**10 层**」（默认建议 4 层）

→ 性能预算与 G.1 自适应规则联动：
- depth ≤ 4: 默认行为
- depth 5-7: 自动降密度（合并叶节点）
- depth 8-10: 强制 Lazy Loading + 用户主动展开

---

## I. PRD 信号

1. **附属 + 一级入口双轨**：用户既要附属图也要顶级入口
2. **5 种视图必须支持**：force / dagre / radial / grid / flowchart
3. **跳转栈深度 20**：远超默认（用户要深度回退）
4. **10 层深度**：远超默认 4 层（用户要深下钻）
5. **可见性"角标 + 顶部按钮 + 命令面板 + 卡片角标 + Tour"五重冗余**：解决感知"消失"
6. **流程图回放完整**：拖游标 + 自动播放 + 暂停跳事件
7. **历史快照轻量起步**：仅手动保存，命名管理
