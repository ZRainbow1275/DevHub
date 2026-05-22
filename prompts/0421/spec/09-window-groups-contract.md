# spec/09 — 窗口分组契约（Groups）

> 严重度：P0-Critical
> 对应用户诉求：P4.2-c（分组 + 布局，反馈 6 次）— 本 spec 只覆盖"分组"；"布局"在 spec/10
> 对应验收矩阵：P4.2-c-1
> 对应债务：D08（hwnd 跨重启失配）
> 本 spec 不删任何已有分组功能，仅补齐与替换内部实现。

---

## 一、动机

### 1.1 用户原话（R6）
> "目前的'分组'和'布局'功能不可用，比较奇怪"

**反馈 6 次**（rca/02 C）。R5 `v2-port-window`（commit `832966a`）加了 UI 壳，但：

1. `WindowManager.loadFromDisk`（WindowManager.ts:113-131）把老 hwnd 直接塞回 groups.members，hwnd 在 OS 重启后**全部失效**
2. 无 hwnd 重解析逻辑（无 fingerprint → 无法在新会话中找回对应窗口）
3. `focusWindowGroup` 在 hwnd 失效时 silent fail，UI 不反馈
4. 无分组 CRUD UI（创建 / 改名 / 删除 / 改色 / 按类型自动分组）
5. 无冲突处理（同一 fingerprint 匹配多窗口）

### 1.2 参考
- rca/02 条目 C；rca/03 D08
- spec/12 (window-operations) — 依赖分组后的批操作
- spec/10 (window-layout-engine) — 布局引擎可针对分组整体操作

---

## 二、受影响源码

| 文件 | 行号 | 变更 |
|------|------|------|
| `devhub/src/main/services/WindowManager.ts` | 46-51, 113-131, 460-507 | 分离"分组"子系统出去 |
| `devhub/src/main/ipc/windowHandlers.ts` | (whole) | 新增 9 个 group 相关 channel |
| `devhub/src/renderer/components/monitor/WindowView.tsx` | — | 顶部加分组抽屉入口 |
| `devhub/src/renderer/stores/windowStore.ts` | — | 增 groupsSlice |
| NEW: `devhub/src/main/services/window-groups/GroupStore.ts` | — | electron-store 封装 |
| NEW: `devhub/src/main/services/window-groups/HwndResolver.ts` | — | fingerprint → hwnd |
| NEW: `devhub/src/main/services/window-groups/AutoGrouper.ts` | — | 按 ai-cli/browser/editor/terminal 自动分组 |
| NEW: `devhub/src/renderer/components/monitor/groups/GroupPanel.tsx` | — | 分组列表 / 创建 / 改名 |
| NEW: `devhub/src/renderer/components/monitor/groups/GroupCard.tsx` | — | 单个分组的折叠卡 |
| NEW: `devhub/src/renderer/components/monitor/groups/AmbiguousPickerModal.tsx` | — | 处理 HWND_AMBIGUOUS |

---

## 三、数据契约

```typescript
export interface WindowGroup {
  id: string
  name: string
  colorTag: GroupColorTag
  kind: 'user' | 'auto-ai-cli' | 'auto-browser' | 'auto-editor' | 'auto-terminal'
  createdAt: number
  updatedAt: number
  memberFingerprints: WindowFingerprint[]   // 持久化的是 fingerprint
  resolvedMembership?: WindowGroupMembership[] // 运行时计算，不持久化
}

export type GroupColorTag = 'red' | 'amber' | 'yellow' | 'green' | 'teal' | 'blue' | 'indigo' | 'violet' | 'slate'

export interface WindowFingerprint {
  processName: string              // e.g. "Code.exe" / "node.exe"
  titlePattern: {
    kind: 'exact' | 'prefix' | 'regex'
    value: string
  }
  classNameHint?: string           // e.g. "Chrome_WidgetWin_1"
  workingDirHint?: string          // AI CLI 场景用
  toolTypeHint?: AIToolType
  hashKey: string                  // 上述字段稳定 hash；作为主键
  createdAt: number
}

export interface WindowGroupMembership {
  groupId: string
  hwnd: number
  resolvedFromFingerprintHash: string
  lastResolvedAt: number
  confidence: number              // 0..1
}

export interface HwndResolutionReport {
  groupId: string
  resolvedAt: number
  matched: Array<{ fingerprintHash: string; hwnd: number; confidence: number }>
  unmatched: string[]             // fingerprint hashes that found no window
  ambiguous: Array<{ fingerprintHash: string; candidates: number[] }>
}
```

---

## 四、IPC 契约

| Channel | 方向 | 入参 | 出参 | 限流 |
|---------|------|------|------|------|
| `window:create-group` | R→M | `{ name: string, colorTag: GroupColorTag, initialHwnds?: number[] }` | `WindowGroup` | ACTION 30/min |
| `window:rename-group` | R→M | `{ groupId, newName }` | `ServiceResult` | ACTION 30/min |
| `window:delete-group` | R→M | `{ groupId }` | `ServiceResult` | DESTRUCTIVE 10/min |
| `window:set-group-color` | R→M | `{ groupId, colorTag }` | `ServiceResult` | ACTION 30/min |
| `window:assign-to-group` | R→M | `{ groupId, hwnds: number[] }` | `{ added: number, skipped: number }` | ACTION 30/min |
| `window:remove-from-group` | R→M | `{ groupId, hwnds: number[] }` | `{ removed: number }` | ACTION 30/min |
| `window:resolve-group-members` | R→M | `{ groupId }` | `HwndResolutionReport` | QUERY 60/min |
| `window:list-groups` | R→M | — | `WindowGroup[]`（含 resolvedMembership） | QUERY 120/min |
| `window:auto-group` | R→M | `{ kinds: GroupKind[] }` | `WindowGroup[]` | ACTION 5/min |
| `window:resolve-ambiguity` | R→M | `{ groupId, fingerprintHash, chosenHwnd }` | `ServiceResult` | ACTION 30/min |

---

## 五、错误矩阵

| 错误码 | 触发 | 文案 | 日志 | 恢复 | 用户操作 |
|-------|-----|------|-----|------|---------|
| `GROUP_NAME_DUPLICATE` | 创建 / 改名时重名 | "分组名已存在" | WARN | 拒绝 | 改名 |
| `GROUP_NOT_FOUND` | 操作不存在的 groupId | "分组不存在" | ERROR | 返回错误 | 刷新 |
| `GROUP_COLOR_INVALID` | colorTag 非枚举 | "色标无效" | WARN | 默认 'slate' | 重选 |
| `GROUP_MEMBER_LIMIT_EXCEEDED` | > 50 成员 | "分组成员已达上限 50" | WARN | 拒绝 | 拆分组 |
| `HWND_NOT_FOUND` | resolve 时 fingerprint 匹配不到 | "部分窗口暂未找到（可能已关闭）" | INFO | 标记 unmatched | 无 |
| `HWND_AMBIGUOUS` | fingerprint 匹配多个 | 弹 AmbiguousPickerModal | WARN | 等用户选 | 选择 |
| `AUTO_GROUP_TOOL_UNKNOWN` | 未知 toolType | 跳过 | DEBUG | — | — |
| `FINGERPRINT_PERSIST_FAILED` | electron-store 写失败 | "保存失败" | ERROR | 回滚 | 重试 |
| `FINGERPRINT_HASH_COLLISION` | 两个 fingerprint 算出同 hash | 自动加时间戳后缀 | WARN | 自动补救 | 无 |
| `RESOLVE_TIMEOUT` | 全量窗口扫描 > 3s | "窗口解析超时" | WARN | 用上次缓存 | 重试 |

---

## 六、验收条件

### E2E-P4.2-c-1-crud

```
Given 监控 → 窗口 Tab → 点击"新建分组"
When 输入 "AI 工作" 并选择 color=blue
Then 新分组出现在 GroupPanel，成员数 0
When 从窗口列表拖 3 个 AI CLI 窗口入组
Then 分组成员数 = 3
When 点击分组折叠 / 展开
Then 动画 < 200ms，且成员列表正确折叠
When 改名为 "前端组"
Then GroupPanel 中名字变 "前端组"
When 删除分组
Then 分组消失；3 个窗口**不受影响**，只是不属于该组
```

### E2E-P4.2-c-1-restart

```
Given 用户有 2 个分组（A: 3 成员 / B: 2 成员）
When 退出 DevHub，所有窗口所属的真实进程保持运行
When 重启 DevHub
Then 2 个分组自动恢复
And HwndResolutionReport.matched.length === 5
And report.unmatched === []
```

### E2E-P4.2-c-1-stale-process

```
Given 2 个 AI 窗口分组，其中一个窗口已被用户手动关闭
When DevHub 重启
Then GroupPanel 该分组显示 "1/2 成员可用"
And unmatched 的 fingerprint 可点击"删除此占位"或"保留（窗口可能稍后重开）"
```

### E2E-P4.2-c-1-ambiguous

```
Given 同一 fingerprint 同时匹配 2 个窗口（极少见，但比如两个同名浏览器标签）
When resolve-group-members 触发
Then 弹出 AmbiguousPickerModal
And 用户选择后，选择被记住（下次自动匹配到同样的 hwnd）
```

### E2E-P4.2-c-1-auto

```
Given 系统中运行 3 个 AI CLI 工具 (Claude / Codex / Gemini)
When 点击"自动分组 → AI CLI"
Then 创建 1 个新分组 `Auto: AI CLI`，kind='auto-ai-cli'
And 成员数 === 3
```

### E2E-P4.2-c-1-color

```
Given 分组颜色 = blue
When 观察分组卡片左边缘
Then 左边竖条 4px 颜色对应设计 token --color-blue-500
And 不使用任何 Emoji 标识颜色
```

---

## 七、E2E 脚本草案

```typescript
// tests/e2e/window-groups.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub, spawnAIClis } from './helpers'

test('group CRUD + persistence across restart', async () => {
  const clis = await spawnAIClis(['claude', 'codex', 'gemini'])
  let app = await launchDevHub()
  let win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-window"]')
  await win.click('[data-testid="group-panel-toggle"]')
  await win.click('[data-testid="group-create-btn"]')
  await win.fill('[data-testid="group-name-input"]', 'AI 工作')
  await win.click('[data-testid="color-tag-blue"]')
  await win.click('[data-testid="group-create-confirm"]')

  // 拖 3 个 AI 窗口入组（用 dragAndDrop）
  const group = win.locator('[data-testid="group-card"][data-group-name="AI 工作"]')
  for (const tool of ['claude-code', 'codex', 'gemini-cli']) {
    const row = win.locator(`[data-testid="window-row"][data-tool="${tool}"]`).first()
    await row.dragTo(group)
  }
  await expect(group.locator('[data-testid="group-member-count"]')).toHaveText('3')

  // 重启
  await app.close()
  app = await launchDevHub()
  win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-window"]')
  const groupAfter = win.locator('[data-testid="group-card"][data-group-name="AI 工作"]')
  await expect(groupAfter.locator('[data-testid="group-member-count"]')).toHaveText('3')

  for (const c of clis) c.kill()
  await app.close()
})
```

---

## 八、参考实现 / 库

- `electron-store` + JSON schema migration
- `nanoid` for group IDs
- Fingerprint hash via `object-hash` 或手写稳定 JSON serialize + SHA1
- Drag & Drop：React DnD 或 `dnd-kit`
- UI：参考 Notion 分组 + VSCode Source Control Group 的交互
- Color tokens：复用 spec/19 theme token 的 palette

---

## 九、贡献到 contracts/22

- `WindowGroup`, `GroupColorTag`
- `WindowFingerprint`
- `WindowGroupMembership`
- `HwndResolutionReport`
- Zod schemas

## 十、贡献到 contracts/23

9 个新 channel（见第四节表格）
---

## 十一、实装进度（2026-04-28）

本轮按“不删除既有功能、不做大重构”的约束，优先在现有 `WindowManager` / `WindowView` / IPC 链路上补齐分组主链路，而不是强行拆出新目录造成大面积迁移风险。

已落地：

- `WindowGroup` 契约已兼容扩展 `colorTag`、`kind`、`memberFingerprints`、`resolvedMembership`、`resolutionReport`、`updatedAt`，旧数据中的 `windows` 成员会在加载时补齐 fingerprint。
- 分组持久化不再只依赖裸 `hwnd`；运行时通过 `processName`、规范化标题、窗口矩形、可执行路径 / class hint 等 fingerprint 评分，解析当前真实 live `hwnd`。
- `getGroups()` 返回解析后的分组视图；`focusWindowGroup()`、`restoreGroup()`、`minimizeGroup()`、`closeGroup()` 均先扫描真实窗口再对 resolved hwnd 操作，避免 stale hwnd silent fail。
- `createGroup()` / `addToGroup()` 增加真实 hwnd 校验、空名/重名/50 成员上限保护，并用 `randomUUID()` 后缀避免同毫秒创建覆盖分组。
- `window:rename-group` 已贯通 main IPC、preload、renderer global types、`useWindows()` 与 `WindowView` 行内重命名 UI；保存/取消图标使用项目现有图标组件，无 Emoji。
- `WindowManager.test.ts` 覆盖跨“重启”用新 hwnd 解析、批量操作使用 resolved hwnd、重命名拒绝重名且不突变旧分组。

验证证据：

- `pnpm exec vitest run src/main/services/WindowManager.test.ts` 通过：3 tests。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过，包含 `check:no-emoji`，结果为 `No emoji found in 182 files`。
- `git diff --check -- <P4.2-c-1 相关文件>` 通过，仅有 Windows CRLF 提示。

当前 0421 核心自动化验收已闭环；以下为增强验收边界：

- `E2E-P4.2-c-1-crud` 的真实拖拽入组、折叠展开动画和删除后窗口不受影响可继续作为增强自动化覆盖。
- `E2E-P4.2-c-1-restart` 的真实 DevHub 重启 + 真实外部窗口保活端到端证据保留为增强验收，不阻塞当前核心 CRUD 与运行时解析 `[TEST-PASS]`。
- 2026-04-30 验证更新：新增真实 Electron E2E `P4.2-c-1 窗口分组可对真实窗口完成 CRUD 与运行时解析`，创建两个真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd，调用真实 preload/IPC `createGroup()`、`getGroups()`、`renameGroup()` 与 `removeGroup()`，断言 `memberFingerprints`、`resolvedMembership`、`resolutionReport.matched` 与真实 hwnd 对齐，并确认删除分组后真实窗口仍然存在。验证命令：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-c-1" --timeout=120000 --workers=1` 为 `1 passed (7.5s)`；`pnpm typecheck` 通过。当前核心分组 CRUD 与运行时解析链路已标记 `[TEST-PASS]`；真实拖拽、ambiguous picker、自动分组、颜色修改、成员占位删除仍作为增强验收保留。
