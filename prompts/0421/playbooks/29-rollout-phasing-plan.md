# playbooks/29 — 分期交付路线图

> 目的：将 spec/02~21 + contracts/22~25 + tests/27~28 合并为 5 个 stage 的落地计划
> 假设：单开发者（或 1-2 人小队），顺序推进，每 stage 可独立发布
> 关联：每个 stage 完成对应 `.trellis/tasks/` 下的任务

---

## 一、Stage 0 — 地基（3-5 天）

**目标**：修 R5 Runtime Killer、建立 observability，不做 UI 改动。

| 任务 | Spec | 验收 |
|------|------|------|
| Scanner Registry 单例化 | spec/03 | 任意时刻 log 里只有 1 个 ProcessScanner 实例 |
| PowerShellGateway 半控 + tree-kill | spec/03 | Chaos 超时 10 次不泄漏 |
| IScanner 接口 + DisposalRegistry | spec/04 | 切 tab 不泄漏 |
| IPC 限流 + BroadcastBatcher | spec/05 | IPC P95 ≤ 50ms |
| DevObservabilityPanel | spec/06 | Ctrl+Shift+D 显示 6 个指标 |
| PerfProbe 采集 | tests/28 | `%APPDATA%/DevHub/perf/` 有 jsonl |

**Gate**: Scenario-B 30min 通过 + Scenario-C 2hr 通过（spec/28 阈值）。

**Release**: `v0.7.0-alpha` — Internal only

---

## 二、Stage 1 — IA + 拓扑附属化（2-3 天）

**目标**：彻底移除顶层 Topology / Flow tab，附到三大模块详情。

| 任务 | Spec | 验收 |
|------|------|------|
| MainLayout 移除 nav-topology / nav-flow | spec/02 | 顶 nav 只 5 项 |
| TopologyScope 类型 + AttachedTopologyView | spec/02 | 三大详情面板均有 Relationship sub-tab |
| Attached flow view | spec/02 | 三大详情面板有 Flow sub-tab |
| ResizeObserver + dynamic yLayerGap | spec/17 | 节点不聚左上 |
| TopologyRenderer 通用化 | spec/02 | 同一 Renderer 支持 3 种 root |

**Gate**: P6.1/P6.2/P7 相关 E2E 全绿

**Release**: `v0.7.0-beta`

---

## 三、Stage 2 — AI 窗口四件套（4-6 天）

**目标**：解决用户反复提 6 轮的 4 个痛点。

| 任务 | Spec | 验收 |
|------|------|------|
| Win32WindowTitler + SetWindowText | spec/07 | 真实改目标窗口标题 |
| AIAlias rename-and-apply IPC | spec/07 | RenameIntent → RenameResult 双路径 |
| AppNotification.metadata.taskAlias | spec/07 | 通知含"Claude / Fix login bug" |
| ToolProfile + CompletionStateMachine | spec/08 | 7 个 tool profile JSON 存在 |
| ConfidenceEngine 多信号融合 | spec/08 | 误报率 < 5%（自测） |
| WindowGroup fingerprint 持久化 | spec/09 | 重启仍能匹配 |
| LayoutEngine + Win32Positioner | spec/10 | 应用布局真移动窗口 |
| deriveProgress + assertInvariant | spec/11 | idle 时 progress 必为 0 |
| 12 窗口操作清单 | spec/12 | 右键菜单 12 项可点 |

**Gate**: P2/P4/P5 相关 E2E 全绿 + Chaos 通过

**Release**: `v0.7.0-rc1`

---

## 四、Stage 3 — P1 Bug 打磨（3 天）

**目标**：清除 R6 截图列出的可见 bug。

| 任务 | Spec | 验收 |
|------|------|------|
| ScriptSelector Portal 化 | spec/13 | Dropdown 挂 body |
| ProcessDetailPanel partial + AdminRelaunch | spec/14 | PID 9148 类场景有部分字段 |
| ResizableSplitPane + TimeoutBanner + scrollbar.css | spec/15 | 端口面板可调 + 滚动 + 超时提示 |
| WindowTitleCell truncate + Marquee + virtualize | spec/16 | 长 title 不溢出 |
| ResizeObserver → NeuralGraphEngine | spec/17 | 节点分布均匀 |

**Gate**: P1/P2.2/P3/P4.1/P6.1 E2E 全绿

**Release**: `v0.7.0-rc2`

---

## 五、Stage 4 — Visual / UX（4-5 天）

| 任务 | Spec | 验收 |
|------|------|------|
| useContainerSize + ResponsiveTable | spec/18 | 表格→卡片自动回流 |
| CollapsibleSidebar | spec/18 | 按宽度三态 |
| 4-axis theme + preset grid | spec/19 | 216 种组合可切 |
| Token 层 + 组件订阅 | spec/19 | 切 density 所有行高变化 |
| brand-logos/ + ToolLogo | spec/20 | 无 emoji |
| ESLint no-emoji + pre-commit | spec/20 | CI 拦截 |
| Project 20 打磨项 | spec/21 | 20 条 E2E 全绿 |

**Gate**: P8 E2E 全绿 + Full Acceptance suite 全绿

**Release**: `v0.7.0`

---

## 六、Stage 5 — 稳定性回归 + 发布（2 天）

| 任务 | 验收 |
|------|------|
| Stability suite（4 hr） | slope ≈ 0 |
| Chaos suite | 所有故障模式降级 |
| Playbook dry-run | playbook/30 逐条通过 |
| 文档 / CHANGELOG | 覆盖所有 spec 变更 |
| 打包 & 签名 | Windows exe 可运行 |

**Release**: `v0.7.0 GA`

---

## 七、总计

- 代码改动估算：8-12k LoC
- 新增文件：~50
- 耗时：18-24 天（单人）/ 10-14 天（2 人）
- 测试用例：~136

---

## 八、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|-----|------|------|
| koffi 与 Electron 23 不兼容 | 低 | 高 | 备选 node-window-manager；或保持 node-ffi-napi |
| SetWindowText 被目标应用反复覆盖 | 中 | 中 | 检测并提示 + 只应用我方前缀 |
| xstate 学习曲线 | 中 | 低 | 先写 POC，再重构 |
| 主题 216 组合视觉破碎 | 中 | 中 | 先发 8 预设，其他通过 advanced 入口 |
| 30 文档过多开发者不看 | 高 | 中 | Stage 开始前强制看对应 spec + README 10min onboarding |

---

## 九、Stage 切换检查

每 stage 完成后：

1. `git tag v0.7.0-<stage>`
2. 本文件对应行标记为 DONE
3. 更新 `.trellis/workspace/` journal
4. 合并 Full Acceptance suite baseline snapshot
5. 记录 perf baseline 到 `perf-history/`

---

## 十、回滚策略

| 发现严重问题 | 回滚到 | 保留 |
|------------|-------|------|
| Stage 2 AI 别名破坏既有用户数据 | 上 stage | 保留 observability + IA |
| Stage 4 主题切换全屏白屏 | 上 stage | 保留 AI 四件套 |

所有 stage 都是 additive；禁止删除已交付特性（用户硬约束）。
