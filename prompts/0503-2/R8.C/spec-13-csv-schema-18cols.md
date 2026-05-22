# spec-13-csv-schema-18cols — CSV 任务 18 列权威 schema

> **batch**: R8.C  |  **flag**: `R8.C.csv.schema`
> **depends_on**: R8.C spec-09 (Skill), R8.C spec-12 (CsvTaskDriver)
> **derives_from**: 00-master §7.7 18 列 / V1-Q-7.E 答 完整字段集

---

## 1. motivation

```yaml
user_quote_v1_q_7_e: "18 列必须；少一列拒绝；多一列截断"
goals:
  - 严格 18 列 schema（master §7.7 唯一 SoT）
  - 每列含 type / required / validators / default
  - 列与 SKILL inputs / 调度参数对齐
  - 错误信息精确到列+行
constraint:
  - 列名固定（用户不可改）
  - 列顺序固定（按列名序号）
  - 不允许空格列名
  - 字段值越界 → 该行作废
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/shared/schemas/csv-task-row.ts
  - devhub/src/shared/schemas/csv-task-row.test.ts
  - devhub/src/shared/csv-task-row.docs.md  # 字段含义说明
modified_files:
  - devhub/src/main/services/csv/CsvParser.ts  # 引用本 schema
glob_anchors:
  - devhub/src/shared/schemas/index.ts:1-50
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

// 18 列定义（顺序固定）
export const CSV_COLUMN_NAMES = [
  'taskId',  // 1. unique within group
  'taskName',  // 2. human readable
  'priority',  // 3. P0..P3
  'status',  // 4. pending|running|done|failed|skipped
  'tool',  // 5. codex|claude|gemini|cursor|copilot
  'skill',  // 6. SKILL name
  'inputFile',  // 7. abs/rel path
  'inputArgs',  // 8. JSON-encoded args
  'outputDir',  // 9. abs/rel path
  'outputFormat',  // 10. json|md|txt|file
  'tags',  // 11. comma-separated
  'dependsOn',  // 12. comma-separated taskIds
  'timeoutMs',  // 13. integer
  'retries',  // 14. integer 0..5
  'concurrencyKey',  // 15. limit parallelism
  'createdAt',  // 16. ISO date
  'scheduledAt',  // 17. ISO date or "now"
  'note',  // 18. free text
] as const

export const PriorityEnum = z.enum(['P0','P1','P2','P3'])
export const StatusEnum = z.enum(['pending','running','done','failed','skipped'])
export const ToolEnum = z.enum(['codex','claude','gemini','cursor','copilot'])
export const OutputFormatEnum = z.enum(['json','md','txt','file'])

export const CsvTaskRowSchema = z.object({
  taskId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_\-:.]+$/),
  taskName: z.string().min(1).max(200),
  priority: PriorityEnum,
  status: StatusEnum.default('pending'),
  tool: ToolEnum,
  skill: z.string().min(1).max(60),
  inputFile: z.string().max(500),
  inputArgs: z.string().refine(v => { try { JSON.parse(v || '{}'); return true } catch { return false } }, { message: 'inputArgs must be valid JSON' }),
  outputDir: z.string().max(500),
  outputFormat: OutputFormatEnum,
  tags: z.string().max(200).default(''),
  dependsOn: z.string().max(500).default(''),
  timeoutMs: z.coerce.number().int().min(0).max(86400000),
  retries: z.coerce.number().int().min(0).max(5),
  concurrencyKey: z.string().max(60).default(''),
  createdAt: z.string().datetime(),
  scheduledAt: z.union([z.literal('now'), z.string().datetime()]),
  note: z.string().max(1000).default(''),
})
export type CsvTaskRow = z.infer<typeof CsvTaskRowSchema>

// 列名校验（严格 18 列）
export function validateHeader(header: string[]): { valid: boolean; missing: string[]; extra: string[] } {
  const expected = new Set(CSV_COLUMN_NAMES as readonly string[])
  const got = new Set(header)
  return {
  valid: header.length === 18 && CSV_COLUMN_NAMES.every((n, i) => header[i] === n),
  missing: [...expected].filter(c => !got.has(c)),
  extra: [...got].filter(c => !expected.has(c)),
  }
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  csv:schema-info:
  req: {}
  resp: { columns: { name: string, type: string, required: boolean, description: string }[] }
  csv:validate-row:
  req: { row: Record<string, string> }
  resp: { valid: boolean, errors?: { column: string, message: string }[] }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 列数 != 18 | E_VALIDATION (header level) |
| 列名顺序错 | E_VALIDATION |
| taskId 重复（group 内） | E_VALIDATION |
| dependsOn 引用不存在 | E_VALIDATION |
| inputArgs 非 JSON | E_VALIDATION |
| timeoutMs 超 24h | E_VALIDATION |
| createdAt / scheduledAt 非 ISO | E_VALIDATION |
| tool 未在 enum | E_VALIDATION |
| skill 引用不存在 | E_NOT_FOUND（spec-09 SkillLibrary 校验） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (header 校验):
  given: CSV 仅 17 列
  when: validateHeader
  then: valid=false missing 含缺失列名

GWT-2 (列顺序):
  given: 列名相同但顺序不同
  when: validateHeader
  then: valid=false（顺序固定）

GWT-3 (类型校验):
  given: timeoutMs="abc"
  when: row 校验
  then: errors 含 "timeoutMs must be number"

GWT-4 (依赖):
  given: dependsOn="t1,t2" 但 t1 不在同 group
  when: 解析阶段
  then: row.errors 标记缺失依赖

GWT-5 (JSON args):
  given: inputArgs="{not-json"
  when: 校验
  then: errors 含 "inputArgs must be valid JSON"
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 header column count', async ({ page }) => {
  const result = await page.evaluate(() => window.electronAPI.csv.validateRow({
  row: { taskId: 'x', taskName: 'X', priority: 'P0' /* ... 缺多列 */ }
  }))
  expect(result.valid).toBe(false)
  expect(result.errors?.length).toBeGreaterThan(0)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'zod@3.23':  主校验
  - 'papaparse@5.4':  CSV 解析
column_doc_table: |
  | # | name | type | req | example |
  |---|------|------|-----|---------|
  | 1 | taskId | string | Y | task-001 |
  | 2 | taskName | string | Y | "Review PR #42" |
  | 3 | priority | enum P0..P3 | Y | P1 |
  | 4 | status | enum | N (default pending) | pending |
  | 5 | tool | enum 5 | Y | claude |
  | 6 | skill | string | Y | code-review |
  | 7 | inputFile | path | N | src/app.ts |
  | 8 | inputArgs | json string | N (default {}) | {"depth":2} |
  | 9 | outputDir | path | N | out/ |
  | 10 | outputFormat | enum | Y | md |
  | 11 | tags | csv string | N | review,sec |
  | 12 | dependsOn | csv taskId | N |  |
  | 13 | timeoutMs | int | Y | 60000 |
  | 14 | retries | int 0..5 | Y | 1 |
  | 15 | concurrencyKey | string | N | claude-pool |
  | 16 | createdAt | ISO datetime | Y | 2026-05-03T08:00:00Z |
  | 17 | scheduledAt | ISO or now | Y | now |
  | 18 | note | string | N | "owner: zr" |
inspirations:
  - GitHub Actions workflow_dispatch inputs
  - Linear bulk import CSV
  - n8n CSV trigger
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~280
modified_loc: ~40
test_loc: ~250
total: ~570
risk_areas:
  - Schema 演进（v2 加列时兼容性）
  - 列顺序硬约束（用户复制粘贴易错）
```

---

## 10. implement_checklist

- [x] CSV_COLUMN_NAMES 常量导出（顺序固定）
- [x] validateHeader 严格匹配
- [x] 18 列 zod refinements + custom validators
- [x] inputArgs JSON 校验
- [x] dependsOn 引用解析延后到 group level
- [x] csv-task-row.docs.md 文档（用户参考）
- [x] vitest 覆盖 5 GWT + 边界值
- [x] CSV 模板导出含示例行
- [x] feature flag R8.C.csv.schema 默认 ON
- [x] schemaVersion 字段保留（未来扩展）

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-09: SkillLibrary 校验 skill 字段
  - R8.C.spec-12: CsvTaskDriver 调用本 schema
downstream:
  - R8.C.spec-14: CSV 启动器 UI 显示列说明
  - R8.C.spec-15: 任务队列读 row.timeoutMs / retries / concurrencyKey
```

---

## 12. fallback_strategy

```yaml
on_legacy_csv:
  - 列数 < 18 时拒绝；用户用 csv:export-template 重新生成
on_future_extension:
  - 加列必须 schemaVersion 升级（v2 单独 spec）
flag_off_behavior:
  - R8.C.csv.schema=OFF 时退回 v0 简单 schema（仅供调试，不推荐）
```

---

## 13. performance_budget

```yaml
schema_validate_per_row_us: { warn: 100, fatal: 1000 }
header_validate_us: { warn: 50, fatal: 500 }
total_csv_validate_p99_ms_per_1k_rows: { warn: 200, fatal: 2000 }
```
## 14. implementation_status_2026-05-05_spec13_csv_schema

```yaml
status: executable_slice_verified
implemented:
  - src/shared/schemas/csv-task-row.ts exports CSV_COLUMN_NAMES as the fixed 18-column order and CSV_COLUMN_INFO as the operator-facing column table.
  - validateCsvHeader rejects missing columns, extra columns, and reordered headers while reporting missing/order errors with column names.
  - csvTaskRow18Schema enforces taskId format, priority/status/tool/outputFormat enums, JSON inputArgs, timeoutMs 0..86400000, retries 0..5, ISO createdAt, and scheduledAt ISO-or-now.
  - csvTaskRow18Schema now injects hidden row-level `schemaVersion: "1.0"` metadata while keeping `CSV_COLUMN_NAMES` fixed at exactly 18 CSV columns.
  - R8 runtime schema registry now exposes CsvTaskRow18, CsvHeaderValidationResult, CsvFileGroup, CsvDriverState, CsvSchemaInfo, CsvReloadSummary, CsvLaunchOptions, and CsvLaunchSession.
  - csv:schema-info, csv:validate-header, and csv:validate-row are executable and synchronized with the preload whitelist contract.
verified_by:
  - src/shared/schemas/csv-task-row.test.ts covers header count, strict order, missing note, timeout type/range, malformed inputArgs JSON, valid coercion, priority mapping, and template header.
  - pnpm -C devhub test --run src/shared/schemas/csv-task-row.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "csv|CSV|Csv" passed: 3 files, 17 tests passed, 14 tests skipped by filter.
  - pnpm -C devhub check:zod-sot passed.
known_boundaries:
  - Row-level schemaVersion is metadata on the parsed row object, not a 19th CSV column; adding actual CSV columns still requires a v2 spec and version migration.
```
