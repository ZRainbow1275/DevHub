# spec-02-shim-codex — Codex SHIM 注入（D 路线）

> **batch**: R8.C  |  **flag**: `R8.C.shim.codex`
> **depends_on**: R8.C.spec-01 (CLIOutputParser)
> **derives_from**: 07.B.2 Codex CLI = D 方案（SHIM）

---

## 1. motivation

```yaml
user_quote_07_B_2: "Codex CLI: D — SHIM（DevHub 控制 codex 进程的 stdio）"
pain_point: "Codex CLI 默认 stdout 没有结构化进度；只能从启发式估算"
goal:
  - 通过 PATH-shim 拦截 codex.exe 调用
  - SHIM 透传 stdin/stdout/stderr 给真 codex
  - SHIM 同时 fork 一份到 DevHub IPC（含 marker 协议）
  - 用户无感（codex 命令行体验完全一致）
market_alignment_2026:
  - shim 思路对标 npm-pack/scripts: rust-bin shim, shimexe, scoop shim
  - codex CLI 没有公开 stream-json 接口（与 Claude 不同）
  - 因此 SHIM 是唯一可控注入点
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/shim/CodexShimInstaller.ts
  - devhub/src/main/services/shim/ShimRegistry.ts
  - devhub/src/main/services/shim/MarkerProtocol.ts
  - devhub/src/main/services/cli-parser/parsers/CodexParser.ts
  - devhub/src/main/services/cli-parser/parsers/CodexParser.test.ts
  - shim/codex/codex-shim.ts  # 编译为 codex-shim.exe (pkg/bun)
  - shim/codex/codex-shim.test.ts
  - shim/codex/build.config.json
modified_files:
  - devhub/src/main/services/cli-parser/ParserRegistry.ts  # 注册 CodexParser
  - devhub/src/main/services/AppLifecycle.ts  # 启动时 ensureShim()
glob_grep_anchors:
  - devhub/src/main/index.ts:1-80  # main process bootstrap
```

---

## 3. data_contracts

```typescript
// MarkerProtocol — 双方约定的二进制安全 marker
export const MARKER_PREFIX = 'DEVHUB::MARKER::';
export const MARKER_VERSION = 1;

export const CodexMarkerSchema = z.object({
  version: z.literal(1),
  field: z.enum(['PHASE','PROGRESS','TOKENS','TOOL','ERROR','DONE','HEARTBEAT']),
  value: z.string(),
  ts: z.number().int(),
});

export const ShimManifestSchema = z.object({
  toolName: z.literal('codex'),
  realExePath: z.string(),  // 解析的真 codex.exe
  shimExePath: z.string(),  // C:\Users\X\AppData\Local\DevHub\shims\codex.exe
  installedAt: z.number().int(),
  shimVersion: z.string(),  // semver
  ipcPipe: z.string(),  // \\.\pipe\devhub-shim-{pid}
});

// SHIM IPC frame
export const ShimFrameSchema = z.object({
  shimPid: z.number().int(),
  realPid: z.number().int().nullable(),
  source: z.enum(['stdout','stderr']),
  line: z.string(),
  ts: z.number().int(),
});
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  shim:install:  # renderer → main
  req: { tool: 'codex' }
  resp: { manifest: ShimManifest, requiresPathRefresh: boolean }
  shim:uninstall:
  req: { tool: 'codex' }
  resp: { success: boolean }
  shim:status:
  req: {}
  resp: { codex: ShimManifest | null, claude: ShimManifest | null, gemini: ShimManifest | null }
  shim:frame:  # 命名管道接入 → 转发为 ai:parse-stream
  pipe_name: \\.\pipe\devhub-shim
  payload: ShimFrame
```

---

## 5. error_matrix

| condition | code | recovery |
|-----------|------|----------|
| 真 codex 不存在 | E_CLI_NOT_FOUND | UI 提示安装 codex CLI；不安装 SHIM |
| SHIM 已安装但 PATH 优先级失败 | E_SHIM_NOT_INSTALLED | 提示用户重新打开终端 / 重启 DevHub |
| 命名管道连接失败 | E_INTERNAL | SHIM 透传仍正常；DevHub 退化到不解析 |
| 真 codex 退出码非零 | (透传 exit code) | 写 ParseEvent type=error |
| Marker 解析失败 | E_VALIDATION | 当作普通 stdout 行处理 |
| SHIM 自身崩溃 | E_INTERNAL | spawn-tracker 探测 → ai:parse-stream 推送 disconnect |

---

## 6. acceptance_gwt

```gherkin
Given 用户已安装 codex CLI 且 DevHub 已注册 SHIM
When 用户在终端执行 "codex --help"
Then 用户看到的 stdout 与未装 SHIM 完全一致
And DevHub 收到 ShimFrame 含相同行内容

Given codex 输出 "DEVHUB::MARKER::v=1::PHASE=coding"
When CodexParser 解析
Then ParseEvent type=phase_marker payload={phase:'coding'} confidence=1.0

Given codex 进程被 OS kill
When SHIM 检测到子进程退出
Then SHIM 写一条 marker DONE + exit_code 然后自身退出 0

Given 用户卸载 codex
When ensureShim() 启动检查
Then SHIM 自动卸载（不留死链）

Given 二进制安全：codex 输出含 marker 前缀的恶意行 "DEVHUB::MARKER::FAKE"
When MarkerProtocol 校验 version 字段
Then 严格 schema 校验失败 → 当作普通 stdout 处理（不冒充 marker）
```

---

## 7. e2e_playwright_draft

```typescript
test('codex shim transparent passthrough + marker capture', async ({ ipc, terminal }) => {
  await ipc.invoke('shim:install', { tool: 'codex' });
  const events: ParseEvent[] = [];
  ipc.subscribe('ai:parse-stream', e => events.push(e));
  const out = await terminal.run('codex run "echo DEVHUB::MARKER::v=1::PHASE=coding"');
  expect(out).toContain('DEVHUB::MARKER::v=1::PHASE=coding');  // 用户透传
  await expect.poll(() => events.find(e => e.type === 'phase_marker')).toBeTruthy();
});
```

---

## 8. reference_impl

```yaml
libraries:
  - name: pkg
  version: ^5.8.1
  license: MIT
  use: 把 codex-shim.ts 打包为 codex-shim.exe（无需 Node 安装）
  - name: bun (alternative)
  version: ^1.1.0
  use: bun build --target=bun-windows-x64
  - name: koffi (peer)
  version: ^2.10.0
  license: MIT
  use: PATH 修改 fallback 调用 SetEnvironmentVariable
  - name: net (Node builtin)
  use: 命名管道 \\.\pipe\
patterns:
  - https://github.com/microsoft/winget-cli/tree/master/src/AppInstallerCLICore  # shim 设计
  - https://github.com/jbrains/scoop/blob/master/lib/install.ps1  # scoop shim
shim_logic_pseudocode: |
  // codex-shim.ts (compiled to .exe via pkg)
  import { spawn } from 'child_process';
  import { connect } from 'net';
  const real = process.env.DEVHUB_REAL_CODEX || resolveReal();
  const child = spawn(real, process.argv.slice(2), { stdio: ['inherit','pipe','pipe'] });
  const pipe = connect('\\\\.\\pipe\\devhub-shim');
  child.stdout.on('data', chunk => { process.stdout.write(chunk); pipe.write(frame('stdout', chunk)); });
  child.stderr.on('data', chunk => { process.stderr.write(chunk); pipe.write(frame('stderr', chunk)); });
  child.on('exit', code => { pipe.write(frame('done', String(code))); pipe.end(); process.exit(code ?? 1); });
```

---

## 9. impact_radius_loc

```yaml
estimated_loc:
  CodexShimInstaller.ts: 220
  ShimRegistry.ts: 100
  MarkerProtocol.ts: 90
  CodexParser.ts: 280
  codex-shim.ts: 180
  test: 380
  total_new: ~1250
modified_loc:
  ParserRegistry.ts: +20
  AppLifecycle.ts: +30
risk_level: HIGH (PATH 修改 / 进程接管)
gitnexus_impact_target: AppLifecycle
```

---

## 10. implement_checklist

- [x] codex-shim.cjs 通过 `@yao-pkg/pkg` 打包为真实 Codex shim executable（Windows x64 / Linux x64 / macOS x64 三平台产物）
- [x] ShimRegistry 把真实 passthrough shim 写入 Electron userData/r8-cli-shims/
- [x] PATH 修改：仅本进程 process.env.PATH（不动 HKCU\Environment）
- [x] DevHub 启动时 ensureShim 检查 SHIM 是否被旧版/同名占用
- [x] CodexParser 实现 IParser，识别 7 个 marker 字段
- [x] 命名管道 server 在 main 启动并把 shim frame 转入 CodexParser
- [x] shim client 重连退避 100ms→1s
- [x] 二进制安全：marker schema 必须含 version 字段防伪
- [x] 透传完整性：stdin/stdout/stderr 镜像 + exit code / signal DONE marker
- [x] 卸载流程：删除 shim + 清理 manifest
- [x] vitest 单测：MarkerProtocol parse / encode
- [x] Playwright E2E：透传 + marker 捕获
- [x] 用户文档：终端体验无感

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-01 (CLIOutputParser / IParser)
  - R8.C.spec-06 (CLI 检测：判断 codex 是否安装)
downstream:
  - R8.C.spec-15 (任务队列 spawn 子进程时使用 shim)
  - R8.C.spec-22 (任务录像消费 shim frame)
external_deps:
  - 用户必须自装 codex CLI（API key 也由 codex 自己存）
```

---

## 12. fallback_strategy

```yaml
on_shim_install_fail:
  primary: 提示用户手动复制 shim
  fallback: 退化为 Cursor 风格的窗口标题 + 文件感测
on_pipe_disconnect:
  primary: 重连退避（100ms → 30s 上限）
  fallback: SHIM 持续透传（不影响用户），但 DevHub 标记该 instance 为 "no-parse"
on_user_unsets_path:
  primary: 启动检查 + 提示用户重启 DevHub
  fallback: 退化到启发式
```

---

## 13. performance_budget

```yaml
budgets:
  shim_overhead_ms_per_call:
  warn: 30
  fatal: 200
  pipe_throughput_kbps:
  warn: 1024
  fatal_below: 256
  shim_rss_mb:
  warn: 25
  fatal: 80
  shim_cpu_pct_idle:
  warn: 1
  fatal: 5
  install_time_ms:
  warn: 1500
  fatal: 8000
  marker_parse_p99_us:
  warn: 200
  fatal: 1500
ipc_class: medium_query (parser frame stream)
```

---

## 14. Implementation Evidence — 2026-05-04 Parser Foundation

```yaml
status: partial_verified
implemented_now:
  - devhub/src/main/services/shim/MarkerProtocol.ts
  - devhub/src/main/services/cli-parser/parsers/CodexParser.ts
  - devhub/src/main/services/cli-parser/parsers/CodexParser.test.ts
  - devhub/src/shared/schemas/r8-runtime.ts
verified_gwt_subset:
  marker_parse: valid DEVHUB::MARKER::v=1::PHASE=coding emits eventType=phase_marker confidence=1
  marker_spoof_guard: malformed DEVHUB::MARKER::FAKE is not accepted as a marker
closed_by_later_evidence_2026_05_14:
  - current-process PATH shim directory prepending
  - named-pipe passthrough frame delivery
  - automatic dead-link uninstall on missing real codex executable
verification:
  targeted_tests: parser suite passed
  full_vitest: 53 files / 472 tests passed
  typecheck: passed
  lint_no_emoji: passed
  gitnexus: CodexParser LOW risk
```

---

## 15. Implementation Update — 2026-05-06

```yaml
status: partial_verified
added:
  - devhub/src/main/services/shim/ShimRegistry.ts now prepends the shim directory to current process.env.PATH only.
  - devhub/src/main/services/shim/ShimRegistry.test.ts verifies real shim file content, current-process PATH update, uninstall cleanup, and permission guard.
  - devhub/src/main/services/cli-parser/parsers/CodexParser.test.ts verifies all 7 strict marker fields.
  - devhub/docs/r8/codex-shim.md documents operator behavior and non-claimed boundaries.
verified_commands:
  - pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts --maxWorkers=1
  - pnpm -C devhub test --run src/main/services/cli-parser/parsers/CodexParser.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub check:zod-sot
verification_results:
  shim_codex_suite: 3 files / 17 tests passed
  codex_marker_fields: 1 file / 9 tests passed
  typecheck: passed
  lint_no_emoji: passed, No emoji found in 573 files
  zod_sot: passed
closed_by_later_evidence_2026_05_14:
  - startup_ensureShim_reconciliation
  - packaged_Electron_e2e
remaining_not_claimed_done:
  - packaged_codex_shim_exe
```

## 18. Implementation Evidence — 2026-05-16 Packaged Codex Shim Executable Closure

```yaml
status: verified
implemented_now:
  - devhub/shim/codex/codex-shim.cjs
  - devhub/shim/codex/build.config.json
  - devhub/scripts/build-codex-shim.mjs
  - devhub/scripts/verify-codex-shim-package.mjs
  - devhub/src/main/services/shim/ShimRegistry.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/package.json
behavior:
  - `@yao-pkg/pkg` builds native executable artifacts for Windows x64, Linux x64, and macOS x64 from the same sidecar-manifest shim source.
  - packaged Electron installs `codex.exe` into `userData/r8-cli-shims/` on Windows so PATH interception targets the real `codex` command name instead of a Node-only `.mjs` helper.
  - packaged shim reads `${shimExePath}.json` sidecar metadata for `realExePath`, `ipcPipe`, and `toolName`, so external terminals do not need DevHub-specific environment variables to preserve passthrough behavior.
  - Node `.mjs` shim generation remains as a fallback when the packaged artifact is absent, preserving existing Claude/Gemini and development paths.
  - uninstall and startup reconciliation delete stale sidecar manifests together with stale shim executables.
verified_commands:
  - cd devhub && pnpm install --ignore-scripts --no-frozen-lockfile
  - cd devhub && pnpm shim:build:codex
  - cd devhub && pnpm shim:build:codex:all
  - cd devhub && pnpm shim:verify:codex
  - pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts -t "shim|Shim" --maxWorkers=1
  - pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub check:zod-sot
  - pnpm -C devhub check:no-cloud-deps
  - pnpm -C devhub check:no-ocr-deps
  - pnpm -C devhub build
  - pnpm -C devhub test:e2e --grep "R8.C spec-02" --reporter=line
  - git -C devhub diff --check
  - git diff --check
  - python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
verified_results:
  packaged_artifacts:
  win32_x64: resources/shims/codex/codex-shim-win32-x64.exe
  linux_x64: resources/shims/codex/codex-shim-linux-x64
  darwin_x64: resources/shims/codex/codex-shim-darwin-x64
  packaged_windows_verify:
  exitCode: 0
  frameCount: 3
  stdoutPreserved: true
  stderrPreserved: true
  targeted_vitest:
  shim_grep: 2 files / 6 tests passed
  full_related: 3 files / 116 tests passed
  typecheck: passed
  lint_no_emoji: passed
  zod_sot: passed
  no_cloud_deps: passed
  no_ocr_deps: passed
  production_build: passed
  packaged_electron_e2e: 1 passed
  diff_check: passed with existing Windows LF/CRLF warnings only
  trellis_task_validate: passed
remaining_not_claimed_done: []
```

## 17. Implementation Evidence — 2026-05-14 Bounded Shim Client Reconnect

```yaml
status: partial_verified_reconnect_backoff
implemented_now:
  - devhub/src/main/services/shim/ShimRegistry.ts
  - devhub/src/main/services/shim/ShimRegistry.test.ts
behavior:
  - generated shim clients now reconnect to the DevHub named pipe when the pipe is unavailable or closes
  - reconnect delay starts at 100ms and doubles up to a bounded 1000ms ceiling
  - timers are unref'ed so pipe recovery does not keep an otherwise finished CLI process alive
  - child stdout/stderr passthrough remains non-blocking; DevHub frame capture may reconnect without changing user-visible terminal output
verified_commands:
  - pnpm -C devhub exec eslint src/main/services/shim/ShimRegistry.ts src/main/services/shim/ShimRegistry.test.ts
  - pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts --maxWorkers=1
  - pnpm -C devhub exec tsc --noEmit --pretty false
verified_results:
  eslint: passed
  shim_registry_vitest: passed; 1 file / 3 tests, including delayed-pipe reconnect through a real generated shim and real Node child process
  typecheck: passed
remaining_not_claimed_done:
  - packaged_codex_shim_exe
```

---

## 16. Implementation Evidence — 2026-05-14 Startup Reconciliation + Packaged Shim E2E

```yaml
status: partial_verified_packaged_shim_e2e_and_reconciliation
implemented_now:
  - devhub/src/main/services/shim/ShimRegistry.ts
  - devhub/src/main/services/shim/ShimRegistry.test.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/e2e/example.spec.ts
  - prompts/0421/contracts/23-ipc-contracts-master.md
verified_now:
  startup_reconciliation:
  - `R8RuntimeService` now runs bounded `ensureShimReconciliation()` on startup and logs `shim:ensure` audit errors instead of crashing
  - `ShimRegistry.ensureInstalledShims()` keeps healthy manifests and removes manifests whose shim file is missing
  - `ShimRegistry.ensureInstalledShims()` removes dead manifests and deletes the shim file when the real executable path disappears
  - command-name checks resolve through `which` while excluding the shim directory from PATH to avoid accepting the shim itself as the real CLI
  shim_passthrough:
  - generated Node shim still mirrors stdin/stdout/stderr and writes frame JSON lines to the configured pipe
  - generated shim now uses `shell=true` only for Windows `.cmd`/`.bat` targets; real `.exe` targets such as `process.execPath` run with `shell=false`
  - `shim:uninstall` and `shim:status` are exposed through preload/global types so E2E cleanup and status assertions use the real public bridge
  packaged_e2e:
  - Playwright launches the production-built Electron main entry `out/main/index.js`
  - E2E stores a real codex override pointing to `process.execPath`, installs the codex shim, and verifies the pipe server is listening
  - E2E runs the generated shim file through the real Node executable; the child prints `DEVHUB::MARKER::v=1::PHASE=coding`
  - stdout passthrough contains the exact marker line seen by the user
  - DevHub receives the shim frame through the named pipe, `CodexParser` parses it as `eventType=phase_marker`, and the renderer receives it through `window.devhub.r8.cli.onEvent`
  - E2E verifies `window.devhub.r8.cli.shimStatus().codex` contains the real executable path and generated shim path, then uninstalls and restores prior codex override state
validation:
  gitnexus_impact: npx gitnexus impact --repo devhub --direction upstream --include-tests --depth 2 ShimRegistry && npx gitnexus impact --repo devhub --direction upstream --include-tests --depth 2 R8RuntimeService && npx gitnexus impact --repo devhub --direction upstream --include-tests --depth 2 installShim
  eslint: pnpm -C devhub exec eslint src/main/services/shim/ShimRegistry.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.ts src/preload/index.ts src/renderer/types/global.d.ts e2e/example.spec.ts
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
  targeted_vitest: pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts -t "shim|Shim|preload|contract" --maxWorkers=1
  build: pnpm -C devhub build
  packaged_playwright: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-02" --workers=1 --reporter=line
remaining_not_claimed_done:
  - packaged_codex_shim_exe
  - shim_client_reconnect_backoff
```
