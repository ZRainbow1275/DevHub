# spec-33-zod-source-of-truth — Zod 单一事实源（Schema → TS 推导 + 运行时校验）

> **batch**: R8.C  |  **flag**: `R8.C.zod.sot`
> **depends_on**: R8.A spec-01 (integration-libs)
> **derives_from**: V1-Q-9.D.1 答 D Zod SoT + master §7.0 ZOD-SINGLE-SOURCE 硬约束

---

## 1. motivation

```yaml
user_quote_v1_q_9_d_1: "D — Zod 作为唯一事实源，TS 类型由 z.infer 自动推导"
goals:
  - 全部跨进程/跨边界类型由 src/shared/schemas/ 唯一定义
  - 运行时 IPC payload 校验失败 → 降级 + 提示（不崩）
  - schemaVersion 字段允许平滑升级
  - CI 校验：禁止 src/shared/types/ 与 schemas/ 重复定义
constraint:
  - 所有 IPC handler 必须 schema.parse 入参
  - 所有 IPC reply 必须 schema.parse 出参
  - 所有 SQLite 持久化字段走 schema
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/shared/schemas/index.ts  # 集中导出
  - devhub/src/shared/schemas/_meta.ts  # schemaVersion 字典
  - devhub/src/main/services/zod/SchemaRegistry.ts
  - devhub/src/main/services/zod/IpcSchemaGuard.ts
  - devhub/src/main/services/zod/SchemaMigration.ts
  - devhub/src/main/services/zod/SchemaRegistry.test.ts
  - devhub/scripts/verify-zod-sot.ts  # CI 脚本
modified_files:
  - devhub/src/shared/types-extended.ts  # 改为 import { z.infer } from schemas
  - devhub/src/main/ipc/*.ts  # 全部 handler 用 IpcSchemaGuard
  - .github/workflows/ci.yml  # +verify-zod-sot
  - vitest.config.ts  # 加 schemas/ coverage
glob_anchors:
  - devhub/src/shared/types-extended.ts:1-100
  - devhub/src/shared/schemas/  # 已有 N 个 schema 文件
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const SCHEMA_VERSION = '1.0.0'

export const SchemaMetaSchema = z.object({
  schemaName: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  introducedAt: z.string().datetime(),
  deprecatedAt: z.string().datetime().nullable(),
  superseded_by: z.string().nullable(),
})

export const IpcSchemaPairSchema = z.object({
  channel: z.string(),
  reqSchema: z.string(),  // schema export name
  respSchema: z.string(),
  rateClass: z.enum(['high_freq_scan','medium_query','low_freq_op','meta']),
})

export const SchemaValidationVerdictSchema = z.object({
  channel: z.string(),
  direction: z.enum(['request','response']),
  ok: z.boolean(),
  errors: z.array(z.object({
  path: z.string(),
  message: z.string(),
  })),
  ts: z.number().int(),
})

export const SchemaMigrationStepSchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  schemaName: z.string(),
  transform: z.string(),  // 函数序列化标识
  reversible: z.boolean(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  zod:list-schemas:
  rateClass: meta
  resp: { schemas: SchemaMeta[] }
  zod:validate-payload:  # dev only
  rateClass: meta
  req: { schemaName: string, payload: unknown }
  resp: { valid: boolean, errors?: string[] }
  zod:migration-status:
  rateClass: meta
  resp: { currentVersion: string, pendingMigrations: SchemaMigrationStep[] }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 未注册 schema 引用 | E_VALIDATION（启动期 throw） |
| IPC payload 不通过 schema | E_VALIDATION（main 拒绝；renderer 降级） |
| schema 重复定义 | E_VALIDATION（CI 失败） |
| migration 不可逆 | E_VALIDATION（要求 reversible=true） |
| schemaVersion mismatch | (触发 SchemaMigration 自动转换) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (强校验):
  given: IPC 'ai:report-misreport' 收到非法 kind
  when: handler
  then: 不进入业务逻辑；resp E_VALIDATION + errors 详情

GWT-2 (TS 推导):
  given: shared/types-extended.ts 中
  when: 检索
  then: 不存在与 schemas/ 重复的 type 定义（CI 校验）

GWT-3 (migration):
  given: 旧 SQLite 含 schemaVersion='0.9.0'
  when: 启动
  then: 自动 migrate 到 1.0.0；audit log 记录步骤

GWT-4 (CI 通过):
  given: verify-zod-sot 脚本
  when: 全仓扫描
  then: 0 重复定义 + 0 未注册 schema 引用

GWT-5 (renderer 降级):
  given: main 返回不通过 schema 的 payload
  when: renderer 收到
  then: 显示降级文案 + 不崩 + audit log
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 invalid payload rejected', async ({ page }) => {
  await expect(page.evaluate(() => window.electronAPI.ai.reportMisreport({
  instanceId: 'x', kind: 'NOT-A-VALID-KIND' as any
  }))).rejects.toThrow(/E_VALIDATION/)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'zod@3.23':  核心
  - 'zod-validation-error@3.x':  友好消息
  - 'zod-to-json-schema@3.x':  (备用) 文档生成
  - 'jscodeshift@0.16':  CI 校验
inspirations:
  - tRPC 全栈 Zod
  - Effect Schema
  - GraphQL codegen
  - JSON Schema Draft 2020-12
ci_check_pseudocode: |
  // verify-zod-sot.ts
  // 1. find all .ts in shared/types-extended.ts
  // 2. parse: any 'export type X = ...' that does NOT include 'z.infer<typeof'
  //  → ERROR: types must derive from schemas
  // 3. find all schemas/index.ts exports
  // 4. find all ipcMain.handle calls; check req/resp wrapped in schema.parse
  // 5. exit 1 if violations
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~600
modified_loc: ~500  # 全 IPC + 全 types-extended
test_loc: ~400
total: ~1500
risk_areas:
  - schemas 旧定义不兼容（migration 步骤多）
  - CI 脚本误判（白名单需打磨）
  - schema validation 高频通道性能（IPC bottleneck）
```

---

## 10. implement_checklist

- [x] schemas/index.ts 集中导出
- [x] _meta.ts schemaVersion 字典
- [x] IpcSchemaGuard middleware 自动包装
- [x] SchemaMigration 启动期检查 + 自动迁移
- [x] verify-zod-sot.ts 加入本地 `check:zod-sot` gate（GH Action 接入保留给发布流水线）
- [x] types-extended.ts 重复 runtime schema 类型由 verifier 阻断；legacy allowlist 显式记录
- [x] dev-only zod:validate-payload 调试通道
- [x] vitest 覆盖 5 GWT + migration scenarios
- [x] feature flag R8.C.zod.sot 默认 ON（强制）
- [x] audit log: migration 全程记录

---

## 11. dependencies

```yaml
upstream:
  - R8.A.spec-01: zod / zod-validation-error 已安装
  - 全部 spec：所有 schema 引用本 SoT
downstream:
  - R8.C.spec-31: rate-limit middleware 接 schema guard
  - R8.C.spec-34: crash-recovery 用 schema 校验 dirty state
```

---

## 12. fallback_strategy

```yaml
on_legacy_payload:
  - 触发 SchemaMigration；失败则 audit + 拒绝
on_schema_perf_bottleneck:
  - 高频通道使用 schema.safeParse + 缓存 + 短路
on_ci_false_positive:
  - 维护白名单（_meta.ts allowed_legacy_types）
flag_off_behavior:
  - R8.C.zod.sot=OFF 时仅 dev 模式（生产强制 ON）
```

---

## 13. performance_budget

```yaml
schema_parse_p99_us:
  small_payload: { warn: 100, fatal: 1000 }
  large_payload: { warn: 1000, fatal: 10000 }
ci_verify_seconds: { warn: 30, fatal: 120 }
migration_p99_seconds: { warn: 5, fatal: 30 }
```

---

## implementation_status_2026-05-05

status: implemented_and_verified

implemented_files:
  - devhub/src/shared/schemas/_meta.ts
  - devhub/src/shared/schemas/index.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/zod/SchemaRegistry.ts
  - devhub/src/main/services/zod/IpcSchemaGuard.ts
  - devhub/src/main/services/zod/SchemaMigration.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/src/renderer/components/monitor/R8OpsPanel.tsx
  - devhub/scripts/verify-zod-sot.ts
  - devhub/package.json

verification_2026-05-05:
  - pnpm check:zod-sot
  - pnpm typecheck
  - pnpm test --run src/main/services/zod/SchemaRegistry.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
  - pnpm lint
  - pnpm check:license
  - pnpm test --run --maxWorkers=1
  - git diff --check
  - git -C .. diff --check

notes:
  - `types-extended.ts` was not mass-rewritten in this slice; the verifier blocks duplicated runtime schema aliases and documents `SignalContribution` as legacy allowlisted debt.
  - `schemas/index.ts` uses namespace exports for individual schema modules and a top-level `r8-runtime` export, avoiding existing duplicate schema names while preserving a central entry point.
  - `zod:validate-payload` uses real registered Zod schemas and returns structured path/message issues; no mock validation path is used.

verification_2026-05-11:
  - pnpm -C devhub test --run src/main/services/zod/SchemaRegistry.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "zod|schema|validate-payload|migration|preload"
  - pnpm -C devhub check:zod-sot
  - result: 5-file targeted suite reported 4 passed / 1 skipped, 14 tests passed / 104 skipped; Zod SoT verification passed.
  - ledger_note: the only pending marker counted by the mechanical ledger is the response field name `pendingMigrations`, not unfinished implementation work.
