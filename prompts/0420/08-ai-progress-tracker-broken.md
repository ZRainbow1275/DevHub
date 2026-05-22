# P5.1 — AI 任务进度监控失效 [P0-Critical]

> Round: R6 · 2026-04-20
> 用户原话：**"大概窗口进度监控失效的问题和该问题同属一个"**
> 参考 P4.2-d（监控进度与实际 AI 任务不对齐）

---

## 一、问题范围

此问题与 `07-window-unmet-5-demands-revisit.md` 的 P4.2-d **视为同一问题**。在 AI 任务 Tab 下的表现：

截图 `屏幕截图 2026-04-15 195527.png`：
- `Claude Code-1 空闲` 但进度 56%
- `Codex CLI-1 空闲` 但进度 28%，预估剩余 1h 45m
- 两张 `Codex CLI-1` 卡片（PID 不同，数据雷同）— R5-N5 未修复

## 二、矛盾症状

**"空闲"与"进度 56%"同屏出现**说明：
- 状态机与进度计算是两套互不同步的系统
- 状态字段和进度字段分别取自不同 store 字段/不同扫描周期
- 没有"状态驱动进度可见性"的统一逻辑

## 三、验收契约

- [ ] 卡片显示遵守状态 → 进度的**强关联**规则：
  - `idle` → 不显示进度条，只显示时长
  - `thinking` → 进度条无限循环动画
  - `coding` → 进度条显示预估百分比（基于 token 速率或历史均值）
  - `waiting-input` → 进度条停在当前值 + 黄色提示
  - `completed` → 进度条到 100% 2s 后卡片折叠
- [ ] 重复卡片（R5-N5）修复：同一工具同一工作目录视为同一任务，即使 PID 变也复用同一卡片

## 四、关联

- `07-window-unmet-5-demands-revisit.md` § P4.2-b / § P4.2-d
- `09-ai-icons-emoji-not-logo.md` 同屏截图
- R5 N5：`prompts/0415/07-ai-task-icons-and-duplicates.md`
