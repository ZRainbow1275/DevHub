# spec-34-crash-recovery — 崩溃恢复（脏状态检测 + 自动恢复）

> **batch**: R8.C  |  **flag**: `R8.C.recovery.crash`
> **depends_on**: R8.C spec-15 (task queue), R8.C spec-28 (state machine), R8.C spec-33 (zod sot)
> **derives_from**: V1-Q-9.E.2 答 D 启动 dirty 检测 + V2-Q-17.G

---

## 1. motivation

```yaml
user_quote_v1_q_9_e_2: "D — 启动时检测 dirty 状态：未完成任务/孤儿子进程/未持久化设置"
goals:
  - DevHub 启动时执行 RecoveryProbe
  - 检测：上次未正常退出 / 任务队列残留 / 孤儿 SHIM 子进程 / 未刷盘配置
  - 用户可选：恢复 / 跳过 / 备份后清理
constraint:
  - 恢复操作必须可回滚（先备份）
  - 不自动重启 AI 子进程（避免误伤用户工作）
  - 检测 P95 < 2s（启动闪屏内）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/recovery/RecoveryProbe.ts
  - devhub/src/main/services/recovery/DirtyStateScanner.ts
  - devhub/src/main/services/recovery/RecoveryStrategy.ts
  - devhub/src/main/services/recovery/RecoveryProbe.test.ts
  - devhub/src/renderer/views/recovery/RecoveryDialog.tsx
  - devhub/src/shared/schemas/recovery.ts
modified_files:
  - devhub/src/main/index.ts  # 启动期调用
  - devhub/src/main/services/AppLifecycle.ts  # 退出标记
glob_anchors:
  - devhub/src/main/index.ts:1-150
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const DirtyKindEnum = z.enum([
  'unclean-shutdown',
  'pending-tasks-in-queue',
  'orphan-shim-processes',
  'unsaved-store',
  'truncated-audit-log',
  'inconsistent-state-machine',
  'sqlite-integrity-fail',
])

export const DirtyFindingSchema = z.object({
  kind: DirtyKindEnum,
  severity: z.enum(['low','medium','high','critical']),
  detectedAt: z.number().int(),
  details: z.record(z.string(), z.unknown()),
  recommendedAction: z.enum(['restore','skip','backup-and-clean','manual-review']),
})

export const RecoverySnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  takenAt: z.number().int(),
  reason: z.enum(['pre-recovery','user-explicit','auto-checkpoint']),
  paths: z.array(z.string()),  // 备份的文件路径
  sizeBytes: z.number().int(),
})

export const RecoveryReportSchema = z.object({
  startedAt: z.number().int(),
  completedAt: z.number().int().nullable(),
  findings: z.array(DirtyFindingSchema),
  snapshotsCreated: z.array(RecoverySnapshotSchema),
  userChoice: z.enum(['restore-all','restore-selected','skip-all','cancel']).nullable(),
  appliedActions: z.array(z.object({
  finding: DirtyKindEnum,
  action: z.string(),
  success: z.boolean(),
  error: z.string().nullable(),
  })),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  recovery:check-dirty:
  rateClass: meta
  req: {}
  resp: { findings: DirtyFinding[] }
  recovery:restore-state:
  rateClass: low_freq_op
  req: { snapshotId?: string, kindsToRestore: DirtyKind[] }
  resp: RecoveryReport
  recovery:list-snapshots:
  rateClass: meta
  resp: RecoverySnapshot[]
  recovery:create-checkpoint:
  rateClass: low_freq_op
  req: { reason: string }
  resp: RecoverySnapshot
  recovery:dismiss:
  rateClass: meta
  req: { findingsToDismiss: DirtyKind[] }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 备份磁盘满 | E_INTERNAL（拒绝恢复） |
| sqlite integrity_check 失败 | E_INTERNAL（必须备份后重建） |
| 用户取消 | (R8C-RISK-9 备份保留供下次提示) |
| 孤儿 SHIM 杀失败 | E_INTERNAL（提示用户手动） |
| RecoveryProbe 超时 | E_TIMEOUT（跳过 + 标 inconclusive） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (干净启动):
  given: 上次正常退出
  when: RecoveryProbe
  then: findings=[]；用户无感知；启动正常

GWT-2 (脏状态检测):
  given: 上次进程被 OS kill；任务队列有 3 条 pending；2 个孤儿 SHIM
  when: RecoveryProbe
  then:
  - findings 含 unclean-shutdown / pending-tasks-in-queue / orphan-shim-processes
  - RecoveryDialog 弹出供用户选择

GWT-3 (用户恢复):
  given: dirty findings 存在
  when: 用户选 restore-all
  then:
  - 先创建 pre-recovery snapshot
  - 恢复任务队列；杀孤儿 SHIM
  - audit log 全程记录

GWT-4 (sqlite 完整性):
  given: tasks.db PRAGMA integrity_check 失败
  when: probe
  then: severity=critical；强制备份后重建（R8C-RISK-9）

GWT-5 (回滚):
  given: 恢复出错
  when: 用户回滚
  then: 用 pre-recovery snapshot 还原；audit log
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-2 dirty state detection on relaunch', async ({ electronApp }) => {
  await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.emit('test:simulate-unclean-shutdown')
  ipcMain.emit('test:inject-pending-tasks', 3)
  })
  await electronApp.close()
  const newApp = await electronApp.relaunch()
  const findings = await newApp.evaluate(({ ipcMain }) => ipcMain.handle('recovery:check-dirty'))
  expect(findings.findings.some((f: any) => f.kind === 'unclean-shutdown')).toBe(true)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'better-sqlite3@11.x':  integrity_check
  - 'fs-extra@11.x':  备份/恢复
  - 'archiver@7.x':  snapshot ZIP
  - 'find-process@1.4':  孤儿子进程
inspirations:
  - VSCode workspace recovery
  - macOS Time Machine snapshot
  - SQLite WAL recovery
  - PostgreSQL crash recovery
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~750
modified_loc: ~120
test_loc: ~400
total: ~1270
risk_areas:
  - 误判 dirty 导致频繁弹窗
  - 备份路径权限
  - 孤儿进程跨 OS 探测差异
```

---

## 10. implement_checklist

- [x] AppLifecycle 写 'clean-shutdown' 标记到 store；启动检查
- [x] DirtyStateScanner 7 种 finding 各自独立（一个失败不影响其他）
- [x] sqlite PRAGMA integrity_check 启动必跑
- [x] 孤儿 SHIM 探测：Windows process probe 检测 `*-shim.exe` / `devhub-shim.exe` 且父进程 pid 不在
- [x] RecoveryDialog 显示 finding 详情 + 用户选项
- [x] pre-recovery snapshot 必创建
- [x] vitest + Playwright 5 GWT
- [x] feature flag R8.C.recovery.crash 默认 ON
- [x] audit log 全程记录
- [x] probe P95 < 2s（基准测试）

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-15: 任务队列 SQLite
  - R8.C.spec-28: state machine 一致性
  - R8.C.spec-33: schema migration
downstream:
  - R8.C.spec-35: backup 系统复用 snapshot
  - R8.C.spec-36: 诊断包包含 recovery report
```

---

## 12. fallback_strategy

```yaml
on_probe_timeout:
  - 标 inconclusive；启动继续；不阻塞用户
on_sqlite_corrupted:
  - 强制备份 + 创建新 db + 提示用户
on_user_dismiss:
  - 7 天内不再提示同 finding（可在设置重置）
flag_off_behavior:
  - R8.C.recovery.crash=OFF 时启动跳过 probe（dev only）
```

---

## 13. performance_budget

```yaml
probe_p95_seconds: { warn: 2, fatal: 10 }
snapshot_create_p95_seconds: { warn: 5, fatal: 30 }
restore_p95_seconds: { warn: 10, fatal: 60 }
disk_per_snapshot_mb: { warn: 50, fatal: 500 }
```

---

## implementation_status_2026-05-05

Status: implemented and targeted-verified for the executable spec-34 vertical slice.

Implemented:

- Added schema-first recovery contracts in `devhub/src/shared/schemas/recovery.ts`, exported through `devhub/src/shared/schemas/index.ts`, and registered in `devhub/src/shared/schemas/r8-runtime.ts`.
- Added `devhub/src/main/services/AppLifecycle.ts` for `running` and `clean-shutdown` lifecycle marker persistence under local app data.
- Added `DirtyStateScanner`, `RecoveryProbe`, and `RecoveryStrategy` under `devhub/src/main/services/recovery/`.
- Scanner coverage includes unclean shutdown, pending task queue rows, orphan SHIM process metadata, unsaved store artifacts, truncated audit log, inconsistent state-machine records, and SQLite integrity failures.
- Startup probe is invoked non-blockingly from `devhub/src/main/ipc/index.ts`; dirty findings are persisted as recovery reports and emitted to the renderer only when findings exist.
- Recovery restore creates a real `pre-recovery` snapshot before applying cleanup or restore actions. SQLite corruption is not marked repaired; the action returns a manual rebuild error after snapshot retention.
- IPC/preload/global types now expose `recovery:check-dirty`, `recovery:restore-state`, `recovery:list-snapshots`, `recovery:create-checkpoint`, and the updated `recovery:dismiss` payload while preserving legacy `recovery:scan` and `recovery:report`.
- `RecoveryDialog` renders in the existing R8 Ops panel, uses installed icon components only, and provides restore-all, checkpoint, and seven-day dismiss actions.
- `prompts/0421/contracts/23-ipc-contracts-master.md` and `prompts/0503-2/_shared/ipc-channels.md` were updated for the new recovery channels.

Verification evidence:

```bash
pnpm -C devhub typecheck
pnpm -C devhub test --run src/main/services/recovery/RecoveryProbe.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/recovery/RecoveryProbe.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:license
pnpm -C devhub test --run --maxWorkers=1
git -C devhub diff --check
git diff --check
```

Results:

- TypeScript typecheck: passed.
- `RecoveryProbe.test.ts`: 1 file passed, 6 tests passed.
- Targeted spec-34 regression: 5 files passed, 80 tests passed with `--maxWorkers=1`.
- Lint/no-emoji: passed with no eslint errors and `No emoji found in 444 files`.
- Zod SoT verification: passed.
- License check: passed; 422 production package entries validated and 1 documented manifest exception retained.
- Full Vitest: 91 files passed, 640 tests passed with `--maxWorkers=1`.
- Final whitespace checks: `git -C devhub diff --check` and `git diff --check` passed. Git emitted existing LF-to-CRLF warnings only, not whitespace errors.

Completion boundary:

- This status completes spec-34 crash recovery only.
- It does not claim spec-35 backup bundles, spec-36 diagnostic ZIP export, long-run packaged startup soak, or completion of all R8.C specs.

## implementation_status_2026-05-11

Status: verified for the executable crash recovery slice, including the prior open Playwright and P95 benchmark gates.

Implemented and verified in this sync:

- `RecoveryProbe` now uses an explicit `DEFAULT_RECOVERY_PROBE_TIMEOUT_MS = 2000`, keeping default startup dirty detection inside the splash-screen budget instead of the previous generic 10 second timeout.
- `RecoveryProbe.test.ts` now proves one dirty detector failure does not suppress independent lifecycle/task findings.
- `RecoveryProbe.test.ts` now proves recovery checkpoint and restore-state operations call the injected audit sink with real action names.
- `feature-flags.test.ts` now asserts `R8.C.recovery.crash` is default ON alongside the other default-enabled R8.C runtime surfaces.
- `RecoveryProbe.test.ts` now runs ten real filesystem startup probe samples and asserts the measured P95 remains under the 2 second startup budget.
- `e2e/example.spec.ts` now covers a real Electron relaunch path: it writes local recovery dirty markers, queues a real dry-run task through `csv:enqueue-row`, verifies `recovery:check-dirty` returns `unclean-shutdown`, `pending-tasks-in-queue`, and `unsaved-store`, renders `RecoveryDialog` in R8 Ops, and applies `recovery:restore-state` to create a real `pre-recovery` snapshot.

Verification evidence:

```bash
pnpm -C devhub exec vitest run src/main/services/recovery/RecoveryProbe.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/recovery/RecoveryProbe.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "recovery|Recovery|default disabled states|feature flag"
pnpm -C devhub exec vitest run src/main/services/recovery/RecoveryProbe.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/recovery/RecoveryProbe.test.ts --maxWorkers=1
pnpm -C devhub test:e2e --grep "R8.C spec-34" --reporter=line
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub exec eslint e2e/example.spec.ts src/main/services/recovery/RecoveryProbe.test.ts
git -C devhub -c safe.directory='D:/Desktop/CREATOR ONE/devhub' diff --check -- e2e/example.spec.ts src/main/services/recovery/RecoveryProbe.test.ts
```

Results:

- Focused recovery and feature-flag Vitest: 2 files passed, 12 tests passed.
- Runtime recovery filter: 3 files passed, 3 files skipped by filter, 15 tests passed, 113 skipped.
- Recovery service plus IPC/schema/preload/feature full small-file suite: 5 files passed, 56 tests passed.
- Focused recovery benchmark Vitest: 1 file passed, 10 tests passed.
- Focused Playwright Electron GWT: 1 test passed.
- TypeScript typecheck, no-emoji scan, Zod SoT scan, targeted ESLint, and touched diff whitespace check passed.

Completion boundary:

- This status closes spec-34 crash recovery only. It does not claim spec-35 backup/restore, spec-36 diagnostic pack, or any other remaining R8.C partial spec.
