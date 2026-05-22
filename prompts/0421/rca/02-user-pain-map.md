# RCA-02 — 用户六轮反馈映射表

> 类型：用户反馈溯源
> 对象：R1 (0410) → R2 (0410-2) → R3/R4 (0411) → R5 (0415) → R6 (0420) → R7 (0421)
> 目的：让 R7 实现 Agent 理解"哪些问题已经被反馈 6 次"，从而判断修复质量的标准应有多高

---

## 一、反馈热度总表

下表按"反馈次数"降序排列。反馈次数 ≥ 3 的条目标记为"陈年顽疾"，必须优先且精修。

| # | 诉求 | R1 | R2 | R3 | R4 | R5 | R6 | 次数 | 等级 |
|---|------|----|----|----|----|----|----|------|------|
| A | AI 窗口自命名 + 通知带名 | [Y] | [Y] | [Y] | [Y] | [Y] | [Y] | **6** | 顽疾 |
| B | AI 任务完成感测准确 | [Y] | [Y] | [Y] | [Y] | [Y] | [Y] | **6** | 顽疾 |
| C | 分组 + 布局真正可用 | [Y] | [Y] | [Y] | [Y] | [Y] | [Y] | **6** | 顽疾 |
| D | 监控进度与实际任务对齐 | [Y] | [Y] | [Y] | [Y] | [Y] | [Y] | **6** | 顽疾 |
| E | 主题从"换色"到"设计语言" | [ ] | [Y] | [Y] | [Y] | [Y] | [Y] | **5** | 顽疾 |
| F | 小尺寸 reflow 而非挤压 | [ ] | [ ] | [Y] | [Y] | [Y] | [Y] | **4** | 顽疾 |
| G | 端口滚动 / 布局 / 查询超时 | [ ] | [ ] | [Y] | [Y] | [Y] | [Y] | **4** | 顽疾 |
| H | 监控模块长跑资源爆炸 | [ ] | [ ] | [ ] | [Y] | [Y] | [Y] | **3** | 顽疾 |
| I | 拓扑 / 流程图附属化 | [ ] | [ ] | [ ] | [ ] | [Y] | [Y] | 2 | 高 |
| J | 拓扑渲染正常（不聚左上） | [ ] | [ ] | [ ] | [ ] | [ ] | [Y] | 1 | 新 |
| K | 项目卡片下拉遮挡 | [ ] | [ ] | [ ] | [ ] | [Y] | [Y] | 2 | 高 |
| L | PID 类进程详情降级 | [ ] | [ ] | [ ] | [ ] | [Y] | [Y] | 2 | 高 |
| M | 窗口名溢出 | [ ] | [ ] | [ ] | [Y] | [Y] | [Y] | 3 | 顽疾 |
| N | AI 图标用 Logo 替代 Emoji | [ ] | [ ] | [ ] | [ ] | [Y] | [Y] | 2 | 高 |
| O | 窗口可操作功能增加 | [ ] | [Y] | [Y] | [Y] | [Y] | [Y] | **5** | 顽疾 |
| P | 项目模块继续打磨 | [Y] | [Y] | [Y] | [Y] | [Y] | [Y] | **6** | 顽疾 |
| Q | IPC 调用频率限流 | [ ] | [ ] | [ ] | [ ] | [Y] | [ ] | 1 | 隐性 |
| R | PowerShell 子进程泄漏 | [ ] | [ ] | [ ] | [ ] | [Y] | [Y] | 2 | 高 |

顽疾（≥ 3 次）合计：**11 条**，占比 61%。

---

## 二、顽疾的"为什么没被修好"清单

每一条后面都对应一份 R7 spec，这份 spec 必须**先解释上一轮为何失败**，再给出新一轮的契约。

### A. AI 窗口自命名 + 通知带名（6 次）

**历次表现**：
- R1：用户只要求"让我知道是哪个窗口" → R1 实现用 PID 作为区分，用户不满
- R2：R2 实现"工具名 + 序号"（`Claude Code-1`），用户说"我希望能自定义"
- R3/R4：增加"右键 → 重命名"，但只改了 store 不改外部窗口标题
- R5：`AIAliasManager.rename()` + `AIWindowAlias.tsx` 组件全新建，但 `SetWindowText` 调用仍未接；`NotificationService.metadata` 被计算但 `AppNotification` 类型无此字段
- R6：用户原话 "**依旧完全没有实现**"

**病根**：UI 造壳 → 后端未接 → 持久化路径 + 通知模板链路完全闭合需要 **三个系统同步改造**（alias store / notification service / WindowManager WinAPI），单批次 task 只改 1-2 个就 archive

**R7 spec 落点**：`spec/07-ai-window-alias-contract.md` —— 把三系统合同写死，不允许部分交付

### B. AI 任务完成感测准确（6 次）

**历次表现**：
- R1：用 CPU 降低 + window title 变化作为信号，漏报严重
- R2：加入 stdout 停止检测，但 child_process 之间串流难捕获
- R3/R4：提出"多信号融合 + 置信度状态机" 但未落地
- R5：新增 5 信号融合（terminal keyword / CPU idle / I/O rate / prompt / child exit），置信度阈值 0.80，8s 二次确认
- R6：用户原话"依然经常误报、瞎报、错报"

**病根**：单信号不可靠（terminal keyword 对不同 shell 失效、CPU 变化率受工具差异影响、prompt 检测因 title 缓冲更新延迟）；5 信号融合的权重是静态 hardcode，未按"每个工具的特性"做自适应

**R7 spec 落点**：`spec/08-ai-task-detection-engine-spec.md` —— 引入"每工具自适应权重 + 状态机退出条件" + DevObservabilityPanel 实时显示状态机

### C. 分组 + 布局真正可用（6 次）

**历次表现**：
- R1-R3：UI 上有"分组"按钮但点了没反应
- R4：新增 `WindowGroup` 类型定义
- R5：`LayoutPreview.tsx` 新建，能显示 2×2 / 3×3 预览；`stackWindows()` 方法存在
- R6：用户"重启后分组里的窗口找不到"

**病根**：
1. `loadFromDisk()` 直接把老 hwnd 塞回 `groups[].windows[]`，hwnd 是 OS 每次启动重新分配的
2. `LayoutEngine` 没有调 WinAPI `SetWindowPos`，只在 JS 层打印 log
3. "恢复到之前位置" 没有快照保存

**R7 spec 落点**：`spec/09-window-groups-contract.md` + `spec/10-window-layout-engine-spec.md`

### D. 监控进度与实际任务对齐（6 次）

**历次表现**：
- R1：进度条是假的，按时间线性填
- R2：改为按"输出行数比例"，但没区分 thinking / coding
- R3/R4：引入 phase 概念（initializing / thinking / coding / validating / completed）
- R5：phase weights 写入 AITaskTracker
- R6：用户截图显示 "Claude Code-1 空闲 56%"，状态与进度矛盾

**病根**：`task.status.state`（状态字段）和 `task.status.progressEstimate.percentage`（进度字段）在两个不同的 tick 被更新 → 同一帧读出来可能是 `idle + 56%` 组合

**R7 spec 落点**：`spec/11-ai-progress-tracker-contract.md` —— 强制"状态 → 进度"的派生关系（空闲=隐藏进度条；思考=流动不定值；编码=可估百分比；完成=100%）

### E. 主题从"换色"到"设计语言"（5 次）

**历次表现**：
- R2：只有 light / dark
- R3：新增 cyberpunk / modern-light
- R4：新增 warm-light / swiss
- R5：`theme-tokens.css` 扩展到 7 层 tokens，6 个主题
- R6：用户 "布局完全一致，仅换色"

**病根**：密度 / 圆角 / 字体 / 间距 tokens 已经定义，但**没有 UI 让用户独立选**；theme 只是一个预设的多维组合，用户选 "cyberpunk" 就被绑定到它的密度默认值，想要"cyberpunk 美术 + 紧凑密度"做不到

**R7 spec 落点**：`spec/19-theme-design-language-system.md` —— 暴露 4 个正交选择器（theme / density / radius-family / motion-level）

### F. 小尺寸 reflow 而非挤压（4 次）

**历次表现**：
- R3：用户贴图 1200×800 视口，卡片互相重叠
- R4：Tailwind 加了 `sm:` `md:` 前缀，但 Sidebar 在 < 1000px 仍然全宽
- R5：Sidebar 增加 auto-collapse，但只是折叠 Sidebar，主内容区还是按原布局排
- R6：用户"窗口在过小的情况下，显示并没有进行缩放，而是依然那么大，就会造成挤压"

**病根**：主内容区使用固定列数（`grid-cols-3`），小视口下每列收窄到极小；没有使用 `container-query` 做组件级响应

**R7 spec 落点**：`spec/18-responsive-scaling-system.md`

### G. 端口滚动 + 布局 + 查询超时（4 次）

**历次表现**：
- R3：端口列表在小窗口下挤成一团
- R4：引入 PortFocusPanel 作为右侧详情区
- R5：主列表是 `overflow-y-auto` 但滚动条隐藏；FocusPanel 作为 absolute overlay 挤占主列
- R6：用户"没有滑动栏，无法上下滑动"

**病根**：
1. 滚动条 CSS 被 `::-webkit-scrollbar { width: 0 }` 之类隐藏
2. FocusPanel 应该是 **resizable split pane** 而不是 overlay
3. "查询超时" 只显示 3 个字，用户不知道是否可重试

**R7 spec 落点**：`spec/15-port-scroll-layout-timeout-spec.md`

### H. 监控模块长跑资源爆炸（3 次 + 用户措辞升级）

**历次表现**：
- R4：提到 PowerShell 子进程泄漏
- R5：`04-14-v2-backend-core` 改了 SystemProcessScanner / ToolMonitor / AITaskTracker 的 timeout，但没 kill child
- R6：用户原话 "**整个监控模块在长时间开启后将占据大量内存以及 CPU，导致系统极其卡顿。这个问题必须要得到解决**"

**病根**：
1. `BackgroundScannerManager` 和 `processHandlers.ts` 各自实例化一份 SystemProcessScanner + PortScanner → 2x 扫描频率
2. `withTimeout()` 超时返回 fallback 但不 kill 子进程 → PowerShell 僵尸
3. `cleanupProcessHandlers()` 只 unregister IPC，不调用 `processScanner.cleanup()`

**R7 spec 落点**：`spec/03 + 04 + 05 + 06`

### M. 窗口名溢出（3 次）

**历次表现**：
- R4：窗口卡片 `title` 直接渲染，极长 title 撑破卡片
- R5：加 `truncate` 类但 tooltip 不完整
- R6：用户贴图显示多个窗口卡片因不同标题长度高度不一致

**病根**：`truncate` 生效但没有"双击展开完整" 和"hover tooltip"

**R7 spec 落点**：`spec/16-window-layout-overflow-fix.md`

### O. 窗口可操作功能（5 次）

**历次表现**：
- R2：用户希望能 "focus / 置顶 / 截屏"
- R3：实现 "focus"
- R4：实现 "minimize / maximize"
- R5：实现 "stack"
- R6：用户仍觉得少

**病根**：每次只补一两个操作，缺乏目录式规划

**R7 spec 落点**：`spec/12-window-operations-catalog.md` —— 一次性列 12 个操作的 IPC 清单

### P. 项目模块继续打磨（6 次）

**历次表现**：
- R1-R6 每一轮都是"继续打磨"的模糊指示

**R7 spec 落点**：`spec/21-project-ux-polish-roadmap.md` —— 把"打磨"拆成 20 个具体项，每项有验收条

---

## 三、给 R7 实现 Agent 的优先级建议

严格按以下顺序推进，**顽疾条目的修复必须在 E2E 通过前 不允许 archive**：

1. **先做 H**（Runtime 爆炸，3 次 + 措辞升级）—— 卡住用户的日常使用
2. **再做 I + J**（拓扑附属化 + 渲染）—— 信息架构对齐后再动附属功能
3. **然后做 A B C D O**（窗口 / AI 五诉求，各 6 次）—— 批次 2 六份 spec 一次性写到死
4. **接着做 K L M G F**（P1 显性 Bug）
5. **最后做 E N P**（视觉 / 主题 / 项目打磨）

---

## 四、"反馈频次 ≥ 6 次"的特殊处理

以下四条反馈 6 次的诉求，R7 **必须** 做到：

- A. AI 别名 + 通知 → 三端（Toast / 系统通知 / 应用内通知中心）同时验证通过
- B. AI 感测 → 连续 30 分钟两实例无误报 + 漏报 0
- C. 分组 + 布局 → 重启后恢复 100%
- D. 监控进度 → 不允许出现"空闲 + 百分比" 一帧

未达到 100% 的 **任何** 一条，整个 R7 不能标记为 "release-ready"。

---

## 五、附录：R7 → R8 的问题去留

若 R7 某些条目因时间 / 复杂度过不了，允许 defer 到 R8，但必须在 `playbooks/30-r7-daily-verification-checklist.md` 的 "R8 遗留" 段显式记录，并说明：
1. 本轮完成了多少
2. 剩余工作的具体未完成点
3. 用户感知上的影响（是"不完美" 还是 "完全不能用"）

**严禁**隐性放弃。
