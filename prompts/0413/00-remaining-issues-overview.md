# Code Review 遗留问题处理计划 — 2026-04-13

> 来源: 5-agent 并行 code review（2026-04-12）
> 总发现: 42 个问题，已修复 25 个，剩余 17 个
> 处理策略: 大项先出设计文档讨论，小项直接实施

---

## 一、大项（需设计文档 + 方案讨论）

| # | 文档 | 问题 | 影响面 | 复杂度 |
|---|------|------|--------|--------|
| D1 | `01-zustand-selector-refactor.md` | 8 个 hooks 全量解构无 selector，导致不必要重渲染 | 全前端性能 | 高 |
| D2 | `02-terminal-signal-fusion.md` | AI 任务感测缺终端输出速率、提示符检测、子进程退出信号 | 核心功能准确性 | 高 |
| D3 | `03-theme-runtime-manager.md` | useTheme 仅管理主题名，无运行时多维 token 管理 | 主题系统完整性 | 中高 |
| D4 | `04-font-bundling-strategy.md` | 字体从 Google CDN 加载，离线 + CSP 双重阻断 | 离线可用性 | 中 |
| D5 | `05-scanner-subscribe-lifecycle.md` | WeakSet 阻止 renderer 重连后收到快照推送 | 扫描数据推送可靠性 | 中 |
| D6 | `06-window-rename-chain.md` | window:rename IPC 通道完全缺失 | 窗口管理核��功能 | 中 |
| D7 | `07-aitask-confidence-state.md` | aiTaskStore 缺少置信度/信号权重/确认窗口状态 | AI 任务状态展示 | 中 |

## 二、中小项（直接实施）

| # | 文件 | 问题 | 复杂度 |
|---|------|------|--------|
| I1 | windowStore.ts | 缺少内置布局预设 (Tile/Cascade/Master-Slave) | 低 |
| I2 | aliasStore.ts | 无启动自动 hydration | 低 |
| I3 | processHandlers/windowHandlers | IPC 未用 Zod schema 校验 | 中 |
| I4 | tailwind.config.js | screens 断点不匹配自定义断点系统 | 低 |
| I5 | formatMetric.ts | switch 缺返回路径 | 低 |
| I6 | main/index.ts | saveLayoutOnExit 未实现 | 低 |
| I7 | scannerHandlers.ts | WeakSet 重连问题（快速修复版） | 低 |
| I8 | global.d.ts | AITaskStatistics 与 TaskStatistics 重复混淆 | 低 |
| I9 | security.ts | venv 检测标准不一致 | 低 |
| I10 | ProcessView.tsx:CompactProcessRow | cpu.toFixed NaN 防护（已部分修复，需确认） | 低 |

---

## 三、执行顺序

```
Phase 1 (立即): 中小项 I1-I10 并行修复
Phase 2 (讨论后): 大项 D1-D7 按设计文档实施
```
