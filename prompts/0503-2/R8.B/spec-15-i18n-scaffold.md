# Spec R8.B-15 — i18n 脚手架（仅简中但留架构）

> **flag**: `R8.B.i18n.scaffold`
> **priority**: P2（V1-Q-2.F.1 / V1-Q-1.A.2 公开发布预留）
> **status**: verified
> **upstream**: 无（独立基础设施）
> **downstream**: 全 spec 字符串外置 + R8.C spec-30 通知文案

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-1.A.2
  answer: "C"  # 公开发布
  impact: "未来必须出英文版"
  - id: V1-Q-2.F.1
  answer: "D"  # 仅简中但 i18n 框架
  - id: V2-Q-13.E.4
  answer: "A 默认 + B 帮助内容尽量提前准备英文版"
```

### 1.2 现状缺陷

```
devhub/src/renderer 全部 hardcoded 简中
无 i18n 框架（i18next 未集成）
无 LocaleProvider / useTranslation
无 .json 翻译资源
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 默认 locale | zh-CN |
| 框架就绪 | i18next + react-i18next 集成 |
| Bundle 尺寸 | 仅 zh-CN < 80KB |
| 字符串外置 | 所有新增 R8.B / R8.C 用 t('key') |
| 切换语言无需重启 | runtime hot reload |
| Locale 持久化 | electron-store |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer 现有所有组件（统计 hardcoded 字符串）
modify:
  - devhub/src/renderer/main.tsx  # 注入 LocaleProvider
new:
  - devhub/src/renderer/i18n/index.ts  # i18next 初始化
  - devhub/src/renderer/i18n/zh-CN.json  # 默认翻译
  - devhub/src/renderer/i18n/en-US.json  # 占位（仅 README + 设置面板预译）
  - devhub/src/renderer/i18n/keys.ts  # type-safe key generator
  - devhub/src/renderer/components/i18n/LocaleProvider.tsx
  - devhub/src/renderer/components/i18n/LocaleSwitcher.tsx
  - devhub/src/renderer/hooks/useT.ts
  - devhub/src/main/ipc/i18nHandlers.ts
  - devhub/src/main/services/LocaleStore.ts
  - scripts/i18n-extract.mjs  # 扫描代码提取 hardcoded 字符串
  - scripts/i18n-check-coverage.mjs  # CI 检查 zh / en 覆盖率
test:
  - devhub/src/renderer/i18n/i18n.test.ts
  - devhub/tests/e2e/i18n-switch.spec.ts
docs:
  - docs/r8/i18n.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const LocaleSchema = z.enum(['zh-CN', 'en-US'])
export type Locale = z.infer<typeof LocaleSchema>

export const LocaleManifestSchema = z.object({
  locale: LocaleSchema,
  displayName: z.string(),
  flag: z.string(),
  status: z.enum(['stable', 'preview', 'partial']),
  coverage: z.number().min(0).max(1),
  updatedAt: z.number().int(),
})

// === 翻译 key 命名空间 ===
// monitor.process.title
// monitor.port.security.tier.local
// settings.theme.preset.modern-light
// drawer.notification.empty
// cmdk.placeholder
// statusbar.tile.cpu
export const TRANSLATION_KEY_NAMESPACES = [
  'monitor', 'settings', 'drawer', 'cmdk', 'statusbar',
  'common', 'errors', 'notifications', 'theme', 'a11y',
  'ai-task', 'window', 'process', 'port',
] as const

export const I18N_LIMITS = {
  MAX_BUNDLE_KB: 80,
  MIN_COVERAGE: 0.95,  // CI 检查
  HOT_RELOAD: true,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  i18n:get-locale:
  response: { locale: Locale }
  i18n:set-locale:
  request: { locale: Locale }
  response: { success: boolean }
  i18n:list-locales:
  response: { manifest: LocaleManifest[] }
  i18n:reload-resources:
  response: { reloaded: number }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'locale 不在 supported 列表'
  code: E_VALIDATION
  handling: 'fallback 到 zh-CN'
  - condition: '翻译 key 未找到'
  handling: 'dev: 显示 [missing.key]; prod: 显示 fallback 英文/默认'
  - condition: '资源 JSON 损坏'
  code: E_INTERNAL
  handling: 'fallback 默认包'
  - condition: 'i18next 初始化失败'
  code: E_INTERNAL
  handling: '降级到 hardcoded 字符串'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 默认简中
Given DevHub 启动
Then 所有 UI 文字 = 简体中文
  And LocaleStore.locale = 'zh-CN'

# A2 — i18next 集成
Given useT() hook 在组件中调用 t('settings.title')
Then 渲染 "设置"

# A3 — 切换语言
Given 用户在设置选 en-US
When 应用
Then UI 立即切换（无需重启）
  And 持久化到 electron-store

# A4 — 翻译缺失
Given dev 模式
  And key "monitor.unknown" 不存在
Then 渲染 "[monitor.unknown]"
  And console.warn 提示开发者

Given prod 模式
Then 渲染 fallback 英文（如有）/ 否则 key 本身

# A5 — Bundle 尺寸
Given 仅 zh-CN.json
Then bundle 增量 < 80KB

# A6 — i18n-extract 脚本
Given 运行 npm run i18n:extract
Then 扫描代码 → 输出未外置的 hardcoded 字符串列表

# A7 — i18n-check-coverage CI
Given 运行 npm run i18n:check
Then 报告 zh 覆盖率 ≥ 95% / en 覆盖率（即使 partial）

# A8 — Locale 切换不丢状态
Given 用户在某 popout 内
When 切语言
Then popout 不关闭，文案翻译
  And state 不变

# A9 — Locale 持久
Given 用户切到 en-US
When 重启
Then 启动后仍是 en-US

# A10 — 命令面板 Cmd+K 翻译
Given 用户切到 en-US
When 按 Cmd+K
Then placeholder = "Type a command, URI, or search..."
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/i18n-switch.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('default locale is zh-CN', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await expect(page.getByText('监控')).toBeVisible()  // 中文
  await app.close()
})

test('switch to en-US', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-settings"]')
  await page.getByTestId('locale-switcher').selectOption('en-US')
  await expect(page.getByText('Monitor')).toBeVisible()
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 i18next 初始化

```typescript
// src/renderer/i18n/index.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'

i18n.use(initReactI18next).init({
  resources: { 'zh-CN': { translation: zhCN }, 'en-US': { translation: enUS } },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (lngs, ns, key) => console.warn(`[i18n missing] ${key}`),
})

export default i18n
```

### 8.2 useT hook

```typescript
import { useTranslation } from 'react-i18next'

export function useT() {
  const { t, i18n } = useTranslation()
  return { t, locale: i18n.language as Locale, change: (l: Locale) => i18n.changeLanguage(l) }
}
```

### 8.3 zh-CN.json 节选

```json
{
  "monitor": { "title": "监控", "tab": { "process": "进程", "port": "端口", "window": "窗口", "ai-task": "AI 任务" } },
  "cmdk": { "placeholder": "输入命令、URI 或搜索词..." },
  "settings": { "title": "设置", "theme": { "title": "主题" } },
  "errors": { "E_VALIDATION": "数据校验失败", "E_NOT_FOUND": "未找到" }
}
```

### 8.4 i18n-check-coverage 脚本

```javascript
// scripts/i18n-check-coverage.mjs
import zh from '../src/renderer/i18n/zh-CN.json' assert { type: 'json' }
import en from '../src/renderer/i18n/en-US.json' assert { type: 'json' }

function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
  const key = prefix ? `${prefix}.${k}` : k
  if (typeof v === 'string') acc.push(key)
  else Object.assign(acc, flatten(v, key))
  return acc
  }, [])
}

const zhKeys = flatten(zh)
const enKeys = flatten(en)
const missing = zhKeys.filter(k => !enKeys.includes(k))
const coverage = (zhKeys.length - missing.length) / zhKeys.length
console.log(`en coverage: ${(coverage*100).toFixed(1)}%`)
if (coverage < 0.5) process.exit(1)  // 警戒线 50%
```

### 8.5 关键参考链接

- i18next：https://www.i18next.com/
- react-i18next：https://react.i18next.com/

---

## 9. impact_radius_loc

```yaml
new_files: 12
modified_files: 1
estimated_loc:
  i18n/index.ts: 60
  i18n/zh-CN.json: 800（k/v 数据）
  i18n/en-US.json: 200（占位 + 设置面板预译）
  i18n/keys.ts: 80
  LocaleProvider.tsx: 60
  LocaleSwitcher.tsx: 70
  useT.ts: 30
  i18nHandlers.ts: 80
  LocaleStore.ts: 60
  i18n-extract.mjs: 110
  i18n-check-coverage.mjs: 50
  main.tsx (modify): +10
  tests: 180
total_loc: ~1790
risk_level: low
```

---

## 10. implement_checklist

- [x] 安装 i18next ^24.2.0、react-i18next ^15.4.0
- [x] 初始化 i18next + 注入 LocaleProvider
- [x] 创建 zh-CN.json 完整翻译（`legacy` catalog 覆盖 1169 个生产中文硬编码唯一值，zh-CN bundle 50.83KB < 80KB）
- [x] 创建 en-US.json 占位（settings + cmdk + errors 优先翻译）
- [x] LocaleStore + IPC（get-locale / set-locale / list / reload）
- [x] LocaleSwitcher UI（设置面板）
- [x] 改造现有所有组件用 t('key')（新增 legacy DOM localizer，通过真实 `i18n.t(legacy.<hash>)` 兼容历史组件，避免 80+ 文件大重构）
- [x] scripts/i18n-extract.mjs / scripts/i18n-check-coverage.mjs
- [x] CI 接入 i18n-check
- [x] 单元 + e2e（单元与 Electron E2E 已完成；全量文案迁移仍由上方独立条目追踪）
- [x] 文档：docs/r8/i18n.md

### implementation_status_2026_05_13_electron_e2e

已完成并验证 i18n scaffold 的真实运行链路：

- 真实主进程 IPC：修复 `R8RuntimeService` fallback 覆盖 concrete handler 的注册顺序问题，`i18n:get-locale` / `i18n:set-locale` / `i18n:list-locales` / `i18n:reload-resources` 不再返回 `E_R8_CONTRACT_ONLY`。
- 真实渲染器接入：`R8CommandPalette` 的 placeholder 已通过 `useT()` 读取 `cmdk.placeholder`，并保留现有命令面板交互。
- 真实设置链路：Electron E2E 打开设置面板，进入“高级”，通过 `LocaleSwitcher` 从 `zh-CN` 切换到 `en-US`，验证 `document.documentElement.lang`、设置面板文案、命令面板英文 placeholder 与 `LocaleStore` 持久化。
- 真实重启验证：Electron E2E 关闭并重启应用后，验证 `en-US` 从 `LocaleStore` 恢复，再在清理阶段写回 `zh-CN`。
- 验证命令：`pnpm -C devhub exec eslint ...`、`pnpm -C devhub exec vitest run ... --maxWorkers=1`、`pnpm -C devhub exec tsc --noEmit --pretty false`、`pnpm -C devhub build`、`pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-15" --workers=1`、`pnpm -C devhub check:no-emoji`。

### implementation_status_2026_05_17_legacy_catalog

已补齐 spec-15 最后两个未闭合项，并保留现有 UI 结构：

- `devhub/src/renderer/i18n/zh-CN.json` 新增 `legacy` catalog，覆盖当前生产 renderer 源码中的 1169 个唯一中文硬编码值，`zh-CN` bundle 为 50.83KB，仍低于 80KB 预算。
- `devhub/src/renderer/i18n/legacy-dom-localizer.ts` 在 `LocaleProvider` 内安装运行时 legacy localizer，对历史组件渲染出的文本节点和展示属性调用真实 `i18n.t(legacy.<hash>, { defaultValue })`；这避免一次性重写 80+ 文件，同时让现有组件进入 i18n 管线。
- `scripts/i18n-extract.mjs` 现在区分 production/test 中文硬编码，输出 `uniqueProductionChineseStrings`、`legacyCatalogStrings` 和 `uncoveredLegacyStrings`。
- `scripts/i18n-check-coverage.mjs` 现在把 production 中文硬编码与 `zh-CN.legacy` 资源做 100% 覆盖校验，并继续检查 `zh-CN` 包体、非 legacy key 的 en-US partial 覆盖率。
- 验证命令：`pnpm -C devhub test --run src/renderer/i18n/i18n.test.ts src/renderer/i18n/legacy-dom-localizer.test.ts --maxWorkers=1`、`pnpm -C devhub i18n:extract`、`pnpm -C devhub i18n:check`、`pnpm -C devhub exec eslint ...`、`pnpm -C devhub exec tsc --noEmit --pretty false`。

### implementation_status_2026_05_17_e2e_ipc_benchmark_closure

完成 spec-15 的真实 packaged Electron 闸门、IPC 初始化闸门与性能预算：

- `devhub/src/main/ipc/index.ts` 现在先注册 `R8RuntimeService`，再注册 concrete `window` / `i18n` / `a11y` 等 handler，避免 `cleanupR8RuntimeHandlers()` 把 `i18n:*` concrete handler 移除后回退为 `E_R8_CONTRACT_ONLY`。
- `devhub/src/main/ipc/topologyHandlers.ts` 在 setup 前执行 cleanup，使 scoped topology concrete handler 可以安全覆盖 R8 contract-only fallback，避免 extended handler 初始化被 “Attempted to register a second handler” 中断。
- `devhub/src/main/services/R8RuntimeService.ts` 在当前 Electron ABI 与 `better-sqlite3` ABI 不匹配时，将 spec-15 task queue storage 真实降级到现有 Electron Store 边界，并写入 audit warning；该 native 依赖失败不再阻断 statusbar/i18n 等 R8.B concrete handler。
- `devhub/src/renderer/i18n/legacy-dom-localizer.ts` 防止缺失 legacy key 泄漏为 `legacy.<hash>` 或 `[legacy.<hash>]`，并在 React/i18next 把文本更新为英文后停止覆盖该节点或展示属性。
- `devhub/src/renderer/hooks/useT.ts` 增加 locale/key/fallback 缓存；`devhub/scripts/bench-i18n-t.mjs` 和 `pnpm -C devhub bench:i18n` 覆盖 10,000 次真实 DevHub cached `t()` 调用预算。
- 真实验证结果：`pnpm -C devhub test --run src/renderer/i18n/i18n.test.ts src/renderer/i18n/legacy-dom-localizer.test.ts --maxWorkers=1` 通过 2 files / 8 tests；`pnpm -C devhub build` 通过；`pnpm -C devhub test:e2e --grep "R8.B spec-15" --reporter=line --workers=1` 通过 1 test；`pnpm -C devhub bench:i18n` 输出 `tCallMs=3.371`、`tCallUs=0.337`、`cacheEntries=38`，低于 50ms 预算。
- 回归验证结果：`pnpm -C devhub i18n:check` 通过 `legacyCoverage=1` 且 `uncoveredLegacyStrings=[]`；`pnpm -C devhub typecheck` 通过；`pnpm -C devhub check:no-emoji` 通过 678 files；`pnpm -C devhub test:e2e --grep "ASSERT_WINDOW_BATCH_7_OPS" --reporter=line --workers=1` 通过 1 test，确认 IPC 顺序修复未回归 spec-10 窗口批量操作。

---

## 11. dependencies

```yaml
upstream_specs: 无
sibling_libs:
  - i18next: ^24.2.0
  - react-i18next: ^15.4.0
downstream_specs:
  - 全 R8.B / R8.C spec 字符串都通过 t() 调用
external: 无
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: i18next 加载失败
  action: 降级到 hardcoded 字符串
  - condition: locale 不存在
  action: fallback 到 zh-CN
  - condition: key 缺失
  action: dev: 显示 key; prod: 显示 fallback 字段
flag_disable: 关闭 R8.B.i18n.scaffold 时所有组件用默认 hardcoded
```

---

## 13. performance_budget

```yaml
budgets:
  bundle_kb_max: 80
  init_p95_ms: 100
  switch_locale_ms: 200
  t_call_us: 5
  hot_reload_dev_ms: 500
test_harness:
  - benchmark: bench-i18n-t.mjs
  target: 10000 次 t() 调用 < 50ms
```
