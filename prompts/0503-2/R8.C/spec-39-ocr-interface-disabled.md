# spec-39-ocr-interface-disabled — OCR 接口预留（必返回 E_OCR_DISABLED）

> **batch**: R8.C  |  **flag**: `R8.C.ocr.interface` (HARDCODED OFF)
> **depends_on**: R8.C spec-33 (zod sot)
> **derives_from**: master §10 NO-OCR-INTEGRATION + R8C-RISK-18 + V1-Q-9.H.3 答 D 接口预留

---

## 1. motivation

```yaml
user_quote_v1_q_9_h_3: "D — OCR 接口预留但不实现；防止后期突然需要时返工"
master_constraint: "NO-OCR-INTEGRATION — 不引入任何 OCR 库（tesseract / paddle / cloud-ocr）"
goals:
  - 仅定义 OCR 接口契约（OcrRequest / OcrResult schema）
  - 所有调用必返回 E_OCR_DISABLED
  - CI 强制阻止 OCR 库 import
  - 未来 R9+ 启用时 schema 已就位
constraint:
  - 0 OCR 库依赖（CI grep 阻止 tesseract / paddleocr / @azure/cognitiveservices-vision）
  - 任何调用 → E_OCR_DISABLED
  - 不允许 R8 阶段启用此 flag（硬编码 OFF）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/ocr/OcrFacade.ts  # 全部方法 throw E_OCR_DISABLED
  - devhub/src/main/services/ocr/OcrFacade.test.ts
  - devhub/src/shared/schemas/ocr.ts
  - devhub/scripts/verify-no-ocr-deps.ts  # CI 校验
modified_files:
  - devhub/src/main/ipc/ocrHandlers.ts  # 注册占位通道
  - .github/workflows/ci.yml  # 加 verify-no-ocr-deps
glob_anchors:
  - devhub/package.json
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const OcrLanguageEnum = z.enum(['eng','chs','cht','jpn','kor','rus','ara'])

export const OcrRequestSchema = z.object({
  imageBase64: z.string(),
  languages: z.array(OcrLanguageEnum).min(1),
  rotateAuto: z.boolean().default(true),
  preprocessFilters: z.array(z.enum(['grayscale','denoise','threshold','sharpen'])).optional(),
})

export const OcrTextBlockSchema = z.object({
  text: z.string(),
  bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  confidence: z.number().min(0).max(1),
  language: OcrLanguageEnum,
})

export const OcrResultSchema = z.object({
  success: z.literal(false),  // 永远 false（接口预留）
  errorCode: z.literal('E_OCR_DISABLED'),
  message: z.string(),
  blocks: z.array(OcrTextBlockSchema).default([]),
  notice: z.literal('OCR feature is intentionally disabled in R8; see master §10 NO-OCR-INTEGRATION'),
})

export const OcrCapabilitiesSchema = z.object({
  enabled: z.literal(false),  // 硬编码 false
  reason: z.literal('NO-OCR-INTEGRATION constraint'),
  futureRelease: z.string().nullable().default(null),  // null = 无计划
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  ocr:capabilities:
  rateClass: meta
  req: {}
  resp: OcrCapabilities  # 永远 enabled=false
  ocr:recognize:
  rateClass: meta
  req: OcrRequest
  resp: OcrResult  # 永远 errorCode=E_OCR_DISABLED
  ocr:list-supported-languages:
  rateClass: meta
  req: {}
  resp: { languages: [], notice: 'OCR disabled' }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 任何 ocr:recognize 调用 | E_OCR_DISABLED（一律返回） |
| 引入 OCR 库（CI 检测） | E_VALIDATION（构建失败） |
| 用户启用 flag | (硬编码忽略；flag 必 OFF) |
| imageBase64 解码 | (不解码；直接返回 disabled) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (always disabled):
  given: 任何 ocr:recognize 调用
  when: 调用
  then: resp.errorCode='E_OCR_DISABLED'；blocks=[]

GWT-2 (capabilities false):
  given: ocr:capabilities
  when: 查询
  then: enabled=false reason='NO-OCR-INTEGRATION constraint'

GWT-3 (CI 阻止 OCR 依赖):
  given: package.json 含 'tesseract.js'
  when: verify-no-ocr-deps.ts 运行
  then: exit 1 + 列出违规依赖

GWT-4 (schema 完整):
  given: zod schemas
  when: 编译
  then: 通过 + R9+ 启用时可直接使用

GWT-5 (NO-TELEMETRY):
  given: 调用 ocr:recognize
  when: 网络抓包
  then: 0 字节流向外部（无云 OCR 调用）
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 ocr always returns disabled', async ({ page }) => {
  const result = await page.evaluate(() => window.electronAPI.ocr.recognize({
  imageBase64: 'iVBORw0KGgoAAAANSUhEUg...',  // 即使是真图也不处理
  languages: ['eng'],
  }))
  expect(result.success).toBe(false)
  expect(result.errorCode).toBe('E_OCR_DISABLED')
  expect(result.blocks).toEqual([])
})
```

---

## 8. reference_impl

```yaml
libraries: []  # 故意空（硬约束）
forbidden_libraries:
  - tesseract.js
  - tesseract.js-core
  - node-tesseract-ocr
  - paddleocr
  - paddle-ocr
  - @azure/cognitiveservices-computervision
  - @google-cloud/vision
  - aws-sdk-textract
  - amazon-textract
ci_grep_pattern: |
  // verify-no-ocr-deps.ts
  - 读 package.json 全 deps
  - 命中 forbidden_libraries 任一 → exit 1
  - 扫描 src/**/*.ts，禁止 import tesseract / paddle / vision / textract
inspirations:
  - GraphQL @forbidden directive
  - feature flags with hardcoded OFF
  - Linux SECCOMP block syscall
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~250
modified_loc: ~30
test_loc: ~180
total: ~460
risk_areas:
  - 未来 R9+ 启用时 schema 兼容
  - CI 脚本误判（非 OCR 但名称相似的包）
```

---

## 10. implement_checklist

- [x] OcrFacade 全方法 throw E_OCR_DISABLED
- [x] schemas/ocr.ts 完整 zod 定义（当前按 spec-33 统一收敛在 `shared/schemas/r8-runtime.ts` SoT）
- [x] OcrCapabilities enabled 硬编码 false
- [x] verify-no-ocr-deps.ts CI 强制
- [x] vitest 5 GWT 全部通过
- [x] feature flag R8.C.ocr.interface 硬编码 OFF（不可启用）
- [x] audit log: 任何调用记录（识别误用）
- [x] documentation: 在用户文档明确"OCR 不支持"

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-33: schema SoT
downstream:
  - R9+ (future): 启用真实实现
external_constraint:
  - master §10 NO-OCR-INTEGRATION
  - R8C-RISK-18
```

---

## 12. fallback_strategy

```yaml
on_user_attempts:
  - 任何调用 → E_OCR_DISABLED；UI 不暴露入口
on_ci_violation:
  - 构建失败 + 列出违规
on_misuse_detection:
  - 1 小时内 ≥ 100 次调用 → 通知用户（可能 bug）
flag_off_behavior:
  - R8.C.ocr.interface 永久 OFF（R8 整阶段）
```

---

## 13. performance_budget

```yaml
disabled_response_p99_ms: { warn: 5, fatal: 50 }  # 仅返回错误对象
ci_check_seconds: { warn: 10, fatal: 60 }
```

---

## 2026-05-05 implementation_status

- Status: executable R8.C spec-39 disabled contract complete for this task.
- Runtime: `devhub/src/main/services/R8RuntimeService.ts` exposes an OCR facade that validates request shape but never decodes image bytes, starts OCR engines, imports OCR SDKs, or calls network OCR services.
- IPC/preload: `ocr:capabilities`, `ocr:recognize`, and `ocr:list-supported-languages` are wired.
- Contract: `ocr:capabilities` returns `enabled=false`; `ocr:recognize` returns `success=false`, `errorCode='E_OCR_DISABLED'`, and `blocks=[]`; supported languages returns an empty list.
- Verification: `pnpm check:no-ocr-deps` passed, and focused Vitest proved disabled OCR responses.

## 2026-05-10 verification_update

- `devhub/src/shared/schemas/r8-runtime.ts` remains the executable Zod SoT for OCR recognize request, disabled response, capabilities, supported language response, and registry exports; no separate schema island was introduced.
- `devhub/src/main/services/R8RuntimeService.ts` keeps OCR hard-disabled and now audits all OCR calls: capabilities, recognize, and supported-language list all record refused local audit events.
- `devhub/src/renderer/components/monitor/R8OpsPanel.tsx` renders OCR as a disabled row with a tooltip explaining that R8 returns `E_OCR_DISABLED` and does not load OCR engines.
- `devhub/docs/r8/deferred-integrations.md` documents the R8 user-facing boundary: OCR is not supported, `ocr:recognize` returns `success=false`, `errorCode='E_OCR_DISABLED'`, and `blocks=[]`.
- Verified by `pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "cloud sync|OCR|ocr|feature flag|resilience contracts|deferred"`, `pnpm -C devhub check:no-ocr-deps`, and `pnpm -C devhub typecheck`.
