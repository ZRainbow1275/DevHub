# Design: Scanner Subscribe Lifecycle

> 日期: 2026-04-13
> 文件: `src/main/ipc/scannerHandlers.ts`

---

## 问题分析

`scannerHandlers.ts:6` 的 `WeakSet<Electron.WebContents>` 在 renderer reload 后阻止重新推送 snapshot。

**实际影响范围**：
- `getSnapshot()` 走独立 `ipcMain.handle` 不受影响
- diff 推送走 `BackgroundScannerManager` 直接 `webContents.send()` 不受影响
- **真实 bug**: renderer 监听 `scanner:snapshot:push` 期待被动推送，reload 后同一 WebContents 仍在 WeakSet，`subscribe()` 被忽略

`destroyed` 监听器是空的（依赖 GC），但 `reload()` 不销毁对象。

---

## 推荐方案：移除 dedup（方案 B）

subscribe 语义本身就是"我准备好接收数据"，重复推送无害。

1. 删除 `subscribedSenders` WeakSet
2. 每次 subscribe 直接推送 snapshot
3. 已有 `isDestroyed()` 保护

**注：此修复已在 I7（fix-remaining agent）中实施完成。**

---

## 影响文件

| 文件 | 状态 |
|------|------|
| `src/main/ipc/scannerHandlers.ts` | 已修复 |
