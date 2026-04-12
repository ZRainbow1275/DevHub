# Design: Window Rename IPC Chain

> 日期: 2026-04-13
> 文件: `windowHandlers.ts`, `AIAliasManager.ts`, `WindowView.tsx`

---

## 问题分析

**结论：`window:rename` 专用 IPC 不需要新增**。`ai-alias:rename` 链路已完整：

| 层级 | 位置 | 内容 |
|------|------|------|
| handler | `aiTaskHandlers.ts:253` | `ipcMain.handle('ai-alias:rename')` |
| service | `AIAliasManager.ts:201-213` | `rename(aliasId, newName)` |
| preload | `extended.ts:309` | `aiAliasApi.rename()` |
| UI | `WindowView.tsx:1322` | 调用 rename |

### 真实问题

1. **alias 查找不可靠**: `WindowView.tsx:1316` 用 `matchCriteria.pid` 查找，但 pid 不持久化
2. **aliasStore 无 renameAlias 动作**: rename 后只能全量 `fetchAliases()` 刷新
3. **非 AI 窗口 rename 路径缺失**

---

## 推荐方案

1. 修复 `WindowView.tsx:1316` alias 查找逻辑 — 用 task.alias 查，fallback workingDir+toolType
2. `aliasStore.ts` 新增 `renameAlias(aliasId, newName)` 乐观更新
3. 非 AI 窗口不显示 rename 控件

---

## 影响文件

| 文件 | 修改内容 |
|------|--------|
| `src/renderer/stores/aliasStore.ts` | 新增 `renameAlias` |
| `src/renderer/components/monitor/WindowView.tsx` | 修复 alias 查找逻辑 |
