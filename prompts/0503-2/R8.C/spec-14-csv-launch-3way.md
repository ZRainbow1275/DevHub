# R8.C spec-14 — CSV 三种启动方式（UI / Python 桥 / CLI）

> **batch**: R8.C  |  **priority_in_batch**: #14（CSV 任务驱动 - 启动入口）  |  **flag**: `R8.C.csv.launch`
> **depends_on**: spec-12（CSV driver 主框架）+ spec-13（CSV 18 列 schema）+ spec-33（Zod SoT）+ spec-31（IPC 限流）
> **blocks**: spec-15（任务队列消费）+ spec-18（自动注入 csv-task-driven 场景）
> **decision_anchor**: V1-Q-7.E.3 答 D（A+B+C 全部支持） / V1-Q-16.C.1..C.5 / feedback#4 监控接驳
> **estimated_loc**: 1100
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_7_e_3: "D — DevHub 内置 + Python 脚本 + CLI 子命令，三选一"
user_quote_v1_q_16_c_1: "我希望编写 Python 脚本根据 CSV 逐条拉起或并行拉起 codex 持续工作验收"
user_quote_v1_q_16_c_4: "D — Python 完整闭环（DevHub 仅观察 + 控制）"
user_quote_v1_q_16_c_5: "A + D — 二者并存且 CSV metadata 可标 runner=devhub|python"
feedback_4_link: "监控窗口必须 2s 内反映批次启动后任意一条任务的真实进度"

goals:
  - 三种 launch 路径互斥但可以彼此触发：UI Wizard → 内部 spawn DevHub runner / Python runner / 复制 CLI 命令到剪贴板
  - DevHub runner（in-process）零外部依赖，最快路径，用于 CSV ≤ 50 行的小批次
  - Python runner（spawn 子进程）适合 4-6 实例长跑，逻辑闭环到 Python，DevHub 只观察
  - CLI 子命令（devhub run-csv）让用户脱离 DevHub UI，在终端直接跑（CI 集成、远程会话）
  - 三路都必须把 CliEvent / ProgressDataPoint 注入 IPC `cli:event-stream`，监控窗口（spec-07）不分路径都能看
  - runner 选择由 CSV metadata header 或 UI Wizard 单选决定，不允许同一批次混用
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/csv-launcher/CsvLauncherService.ts  # 三路 dispatcher
  - devhub/src/main/services/csv-launcher/runners/DevHubRunner.ts  # in-process
  - devhub/src/main/services/csv-launcher/runners/PythonRunner.ts  # spawn child + named pipe
  - devhub/src/main/services/csv-launcher/runners/CliRunner.ts  # 仅生成命令字符串
  - devhub/src/main/services/csv-launcher/runners/IRunner.ts
  - devhub/src/main/services/csv-launcher/RunnerRegistry.ts
  - devhub/src/main/services/csv-launcher/CsvMetadataReader.ts  # 解析 # devhub-csv-version=1.0; runner=python
  - devhub/src/main/services/csv-launcher/PythonScriptManager.ts  # 校验/分发 devhub-batch.py
  - devhub/scripts/devhub-batch.py  # Python runner 脚本
  - devhub/src/main/cli/csv-cli-entry.ts  # devhub run-csv 入口
  - devhub/src/renderer/components/csv/CsvLaunchWizard.tsx  # UI 选择三路 + 预览
  - devhub/src/renderer/components/csv/CsvLaunchWizardStepRunner.tsx
  - devhub/src/renderer/components/csv/CsvLaunchWizardStepDryRun.tsx
  - devhub/src/main/services/csv-launcher/CsvLauncher.test.ts
  - devhub/src/shared/schemas/csv-launch.ts  # Zod schema
modified_files:
  - devhub/src/main/ipc/csvHandlers.ts  # csv:launch / csv:get-runner-info
  - devhub/src/main/index.ts  # 启动注册 CsvLauncherService 单例
  - devhub/package.json  # bin: { "devhub": "dist/cli/csv-cli-entry.js" }
glob_anchors:
  - devhub/src/shared/schemas/csv-task-row.ts  # spec-13 CsvTaskRowSchema
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts:1-50  # spec-01 接入点
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { CsvTaskRowSchema } from '@/shared/schemas/csv-task-row'
import { CliEventSchema } from '@/shared/schemas/cli-event'

export const RunnerKindSchema = z.enum(['devhub', 'python', 'cli'])
export type RunnerKind = z.infer<typeof RunnerKindSchema>

export const CsvMetadataSchema = z.object({
  devhubCsvVersion: z.string().regex(/^\d+\.\d+$/).default('1.0'),
  runner: RunnerKindSchema.default('devhub'),
  author: z.string().optional(),
  createdAt: z.number().int().optional(),
  totalTimeoutMs: z.number().int().positive().optional(),
  concurrentMax: z.number().int().min(1).max(16).default(3),  // V1-Q-7.E.5 默认 3
})
export type CsvMetadata = z.infer<typeof CsvMetadataSchema>

export const LaunchOptionsSchema = z.object({
  csvPath: z.string(),
  runner: RunnerKindSchema.optional(),  // 覆盖 metadata
  resume: z.boolean().default(false),  // --resume 补跑
  dryRun: z.boolean().default(false),
  concurrent: z.number().int().min(1).max(16).optional(),
  forceRerun: z.array(z.string()).optional(),  // 任务 id 列表
  parallelGroupOverrides: z.record(z.string(), z.number()).optional(),
})
export type LaunchOptions = z.infer<typeof LaunchOptionsSchema>

export const LaunchSessionSchema = z.object({
  sessionId: z.string().uuid(),
  csvPath: z.string(),
  runner: RunnerKindSchema,
  metadata: CsvMetadataSchema,
  rows: z.array(CsvTaskRowSchema),
  startedAt: z.number().int(),
  pid: z.number().int().nullable(),  // python runner 的子进程 pid
  status: z.enum(['preparing', 'running', 'paused', 'completed', 'failed', 'aborted']),
  totalRows: z.number().int(),
  succeededRows: z.number().int(),
  failedRows: z.number().int(),
  pendingRows: z.number().int(),
})
export type LaunchSession = z.infer<typeof LaunchSessionSchema>

export interface IRunner {
  readonly kind: RunnerKind
  prepare(opts: LaunchOptions, rows: CsvTaskRowSchema[], meta: CsvMetadata): Promise<LaunchSession>
  start(sessionId: string): Promise<void>
  pause(sessionId: string): Promise<void>
  resume(sessionId: string): Promise<void>
  abort(sessionId: string): Promise<void>
  onCliEvent(handler: (e: z.infer<typeof CliEventSchema>) => void): () => void
  onProgress(handler: (sessionId: string, progress: { taskId: string, percent: number }) => void): () => void
  dispose(): Promise<void>
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  csv:launch:
  direction: renderer->main
  rate_limit: medium_query
  req: LaunchOptions
  resp: { sessionId: string, runner: RunnerKind }
  csv:abort:
  req: { sessionId: string }
  resp: { success: boolean }
  csv:pause:
  req: { sessionId: string }
  resp: { success: boolean }
  csv:resume:
  req: { sessionId: string }
  resp: { success: boolean }
  csv:get-runner-info:
  req: { kind: RunnerKind }
  resp: { available: boolean, version: string|null, details: Record<string,unknown> }
  csv:generate-cli-command:
  req: LaunchOptions
  resp: { command: string, copyToClipboard: boolean }
  csv:list-sessions:
  req: {}
  resp: LaunchSession[]
  csv:session-event-stream:
  direction: main->renderer
  streaming: true
  payload: { sessionId: string, type: 'task-start'|'task-progress'|'task-end'|'session-end', data: unknown }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| CSV 文件不存在 | E_NOT_FOUND |
| CSV schema 校验失败 | E_CSV_INVALID |
| Python 不可用（runner=python） | E_DEPENDENCY_MISSING |
| Python 脚本被篡改 sha256 不匹配 | E_INTEGRITY_FAIL |
| 同一 sessionId 重复 launch | E_VALIDATION |
| 拉起的子进程 spawn 失败 | E_SPAWN_FAILED |
| concurrent 超 16 | E_VALIDATION |
| metadata runner 字段非法 | E_VALIDATION |
| named pipe 连接失败（python ↔ DevHub） | E_NOT_FOUND |
| DAG 检测到环（spec-20 上抛） | E_DAG_CYCLE |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (DevHub runner 路径):
  given: CSV 含 3 行任务 + metadata 标 runner=devhub
  when: 用户从 CsvLaunchWizard 点击"启动"
  then:
  - LaunchSession.runner === 'devhub'
  - 30s 内 csv:session-event-stream 至少 emit 1 个 task-start
  - 监控窗口（spec-07）显示批次进度 ≥ 1 行

GWT-2 (Python runner 路径):
  given: 系统已装 Python ≥ 3.10，CSV metadata 标 runner=python
  when: csv:launch
  then:
  - LaunchSession.pid 非 null（指向 python 子进程）
  - DevHub 与 python 通过 named pipe 双向通信
  - python emit JSON 行 → DevHub 转 CliEvent → IPC 事件流

GWT-3 (CLI 命令生成):
  given: 用户选 runner=cli
  when: csv:generate-cli-command
  then:
  - resp.command 形如 'devhub run-csv tasks.csv --concurrent 3'
  - copyToClipboard 默认 true
  - 不实际启动子进程（仅生成）

GWT-4 (Python 不可用降级):
  given: metadata runner=python，但 systemPython 检测失败
  when: csv:launch
  then:
  - 返回 E_DEPENDENCY_MISSING + 提示用户安装或切回 devhub
  - 用户确认后 LaunchOptions.runner='devhub' 重新启动

GWT-5 (compatibility lock):
  given: sessionId 已 running
  when: 同一 csvPath 重复 csv:launch
  then: E_VALIDATION + 提示"批次正在运行，请先 abort 或 resume"

GWT-6 (Python script integrity):
  given: scripts/devhub-batch.py 被外部修改 sha256 变化
  when: PythonRunner.prepare
  then: E_INTEGRITY_FAIL + 提示用户重装或恢复脚本
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-14-csv-launch-3way.spec.ts
test('GWT-1 DevHub runner CSV 3 rows', async ({ page, electronApp }) => {
  await page.goto('app://./csv/wizard')
  await page.setInputFiles('[data-testid="csv-file-input"]', './fixtures/3-rows-devhub.csv')
  await page.click('[data-testid="csv-launch-confirm"]')
  const events: any[] = []
  await page.exposeFunction('__pushEvent', (e: any) => events.push(e))
  await page.evaluate(() => {
  window.electronAPI.csv.sessionEventStream.subscribe((e: any) => (window as any).__pushEvent(e))
  })
  await page.waitForFunction(() => (window as any).__lastTaskStart !== undefined, { timeout: 30000 })
  expect(events.find(e => e.type === 'task-start')).toBeDefined()
})

test('GWT-3 CLI command generation copy', async ({ page }) => {
  await page.goto('app://./csv/wizard')
  await page.setInputFiles('[data-testid="csv-file-input"]', './fixtures/cli-mode.csv')
  await page.click('[data-testid="csv-runner-cli"]')
  await page.click('[data-testid="csv-generate-command"]')
  const cmd = await page.locator('[data-testid="csv-cli-command-output"]').textContent()
  expect(cmd).toMatch(/^devhub run-csv .+\.csv/)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'execa@9.5':  spawn python child
  - 'node-pty@10.x':  交互式终端模式（cli runner 仿真）
  - 'papaparse@5.4':  CSV 解析（spec-13 共享）
  - 'cross-spawn@7.x':  Windows 兼容 spawn
  - 'commander@12.x':  devhub run-csv CLI 子命令
  - 'find-python-script@x':  自带：用 systeminformation 探测 Python 路径
inspirations:
  - "GitHub Actions act runner"
  - "asciinema rec / play"
  - "devbox / nox 多 runner 切换模式"
fallback_python_paths:
  - process.env.PYTHON
  - process.env.LOCALAPPDATA/Programs/Python/Python311/python.exe
  - C:/Python311/python.exe
  - "py -3.11"
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~700
modified_loc: ~80
test_loc: ~320
total: ~1100
risk_areas:
  - Python 可用性检测在不同 Windows 版本上的差异
  - named pipe 在 Windows 上的 ACL（与 DevHub 进程同 user）
  - CLI 子命令打包为可执行（pkg/nexe vs node-binary）
```

---

## 10. implement_checklist

- [x] CsvMetadataReader 解析首行 `# devhub-csv-version=1.0; runner=python`
- [x] DevHubRunner：直接调用 spec-15 TaskQueue（in-process）
- [x] PythonRunner：spawn `python devhub-batch.py --pipe \\.\pipe\devhub-csv-{sid}` + sha256 check
- [x] CliRunner：仅生成命令字符串 + 写到剪贴板（`navigator.clipboard.writeText`）
- [x] devhub-batch.py：argparse + named pipe + JSON line 协议（每行 `{type, payload}`）
- [x] CsvLaunchWizard 三步：选 runner → 预览 rows → dryRun/launch
- [x] dryRun=true 时仅校验 + 拓扑排序，不实际 spawn
- [x] feature flag `R8.C.csv.launch` 默认 ON，子项 `R8.C.csv.launch.python` 默认 OFF（用户自助开）
- [x] CLI subcommand `devhub run-csv <file>` 注册到 package.json bin
- [x] audit log：runner 选择 + sessionId + sha256(csvPath) + concurrent
- [x] cli:event-stream 与 spec-01 共享同一 IPC channel（不重复实现）
- [x] 限流：launch IPC 走 medium_query 桶（spec-31 token bucket）
- [x] vitest fixture：3-rows-devhub.csv / 5-rows-python.csv / dry-run-only.csv
- [x] 单进程互斥：同一 csvPath sha256 同时只能有一个 LaunchSession running

---

## 11. dependencies

```yaml
upstream:
  - spec-12: CSV driver 主框架
  - spec-13: CSV 18 列 Zod schema
  - spec-33: Zod SoT
  - spec-31: IPC 限流
  - spec-01: CliEventSchema 复用
downstream:
  - spec-15: TaskQueue 消费 LaunchSession.rows
  - spec-18: csv-task-driven 注入场景由 task-start 事件触发
  - spec-07: 监控窗口订阅 csv:session-event-stream
```

---

## 12. fallback_strategy

```yaml
on_python_unavailable:
  - PythonRunner.prepare 抛 E_DEPENDENCY_MISSING
  - UI 提示三选一：安装 Python / 切 devhub runner / 取消
  - audit log 记录降级原因
on_named_pipe_fail:
  - 退化到 stdout JSON 行模式（python 进程 stdout → DevHub）
  - 双向控制丢失（pause/resume 不可用），仅观察
  - 通知用户切到 devhub runner
on_cli_runner_user_no_clipboard:
  - 提供 textarea 让用户手动复制
  - 命令同时写到 %APPDATA%/devhub/last-csv-command.txt
flag_off_behavior:
  - R8.C.csv.launch=OFF → CSV 仅能在 CLI 中通过 devhub run-csv 触发，UI Wizard 隐藏
```

---

## 13. performance_budget

```yaml
launch_to_first_task_start_ms:
  devhub: { warn: 800, fatal: 2500 }
  python: { warn: 2500, fatal: 8000 }
  cli:  { warn: 50,  fatal: 200 }  # 仅生成命令字符串
spawn_python_p95_ms: 1500
named_pipe_handshake_p95_ms: 500
metadata_parse_p95_ms: 30
csv_validate_p95_ms_per_row: 2
ipc_channel: csv:launch → spec-31 medium_query 60 RPM
session_concurrent_max: 4  # 同一 DevHub 实例最多 4 批次并跑
```

---

## 14. implementation_evidence_2026-05-09

### completed_executable_slice

- Added `src/main/services/csv-launcher/CsvMetadataReader.ts` and wired `CsvParser` metadata extraction through it.
- DevHub runner path in `R8RuntimeService.launchCsv()` now validates the real CSV file, performs dry-run DAG topological build without queue mutation, enqueues real rows through `StoreBackedTaskQueueService`, starts ready tasks, persists `CsvLaunchSession`, writes `csv:launch` audit rows, and enforces same-`csvPath` active-session mutual exclusion.
- CLI runner path writes the generated `devhub run-csv` command to Electron clipboard, persists `last-csv-command.txt`, registers `package.json` `bin.devhub`, and includes a real `scripts/devhub-cli.mjs` entry that parses a local CSV stream and reports row count.
- Python runner path verifies `scripts/devhub-batch.py.sha256`, probes real local Python, starts a Node named-pipe server, spawns the real standard-library `scripts/devhub-batch.py` child with `--pipe`, and bridges JSON-line `session-start` / `task-start` / `task-progress` / `session-end` events back into DevHub.
- `csv:session-event-stream` and `cli:event-stream` are both emitted from launch events; the renderer preload exposes `onSessionEvent`, `getRunnerInfo`, `pause`, `resume`, and `abort`.
- `CsvLaunchWizard` is integrated into `R8OpsPanel` and supports runner selection, CSV path entry, dry-run/concurrency controls, CLI command generation, launch, session display, and recent session events.

### verification

- `pnpm -C . test --run src/main/services/csv-launcher/CsvMetadataReader.test.ts src/main/services/csv-launcher/PythonScriptManager.test.ts src/main/services/csv-launcher/CsvCliEntry.test.ts src/renderer/components/csv/CsvLaunchWizard.test.tsx src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/main/services/R8RuntimeService.test.ts --testNamePattern "CSV|csv|Csv|PythonScript|CsvMetadata|devhub run-csv|preload|IPC|schema|launch|Launch|runner|Runner" --maxWorkers=1` passed: 8 files, 33 tests.
- `pnpm -C . typecheck` passed.

### explicit_boundary

- Python pause/resume over a long-lived bidirectional control pipe is now implemented through a real named-pipe control socket. If the pipe cannot be created, stdout JSON-lines remain the truthful fallback described in `fallback_strategy`, and pause/resume remain unavailable for that fallback transport.
## 14. implementation_checkpoint_2026_05_04

```yaml
status: executable_slice_verified_with_python_boundary
implemented:
  - R8RuntimeService.launchCsv reads and validates a real CSV file, chooses runner from explicit input or CSV metadata, and creates persisted CsvLaunchSession records.
  - devhub runner path enqueues valid rows into the current store-backed task queue or returns dry-run sessions without pretending external command success.
  - cli runner path generates a copyable devhub run-csv command string and stores a command-generated session; it does not spawn a subprocess.
  - python runner path fails explicitly with E_DEPENDENCY_MISSING until a verified local Python bridge/named-pipe runner is installed; no fake Python success path exists.
  - csv:launch and csv:generate-cli-command are executable through IPC/preload, and new CSV launch channels are synced into prompts/0421/contracts/23-ipc-contracts-master.md.
verified_by:
  - R8RuntimeService.test.ts covers real userData/tasks CSV loading, devhub dry-run launch, cli command-generated launch, and python E_DEPENDENCY_MISSING.
  - CsvTaskDriver.test.ts covers command generation without spawning external processes.
known_boundaries:
  - This older checkpoint predates the 2026-05-09 and 2026-05-14 closure evidence; keep it only as historical context.
```

## 15. Implementation Evidence — 2026-05-14 Python Bidirectional Control Pipe Closure

```yaml
status: verified
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/scripts/devhub-batch.py
  - devhub/scripts/devhub-batch.py.sha256
  - devhub/src/main/services/R8RuntimeService.test.ts
behavior:
  - Python CSV launch now keeps a real named-pipe control socket for pause/resume while preserving the existing event socket for child-to-DevHub JSON lines
  - pauseCsvSession sends `{type:"control", action:"pause"}` to the Python bridge and persists session status as paused
  - resumeCsvSession sends `{type:"control", action:"resume"}` to the Python bridge and persists session status as running
  - the Python bridge acknowledges both commands through real `control-ack` session events and pauses row processing while the pause state is active
  - stdout JSON-lines fallback remains truthful: if no named pipe/control socket exists, pause/resume still fail explicitly instead of pretending control succeeded
  - `scripts/devhub-batch.py.sha256` was updated after the real script change and verified with `sha256sum -c`
verified_commands:
  - cd devhub && sha256sum -c scripts/devhub-batch.py.sha256 && python -m py_compile scripts/devhub-batch.py
  - pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts
  - pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "loads 18 column CSV|real Python CSV bridge" --maxWorkers=1
  - pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts -t "CSV launch runner|preload" --maxWorkers=1
  - pnpm -C devhub exec tsc --noEmit --pretty false
verified_results:
  script_integrity: passed
  python_compile: passed
  eslint: passed
  focused_runtime_vitest: passed; 2 selected CSV launch tests passed, including real Python child, named-pipe transport, pause control-ack, and resume control-ack
  ipc_preload_vitest: passed; 5 selected tests passed
  typecheck: passed
remaining_not_claimed_done: []
```
