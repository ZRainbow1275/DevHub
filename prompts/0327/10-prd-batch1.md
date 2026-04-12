# PRD — Batch 1: 安全 + 工程基础修复

> 优先级: CRITICAL
> 类型: fullstack (main + renderer)
> 预估修改文件: 15-20 个

---

## Goal

修复所有 CRITICAL 和 HIGH 级别的安全漏洞与工程缺陷，使项目达到可安全运行的基线。

---

## Requirements

### R1: 验证函数统一 (SEC-05)
- 将所有分散的验证逻辑提取到 `src/main/utils/validation.ts`
- 包含: guardProtoPollution, validatePid, validatePort, validateHwnd, validatePath, validateTagOrGroup
- 所有 IPC handler 统一引用此文件
- 删除重复的内联验证代码

### R2: IPC 速率限制 (SEC-01)
- 在 `src/main/ipc/index.ts` 添加通用 `withRateLimit` 包装器
- 为所有扫描类 handler 添加速率限制 (12/min)
- 为操作类 handler 添加速率限制 (30/min)

### R3: 错误处理修复 (ENG-02)
- 为 MonitorPanel 中每个子视图添加独立 ErrorBoundary
- 修复 `ProjectList.tsx` 中 `shell.openPath()` 未捕获异常
- 修复 `SettingsDialog.tsx` 中 `settings.update()` 未捕获异常
- 为 `SystemProcessScanner` 和 `WindowManager` 添加结构化错误返回

### R4: 代码重复清理 (ENG-01)
- 提取 `ViewModeToggle` 共享组件
- 提取 `LoadingSpinner` 共享组件
- 提取 `LastScanTime` 共享组件
- 统一使用 `StatCard` 组件（移除内联实现）
- 统一原型污染检查到 validation.ts

### R5: 代码生成脚本处理 (ENG-04)
- 评估 scripts/*.cjs 与当前代码差异
- 如已过时则删除脚本文件
- 保留的脚本添加 `@generated` 标记

---

## Acceptance Criteria

- [ ] `src/main/utils/validation.ts` 存在且被所有 handler 引用
- [ ] 所有 IPC handler 有速率限制
- [ ] MonitorPanel 每个子视图有独立 ErrorBoundary
- [ ] `shell.openPath` 和 `settings.update` 有 try-catch
- [ ] ViewModeToggle, LoadingSpinner, LastScanTime 组件存在
- [ ] 无内联原型污染检查（全部引用 validation.ts）
- [ ] `pnpm build` 成功
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过

---

## Files to Modify (Estimated)

### New Files
- `src/main/utils/validation.ts`
- `src/renderer/components/ui/ViewModeToggle.tsx`
- `src/renderer/components/ui/LoadingSpinner.tsx`
- `src/renderer/components/ui/LastScanTime.tsx`

### Modified Files
- `src/main/ipc/index.ts` — 添加 withRateLimit, 引用 validation.ts
- `src/main/ipc/processHandlers.ts` — 引用 validation.ts
- `src/main/ipc/portHandlers.ts` — 引用 validation.ts
- `src/main/ipc/windowHandlers.ts` — 引用 validation.ts
- `src/main/ipc/notificationHandlers.ts` — 引用 validation.ts, 移除内联验证
- `src/main/ipc/taskHistoryHandlers.ts` — 引用 validation.ts, 移除内联验证
- `src/main/services/SystemProcessScanner.ts` — 结构化错误返回
- `src/main/services/WindowManager.ts` — 结构化错误返回
- `src/renderer/components/monitor/MonitorPanel.tsx` — 添加 ErrorBoundary
- `src/renderer/components/monitor/ProcessView.tsx` — 使用 ViewModeToggle, StatCard, LastScanTime
- `src/renderer/components/monitor/PortView.tsx` — 使用 ViewModeToggle, StatCard, LastScanTime
- `src/renderer/components/monitor/WindowView.tsx` — 使用 ViewModeToggle
- `src/renderer/components/project/ProjectList.tsx` — 添加 error handling
- `src/renderer/components/settings/SettingsDialog.tsx` — 添加 error handling

### Potentially Deleted Files
- `scripts/update-projectlist.cjs` (if outdated)
- `scripts/update-sidebar.cjs` (if outdated)
- `scripts/update-toolmonitor.cjs` (if outdated)

---

## Technical Notes

- 所有修改必须是非破坏性的（不改变已有功能行为）
- 验证函数使用 TypeScript assertion functions (`asserts x is T`)
- ErrorBoundary 使用已有的 `components/ErrorBoundary.tsx` 组件
- 速率限制使用内存计数器，无需外部依赖
