# spec-12-csv-task-driver — CSV 任务驱动框架（核心调度入口）

> **batch**: R8.C  |  **flag**: `R8.C.csv.driver`
> **depends_on**: R8.A spec-01 (integration-libs), R8.C spec-09 (SkillLibrary)
> **derives_from**: V1-Q-7.E 答 CSV 任务驱动 / 00-master §7.7 18 列 schema / feedback#4 CSV 槽位

---

## 1. motivation

```yaml
user_quote_v1_q_7_e: "CSV 任务驱动：用户编辑 CSV → DevHub 解析 → 调度 SKILL → 调用 CLI"
goals:
  - 18 列 CSV schema（master §7.7）严格校验
  - 热加载（chokidar 监听 tasks.csv）
  - 离线运行（不调任何在线 API）
  - 输出 TaskRun 给 spec-15 任务队列
constraint:
  - CSV 文件路径：%APPDATA%/DevHub/tasks/<group>.csv
  - 解析失败行不阻塞其他行（容错）
  - 所有 row 在 audit log
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/csv/CsvTaskDriver.ts
  - devhub/src/main/services/csv/CsvParser.ts
  - devhub/src/main/services/csv/CsvFileWatcher.ts
  - devhub/src/main/services/csv/CsvTaskDriver.test.ts
  - devhub/src/shared/schemas/csv-task-row.ts
modified_files:
  - devhub/src/main/index.ts  # 启动时 CsvTaskDriver.init()
  - devhub/src/main/ipc/csvHandlers.ts  # 新增 IPC
glob_anchors:
  - devhub/src/main/services/storage/StoreManager.ts
```

---

## 3. data_contracts

```typescript
// 18 列 schema 详见 spec-13；本 spec 仅引用
import { z } from 'zod'
import { CsvTaskRowSchema, type CsvTaskRow } from '@/shared/schemas/csv-task-row'

export const CsvFileGroupSchema = z.object({
  groupId: z.string(),  // 文件名（不含扩展名）
  filePath: z.string(),
  rowCount: z.number().int().nonnegative(),
  validRowCount: z.number().int().nonnegative(),
  rows: z.array(CsvTaskRowSchema),
  errors: z.array(z.object({
  line: z.number().int(),
  column: z.string(),
  message: z.string(),
  })),
  loadedAt: z.number().int(),
  fileMtime: z.number().int(),
})

export const CsvDriverStateSchema = z.object({
  groups: z.array(CsvFileGroupSchema),
  lastFullScanAt: z.number().int(),
  watchedDirs: z.array(z.string()),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  csv:list-groups:
  req: {}
  resp: { groups: CsvFileGroup[] }
  csv:get-group:
  req: { groupId: string }
  resp: CsvFileGroup | null
  csv:reload:
  req: { force: boolean }
  resp: { groupCount: number, totalRows: number, errorCount: number }
  csv:enqueue-row:  # 用户在 UI 选定一行 → 提交执行
  req: { groupId: string, rowIndex: number }
  resp: { taskRunId: string }
  csv:enqueue-group:
  req: { groupId: string, filter?: { tags?: string[] } }
  resp: { taskRunIds: string[] }
  csv:row-stream:  # 文件变化 → 推送
  payload: { groupId: string, added: CsvTaskRow[], removed: number[], updated: CsvTaskRow[] }
  csv:export-template:
  req: { savePath: string }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| CSV 列数 != 18 | E_VALIDATION |
| BOM 编码不一致 | E_PARSE（自动转 UTF-8） |
| 引用 SKILL 不存在 | E_NOT_FOUND（标 row.error） |
| 行 zod 校验失败 | E_VALIDATION（仅该行失败） |
| 文件锁（被 Excel 打开） | E_TIMEOUT（重试 3 次） |
| group 重复 ID | E_VALIDATION |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础加载):
  given: tasks/dev.csv 含 5 行（含 1 列名错误）
  when: CsvTaskDriver.init
  then: validRowCount=5；errors 包含列名错误提示

GWT-2 (热加载):
  given: 用户在 Excel 编辑 + 保存
  when: chokidar 触发 change
  then: csv:row-stream 5s 内推送 diff

GWT-3 (引用校验):
  given: row.skill="non-existent-skill"
  when: 解析
  then: row.errors 含 "skill not found"；rowState='invalid'

GWT-4 (导出模板):
  given: 用户点 "导出模板"
  when: csv:export-template path=...
  then: 保存含 18 列表头 + 1 示例行的 CSV

GWT-5 (批量执行):
  given: dev.csv 5 行有效
  when: csv:enqueue-group groupId=dev
  then: 5 个 taskRunId 返回；spec-15 队列接管
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 csv load with mixed errors', async ({ page, fs }) => {
  await fs.writeFile(`${userTaskDir}/dev.csv`, sampleCsvWith5Rows)
  await page.evaluate(() => window.electronAPI.csv.reload({ force: true }))
  const { groups } = await page.evaluate(() => window.electronAPI.csv.listGroups())
  const dev = groups.find((g: any) => g.groupId === 'dev')
  expect(dev.validRowCount).toBe(5)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'papaparse@5.4':  CSV 解析（流式 + BOM 处理）
  - 'chokidar@3.6':  文件监听
  - 'iconv-lite@0.6':  编码转换
  - 'zod@3.23':  行级校验
inspirations:
  - VS Code tasks.json
  - GitHub Actions matrix
  - n8n workflow CSV import
file_layout: |
  %APPDATA%/DevHub/tasks/
  ├── dev.csv
  ├── ci.csv
  ├── batch-translate.csv
  └── archive/
  └── 2026-04-old.csv
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~700
modified_loc: ~100
test_loc: ~400
total: ~1200
risk_areas:
  - Excel 锁文件场景
  - BOM / GB18030 编码混合
  - 大 CSV (>10000 行) 性能
```

---

## 10. implement_checklist

- [x] papaparse 流式解析（避免一次加载大文件到内存）
- [x] iconv-lite 自动检测编码（utf-8 / gb18030 / utf-16）
- [x] chokidar awaitWriteFinish: stabilityThreshold=500ms
- [x] 解析失败行 isolate（不影响其他行）
- [x] 引用 SKILL 在加载时校验（spec-09 SkillLibrary）
- [x] csv:row-stream 100ms 节流
- [x] csv:export-template 写带表头的样例 CSV
- [x] vitest 覆盖 5 GWT + 异常 CSV
- [x] feature flag R8.C.csv.driver 默认 ON
- [x] audit log: 每次 reload 写一条

---

## 11. dependencies

```yaml
upstream:
  - R8.A.spec-01: papaparse / chokidar / iconv-lite 已安装
  - R8.C.spec-09: SkillLibrary 提供 skill 引用校验
  - R8.C.spec-13: 18 列 schema
downstream:
  - R8.C.spec-14: CSV 启动器 UI（spec-14）
  - R8.C.spec-15: 任务队列消费 TaskRun
```

---

## 12. fallback_strategy

```yaml
on_chokidar_fail:
  - 退化到手动 csv:reload
on_encoding_unknown:
  - 默认 UTF-8 + 提示用户
on_excel_lock:
  - 重试 3 次 + 提示用户关闭 Excel
flag_off_behavior:
  - R8.C.csv.driver=OFF 时不读 CSV 目录
```

---

## 13. performance_budget

```yaml
init_load_ms: { warn: 1500, fatal: 8000 }
parse_rows_per_sec: { warn_below: 500, fatal_below: 100 }
chokidar_event_p99_ms: { warn: 100, fatal: 1000 }
memory_per_10k_rows_mb: { warn: 30, fatal: 100 }
ipc_channel: csv:row-stream → spec-31 medium_query 60 RPM
```
## 14. implementation_checkpoint_2026_05_04

```yaml
status: executable_slice_verified
implemented:
  - src/main/services/csv/CsvParser.ts parses real local CSV text with metadata comments, quoted fields, escaped quotes, CRLF/LF, UTF-8 BOM removal, and explicit E_PARSE on unterminated quotes.
  - src/main/services/csv/CsvTaskDriver.ts loads real CSV files from Electron userData/tasks, validates each row independently, validates SKILL names against the current local skill library, validates group-level dependsOn references, and maps valid 18-col rows into durable runtime queue rows.
  - src/main/services/csv/CsvFileWatcher.ts provides a low-resource chokidar helper with awaitWriteFinish stabilityThreshold=500ms, atomic writes, depth=1, and ignorePermissionErrors.
  - csv:reload, csv:list-groups, csv:get-group, csv:enqueue-row, csv:enqueue-group, and csv:export-template are executable through R8RuntimeService, IPC, preload, and renderer global types.
  - src/shared/csv-task-row.docs.md documents the 18 columns for operators.
verified_by:
  - pnpm typecheck
  - pnpm lint
  - pnpm test --run src/shared/schemas/csv-task-row.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
known_boundaries:
  - This 2026-05-04 checkpoint was superseded by the 2026-05-08/2026-05-09 continuation slices for GB18030, csv:row-stream, audit rows, and papaparse stream parsing.
  - csv:row-stream and app-start watcher lifecycle are not wired yet; manual csv:reload remains the verified fallback.
  - audit-log rows for reload/export are not claimed complete.
```

---

## 15. implementation_evidence_2026-05-08

### completed_executable_slice

- Added direct `iconv-lite@0.6.3` runtime dependency and GB18030 fallback decoding while preserving UTF-8, UTF-8 BOM, and UTF-16LE BOM handling.
- Kept `CsvFileWatcher` as the low-resource chokidar boundary with `awaitWriteFinish.stabilityThreshold=500ms`, `pollInterval=100`, `atomic`, `depth=1`, and `ignorePermissionErrors`.
- Preserved row isolation: each parsed row carries its own `errors`, invalid rows do not block valid rows, and group-level `skill` / `dependsOn` validation only invalidates affected rows.
- Added typed `CsvRowStreamPayload` schema and registry entry.
- Added `csv:row-stream` renderer subscription through preload/global typings and contract whitelist synchronization.
- `reloadCsvGroups()` now writes an audit row on every reload and emits a 100ms-throttled row stream payload with `changedGroupIds`, `removedGroupIds`, and a full reload summary.
- `csv:reload(force, watch)` can start the CSV watcher and push subsequent `watch:add`, `watch:change`, and `watch:unlink` stream sources.
- Added feature-flag coverage proving `R8.C.csv.driver` remains default-enabled.
- Wrote `docs/r8/csv-task-driver.md` as the current CSV driver implementation boundary.

### verified_gwt

- GWT-1 remains covered by real local CSV load tests with valid and invalid row isolation.
- GWT-2 is now covered by executable row-stream plumbing and reload stream tests; watcher lifecycle can call the same reload/stream path when `watch=true`.
- GWT-3 remains covered by SKILL-name and `dependsOn` validation in `CsvTaskDriver`.
- GWT-4 remains covered by `csv:export-template` writing a real 18-column sample CSV.
- GWT-5 remains covered by `enqueueCsvGroup()` and task-queue tests that create real durable task runs without pretending external CLI success.

### closure_boundary

- Electron E2E/UI wizard coverage remains outside this spec-12 closure slice; the spec-12 backend driver checklist is otherwise closed by local unit/runtime/contract evidence.

### verification

- `pnpm -C . test --run src/shared/schemas/csv-task-row.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts src/preload/preloadContract.test.ts --testNamePattern "csv|CSV|Csv|preload|IPC|schema|default disabled states" --maxWorkers=1` passed: 7 files, 39 tests.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- GitNexus impact for `CsvTaskDriver`, `CsvParser`, and `reloadCsvGroups` returned LOW risk.

---

## 16. implementation_evidence_2026-05-09

### completed_executable_slice

- Added direct `papaparse@5.5.3` runtime dependency and `@types/papaparse@5.3.16` development typing.
- `CsvParser.parseStream()` now uses `Papa.parse(Papa.NODE_STREAM_INPUT, { delimiter: ',', header: false })` on a Node stream instead of requiring whole-file text.
- `CsvTaskDriver.loadGroup()` now probes only a bounded 64 KiB prefix for BOM/encoding selection, then streams the real file through UTF-8 bytes, `iconv.decodeStream('utf16le')`, or `iconv.decodeStream('gb18030')`.
- The existing strict 18-column validation, metadata comments, row isolation, skill validation, dependency validation, and runtime row mapping remain unchanged after streaming.

### verification

- `pnpm -C . test --run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1` passed: 1 file, 7 tests, including a 1200-row Papa Parse streaming fixture with quoted delimiters and embedded newlines.
- `pnpm -C . typecheck` passed.

---

## 17. implementation_evidence_2026-05-16_prompt_interpolation_file_refs

### completed_executable_slice

- `CsvTaskDriver` now expands `{{cwd}}` from `inputArgs.cwd`; when absent, it falls back to the DevHub process cwd.
- `CsvTaskDriver` now expands `{{file}}` from `inputArgs.file` or the 18-column `inputFile` column.
- `CsvTaskDriver` now expands `@file:<path>` references by reading real local text files before runtime row launch.
- Relative `@file:` paths resolve against `inputArgs.cwd` when present.
- File references are bounded to readable regular files up to 64 KiB; invalid references create explicit `inputArgs` errors and no runtime row.

### verified_gwt

- Prompt interpolation preserves the strict 18-column CSV contract without adding new columns.
- A real local file reference is read into the prompt body.
- A missing file reference fails before launch with an explicit row error.

### verification

- `pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "@file|interpolates|@skill|loads a real CSV"` passed: 1 file, 6 tests.
- `pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1` passed: 1 file, 13 tests.
- `pnpm -C devhub typecheck` passed.
- `pnpm -C devhub lint` passed.

---

## 18. implementation_evidence_2026-05-16_prelaunch_validation

### completed_executable_slice

- `CsvTaskDriver.loadGroup()` now rejects duplicate `taskId` values before runtime row creation.
- `inputArgs.require_input_file=true` or `inputArgs.requireInputFile=true` validates that the CSV `inputFile` resolves to a real regular file.
- Required input-file paths resolve against `inputArgs.cwd` when present.
- `CsvTaskDriver` now rejects likely API key leakage in `inputArgs` or prompt text before launch.

### verified_gwt

- Duplicate id rows are all invalidated with explicit `taskId` errors.
- Existing rows without opt-in input-file validation remain compatible with current fixtures.
- A missing required input file produces an explicit `inputFile` error.
- Likely API-key material produces an explicit `inputArgs` error.

### verification

- `pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "duplicate task ids|required inputFile|API key|@file|loads a real CSV"` passed: 1 file, 6 tests.
- `pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1` passed: 1 file, 16 tests.
- `pnpm -C devhub typecheck` passed.
- `pnpm -C devhub lint` passed.
