# spec-05-cursor-copilot-detection — Cursor / Copilot 进程窗口标题检测（B 路线）

> **batch**: R8.C  |  **flag**: `R8.C.cli.cursor-copilot`
> **depends_on**: R8.C.spec-01, R8.A spec-02 (ProcessUnifiedVM), R8.A.spec-08 (window-always-on-top)
> **derives_from**: V1-Q-7.B.2 答 Cursor/Copilot = B（无 stdout，仅窗口/进程）+ feedback#4

---

## 1. motivation

```yaml
user_quote_v1_q_7_b_2: "Cursor / GitHub Copilot CLI: B — 因为没有原生 CLI 输出，只能借窗口标题/进程感测"
pain_point: "Cursor/Copilot 在 IDE 内部运行，AITaskTracker 误报为空闲"
goals:
  - 借 Windows EnumWindows + GetWindowText 抓取 Cursor / VSCode (with Copilot) 标题
  - 解析窗口标题模式（如 'Cursor - Editing main.ts (busy)' / 'GitHub Copilot Chat'）
  - 进程命令行 / 模块列表二次确认（防误识）
  - 输出 CliEvent type='progress' rawSource='window-title' confidence ≤ 0.6
constraint:
  - 不读取窗口内容（隐私）
  - 不注入 IDE 进程（NO-PROCESS-INJECTION）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/cli-parser/parsers/CursorTitleParser.ts
  - devhub/src/main/services/cli-parser/parsers/CopilotTitleParser.ts
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.ts
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.test.ts
  - devhub/src/shared/schemas/window-title-pattern.ts
modified_files:
  - devhub/src/main/services/window/WindowManager.ts  # 复用 EnumWindows
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/main/services/detection/SignalCollector.ts
glob_anchors:
  - devhub/src/main/services/window/WindowManager.ts:1-200
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const TitleToolEnum = z.enum(['cursor', 'copilot-chat', 'copilot-cli', 'unknown'])

export const TitlePatternRuleSchema = z.object({
  tool: TitleToolEnum,
  regex: z.string(),
  flags: z.string().default('i'),
  phase: z.enum(['idle','thinking','editing','running','completed']),
  confidence: z.number().min(0).max(0.7),  // 上限 0.7（窗口标题不如 stdout 可靠）
})

export const TitleSampleSchema = z.object({
  hwnd: z.number().int(),
  pid: z.number().int(),
  exe: z.string(),
  title: z.string(),
  sampledAt: z.number().int(),
})

export const CursorCopilotSignalSchema = z.object({
  instanceId: z.string(),
  tool: TitleToolEnum,
  phase: z.enum(['idle','thinking','editing','running','completed']),
  confidence: z.number().min(0).max(0.7),
  source: z.literal('window-title'),
  rawTitle: z.string(),
  ts: z.number().int(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  cli:cursor-copilot-status:
  req: { instanceId: string }
  resp: { phase, confidence, rawTitle, ts }
  cli:title-rule-reload:
  req: { rules: TitlePatternRule[] }
  resp: { success: boolean, applied: number }
  cli:title-sample-debug:  # 仅 dev 模式
  req: {}
  resp: TitleSample[]
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| EnumWindows 失败 | E_INTERNAL（退化空数组） |
| 窗口标题为空 | (跳过) |
| 命令行匹配但模块列表不含 cursor.exe | E_VALIDATION（疑似伪造） |
| 采样频率超 5 Hz | E_RATE_LIMITED |
| 多实例同名标题 | (按 hwnd 去重) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (Cursor 基础识别):
  given: 系统有 Cursor 窗口标题 "Cursor - Editing main.ts"
  when: CursorCopilotDetector.scan
  then: emit CliEvent tool=cursor phase=editing confidence=0.6

GWT-2 (Copilot Chat):
  given: 窗口标题 "Visual Studio Code - main.ts (Copilot suggesting)"
  when: detector 应用 copilot-chat 规则
  then: emit phase=thinking confidence=0.5

GWT-3 (防伪):
  given: 有进程取名 "Cursor" 但 exe 路径不符
  when: detector 校验 exe 白名单
  then: emit unknown confidence=0.1 + warn

GWT-4 (置信度合并):
  given: 同 instanceId 同时有 window-title + 文件感测
  when: SignalCollector 融合
  then: confidence_total = max(c_title, c_file) 上限 0.8

GWT-5 (规则热更):
  given: 用户更新 title-rules.json
  when: cli:title-rule-reload
  then: 5s 内生效不重启
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 cursor editing detection', async ({ electronApp, page }) => {
  await electronApp.evaluate(({ BrowserWindow }) => {
  const win = new BrowserWindow({ title: 'Cursor - Editing main.ts', show: false })
  })
  const status = await page.evaluate(() => window.electronAPI.cli.cursorCopilotStatus({ instanceId: 'cur-1' }))
  expect(status.phase).toBe('editing')
  expect(status.confidence).toBeGreaterThanOrEqual(0.5)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'koffi@2.10':  FFI 调 EnumWindows / GetWindowTextW
  - 'win32-api@26.x':  Node 包装 (备用)
  - 'fast-glob@3.3':  exe 白名单匹配
inspirations:
  - Microsoft PowerToys window detector
  - Process Hacker UI
  - X-Mouse Button Control title matcher
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~480
modified_loc: ~120
test_loc: ~300
total: ~900
risk_areas:
  - 跨 Windows 版本 EnumWindows 兼容
  - macOS / Linux 路径暂不实现（feature flag OFF）
```

---

## 10. implement_checklist

- [x] EnumWindows + GetWindowTextW 通过 koffi 调用 — 2026-05-15 `Win32WindowEnumerator` 使用真实 `koffi` 绑定 `EnumWindows` / `GetWindowTextW` / `GetClassNameW` / `GetWindowRect` / `GetWindowThreadProcessId`；`WindowManager.scanWindows(false)` 在 Windows 上 native-first，失败时保留现有 PowerShell fallback；真实 Node/koffi smoke 返回 `ok=true`、13 个可见标题窗口。
- [x] exe 白名单：cursor.exe / Code.exe / gh.exe
- [x] 5 Hz 采样上限（IPC 复用 spec-31 high_freq_scan）
- [x] 规则文件 title-rules.json 内置 + 用户可覆盖
- [x] confidence 上限硬编码 0.7（防过度信任）
- [x] 同 hwnd 5s 节流
- [x] vitest 覆盖 5 GWT + EnumWindows mock — 2026-05-15 `CursorCopilotDetector.test.ts` 覆盖 Cursor editing、Copilot suggesting、spoof downgrade、unrelated title ignore、Copilot idle 五类窗口标题 GWT；`WindowManager.test.ts` 通过 mocked `EnumWindows` / `GetWindowText` pipe 输出和 mocked `Get-Process` CSV 验证真实 `scanWindows(false)` 解析为 `WindowInfo` 行。
- [x] feature flag 默认 ON Windows，OFF macOS/Linux
- [x] 隐私 audit log：仅记录 hash(title)，不存原文（除 dev 模式）— 2026-05-11 `R8RuntimeService.cursorCopilotStatus()` 写入 `cli:cursor-copilot-title-signal` 审计行，只包含 `titleHash`、hwnd、pid、processName、phase/confidence/source，不写 `rawTitle`。

- [x] 2026-05-13 real Electron Playwright GWT: temporary real `cursor.exe` Electron process window title -> `WindowManager.scanWindows(false)` -> `scannerCache.updateWindows()` -> `cli:cursor-copilot-status` emits `tool=cursor`, `phase=editing`, `confidence=0.6`, 16-hex `titleHash`
---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-01: IParser
  - R8.A.spec-02: ProcessUnifiedVM 提供 PID + exe 验证
  - R8.A.spec-08: WindowManager 已有 EnumWindows 封装
downstream:
  - R8.C.spec-07: monitor 显示 Cursor/Copilot phase
  - R8.C.spec-27: SignalFusion 消费 (低权重 0.4)
```

---

## 12. fallback_strategy

```yaml
on_enum_windows_fail:
  - 退化到仅进程感测（无窗口标题），confidence 上限 0.3
on_no_match:
  - emit unknown confidence=0.1，不污染信号
on_macos_linux:
  - feature flag OFF，UI 显示 "仅 Windows 支持"
```

---

## 13. performance_budget

```yaml
enum_windows_p99_ms: { warn: 50, fatal: 300 }
sample_rate_hz: 5
title_regex_p99_us: { warn: 200, fatal: 1500 }
memory_kb: { warn: 64, fatal: 256 }
ipc_channel: cli:cursor-copilot-status → spec-31 high_freq_scan 30 RPM
```

## 14. Implementation Evidence - 2026-05-04 Cursor/Copilot Window Title Detection

```yaml
status: partial_verified_executable_detection
implemented_now:
  - devhub/src/main/services/cli-parser/parsers/CursorTitleParser.ts
  - devhub/src/main/services/cli-parser/parsers/CopilotTitleParser.ts
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.ts
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.test.ts
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
verified_gwt_subset:
  cursor_editing: Cursor - Editing main.ts emits tool=cursor source=window-title titlePhase=editing confidence=0.6
  copilot_suggesting: Visual Studio Code title containing Copilot suggesting emits tool=copilot titlePhase=thinking confidence=0.5
  anti_spoof: Cursor-like title from non-whitelisted process emits tool=unknown confidence=0.1
  scanner_cache_path: cli:cursor-copilot-status consumes existing scannerCache.windows metadata without process injection
  rule_hot_reload: cli:title-rule-reload applies confirmed title rules to detector and parser paths
privacy_boundary:
  - detector consumes existing title metadata only
  - no IDE process injection
  - titleHash is computed for audit-friendly correlation; rawTitle is returned only through the explicit status/debug path
not_claimed_done:
  - persistent title-rules.json watcher
  - renderer settings panel for title rule editing
verification:
  targeted_tests: CursorCopilotDetector, R8RuntimeService, r8RuntimeHandlers, and CLIOutputParser passed with --maxWorkers=1
  typecheck: passed
```

## 15. Implementation Evidence - 2026-05-06 Shared Schema, Throttle, Whitelist, and Platform Flag

```yaml
status: partial_verified_executable_detection_extended
implemented_now:
  - devhub/src/shared/schemas/window-title-pattern.ts
  - devhub/src/main/services/cli-parser/title-rules.json
  - devhub/src/main/services/cli-parser/parsers/CursorTitleParser.ts
  - devhub/src/main/services/cli-parser/parsers/CopilotTitleParser.ts
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.ts
  - devhub/src/shared/feature-flags.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
verified_now:
  shared_schema_contracts:
  - TitlePatternRule rejects confidence > 0.7 and invalid regex flags
  - CursorCopilotSignal requires 16-byte hex titleHash
  - CursorCopilotStatus is registered in r8RuntimeSchemaRegistry
  whitelist:
  - allowed executable basenames are cursor.exe, code.exe, and gh.exe
  - Cursor-like titles from cursor-helper.exe and github-copilot.exe are downgraded to unknown confidence 0.1
  - full Windows paths are normalized by basename before validation
  rate_limit:
  - scanWindows returns cached results when sampled faster than 5 Hz
  - same hwnd with unchanged title/process/pid reuses the prior signal for 5 seconds
  rules:
  - built-in title-rules.json supplies Cursor and Copilot parser defaults
  - cli:title-rule-reload continues to apply confirmed user override rules through detector and CLIOutputParser paths
  feature_flag:
  - isFeatureEnabled('R8.C.cli.cursor-copilot') defaults true on win32 and false on darwin/linux
  preload:
  - window.devhub.r8.cli.cursorCopilotStatus(instanceId?) can request instance-scoped status
  - window.devhub.r8.cli.reloadTitleRules(rules, confirmedBy?) can apply confirmed user override rules
verification:
  targeted_schema_detector_flags: pnpm -C devhub test --run src/main/services/cli-parser/CursorCopilotDetector.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
  targeted_ipc_preload: pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --testNamePattern "cursor|copilot|title|preload|specific" --maxWorkers=1
  targeted_runtime: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts --testNamePattern "Cursor|Copilot|cursor|copilot|title" --maxWorkers=1
  typecheck: pnpm -C devhub typecheck
  lint: pnpm -C devhub lint
  zod_sot: pnpm -C devhub check:zod-sot
not_claimed_done:
  - persistent user title-rules.json filesystem watcher
  - renderer settings panel for title rule editing
  - packaged Electron Playwright E2E
```

## 16. Implementation Evidence - 2026-05-11 Privacy Audit

```yaml
status: partial_verified_privacy_audit
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
privacy_boundary:
  - action: cli:cursor-copilot-title-signal
  - target_fields: [instanceId, tool, phase, confidence, source, titleHash, hwnd, pid, processName, ts]
  - excluded_fields: [rawTitle]
  - dedupe_key: hwnd + pid + titleHash + tool + phase
verified_now:
  - runtime status call emits audit rows for Cursor/Copilot title signals
  - audit target contains titleHash and window/process metadata
  - audit target does not contain rawTitle
verification:
  targeted_runtime: pnpm -C devhub test --run src/main/services/cli-parser/CursorCopilotDetector.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "Cursor|Copilot|cursor|copilot|title"
  typecheck: pnpm -C devhub typecheck
not_claimed_done:
  - persistent user title-rules.json filesystem watcher
  - renderer settings panel for title rule editing
  - packaged Electron Playwright E2E
```

## 17. Implementation Evidence - 2026-05-13 Real Cursor-Named Electron Window E2E

```yaml
status: partial_verified_real_electron_window_detection
implemented_now:
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.ts
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.test.ts
  - devhub/src/main/index.ts
  - devhub/e2e/example.spec.ts
production_fix:
  - Windows `Get-Process | Select-Object ProcessName` returns extensionless names such as `cursor` and `Code`; the detector now normalizes extensionless basenames to `.exe` before applying the whitelist.
real_e2e_gwt:
  - the Playwright test starts a real external Electron process from a temporary `cursor.exe` binary in Electron's real dist directory
  - the external process creates a real visible BrowserWindow titled `Cursor - Editing main.ts ...`
  - DevHub main process runs the real `WindowManager.scanWindows(false)` path and writes the result into `scannerCache`
  - renderer IPC `window.devhub.r8.cli.cursorCopilotStatus()` returns a matching window-title signal with `tool=cursor`, `phase=editing`, `confidence=0.6`, and a 16-hex `titleHash`
  - the test asserts the scanned window PID matches the spawned `cursor.exe` process PID and cleans up only that child process plus temporary files
verification:
  unit: pnpm -C devhub test --run src/main/services/cli-parser/CursorCopilotDetector.test.ts --maxWorkers=1
  eslint: pnpm -C devhub exec eslint e2e/example.spec.ts src/main/index.ts src/main/services/cli-parser/CursorCopilotDetector.ts src/main/services/cli-parser/CursorCopilotDetector.test.ts
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
  build: pnpm -C devhub build
  e2e: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-05" --workers=1 --reporter=line
not_claimed_done:
  - persistent user title-rules.json filesystem watcher
  - renderer settings panel for title rule editing
  - installer-packaged E2E beyond the production-build Playwright Electron run
  - SignalCollector confidence fusion with file/tool signals
```

## 19. Implementation Evidence - 2026-05-15 Direct Koffi Win32 Enumeration

```yaml
status: verified_direct_koffi_enumwindows_wrapper
implemented_now:
  - devhub/src/main/services/integrations/Win32WindowEnumerator.ts
  - devhub/src/main/services/integrations/index.ts
  - devhub/src/main/services/WindowManager.ts
  - devhub/src/main/services/WindowManager.test.ts
  - devhub/scripts/smoke-koffi-window-enumerator.mjs
native_path:
  - `Win32WindowEnumerator` dynamically loads installed `koffi` only on Windows and binds `EnumWindows`, `GetWindowTextW`, `GetClassNameW`, `GetWindowRect`, `GetWindowThreadProcessId`, `IsWindowVisible`, and `IsIconic`.
  - `WindowManager.scanWindows(false)` attempts the direct Koffi path first and keeps the previous PowerShell C# enumerator as fallback if native FFI is unavailable.
  - The native path still resolves process names through the existing batched `Get-Process -Id ... | ConvertTo-Csv` path, preserving extensionless Windows `ProcessName` normalization downstream.
real_smoke:
  - `node devhub/scripts/smoke-koffi-window-enumerator.mjs` executed against real `user32.dll`.
  - result: `ok=true`, `visibleTitleCount=13`, and three real hwnd/pid/titleLength samples returned without mock data.
verification:
  gitnexus_impact: npx gitnexus impact WindowManager --repo devhub --direction upstream --depth 2 --include-tests
  focused_native_test: pnpm -C devhub test --run src/main/services/WindowManager.test.ts -t "EnumWindows|GetWindowTextW|Koffi" --maxWorkers=1
  window_manager_tests: pnpm -C devhub test --run src/main/services/WindowManager.test.ts --maxWorkers=1
  real_koffi_smoke: node devhub/scripts/smoke-koffi-window-enumerator.mjs
  smoke_syntax: node --check devhub/scripts/smoke-koffi-window-enumerator.mjs
  eslint: pnpm -C devhub exec eslint src/main/services/integrations/Win32WindowEnumerator.ts src/main/services/integrations/index.ts src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
remaining_boundary:
  - persistent user title-rules.json filesystem watcher
  - renderer settings panel for title rule editing
  - installer-packaged E2E beyond the production-build Playwright Electron run
  - SignalCollector confidence fusion with file/tool signals
```

## 18. Implementation Evidence - 2026-05-15 Vitest GWT and EnumWindows Mock Coverage

```yaml
status: partial_verified_vitest_native_scan_contract
implemented_now:
  - devhub/src/main/services/cli-parser/CursorCopilotDetector.test.ts
  - devhub/src/main/services/WindowManager.test.ts
verified_now:
  five_gwt:
  - Cursor editing title from whitelisted cursor.exe -> tool=cursor phase=editing confidence=0.6
  - VS Code Copilot suggesting title from whitelisted Code.exe -> tool=copilot phase=thinking confidence=0.5
  - Cursor-like title from non-whitelisted notepad.exe -> tool=unknown confidence=0.1
  - unrelated terminal title -> no Cursor/Copilot signal
  - Copilot completed-edit title from whitelisted gh.exe follows the built-in parser rule and emits phase=idle confidence=0.35
  enumwindows_mock:
  - mocked WindowManager PowerShell gateway returns native `EnumWindows` / `GetWindowText` pipe rows
  - mocked second gateway call returns `Get-Process -Id ... | ConvertTo-Csv` process-name rows
  - real `WindowManager.scanWindows(false)` converts those rows into `WindowInfo` records with hwnd/title/processName/pid/className/rect/minimized fields
verification:
  targeted_vitest: pnpm -C devhub test --run src/main/services/cli-parser/CursorCopilotDetector.test.ts src/main/services/WindowManager.test.ts -t "Cursor/Copilot|EnumWindows|GetWindowTextW|GWT|scanner window rows|mocked EnumWindows" --maxWorkers=1
  eslint: pnpm -C devhub exec eslint src/main/services/cli-parser/CursorCopilotDetector.test.ts src/main/services/WindowManager.test.ts
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
  no_emoji: pnpm -C devhub check:no-emoji
  zod_sot: pnpm -C devhub check:zod-sot
  no_cloud: pnpm -C devhub check:no-cloud-deps
  no_ocr: pnpm -C devhub check:no-ocr-deps
not_claimed_done:
  - persistent user title-rules.json filesystem watcher
  - renderer settings panel for title rule editing
  - installer-packaged E2E beyond the production-build Playwright Electron run
  - SignalCollector confidence fusion with file/tool signals
```
