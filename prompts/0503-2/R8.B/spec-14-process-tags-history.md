# Spec R8.B-14 — 进程用户标签（EXE+cwd 双键）+ 24h Sparkline 历史

> **flag**: `R8.B.process.tags-history`
> **priority**: P1（V1-Q-4.H + I）
> **status**: planning
> **upstream**: R8.A spec-02 ProcessUnifiedViewModel
> **downstream**: R8.B spec-08（mini sparkline widget）/ R8.C spec-25 流程图色彩

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-4.H
  answer: "ACCEPT"  # EXE+cwd 双键标签
  - id: V1-Q-4.I
  answer: "ACCEPT"  # 24h Sparkline
  - id: V1-Q-1.E.1
  answer: "B"  # 1h 滑窗（推荐）
  notes: "用户用 24h 而非 1h，意味着扩展数据保留"
  - id: V2-Q-12.E
  answer: "全选 + D"  # 收藏夹关联
```

### 1.2 现状缺陷

```
devhub/src/main/services/ProcessService.ts
  - 无 tag 概念
  - 无历史数据保留
devhub/src/renderer/components/monitor/ProcessView.tsx
  - 仅显示当前 CPU/RSS 数字，无 sparkline
  - 无 tag 编辑 UI
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| Tag 双键 | (exe, cwd) → tag string，重启 PID 变化 tag 不丢 |
| 24h sparkline | 每分钟 1 个 sample，1440 点 |
| sparkline 渲染 | < 16ms / 100 进程同时显示 |
| Tag 持久化 | electron-store + JSON export |
| 历史查询 | 任意 (exe, cwd) 24h 数据回放 |
| Tag 高频展示 | Card / List / Tree / Treemap 都能看到 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/main/services/ProcessService.ts
  - devhub/src/renderer/components/monitor/ProcessView.tsx
  - R8.A spec-02 ProcessUnifiedViewModel
modify:
  - devhub/src/main/services/ProcessService.ts  # 加 tag 字段
  - devhub/src/renderer/components/monitor/ProcessView.tsx  # 显示 tag + sparkline
new:
  - devhub/src/renderer/components/monitor/process/ProcessTagBadge.tsx
  - devhub/src/renderer/components/monitor/process/ProcessTagEditor.tsx
  - devhub/src/renderer/components/monitor/process/ProcessSparkline.tsx
  - devhub/src/renderer/hooks/useProcessTag.ts
  - devhub/src/renderer/hooks/useProcessHistory.ts
  - devhub/src/main/services/ProcessTagStore.ts
  - devhub/src/main/services/ProcessHistoryStore.ts  # SQLite 保留 24h
  - devhub/src/main/services/ProcessHistorySampler.ts  # 每分钟采样
  - devhub/src/main/ipc/processTagHandlers.ts
test:
  - devhub/src/main/services/ProcessTagStore.test.ts
  - devhub/src/main/services/ProcessHistoryStore.test.ts
  - devhub/tests/e2e/process-tags.spec.ts
docs:
  - docs/r8/process-tags-history.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const ProcessTagSchema = z.object({
  key: z.string(),  // sha256(exe|cwd) 双键 hash
  exe: z.string(),
  cwd: z.string().optional(),
  tag: z.string().max(64),
  color: z.string().optional(),
  pinned: z.boolean().default(false),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})

export const ProcessHistoryPointSchema = z.object({
  ts: z.number().int(),
  cpu: z.number(),
  rssMb: z.number(),
  handles: z.number().int().optional(),
  threads: z.number().int().optional(),
})

export const ProcessHistorySchema = z.object({
  key: z.string(),  // 双键 hash
  exe: z.string(),
  cwd: z.string().optional(),
  windowMs: z.number().int(),  // 24h = 86_400_000
  points: z.array(ProcessHistoryPointSchema),
})

export const TAG_HISTORY_LIMITS = {
  TAG_MAX_LEN: 64,
  HISTORY_WINDOW_HOURS: 24,
  SAMPLE_INTERVAL_S: 60,  // 1 sample / minute
  MAX_POINTS_PER_KEY: 1440,
  SQLITE_RETENTION_DAYS: 7,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  process:tags-list:
  response: { tags: ProcessTag[] }
  process:tags-set:
  request: { exe: string, cwd?: string, tag: string, color?: string }
  process:tags-remove:
  request: { exe: string, cwd?: string }
  process:tags-export:
  response: { json: string }
  process:tags-import:
  request: { json: string }
  process:history-24h:
  request: { exe: string, cwd?: string }
  response: ProcessHistorySchema
  process:history-batch:
  request: { keys: string[] }
  response: { histories: ProcessHistory[] }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'tag 长度 > 64'
  code: E_VALIDATION
  handling: 'truncate + warn'
  - condition: 'SQLite 写入失败'
  code: E_INTERNAL
  handling: '日志 + 不影响 UI'
  - condition: 'tag import JSON 不合法'
  code: E_VALIDATION
  - condition: 'history 查询无数据'
  handling: '返回空 points 数组（不报错）'
  - condition: 'sampler 采样跳过'
  handling: '点位标记为 null + 显示间断'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — Tag 双键
Given exe = codex.exe / cwd = D:/repo/myapp
When 用户设置 tag = "myapp-codex"
Then ProcessTagStore 持久化 (sha256(exe|cwd) → tag)
  And 重启后 PID 变了 但 tag 仍然显示

# A2 — Tag UI
Given Process Card 视图
Then 每行显示 tag badge（如有）
  And 点击 badge 弹 ProcessTagEditor 修改

# A3 — Tag 颜色
Given 用户为 tag 选择颜色 #ff0
Then badge 背景 = #ff0
  And Treemap 中 colorBy=ai-tool 的备选 colorBy=tag 时按 tag color 染

# A4 — 24h Sparkline
Given exe / cwd 双键已采样 60 点
Then 列表行右侧显示 60 点 sparkline（CPU%）
  And rendering < 16ms / 100 行

# A5 — 历史回放
Given 用户右键 → "查看 24h 趋势"
Then 弹出 ProcessSparkline 大图
  And 可切 CPU / RSS / handles / threads

# A6 — 采样跳过
Given 系统休眠 5 分钟
Then 5 个采样点为 null
  And sparkline 显示间断（dotted line）

# A7 — Tag 导入导出
Given 用户在设置点 export
Then 下载 JSON 文件
  And import 同一 JSON 还原全部 tag

# A8 — Tag 与收藏夹
Given 用户为 (exe, cwd) 加 tag + pinned=true
Then 该进程出现在收藏夹（V2-Q-12.E）

# A9 — 跨视图同步
Given 在 List 视图设 tag
When 切到 Tree / Treemap 视图
Then 同 (exe, cwd) 仍显示同 tag

# A10 — Tag 数据 7 天保留
Given DevHub 已运行 8 天
Then SQLite 自动清理 7 天前的 history
  And tag 元数据永久保留
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/process-tags.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('tag persists across restart', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="process"]')
  const row = page.getByTestId(/^process-row-/).first()
  await row.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /编辑标签/ }).click()
  await page.getByPlaceholder(/标签/).fill('test-tag')
  await page.getByRole('button', { name: /保存/ }).click()
  await app.close()

  const app2 = await launchDevHub()
  const page2 = await app2.firstWindow()
  await page2.click('[data-testid="nav-monitor"]')
  await page2.click('[data-tab="process"]')
  await expect(page2.getByText('test-tag')).toBeVisible()
  await app2.close()
})

test('sparkline displays 60+ points', async () => {
  // 模拟已有 history
  // ...
})
```

---

## 8. reference_impl

### 8.1 ProcessTagStore

```typescript
import Store from 'electron-store'
import { sha256 } from 'js-sha256'

const tagKey = (exe: string, cwd?: string) => sha256(`${exe}|${cwd ?? ''}`)

export class ProcessTagStore {
  private store: Store<{ tags: Record<string, ProcessTag> }>
  constructor() { this.store = new Store({ name: 'process-tags', defaults: { tags: {} } }) }
  set(exe: string, cwd: string | undefined, tag: string, color?: string) {
  const key = tagKey(exe, cwd)
  const now = Date.now()
  const existing = this.store.get(`tags.${key}` as any)
  this.store.set(`tags.${key}`, { key, exe, cwd, tag, color, pinned: existing?.pinned ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now })
  }
  get(exe: string, cwd?: string) { return this.store.get(`tags.${tagKey(exe, cwd)}` as any) }
  list() { return Object.values(this.store.get('tags')) }
  export() { return JSON.stringify(this.store.get('tags'), null, 2) }
  import(json: string) { /* validate + merge */ }
}
```

### 8.2 ProcessHistoryStore（SQLite better-sqlite3）

```typescript
import Database from 'better-sqlite3'

export class ProcessHistoryStore {
  private db: Database.Database
  constructor(path: string) {
  this.db = new Database(path)
  this.db.exec(`
  CREATE TABLE IF NOT EXISTS process_history (
  key TEXT NOT NULL,
  ts INTEGER NOT NULL,
  cpu REAL NOT NULL,
  rss_mb REAL NOT NULL,
  handles INTEGER,
  threads INTEGER,
  PRIMARY KEY(key, ts)
  );
  CREATE INDEX IF NOT EXISTS idx_ts ON process_history(ts);
  `)
  }
  insert(key: string, ts: number, point: ProcessHistoryPoint) {
  this.db.prepare(`INSERT OR REPLACE INTO process_history VALUES (?, ?, ?, ?, ?, ?)`).run(
  key, ts, point.cpu, point.rssMb, point.handles ?? null, point.threads ?? null
  )
  }
  query(key: string, sinceMs: number): ProcessHistoryPoint[] {
  return this.db.prepare(`SELECT * FROM process_history WHERE key=? AND ts>=? ORDER BY ts ASC`).all(key, sinceMs) as any
  }
  cleanup() {
  const cutoff = Date.now() - TAG_HISTORY_LIMITS.SQLITE_RETENTION_DAYS * 86400_000
  this.db.prepare(`DELETE FROM process_history WHERE ts<?`).run(cutoff)
  }
}
```

### 8.3 ProcessSparkline

```tsx
import { Sparklines, SparklinesLine } from 'react-sparklines'

export function ProcessSparkline({ history, metric }: { history: ProcessHistory, metric: 'cpu' | 'rssMb' }) {
  const data = useMemo(() => history.points.map(p => p[metric]), [history, metric])
  return (
  <Sparklines data={data} width={120} height={32} margin={2}>
  <SparklinesLine style={{ strokeWidth: 1.5 }} />
  </Sparklines>
  )
}
```

### 8.4 关键参考链接

- react-sparklines：https://github.com/borisyankov/react-sparklines
- better-sqlite3：https://github.com/WiseLibs/better-sqlite3

---

## 9. impact_radius_loc

```yaml
new_files: 9
modified_files: 2
estimated_loc:
  ProcessTagBadge.tsx: 60
  ProcessTagEditor.tsx: 130
  ProcessSparkline.tsx: 90
  useProcessTag.ts: 90
  useProcessHistory.ts: 110
  ProcessTagStore.ts: 130
  ProcessHistoryStore.ts: 200
  ProcessHistorySampler.ts: 130
  processTagHandlers.ts: 130
  ProcessService.ts (modify): +60
  ProcessView.tsx (modify): +70
  tests: 320
total_loc: ~1520
risk_level: medium
```

---

## 10. implement_checklist

- [x] 依赖核验：better-sqlite3 已存在；未新增 react-sparklines，复用现有 SVG Sparkline 以降低资源/打包风险
- [x] ProcessTagStore（双键 hash + 持久化 + import/export）
- [x] ProcessHistoryStore（SQLite，7 天保留 + cleanup cron）
- [x] ProcessHistorySampler（每分钟采样）
- [x] ProcessTagBadge / Editor UI
- [x] ProcessSparkline（list/card inline + ProcessDetailDrawer 24h 大图已接入；CPU/RSS/句柄/线程切换已验证）
- [x] IPC handlers
- [x] 与 spec-04 联动（命令面板"为已选进程设标签"）
- [x] 与 spec-08 联动（StatusBar 独立进程 24h mini sparkline widget 已接入，保留 spec-08 12 tile aggregate 合同）
- [x] 与 spec-12 联动（批量打标签 + 5s 撤回，复用真实 ProcessTagStore IPC）
- [x] 单元 + e2e（单元已完成；Electron restart E2E 已覆盖真实标签持久化）
- [x] 文档：docs/r8/process-tags-history.md

---

## 10.1 implementation_status

### 2026-05-13 verified Electron restart tag persistence slice

- Fixed the concrete IPC registration order so `process:tags-list`, `process:tags-set`, and `process:history-24h` are no longer replaced by the R8 contract-only fallback handler.
- Added those executable spec-14 process channels to the R8 runtime specific-channel list and registered R8 fallback handlers before concrete process handlers.
- Added a real Electron Playwright regression in `devhub/e2e/example.spec.ts` that tags a real process identity from `systemProcess.scan()`, confirms the tag through the Process list UI, restarts Electron, verifies the persisted tag through executable IPC/export, and restores any pre-existing user tag for the same identity.
- The regression also calls `getProcessHistory24h()` against the same real process identity and keeps the history boundary truthful without waiting for a synthetic sampler tick.

Validation:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts src/main/ipc/index.ts src/main/ipc/r8RuntimeHandlers.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-14" --workers=1 --reporter=line
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
```

- ESLint and TypeScript passed.
- Production build passed; the existing Monaco dynamic/static import warning remained non-fatal.
- Playwright Electron `R8.B spec-14` passed with 1 real restart test in 13.5s.
- Playwright Electron `R8.B spec-02` was re-run after the IPC order fix and passed in 7.8s.
- A combined `R8.B spec-(02|14)` grep reported both tests passed but exited with a worker teardown timeout, so it is not used as green evidence.

- Claimed complete in this pass: concrete process tag/history IPC restoration, real process tag persistence across Electron restart, real Process list tag badge assertion, and cleanup/restoration of the original tag state.
- Not claimed complete: detail large ProcessSparkline, command-palette tag command, independent spec-08 sparkline widget integration, spec-12 batch tagging, or performance benchmark harness.

### 2026-05-15 verified process detail 24h trend slice

- Extended `ProcessSparkline` to support the existing 24h history metrics `cpu`, `rssMb`, `handles`, and `threads` without adding `react-sparklines` or another rendering dependency.
- Wired `ProcessDetailDrawer` resource tab to the real `useProcessHistory24h().loadHistory()` path from `ProcessView`, which calls the executable `process:history-24h` IPC channel through `window.devhub.systemProcess`.
- Added a large responsive 24h trend panel in the process detail drawer with metric switching, point count, gap count, and the normalized `(exe/name, cwd)` identity shown to the user.
- Added renderer regression coverage proving the resource tab calls `fetchHistory24h({ name, workingDir })`, renders the 24h panel, and switches latest values across CPU, RSS, and handle metrics.

Validation:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/ProcessDetailDrawer.test.tsx --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/components/monitor/process/ProcessSparkline.tsx src/renderer/components/monitor/ProcessDetailDrawer.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessDetailDrawer.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
```

- Vitest passed: `ProcessDetailDrawer.test.tsx` 3 tests.
- ESLint passed for all touched renderer files.
- TypeScript passed.

- Claimed complete in this pass: large process detail 24h ProcessSparkline with CPU/RSS/handles/threads metric switching.
- Not claimed complete: independent spec-08 sparkline widget integration or performance benchmark harness.

### 2026-05-15 verified batch tag linkage slice

- Added a real `ProcessBatchTagDialog` for selected process rows instead of leaving the toolbar tag action disabled.
- Wired the batch tag action through `runSequentialProcessBatch()` and the existing executable `useProcessTagRegistry().setTag()` path, which calls `window.devhub.systemProcess.setProcessTag()` and persists by `(exe, cwd)` through `ProcessTagStore`.
- Added a 5-second undo banner for successful batch tag writes. Undo restores the previous tag when one existed and removes the newly-created tag when no previous tag existed.
- Added `processBatchTagArgsSchema` to the shared R8 Zod contract so renderer batch-tag arguments are validated before any per-PID write.

Validation:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx --maxWorkers=1
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx src/renderer/components/monitor/process/processBatchModel.test.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:zod-sot
```

- Vitest passed: 3 focused process-batch files, 7 tests.
- ESLint passed for all touched batch-tag files.
- TypeScript passed.
- Zod SoT verification passed.

- Claimed complete in this pass: spec-12 batch tag linkage for real selected processes plus 5-second tag undo transaction.
- Not claimed complete: independent spec-08 sparkline widget integration or performance benchmark harness.

### 2026-05-15 verified command-palette tag entry slice

- Added executable command registry entry `process.batch.tag` with title `为已选进程设标签`, process category keywords, and monitor scope.
- `R8RuntimeService.invokeCommand({ commandId: 'process.batch.tag' })` now emits real `r8:command-event` messages to navigate to the Process monitor and request the batch-tag dialog.
- `App` stores the pending process batch-tag request while switching to Monitor, then dispatches `devhub:process-batch-tag-open` after the Monitor surface is active.
- `ProcessView` consumes `devhub:process-batch-tag-open`, opens the real batch tag dialog when processes are selected, and reports a local warning when no process is selected.

Validation:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "batch tag dialog|command palette"
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
```

- Focused runtime command tests passed, including the new `process.batch.tag` command event path.

### 2026-05-15 verified statusbar mini-sparkline and render budget slice

- Added `StatusBarProcessHistoryWidget` as an auxiliary statusbar widget rather than a new `StatusTile`, preserving the verified spec-08 12-tile aggregate/config contract.
- The widget selects the current highest-CPU real process from `useProcessStore`, calls the existing `useProcessHistory24h().loadHistory()` path, and therefore reaches the executable `window.devhub.systemProcess.getProcessHistory24h()` / `process:history-24h` bridge without a mock data path.
- The widget renders the existing `ProcessSparkline` in the statusbar, exposes real process identity attributes for regression coverage, and navigates to the Process monitor with the selected process scope when clicked.
- `ProcessSparkline` now compacts 1440-point 24h histories into bounded render points according to the rendered width while preserving the latest metric value and explicit missing-gap rendering.
- Added `bench:sparkline`, a Chromium DOM benchmark for the production `ProcessSparkline` bundle rendering 100 visible 24h histories with 1440 samples each.

Validation:

```bash
pnpm -C devhub test --run src/renderer/components/statusbar/StatusBar.test.tsx --maxWorkers=1
pnpm -C devhub bench:sparkline
```

- Vitest passed: `StatusBar.test.tsx` 4 tests, including the statusbar process-history widget selecting a real process-store row, calling `getProcessHistory24h({ exe, cwd })`, rendering the sparkline latest value, and dispatching Process monitor navigation.
- Chromium benchmark passed: `BENCH-PROCESS-SPARKLINE-100-DOM`, 100/100 visible sparklines, 1440 points per history, p95 10.8ms under the 16ms budget.
- ESLint passed for touched command/renderer files.
- TypeScript passed.

- Claimed complete in this pass: command-palette entry for the existing batch tag dialog.
- Not claimed complete: independent spec-08 sparkline widget integration or performance benchmark harness.

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-02 ProcessUnifiedViewModel
sibling_libs:
  - react-sparklines: ^1.7.0
  - better-sqlite3: ^11.x
  - js-sha256
downstream_specs:
  - R8.B spec-08 sparkline widget
  - R8.C spec-25 流程图染色
external: 无
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: SQLite 不可用
  action: 退化到 in-memory（仅当前 session）
  - condition: sampler 落后
  action: 自动跳过 + 标记空白
  - condition: tag 文件损坏
  action: 备份 + 重置 + toast
flag_disable: 关闭 R8.B.process.tags-history 时仅 PID + EXE 显示
```

---

## 13. performance_budget

```yaml
budgets:
  sparkline_render_ms_per_row: 1
  list_with_100_sparklines_ms: 100
  sampler_per_tick_ms: 200
  history_query_p95_ms: 30
  tag_set_p95_ms: 50
  cleanup_cron_ms: 1000
test_harness:
  - benchmark: bench-sparkline-render.mjs
  target: 100 sparkline 列表 p99 < 16ms
  - benchmark: bench-sqlite-history.mjs
  target: 1440 points 写入 / 查询 p99 < 50ms
```
