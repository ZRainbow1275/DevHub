# Design: AI Task Confidence State

> 日期: 2026-04-13
> 文件: `aiTaskStore.ts`, `AITaskTracker.ts`, `types-extended.ts`

---

## 问题分析

`aiTaskStore.ts` 仅有 `activeTasks/history/statistics/selectedTaskId`，后端有但前端未暴露：

1. **PhaseSignals**: `confidence` + `indicators`，不存储在 AITask，不通过 IPC 发送
2. **信号权重**: `AITaskDetectionConfig` 为私有，无 IPC 暴露
3. **确认窗口状态**: `confirmationTimers` 内部不暴露
4. **误报计数**: `falsePositiveCount` 完全不暴露

---

## 推荐方案：两步走

### Step 1（纯前端，立即可做）
- `aiTaskStore.ts` 加 `detectionConfigs: Record<string, AIToolDetectionConfig>` 缓存
- `useAITasks.ts` 加 `fetchDetectionConfig(toolType)`
- UI 用已有 `task.status.progressEstimate.confidence` 显示置信度

### Step 2（需后端配合）
- `types-extended.ts` AITask 加 `detectionSignals?: { completionScore, phaseConfidence, activeIndicators, inConfirmationWindow, confirmationRemainingMs? }`
- `AITaskTracker.updateTaskStatuses()` 填充 detectionSignals
- UI 显示信号条/置信度/确认倒计时

---

## 影响文件

| 文件 | Step |
|------|------|
| `src/renderer/stores/aiTaskStore.ts` | 1 |
| `src/renderer/hooks/useAITasks.ts` | 1 |
| `src/shared/types-extended.ts` | 2 |
| `src/main/services/AITaskTracker.ts` | 2 |
