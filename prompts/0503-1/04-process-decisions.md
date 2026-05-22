# 04 — 进程模块决策（提炼版）

> **派生自**: `prompts/0503/04-process-module-survey.md`
> **R8.A 优先级 #2**（仅次于集成库）
> **核心痛点**:
> - 卡片模式资源详情显示"权限不足"
> - 卡片 / 列表显示内容不一致
> - 关系视图入口"消失"

---

## A. 视图模式（[Q-4.A.1] [ACCEPT]）

**用户回答**: E — 卡片 + 列表 + 树形 + Treemap

**4 种视图共存**:
1. **Card** — 已有，加强字段一致性
2. **List** — 已有，紧凑高密度
3. **Tree** — 按父子进程展开（PPID 链）
4. **Treemap** — 按 RSS 占比可视化（react-grid-layout / d3 treemap）

**视图切换**: 模块级密度独立（02.G.2）

---

## B. Card / List 详情统一（[Q-4.A.2] [ACCEPT]）

**用户回答**: C + D 混合
- **分层 ViewModel**: 一份 viewmodel 包含轻字段 + 重字段
- **首次显示轻 + 用户点"深度查询"才取重字段**

**实现要求**:
- 废弃当前 `ProcessRelationship` vs `ProcessDeepDetail` 两套 API
- 新建 `ProcessUnifiedViewModel` (TS + Zod)
  ```ts
  type ProcessUnifiedVM = {
    light: { pid, ppid, name, exe, cmdline, cpu, rss, ws, threads, handles, startTime, user, integrityLevel, ... },
    deep:  { modules?, openFiles?, networkConns?, env?, signature?, services?, gpu?, dep?, aslr? } | null,
    deepLoaded: boolean,
    deepLoadingError: { code, message, requiresElevation } | null
  }
  ```
- IPC: `process:get-unified` （取轻）/ `process:load-deep`（按需取重）
- 渲染层 Card / List / Tree / Treemap 共用同一份 VM

---

## C. 详情字段全集（[Q-4.A.3] [CHANGE→EXTEND]）

**用户回答**: **「全部全选，必须全部做到，这才是能让产品产生差异的东西」**

**字段清单**（必须全部实现）:

### C.1 基础（轻字段，常驻）
- PID / PPID
- 进程名 / 可执行路径
- 命令行
- 工作目录
- 启动时间 / 运行时长
- 用户 / SID
- CPU% / RSS / WS / 句柄数 / 线程数

### C.2 进阶（重字段，按需）
- 加载的模块（DLL）列表
- 打开的文件 / 句柄
- 网络连接（端口）
- 注册表键打开数
- 环境变量
- 进程树（父 / 子 / 兄弟）
- 数字签名 / Authenticode 验证
- 服务关联（Windows Service）
- AppContainer / UAC Level
- WMI 详细字段（CommandLine / CreationClassName / Caption）
- GPU 占用（NVAPI / DXGI）

### C.3 安全/权限
- Integrity Level（Low / Medium / High / System）
- Token 信息（用户/组）
- 是否提权运行
- DEP / ASLR 状态

**PRD 影响**: 这是产品差异化的核心。Spec 必须为每个字段定义获取方式 + 失败 fallback + 性能预算。

---

## D. UAC 提权流程

### D.1 提示策略（[Q-4.B.1] [ACCEPT]）
**用户回答**: B + D — 顶部横幅 + 24 小时记忆

**实现**:
- 详情面板顶部红/橙横幅
- 「提升权限以查看完整信息」按钮
- 用户点击后记忆 24h（按 EXE + 字段类别）
- 不弹窗（弹窗烦）

### D.2 提权方式（[Q-4.B.2] [ACCEPT]）
**用户回答**: B — 单次 spawn 提权子进程

**实现**:
- 主进程保持普通用户
- 需要管理员权限的查询 → spawn 子进程（runas verb 或 `sudo-prompt` 兼容包）
- 子进程通过命名管道返回数据
- 子进程做完即退出（限制爆炸半径）

### D.3 哪些字段需提权（[Q-4.B.3] [ACCEPT]）
**用户回答**: 全部勾选

需提权字段：
- 系统进程的命令行
- 其他用户进程的内存详情
- 服务进程的句柄列表
- System Integrity 进程的所有信息
- WMI 的部分字段（如 ParentProcessId）

---

## E. 操作清单（[Q-4.C.1] [ACCEPT]）

**用户回答**: 基础全选 + 调度全选 + 调试前 3 项 + 关联跳转全选 + 高级首项不选

### E.1 基础（4 项）
- 结束进程（Kill）— 确认 + 强杀
- 优雅终止（Graceful Stop）— SIGTERM / CTRL+C
- 挂起 / 恢复（Suspend/Resume）
- 重启（按 cmdline）

### E.2 调度（2 项）
- CPU 亲和性（Affinity Mask）
- 优先级（Idle ~ RealTime）

### E.3 调试（前 3 项）
- 创建内存转储（procdump 集成）
- 附加调试器（VS / WinDbg）
- 打开模块路径（资源管理器定位）

### E.4 关联跳转（5 项）
- 打开关系视图
- 查看占用的端口
- 查看关联窗口
- 查看父/子进程
- 添加到"我的进程"标签

### E.5 高级
- 复制命令行 / PID / 路径
- 修改环境变量（仅子进程派生时）
- 写入 file handle 到剪贴板
- **不实现**: 进程注入（Inject DLL）— 风险大

---

## F. 操作触发方式（[Q-4.C.2] [ACCEPT]）

**用户回答**: A + B + C + D + F（不要 E 拖拽）

- A. 卡片右上下拉菜单
- B. 列表行右键
- C. 详情顶部工具栏
- D. 命令面板（"kill PID xxxx"）
- F. 键盘快捷键（选中 + Delete）
- 不要 E（拖拽）

### F.1 危险确认（[Q-4.C.3] [ACCEPT]）
**用户回答**: A + C
- 系统进程必须确认（PID < 1000 / 关键服务）
- 用户白名单可关闭部分类型确认

---

## G. 过滤 / 分组 / 排序

### G.1 过滤维度（[Q-4.D.1] [ACCEPT]）
**用户回答**: A + B + C + D + E + G + H

启用维度：
- 进程名 / 路径关键字
- PID 范围
- 用户（System / Admin / 当前 / 其他）
- CPU% / RSS 阈值
- AI 工具特征
- 监听端口
- 是否有窗口

### G.2 过滤组合保存（[Q-4.D.2] [ACCEPT]）
**用户回答**: C — 命名预设 + 一键切换

### G.3 分组（[Q-4.D.3] [EXTEND]）
**用户回答**: A 默认 + C/D/F 用户可切换 + **可自定义自分组**

### G.4 排序（[Q-4.D.4] [EXTEND]）
**用户回答**: A 默认 + B/C/D/E 用户可切换 + **用户可自定义自切换**

→ 必须支持用户保存自定义分组规则与排序规则。

---

## H. 用户标签（[Q-4.E] [ACCEPT]）

### H.1 标签 key（[Q-4.E.1]）
**用户回答**: C — EXE 路径 + cwd 双键

### H.2 标签显示（[Q-4.E.2]）
**用户回答**: D — 全选（卡片 Badge + 列表行尾 + 详情顶部）

---

## I. 历史与时间线（[Q-4.F] [ACCEPT]）

### I.1 历史粒度
**用户回答**: D — 24h 滑窗 + Sparkline

### I.2 可视化形式
**用户回答**: D — 全选（文本时间线 + 横条 Gantt + Sparkline 矩阵）

---

## J. AI 工具识别

### J.1 识别规则（[Q-4.G.1] [ACCEPT]）
**用户回答**: 全部勾选 + 多信号融合

启用规则：
- 进程名包含 codex / claude / gemini
- 命令行含 AI 工具特征词
- 父进程是终端
- 子进程派生模式
- 用户手动标记
- 窗口标题识别（"Claude Code - xxx"）

### J.2 特殊处理（[Q-4.G.2] [ACCEPT]）
**用户回答**: 全选

- 不允许误 kill（额外确认）
- 自动加入 AI 任务监控列表
- 卡片高亮 Badge
- 自动关联 CSV 批次
- 状态栏单独计数

---

## K. 关系视图入口

### K.1 入口位置（[Q-4.H.1] [EXTEND]）
**用户回答**: B + D + E
- B. 子 Tab + 首次气泡 Tooltip
- D. 顶部独立大按钮"关系视图"
- E. 卡片角标 → 直接进全屏

### K.2 默认深度（[Q-4.H.2] [EXTEND]）
**用户回答**: 全选，默认 2
- depth=1 / 2 / 3 全部支持
- 默认 2，记忆用户偏好

### K.3 边类型（[Q-4.H.3] [ACCEPT]）
**用户回答**: 全选 (owns / parents / listens / connects / binds)

---

## L. 自由填写

### L.1 第一眼看到什么（[Q-4.I.1]）
**用户原话**: 「父子关系」
→ 关系图首屏渲染时强调父子边

### L.2 卡片模式独有功能（[Q-4.I.2]）
**用户原话**: 「过滤和更加详尽的内容」
→ Card 上有快捷过滤器条 + 比 List 更详尽的字段密度

---

## M. PRD 信号

1. **Card/List API 必须统一**：废弃双 API，建立 UnifiedViewModel
2. **字段全集"必须全做"**：用户视为产品差异化核心
3. **UAC 单次提权子进程**：主进程不动，子进程做完即退
4. **4 视图并存**：Card / List / Tree / Treemap
5. **AI 工具识别多信号融合**：与 06 / 07 复用同一识别引擎
6. **关系图三冗余入口**：子 Tab + 顶部按钮 + 卡片角标
7. **自定义分组与排序**：用户可保存规则
