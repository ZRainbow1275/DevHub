# spec-35-backup-restore — 备份与分类恢复

> **batch**: R8.C  |  **flag**: `R8.C.backup.restore`
> **depends_on**: R8.C spec-34 (crash recovery), R8.C spec-33 (zod sot)
> **derives_from**: V1-Q-9.F.2 答 B 分类恢复（settings/csv/skills/audit 独立选）

---

## 1. motivation

```yaml
user_quote_v1_q_9_f_2: "B — 分类恢复：settings / csv / skills / audit 用户独立勾选"
goals:
  - 用户主动备份（一键 ZIP 全量）
  - 用户可定时备份（每日/每周）
  - 恢复时分 4 大类（settings / csv-tasks / skills / audit-log）独立勾选
  - 备份文件含 schemaVersion 跨版本兼容（spec-33 SchemaMigration）
constraint:
  - 备份不含 API key / token（NO-API-KEY-UI）
  - 备份默认本地（用户可指定外置盘）
  - 恢复必须二次确认（覆盖现有数据）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/backup/BackupManager.ts
  - devhub/src/main/services/backup/BackupBuilder.ts
  - devhub/src/main/services/backup/RestoreEngine.ts
  - devhub/src/main/services/backup/BackupSchedule.ts
  - devhub/src/main/services/backup/BackupManager.test.ts
  - devhub/src/renderer/views/backup/BackupView.tsx
  - devhub/src/renderer/views/backup/RestoreWizard.tsx
  - devhub/src/shared/schemas/backup.ts
modified_files:
  - devhub/src/main/index.ts  # 注册定时任务
  - devhub/src/renderer/App.tsx  # 路由 /backup
glob_anchors:
  - devhub/src/main/services/storage/StoreManager.ts
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const BackupCategoryEnum = z.enum(['settings','csv-tasks','skills','audit-log'])

export const BackupManifestSchema = z.object({
  backupId: z.string().uuid(),
  createdAt: z.number().int(),
  schemaVersion: z.string(),
  categories: z.array(z.object({
  category: BackupCategoryEnum,
  fileCount: z.number().int(),
  sizeBytes: z.number().int(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })),
  totalSizeBytes: z.number().int(),
  zipPath: z.string(),
  createdBy: z.enum(['user','schedule','pre-recovery','migration']),
  redactedFields: z.array(z.string()),  // 脱敏字段列表
})

export const BackupScheduleSchema = z.object({
  enabled: z.boolean().default(false),
  cron: z.string(),  // e.g. '0 3 * * *' 每日 3 点
  retentionDays: z.number().int().min(1).max(365).default(30),
  destPath: z.string(),
  categoriesIncluded: z.array(BackupCategoryEnum),
})

export const RestorePlanSchema = z.object({
  backupId: z.string().uuid(),
  categoriesToRestore: z.array(BackupCategoryEnum),
  conflictPolicy: z.enum(['overwrite','merge','skip']).default('overwrite'),
  preRestoreSnapshot: z.boolean().default(true),
})

export const RestoreResultSchema = z.object({
  startedAt: z.number().int(),
  finishedAt: z.number().int(),
  restored: z.array(z.object({
  category: BackupCategoryEnum,
  fileCount: z.number().int(),
  success: z.boolean(),
  errors: z.array(z.string()),
  })),
  preRestoreSnapshotId: z.string().uuid().nullable(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  backup:create:
  rateClass: low_freq_op
  req: { categories: BackupCategory[], destPath?: string }
  resp: BackupManifest
  backup:list:
  rateClass: meta
  resp: BackupManifest[]
  backup:restore:
  rateClass: low_freq_op
  req: RestorePlan
  resp: RestoreResult
  backup:delete:
  rateClass: low_freq_op
  req: { backupId: string }
  resp: { success: boolean }
  backup:configure-schedule:
  rateClass: low_freq_op
  req: BackupSchedule
  resp: { success: boolean }
  backup:export-classified:  # V1-Q-9.F.2 B
  rateClass: low_freq_op
  req: { categories: BackupCategory[], destPath: string }
  resp: BackupManifest
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 磁盘空间不足 | E_INTERNAL |
| ZIP 创建失败 | E_INTERNAL |
| sha256 校验失败 | E_VALIDATION（拒绝恢复） |
| schemaVersion 不兼容且无 migration | E_VALIDATION |
| 恢复时 conflict 用户未选策略 | E_VALIDATION |
| cron 表达式非法 | E_VALIDATION |
| 备份含 API key | (CI 阻止 + 字段审计) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (一键备份):
  given: 用户点 "立即备份" 全 4 类
  when: backup:create
  then:
  - ZIP 落盘 + sha256 写 manifest
  - 不含 API key（脱敏审计）

GWT-2 (分类恢复):
  given: 备份含 4 类，用户仅勾 settings + skills
  when: backup:restore
  then:
  - csv-tasks / audit-log 不变
  - settings + skills 覆盖；pre-restore snapshot 创建

GWT-3 (定时):
  given: schedule cron='0 3 * * *' enabled=true
  when: 每日 03:00
  then: 自动备份 + retention 清理 30 天前

GWT-4 (跨版本恢复):
  given: 备份 schemaVersion=0.9.0；当前 1.0.0
  when: restore
  then: 触发 spec-33 SchemaMigration；成功后 audit log

GWT-5 (sha256 校验):
  given: 用户手动篡改 ZIP 字节
  when: restore
  then: E_VALIDATION + 拒绝恢复
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-2 selective restore', async ({ page }) => {
  const manifest = await page.evaluate(() => window.electronAPI.backup.create({ categories: ['settings','csv-tasks','skills','audit-log'] }))
  expect(manifest.categories.length).toBe(4)
  const result = await page.evaluate((id) => window.electronAPI.backup.restore({
  backupId: id, categoriesToRestore: ['settings','skills'], conflictPolicy: 'overwrite', preRestoreSnapshot: true
  }), manifest.backupId)
  const restoredCategories = result.restored.map((r: any) => r.category)
  expect(restoredCategories).toEqual(expect.arrayContaining(['settings','skills']))
  expect(restoredCategories).not.toContain('csv-tasks')
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'node:zlib':  ZIP deflate 压缩
  - 'node:fs/path/crypto':  本地 artifact、manifest、sha256 与 ZIP 容器
  - 'node-cron@4.2.1':  定时（createTask + noOverlap + stop/destroy 生命周期）
  - 'fs-extra@11':  文件操作
  - 'crypto':  sha256
inspirations:
  - macOS Time Machine selective restore
  - GitHub repository archive
  - VSCode settings sync
backup_layout: |
  devhub-backup-2026-05-03T03-00-00.zip
  ├── manifest.json
  ├── settings/
  │  └── store.json (redacted)
  ├── csv-tasks/
  │  └── tasks/
  ├── skills/
  │  └── skills/
  └── audit-log/
  └── audit/
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~120
test_loc: ~450
total: ~1470
risk_areas:
  - retention 算法（误删用户珍贵备份）
  - 大 audit log 备份性能
  - cron 跨平台
```

---

## 10. implement_checklist

- [x] BackupBuilder 4 类独立打包
- [x] sha256 校验入 manifest
- [x] 字段脱敏白名单（API key / token / SMTP password）
- [x] node-cron 定时（默认 OFF）
- [x] retention 30 天默认（可调 1..365）
- [x] RestoreWizard 4 类 checkbox + 二次确认
- [x] preRestoreSnapshot 必创建
- [x] 跨版本 schemaMigration 集成
- [x] vitest + Playwright 5 GWT
- [x] feature flag R8.C.backup.restore 默认 ON
- [x] CI grep: 备份 ZIP 内容禁含 'sk-' / 'tok-' / 'AKIA' 等

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-33: schemaVersion / migration
  - R8.C.spec-34: pre-restore snapshot 复用
downstream:
  - R8.C.spec-36: 诊断包导出可包含最新 backup
```

---

## 12. fallback_strategy

```yaml
on_disk_full:
  - 拒绝创建 + 提示清理 + 不丢现有数据
on_zip_corrupt:
  - 拒绝恢复 + 留原文件
on_schedule_fail:
  - 5 次连续失败自动 disable + 通知用户
flag_off_behavior:
  - R8.C.backup.restore=OFF 时菜单不显示（dev only）
```

---

## 13. performance_budget

```yaml
backup_create_p95_seconds: { warn: 30, fatal: 180 }
restore_p95_seconds: { warn: 60, fatal: 300 }
zip_compression: 6
default_retention_days: 30
disk_total_mb: { warn: 1024, fatal: 10240 }
```

---

## implementation_status_2026-05-05

Status: executable vertical slice complete for the main-process classified backup and restore contract; renderer wizard UI and real cron execution remain future UI/scheduler work.

Implemented in DevHub:

- Shared Zod contracts added in `devhub/src/shared/schemas/r8-runtime.ts`: backup categories, manifest entries, schedule config, create/export/delete requests, restore plan, restore result, and compatibility backup bundle.
- IPC/preload/global types wired for `backup:create`, `backup:list`, `backup:restore`, `backup:delete`, `backup:configure-schedule`, `backup:schedule-config`, and `backup:export-classified`.
- Backup artifacts are real deterministic local directories under `r8-backups` or an explicit destination path, with `manifest.json` plus independent `settings/store.json`, `csv-tasks/tasks.json`, `skills/skills.json`, and `audit-log/audit-log.json` category files.
- Each category file is hashed with SHA256 and verified before restore. Tampering rejects restore with `E_VALIDATION:sha256 mismatch`.
- Backup content redacts sensitive field names and token-like strings including `sk-`, `tok-`, `AKIA...`, JWT-like tokens, and bearer tokens before writing files.
- Selective restore supports `settings`, `csv-tasks`, `skills`, and `audit-log` categories with `overwrite`, `merge`, and `skip` policies. Restore creates a spec-34 `pre-recovery` checkpoint before any mutation.
- `settings` restore updates the real `AppStore`; `csv-tasks` restores persisted runtime store keys; `skills` restores user `SKILL.md` files into the local skill root; `audit-log` restores redacted audit content to a review directory instead of overwriting the active security audit log.
- Schedule config is persisted and cron syntax is validated. The default remains disabled; no fake background cron execution is claimed.

Verified on 2026-05-05:

- `pnpm -C devhub typecheck`
- `pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1`
- `pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "classified local backup|selected backup categories|tampered classified backup|exports and deletes classified|backup schedule"`

Known non-blocking note:

- Full `R8RuntimeService.test.ts` currently has one unrelated `opens monitor BrowserWindow via R8.B popout bridge and applies guarded prefs` timeout on this resource-constrained host. The spec-35 focused tests pass.

## implementation_status_2026-05-11

Status: spec-35 implementation verified for the local R8 scope. Real ZIP output, scheduler, backup-content gate, BackupManifest migration, RestoreWizard UI, and Playwright GWT are implemented and covered by focused tests.

Verified implementation:

- Classified backup writes independent local category directories for `settings`, `csv-tasks`, `skills`, and `audit-log`.
- Manifest entries include per-category SHA256 hashes, and restore verifies hashes before mutating state.
- Backup payload redaction covers API-key, token, SMTP-style password, bearer, JWT-like, and AWS-key patterns in the backed-up content.
- Backup creation writes deterministic category artifact directories and a real deflated `.zip` file whose local headers start with `PK`; `manifest.zipPath` and the returned bundle `zipPath` point to the ZIP container.
- Schedule configuration persists `retentionDays` with the 30 day default and schema range 1..365.
- Real `node-cron@4.2.1` scheduling is wired through `cron.createTask(..., { noOverlap: true, timezone })`, remains default OFF, starts only when the persisted schedule is enabled, and is stopped/destroyed during runtime service disposal.
- Scheduled executions call the same real `createClassifiedBackup({ createdBy: 'schedule' })` path as manual backups, run scheduled-retention pruning only for schedule-created backups, and auto-disable the schedule after five consecutive failures.
- Selective restore creates a spec-34 `pre-recovery` checkpoint and restores only requested categories after explicit confirmation.
- Restore now migrates older backup manifests through a dedicated `SchemaMigration` registry for `BackupManifest` before parsing the manifest contract; `schemaVersion: "0.9.0"` is migrated to the current backup schema and records `backup:schema-migration` audit evidence.
- `devhub/scripts/verify-backup-content.mjs` provides a CI-ready backup-content gate that scans real backup artifact files/directories and rejects forbidden secret patterns including `sk-`, `tok-`, `AKIA`, JWT-like tokens, and bearer tokens.
- The same backup-content gate now detects ZIP files, inflates deflated entries, scans entry contents, and refuses unsupported ZIP compression methods instead of silently passing unscanned payloads.
- `R8OpsPanel` includes a RestoreWizard panel with the four backup categories, backup artifact selector, conflict policy selector, pre-restore snapshot toggle, destructive second-confirmation checkbox, selected-category backup creation, and selected-category restore status.
- `feature-flags.test.ts` now asserts `R8.C.backup.restore` is default ON.

Verification evidence:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "classified local backup|selected backup categories|tampered classified backup|exports and deletes classified|backup schedule|default disabled states|feature flag"
pnpm -C devhub exec vitest run src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "backup schedule|node-cron|backup content|schema migration|classified local backup|selected backup categories|tampered classified backup|exports and deletes classified"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "backup|Backup|restore|Restore|schema migration|node-cron|backup content"
pnpm -C devhub exec vitest run src/renderer/components/monitor/R8OpsPanel.test.tsx --maxWorkers=1
pnpm -C devhub test:e2e --grep "R8.C spec-35" --reporter=line
pnpm -C devhub check:backup-content -- <clean-backup-artifact-path>
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts
node --check devhub/scripts/verify-backup-content.mjs
git -C devhub -c safe.directory='D:/Desktop/CREATOR ONE/devhub' diff --check -- package.json pnpm-lock.yaml scripts/verify-backup-content.mjs src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts
```

Results:

- Backup runtime/feature focused suite: 2 files passed, 3 files skipped by filter, 10 tests passed, 109 skipped.
- IPC/schema/preload/feature full small-file suite: 4 files passed, 47 tests passed.
- Backup scheduler/content/migration focused suite: 1 file passed, 8 tests passed, 74 skipped.
- Backup/restore wider focused suite: 1 file passed, 9 tests passed, 73 skipped.
- RestoreWizard component suite: 1 file passed, 2 tests passed.
- Packaged Electron Playwright GWT: 1 test passed (`R8.C spec-35 RestoreWizard restores selected backup categories through real IPC`).
- Build gate passed after main/renderer changes: `pnpm -C devhub build`.
- Quality gates passed: `typecheck`, `check:no-emoji` (`No emoji found in 600 files.`), `check:zod-sot`, touched-file ESLint, backup-content ZIP scan via Vitest, script syntax check, and touched-file `git diff --check` (CRLF warnings only for known Windows-tracked files).

Completion boundary:

- All spec-35 checklist items are closed for the local R8 scope. Future release hardening can still add import-from-external-ZIP-only recovery, but current create/list/restore/delete/schedule flows are verified through real local artifacts, ZIP output, IPC, renderer UI, and packaged Electron E2E.
