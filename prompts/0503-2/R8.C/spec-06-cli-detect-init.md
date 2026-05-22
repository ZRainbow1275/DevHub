# spec-06-cli-detect-init — CLI 工具检测与初始化

> **batch**: R8.C  |  **flag**: `R8.C.cli.detect`
> **depends_on**: R8.A spec-01 (integration-libs), R8.C spec-01..05
> **blocks**: R8.C spec-07 (monitor window 列出工具)、spec-15 (任务调度)

---

## 1. motivation

```yaml
user_quote_v1_q_7_b_2: "5 工具单独路线（Codex D / Claude C+D / Gemini C+D / Cursor B / Copilot B）"
pain_point: "DevHub 启动时不知用户装了哪些 CLI；SHIM 安装/启用要先确认目标存在"
goals:
  - 启动时一次性检测 5 工具：codex / claude / gemini / cursor / copilot
  - 探测策略：which/where → version 子命令 → 已知路径白名单
  - 输出 ToolDetectResult，含 path / version / strategy 推荐
  - 监控窗口（spec-07）按检测结果动态显示工具卡
constraint:
  - 不调用任何在线 API（隐私 + 离线优先）
  - 检测超时 3s 单工具
  - 用户可手动指定路径覆盖检测结果
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/cli-parser/CliDetector.ts
  - devhub/src/main/services/cli-parser/CliDetector.test.ts
  - devhub/src/main/services/cli-parser/ToolWhitelist.ts  # 已知路径白名单
  - devhub/src/shared/schemas/tool-detect.ts
  - devhub/src/renderer/views/settings/ToolDetectPanel.tsx
modified_files:
  - devhub/src/main/index.ts  # 启动时调用 detect()
  - devhub/src/main/services/cli-parser/ParserRegistry.ts  # 根据 detect 结果激活 parser
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts  # 注入 detector
glob_anchors:
  - devhub/src/main/index.ts:1-100
  - devhub/src/renderer/views/settings/SettingsPanel.tsx:1-200
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const ToolNameEnum = z.enum(['codex','claude','gemini','cursor','copilot'])

export const ToolDetectResultSchema = z.object({
  tool: ToolNameEnum,
  found: z.boolean(),
  path: z.string().nullable(),
  version: z.string().nullable(),
  detectStrategy: z.enum(['path-env','where','known-path','user-override','module-list']),
  recommendedParser: z.enum(['ndjson','shim','line','sse','window-title']).nullable(),
  capabilities: z.array(z.enum(['stream-json','json-flag','marker','window-only'])),
  detectedAt: z.number().int(),
  errors: z.array(z.string()),
})

export const ToolDetectionStateSchema = z.object({
  results: z.array(ToolDetectResultSchema),
  lastFullScanAt: z.number().int(),
  scanDurationMs: z.number().int(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  cli:detect-all:
  req: { force: boolean }  # force=true 跳过 cache
  resp: ToolDetectionState
  cli:detect-one:
  req: { tool: ToolName }
  resp: ToolDetectResult
  cli:set-tool-override:
  req: { tool: ToolName, path: string, confirmedBy: string }
  resp: { tool: ToolName, path: string, version: string | null }
  cli:clear-tool-override:
  req: { tool: ToolName, confirmedBy: string }
  resp: { tool: ToolName, cleared: boolean, previousPath: string | null }
  cli:detection-event:  # 推送：用户启动 DevHub 后 5s 完成检测
  payload: ToolDetectionState
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| where/which 命令失败 | E_INTERNAL（继续尝试 known-path） |
| version 子命令超时 | E_TIMEOUT（标 found=true version=null） |
| 用户 override 路径不存在 | E_VALIDATION |
| 检测进程崩溃 | E_INTERNAL |
| 多版本同名（codex 在 nvm + global） | (按 PATH 优先序选第一个) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (全量检测):
  given: 用户系统已装 codex + claude，未装 gemini
  when: cli:detect-all force=true
  then: results 5 项；codex/claude found=true，gemini found=false errors 含 "not in PATH"

GWT-2 (版本探测):
  given: codex 已装于 PATH
  when: detect codex
  then: version 字段非 null；recommendedParser='shim'

GWT-3 (用户 override):
  given: gemini 在非标准路径 D:\tools\gemini.exe
  when: cli:set-tool-override tool=gemini path=D:\tools\gemini.exe
  then: 重新检测 found=true detectStrategy='user-override'

GWT-4 (capability):
  given: claude 版本 0.2.5（含 stream-json）
  when: detect claude
  then: capabilities 包含 'stream-json'
  and: recommendedParser='ndjson'

GWT-5 (cache):
  given: 上次扫描 5 分钟内
  when: cli:detect-all force=false
  then: 直接返回 cache 不重扫
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 detect-all returns 5 tools', async ({ page }) => {
  const state = await page.evaluate(() => window.electronAPI.cli.detectAll({ force: true }))
  expect(state.results.length).toBe(5)
  const tools = new Set(state.results.map((r: any) => r.tool))
  ;['codex','claude','gemini','cursor','copilot'].forEach(t => expect(tools.has(t)).toBe(true))
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'execa@9.5':  spawn version 子命令
  - 'which@4.0':  跨平台 PATH 探测
  - 'semver@7.6':  version 解析
inspirations:
  - VSCode language server detection
  - GitHub CLI auto-update version 探测
  - npm doctor
known_paths_examples:
  windows:
  codex: ['%LOCALAPPDATA%/Programs/codex/codex.exe', 'C:/Program Files/codex/codex.exe']
  claude: ['%LOCALAPPDATA%/AnthropicClaude/claude.exe', '%APPDATA%/npm/claude.cmd']
  gemini: ['%LOCALAPPDATA%/Google/gemini/gemini.exe']
  macos:
  codex: ['/usr/local/bin/codex', '/opt/homebrew/bin/codex']
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~520
modified_loc: ~150
test_loc: ~350
total: ~1020
risk_areas:
  - 用户路径含中文/空格（execa quoting）
  - 检测启动延迟 < 5s
```

---

## 10. implement_checklist

- [x] 并行检测 5 工具（Promise.allSettled）
- [x] 单工具超时 3s（execa timeout）
- [x] cache TTL 5 分钟（用户切换 PATH 后失效）
- [x] 用户 override 写 store.json
- [x] settings 面板 ToolDetectPanel 显示当前状态 + "重新扫描"
- [x] 启动后 cli:detection-event 推送给 renderer
- [x] cursor / copilot 用 module-list 策略（无 CLI）
- [x] vitest 覆盖 5 GWT（使用真实 `process.execPath` override，不使用模拟 execa）
- [x] feature flag R8.C.cli.detect 默认 ON
- [x] audit log: 检测耗时 / 工具列表

---

## 11. dependencies

```yaml
upstream:
  - R8.A.spec-01: execa / which / semver 已安装
  - R8.A.spec-02: ProcessUnifiedVM 提供 module-list（cursor/copilot）
  - R8.C.spec-01..05: parser 注册依赖检测结果
downstream:
  - R8.C.spec-07: monitor window 显示工具列表
  - R8.C.spec-15: 任务调度按可用工具路由
```

---

## 12. fallback_strategy

```yaml
on_detect_timeout:
  - 标 found=true version=null（保守）
  - 后续重试由用户触发
on_zero_tools_found:
  - settings 面板提示 "未检测到任何 AI CLI"
  - 不强制安装；仅引导用户手动指定路径
flag_off_behavior:
  - R8.C.cli.detect=OFF 时 monitor 显示 5 工具均不可用
```

---

## 13. performance_budget

```yaml
detect_total_ms: { warn: 5000, fatal: 15000 }
detect_per_tool_ms: { warn: 1500, fatal: 3000 }
cache_ttl_ms: 300000
memory_kb: { warn: 128, fatal: 512 }
ipc_channel: cli:detect-all → spec-31 low_freq_op 120 RPM
```

## 14. Implementation Evidence - 2026-05-04 CLI Detect Init Hardening

```yaml
status: partial_verified_executable_detection
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
verified_gwt_subset:
  parallel_detection: cli:detect-all uses Promise.allSettled across codex, claude, gemini, cursor, and copilot so one failed probe cannot abort the full scan
  cache_ttl: non-force detectTool cache TTL is 300000 ms
  timeout: version probe timeout is 3000 ms per tool
  override_validation: cli:set-tool-override rejects missing paths with E_VALIDATION
  windows_path_execution: existing override executable paths run through execFile without shell=true to preserve paths containing spaces
real_probe_evidence:
  - test uses process.execPath as an existing executable override and verifies detectTool(force=true) returns found=true detectStrategy=user-override
not_claimed_done:
  - renderer ToolDetectPanel
  - startup cli:detection-event broadcast
  - known-path whitelist expansion beyond current command map
verification:
  targeted_tests: R8RuntimeService and r8RuntimeHandlers passed with --maxWorkers=1
  typecheck: passed
```

## 15. Implementation Evidence - 2026-05-08 CLI Detection State, Event, and Settings Panel

```yaml
status: partial_verified_executable_detection_extended
implemented_now:
  - devhub/src/shared/schemas/tool-detect.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/main/ipc/index.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/src/renderer/views/settings/ToolDetectPanel.tsx
  - devhub/src/renderer/components/settings/SettingsDialog.tsx
  - devhub/src/renderer/components/monitor/R8OpsPanel.tsx
verified_now:
  tool_detection_state:
  - cli:detect-all returns ToolDetectionState with exactly five ToolDetectResult rows
  - ToolDetectResult includes checkedAt/detectedAt, errors[], recommendedParser, capabilities, and bounded strategy enum
  - r8RuntimeSchemaRegistry exposes ToolDetectionState and request schemas
  detection_runtime:
  - detectTools uses Promise.allSettled across codex, claude, gemini, cursor, and copilot
  - each execFile version probe remains timeout bounded at 3000ms
  - non-force detectTool uses 300000ms cache TTL
  - user overrides are persisted in electron-store and validated with existsSync
  - cursor/copilot can resolve from real scanner module/window lists with detectStrategy=module-list
  event_and_audit:
  - detectTools sends cli:detection-event to the renderer after every full scan
  - startup IPC initialization schedules a non-blocking detectTools({ force:false }) run
  - auditLogger records cli:detect-all durationMs, scanned tool list, and found tools
  renderer:
  - Settings Advanced contains ToolDetectPanel with current status rows and force rescan
  - R8OpsPanel consumes ToolDetectionState.results and scanDurationMs
  - preload exposes detectAll state response and onDetectionEvent subscription
verification:
  targeted_detection_tests: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --testNamePattern "detect|Detect|ToolDetection|preload|IPC|channels" --maxWorkers=1
  typecheck: pnpm -C devhub typecheck
  lint: pnpm -C devhub lint
  zod_sot: pnpm -C devhub check:zod-sot
closed_by_later_evidence_2026_05_14:
  - execa/which/semver library migration
  - packaged Electron Playwright E2E
  - UI path override editor for set/clear override through IPC/preload
explicitly_not_implemented_by_design:
  - mock-based execa GWT suite; replaced by no-mock real process.execPath override tests and packaged Electron E2E
```

## 16. Implementation Evidence - 2026-05-13 CLI Detection GWT Cache Race Closure

```yaml
status: partial_verified_executable_detection_gwt_closed
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
verified_now:
  five_tool_matrix:
  - detectTools({ force:true }) returns exactly codex, claude, gemini, cursor, and copilot rows
  - detection event broadcast carries the real ToolDetectionState result set
  version_probe:
  - codex override uses the real local process.execPath executable and returns a non-null version
  - codex recommendedParser remains shim and capabilities include stream-json
  override_path:
  - missing gemini override path is rejected with E_VALIDATION
  - codex, claude, and gemini overrides persist real executable paths
  capability:
  - claude override returns found=true, recommendedParser=ndjson, and stream-json capability
  - gemini override returns found=true and recommendedParser=line
  cache:
  - detectTool({ force:false }) reuses the cached codex checkedAt/version from the previous full scan
  - fixed a real Promise.allSettled cache race by merging each normalized result into the latest store cache instead of the per-call stale cache snapshot
verification:
  targeted_gwt_vitest: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "detect|Detect|ToolDetection|GWT"
  eslint: pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
closed_by_later_evidence_2026_05_14:
  - execa/which/semver library migration
  - packaged Electron Playwright E2E for the Settings ToolDetectPanel
  - UI path override editor with set and clear override controls
explicitly_not_implemented_by_design:
  - mock-based execa GWT suite; replaced by real executable override tests to preserve R7-NO-MOCK
```

## 17. Implementation Evidence - 2026-05-14 CLI Detect Library Migration + Settings Override E2E Closure

```yaml
status: verified_execa_which_semver_settings_e2e
implemented_now:
  - devhub/package.json
  - devhub/pnpm-lock.yaml
  - devhub/src/shared/schemas/tool-detect.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/src/renderer/views/settings/ToolDetectPanel.tsx
  - devhub/src/renderer/components/i18n/LocaleProvider.tsx
  - devhub/e2e/example.spec.ts
verified_now:
  dependency_migration:
  - runtime dependencies include execa 9.6.1, which 4.0.0, and semver 7.7.3
  - type-only development dependencies include @types/semver and @types/which
  - CLI detection resolves PATH commands through which before version probing
  - CLI version probes execute through execa with shell=false and a 3000ms bounded kill timer
  - semver.coerce normalizes version output from real CLI stdout/stderr
  - Vitest happy-dom AbortSignal interop falls back to real execFile with the same timeout, not to mock data
  override_editor:
  - Settings Advanced renders per-tool executable path inputs for codex, claude, gemini, cursor, and copilot
  - save path calls executable cli:set-tool-override with confirmedBy=settings-panel
  - clear path calls executable cli:clear-tool-override and invalidates the per-tool detection cache
  - missing paths still fail with E_VALIDATION
  packaged_e2e:
  - production build exposes the Settings Advanced ToolDetectPanel in the packaged renderer
  - Playwright writes an invalid codex path and observes E_VALIDATION
  - Playwright writes real process.execPath, triggers save + forced rescan, and verifies found=true, detectStrategy=user-override, semver-normalized version, and exact executable path
  - Playwright restores or clears the previous codex override after the test to avoid persistent store pollution
  startup_stability:
  - LocaleProvider now validates listLocales() payloads with localeManifestSchema so early contract-only/malformed i18n responses cannot crash the Advanced Settings page
validation:
  eslint: pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.ts src/shared/schemas/tool-detect.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/views/settings/ToolDetectPanel.tsx src/renderer/components/i18n/LocaleProvider.tsx e2e/example.spec.ts
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
  targeted_vitest: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts -t "tool override|five-tool|CLI detection GWT|R8 runtime contracts" --maxWorkers=1
  build: pnpm -C devhub build
  packaged_playwright: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-06" --workers=1 --reporter=line
remaining_not_claimed_done: []
```
