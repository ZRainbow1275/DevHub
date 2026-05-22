# spec-38-skill-cloud-sync-deferred — SKILL 云同步占位（接口已就位 / 实现延迟）

> **batch**: R8.C  |  **flag**: `R8.C.skill.cloud-sync` (DEFAULT OFF)
> **depends_on**: R8.C spec-09 (SkillLibrary), R8.C spec-37 (permission ttl)
> **derives_from**: V1-Q-7.D.5 答 D 占位接口 + master §10 deferred 列表

---

## 1. motivation

```yaml
user_quote_v1_q_7_d_5: "D — 占位接口；实际实现延迟到 R9，避免现阶段引入云依赖"
goals:
  - 仅定义 IPC 接口 + zod schema，不实现实际同步逻辑
  - 调用任何 sync 操作 → 返回 E_FEATURE_DEFERRED
  - 用户可在设置看到"云同步"开关，但显示"R9 启用"
  - 为未来扩展保留扩展点：CloudProviderEnum / SyncConflictPolicy / RemoteSkillManifest
constraint:
  - 0 网络调用（NO-TELEMETRY 强约束）
  - 0 第三方云 SDK 引入（CI grep 阻止）
  - 接口已就位但严格内部封锁
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/skill/CloudSyncFacade.ts  # 全部方法 throw E_FEATURE_DEFERRED
  - devhub/src/main/services/skill/CloudSyncFacade.test.ts  # 验证全部返回 E_FEATURE_DEFERRED
  - devhub/src/shared/schemas/skill-cloud-sync.ts
  - devhub/src/renderer/views/skills/CloudSyncPanel.tsx  # 灰色显示"R9 启用"
modified_files:
  - devhub/src/main/ipc/skillHandlers.ts  # 注册占位通道
  - devhub/scripts/verify-no-cloud-deps.ts  # CI 校验
glob_anchors:
  - devhub/src/shared/schemas/skill.ts
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const CloudProviderEnum = z.enum(['none','self-hosted','custom-webhook'])

export const RemoteSkillManifestSchema = z.object({
  remoteId: z.string(),
  name: z.string(),
  version: z.string(),
  publishedAt: z.number().int(),
  size: z.number().int(),
  sha256: z.string(),
  provider: CloudProviderEnum,
})

export const SyncConflictPolicyEnum = z.enum(['local-wins','remote-wins','manual','timestamp'])

export const SyncRequestSchema = z.object({
  direction: z.enum(['push','pull','bidirectional']),
  conflictPolicy: SyncConflictPolicyEnum,
  skillNames: z.array(z.string()).optional(),  // null = all
})

export const SyncResultSchema = z.object({
  success: z.literal(false),  // 永远 false（占位）
  errorCode: z.literal('E_FEATURE_DEFERRED'),
  message: z.string(),
  scheduledRelease: z.literal('R9'),
})

export const CloudSyncStatusSchema = z.object({
  enabled: z.literal(false),  // 永远 false（占位）
  provider: CloudProviderEnum,
  lastSyncAt: z.null(),
  pendingCount: z.literal(0),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  skill:cloud-sync-status:
  rateClass: meta
  req: {}
  resp: CloudSyncStatus  # 永远 enabled=false
  skill:cloud-sync-trigger:
  rateClass: meta
  req: SyncRequest
  resp: SyncResult  # 永远 errorCode=E_FEATURE_DEFERRED
  skill:cloud-sync-list-remote:
  rateClass: meta
  req: {}
  resp: { skills: [], notice: 'feature deferred to R9' }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 任何 sync 调用 | E_FEATURE_DEFERRED（一律返回） |
| 引入云 SDK（CI 检测） | E_VALIDATION（构建失败） |
| 用户尝试启用 flag | (UI 灰显 + tooltip "R9 启用") |
| 网络抓包检测到云请求 | (CI 失败 NO-TELEMETRY) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (接口存在):
  given: 任何调用 skill:cloud-sync-trigger
  when: 调用
  then: resp.errorCode='E_FEATURE_DEFERRED'；resp.scheduledRelease='R9'

GWT-2 (UI 灰显):
  given: settings 面板 CloudSyncPanel
  when: 渲染
  then: 显示开关但 disabled；tooltip "R9 启用"

GWT-3 (无云依赖):
  given: package.json
  when: CI grep
  then: 0 个云 SDK 包（aws-sdk / @azure / @google-cloud / firebase 等）

GWT-4 (NO-TELEMETRY):
  given: 调用 sync-trigger
  when: 网络抓包
  then: 0 字节流向外部

GWT-5 (schema 完整):
  given: zod schemas
  when: 校验
  then: 所有 schema 已定义；TypeScript 编译通过
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 deferred error returned', async ({ page }) => {
  const result = await page.evaluate(() => window.electronAPI.skill.cloudSyncTrigger({
  direction: 'push', conflictPolicy: 'local-wins'
  }))
  expect(result.errorCode).toBe('E_FEATURE_DEFERRED')
  expect(result.scheduledRelease).toBe('R9')
})
```

---

## 8. reference_impl

```yaml
libraries: []  # 故意空
inspirations:
  - GraphQL @deprecated directive
  - PEP 387 (Python deprecation policy)
  - VSCode "preview" feature gating
ci_grep_pattern: |
  禁止 import:
  aws-sdk / @aws-sdk/* / @azure/* / @google-cloud/* / firebase
  parse / dropbox / supabase / appwrite / pocketbase
  @vercel/blob / kv-store
  扫描脚本 verify-no-cloud-deps.ts:
  - 读 package.json dependencies
  - grep 上述 pattern
  - 任何命中 → exit 1
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~280
modified_loc: ~50
test_loc: ~200
total: ~530
risk_areas:
  - 未来 R9 启用时的兼容性（schema 已锁定）
  - 用户误以为已实现 → UI 必须明确"R9 启用"
```

---

## 10. implement_checklist

- [x] CloudSyncFacade 全部方法 throw E_FEATURE_DEFERRED
- [x] schemas/skill-cloud-sync.ts 完整定义（当前按 spec-33 统一收敛在 `shared/schemas/r8-runtime.ts` SoT）
- [x] CloudSyncPanel UI 灰色 + tooltip（当前由 R8 Ops 禁用接口卡片展示 deferred 状态）
- [x] verify-no-cloud-deps.ts CI 集成
- [x] vitest 验证 5 GWT
- [x] feature flag R8.C.skill.cloud-sync 默认 OFF（永久 OFF in R8）
- [x] audit log: 任何调用尝试都记录（用户行为分析）
- [x] documentation: 标"R9 will enable"

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-09: SkillLibrary 提供本地 skills 数据
  - R8.C.spec-37: permission ttl（未来同步需要授权）
downstream:
  - R9 (future): 真实实现
```

---

## 12. fallback_strategy

```yaml
on_user_attempts_enable:
  - flag 永远 OFF；UI tooltip 提示"R9 启用"
on_ci_detect_cloud_dep:
  - 构建失败 + 列出违规依赖
flag_off_behavior:
  - R8.C.skill.cloud-sync=OFF（默认）：所有调用返回 E_FEATURE_DEFERRED
  - 永远不应该 ON until R9
```

---

## 13. performance_budget

```yaml
deferred_response_p99_ms: { warn: 5, fatal: 50 }  # 仅返回错误对象，应极快
ci_check_seconds: { warn: 10, fatal: 60 }
```

---

## 2026-05-05 implementation_status

- Status: executable R8.C spec-38 deferred contract complete for this task.
- Runtime: `devhub/src/main/services/R8RuntimeService.ts` exposes a cloud-sync facade that always returns `enabled=false`, `scheduledRelease='R9'`, and `E_FEATURE_DEFERRED`.
- IPC/preload: `skill:cloud-sync-status`, `skill:cloud-sync-trigger`, and `skill:cloud-sync-list-remote` are wired alongside legacy `skill:cloud-sync-disabled` compatibility.
- Network/deps: the facade performs no network calls, imports no cloud SDK, and returns an empty remote skill list.
- Verification: `pnpm check:no-cloud-deps` passed, and focused Vitest proved deferred status/trigger/list-remote responses.

## 2026-05-10 verification_update

- `devhub/src/shared/schemas/r8-runtime.ts` remains the executable Zod SoT for cloud-sync request/status/result/remote-list contracts; no separate schema island was introduced.
- `devhub/src/main/services/R8RuntimeService.ts` now audits all R8 cloud-sync calls: disabled compatibility, status, trigger, and remote-list all record refused local audit events.
- `devhub/src/renderer/components/monitor/R8OpsPanel.tsx` renders Skill Cloud Sync as a disabled/deferred row with a tooltip explaining R9 deferral and no network sync.
- `devhub/docs/r8/deferred-integrations.md` documents the R8 user-facing boundary: `E_FEATURE_DEFERRED`, `enabled=false`, `scheduledRelease='R9'`, no cloud SDK imports, no network sync.
- Verified by `pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "cloud sync|OCR|ocr|feature flag|resilience contracts|deferred"`, `pnpm -C devhub check:no-cloud-deps`, and `pnpm -C devhub typecheck`.
