# Design: 终端信号融合 — AI 任务完成检测增强

> 日期: 2026-04-13
> 文件: `src/main/services/AITaskTracker.ts`

---

## 当前架构分析

### 已实现信号
- **Signal 1 — 终端输出关键词 (20%)**: 通过 `detectWindowTitlePattern` 读取窗口**标题**匹配 `COMPLETION_PATTERNS`
- **Signal 2 — CPU 活动变化 (25%)**: `SystemProcessScanner` 每 2s 轮询 CPU，存储 `cpuHistory`

### 假实现信号
- **Signal 3 — 终端输出速率 (20%)**: `AITaskTracker.ts:334-341` 用 `idleDuration > 5000ms` 代替，`outputRate` 字段从未被更新
- **Signal 4 — 输入提示符检测 (25%)**: `AITaskTracker.ts:343-346` 匹配窗口**标题**中的 `$/>` 等，但提示符出现在终端**内容**最后一行
- **Signal 5 — 子进程退出 (10%)**: `AITaskTracker.ts:348-351` 用 `idleDuration > 30000` 时间代理

### 核心挑战
AI 工具运行在**外部独立终端窗口**，其 stdout 已被 conhost.exe 消费，Electron 无法常规截获。

---

## 方案对比

| 方案 | 可行性 | 复杂度 | 精准度 | 目标信号 |
|------|--------|--------|--------|---------|
| A: ReadConsoleOutput Win32 | 低-中 | 高 | 高 | 1,3,4 |
| B: UI Automation TextPattern | 中-高 | 中 | 高(WinTerminal)/低(cmd) | 1,3,4 |
| C: conhost I/O delta | **高** | **低** | 中 | **3** |
| D: 进程树子进程变化 | **中** | **低-中** | 中 | **5** |

---

## 推荐方案：分阶段实施

### 第一阶段（高性价比，立即可行）— 方案 C + D

**Signal 3 修复**: 在 `SystemProcessScanner` 对 AI 进程采集 I/O 计数器，通过 `previousIOCounters: Map<number, number>` 计算 delta，得到 `outputRate`（字节/秒），更新 `task.metrics.outputRate`。

**Signal 5 修复**: 在 `AITaskTracker.updateTaskStatuses` 中维护 `_prevChildPids` 快照，每 5 个 refresh 周期调用 `getProcessTree`，检测子进程集合归零。

### 第二阶段（提升 Signal 4）— 方案 B

对 Windows Terminal 窗口通过 UI Automation 读取终端最后 3 行匹配 `PROMPT_PATTERNS`。其他终端降级到现有标题检测。

---

## 关键代码位置

| 位置 | 说明 |
|------|------|
| `AITaskTracker.ts:297-434` | 信号融合主循环 |
| `AITaskTracker.ts:334-351` | Signal 3/4/5 假实现（待修复）|
| `AITaskTracker.ts:244-250` | metrics 初始化（outputRate 从未更新）|
| `SystemProcessScanner.ts:573-577` | I/O 字节采集（现有可复用）|
| `SystemProcessScanner.ts:285-331` | getProcessTree（现有，未被调用）|
