# Task: devhub-monitor-fix

## Overview

修复 DevHub 监控系统中的两个关键 bug：(1) 过期完成通知反复弹出——即使 AI CLI 早已结束甚至崩溃，"XXX completed work, took X seconds" 通知仍持续出现；(2) 应用崩溃——`Cannot read properties of undefined (reading 'onDetected')` 错误导致 AppContent 渲染失败。

## Requirements

### Bug 1: 过期完成通知重复出现

- 修复 `ToolMonitor.checkTools()` 中当 `getAllProcessNames()` 失败时直接 return 但不更新 `previousStatus` 的问题——这导致下次成功检查时误判"从 running 到 stopped"的状态转变，重复触发完成通知
- 在通知层添加去重机制——同一工具的完成通知在合理时间窗口内只发送一次
- 协调 `ToolMonitor`（进程名检测）和 `AITaskTracker`（PID 追踪）两个独立触发源，避免同一完成事件被两个系统各发一次通知
- 确保 `before-quit` 事件处理中，`toolMonitor.stop()` 在任何可能触发通知的操作之前调用，避免退出时发出虚假完成通知

### Bug 2: `onDetected` undefined 崩溃

- 在 `useProjects.ts` 第 48 行的 `window.devhub.projects.watcher.onDetected` 访问处添加可选链（optional chaining）防护
- 审查并修复项目中所有类似的深层属性访问（`window.devhub.X.Y.Z` 模式），确保一致使用可选链
- 在 `useProjects` hook 的 useEffect 中添加对 `watcher` 对象存在性的守卫检查

### 通用改进

- 确保所有 `setInterval`/`setTimeout` 在组件卸载或服务停止时正确清理
- 添加监控生命周期管理的防御性检查——在已停止的监控器上调用操作应为 no-op

## Acceptance Criteria

- [ ] **Bug 1 修复验证**：当 CLI 工具进程结束时，完成通知仅弹出一次（而非反复弹出）
- [ ] **Bug 1 边缘情况**：当进程扫描失败（`getAllProcessNames()` 抛出异常）后恢复时，不会产生虚假的完成通知
- [ ] **Bug 1 去重**：`ToolMonitor` 和 `AITaskTracker` 同时检测到完成时，用户只收到一条通知
- [ ] **Bug 2 修复验证**：当 `window.devhub.projects.watcher` 为 undefined 时，应用不崩溃，gracefully 降级
- [ ] **Bug 2 一致性**：所有 `window.devhub.*` 深层访问均使用可选链防护
- [ ] **生命周期**：调用 `toolMonitor.stop()` 后不再触发任何完成回调或通知
- [ ] **清理**：所有定时器（interval/timeout）在监控停止时正确清除
- [ ] **回归测试**：`ToolMonitor.test.ts` 扩展覆盖——检查失败后的状态处理、去重逻辑
- [ ] **类型安全**：`global.d.ts` 中 `watcher` 相关类型标记为可选（反映运行时可能不存在的情况）

## Technical Notes

1. **双重通知系统**：完成通知同时由 `ToolMonitor`（通过进程名检测，`main/index.ts:179-191`）和 `AITaskTracker`（通过 PID 追踪，`aiTaskHandlers.ts:27-54`）两个独立系统触发。二者之间没有协调机制。推荐策略：在 `NotificationService` 层添加通知去重（基于 toolId + 时间窗口），同时在各自的生产侧修复根本原因。

2. **ToolMonitor 状态不一致根因**：`checkTools()` 第 155-160 行，当 `getAllProcessNames()` 失败时直接 return，`previousStatus` map 中仍保留上次的 `true`（running）状态。下次成功检查时 `wasRunning=true && isRunning=false` 的条件成立，错误触发 `onCompletion` 回调。修复方案：在失败路径中不 return，而是跳过状态变更检测，或者将 `previousStatus` 清除。

3. **onDetected 防护**：`useProjects.ts` 中 `window.devhub.projects.watcher.onDetected` 需要可选链。对比 `useAITasks.ts` 已使用 `window.devhub?.aiTask?.onStarted?.()` 模式，`useProjects.ts` 应保持一致。

4. **AITaskTracker 条件启动问题**：`main/index.ts` 中 ToolMonitor 受 `settings.notification.enabled` 控制，但 AITaskTracker 在 `aiTaskHandlers.ts` 中无条件启动。关闭通知不会阻止 AITaskTracker 发送完成通知。需要统一控制逻辑。

5. **退出时序**：`before-quit` 事件处理中（`main/index.ts:208-219`），应在 `processManager.stopAll()` 之前先调用 `toolMonitor.stop()`，避免进程终止被误判为正常完成。

## Out of Scope

- 重构整个监控架构（仅修复当前 bug，不改变双系统并存的整体设计）
- 添加新的监控功能或通知类型
- 修改 UI 组件的通知展示样式
- 性能优化（轮询间隔调整等）
- 后端/API 层的变更
