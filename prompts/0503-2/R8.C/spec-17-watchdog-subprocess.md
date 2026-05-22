# R8.C spec-17 — Watchdog 独立子进程（双层守望 + 进程隔离）

> **batch**: R8.C  |  **priority_in_batch**: #17（24h 长跑容灾）  |  **flag**: `R8.C.watchdog.subprocess`
> **depends_on**: spec-16（Watchdog 引擎）+ spec-31（IPC 限流）+ spec-33（Zod SoT）+ spec-34（崩溃恢复）
> **blocks**: spec-18（注入场景需通过 Watchdog 子进程触发）
> **decision_anchor**: V1-Q-7.F.4 答 B（独立 Watchdog 子进程） / V1-Q-17.A.1..A.5 双层守望 / V1-Q-17.A.3 多通道通信 / V1-Q-17.A.4 Windows Service 兜底（用户可启用）
> **estimated_loc**: 1100
> **risk**: high

---

## 1. motivation

```yaml
user_quote_v1_q_7_f_4: "B — 独立 Watchdog 子进程"
user_quote_v1_q_17_a_1_implied: "C 默认（DevHub watch OuterWatchdog watch InnerWatchdog watch 任务）+ E 用户可启用 Windows Service"
user_quote_v1_q_17_a_3: "E — 多通道（共享文件 + named pipe + TCP localhost）"

goals:
  - 把 spec-16 WatchdogService 从 DevHub 主进程拆出，成为独立子进程（InnerWatchdog）
  - DevHub 主进程作为外层守望者（OuterWatchdog 角色）：监控 InnerWatchdog 心跳
  - InnerWatchdog 启动时反向监控 DevHub：DevHub 崩溃后仍能维持已注册的 AI 任务最低限度（仅心跳，不能拉起新任务）
  - 心跳互检：3 通道（marker 文件 + named pipe + TCP localhost）任一通即视为对方存活
  - DevHub 重启后能够接管已存在的 InnerWatchdog（通过 named pipe handshake + sessionToken 验证）
  - InnerWatchdog 崩溃时 DevHub 自动 spawn 新的 InnerWatchdog（带恢复指令）
  - 可选 Windows Service 第三层（OuterOuterWatchdog）：用户主动启用 sc create devhub-watchdog
  - 进程通信用 JSON-RPC over named pipe；备用 TCP localhost；最低 fallback 文件 mtime
  - PRIVACY-ZERO-TELEMETRY：所有通信仅 localhost，绝不外发
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/watchdog-process/main.ts  # InnerWatchdog 入口
  - devhub/src/watchdog-process/JsonRpcServer.ts  # named pipe + TCP server
  - devhub/src/watchdog-process/HandshakeProtocol.ts  # sessionToken 验证
  - devhub/src/watchdog-process/InnerWatchdogBootstrap.ts  # 启动 spec-16 WatchdogService
  - devhub/src/main/services/watchdog-supervisor/WatchdogSupervisor.ts  # 主进程一侧的守望者
  - devhub/src/main/services/watchdog-supervisor/WatchdogSpawner.ts  # spawn / respawn / kill
  - devhub/src/main/services/watchdog-supervisor/MutualHeartbeat.ts  # 三通道互检
  - devhub/src/main/services/watchdog-supervisor/WindowsServiceInstaller.ts  # 可选第三层
  - devhub/src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts
  - devhub/src/shared/schemas/watchdog-rpc.ts
  - devhub/src/shared/ipc/watchdog-rpc-types.ts
modified_files:
  - devhub/src/main/services/watchdog/WatchdogService.ts  # 抽出 init 接口供子进程调
  - devhub/src/main/index.ts  # 启动 WatchdogSupervisor
  - devhub/forge.config.ts  # 打包 watchdog-process 为单独 entrypoint
  - devhub/package.json  # bin entry: dist/watchdog-process/main.js
glob_anchors:
  - devhub/src/main/services/watchdog/WatchdogService.ts  # spec-16
  - devhub/src/main/services/recovery/CrashRecovery.ts  # spec-34 协同
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const RpcChannelSchema = z.enum(['named-pipe', 'tcp-localhost', 'marker-file'])

export const HandshakeMessageSchema = z.object({
  type: z.literal('handshake'),
  sessionToken: z.string().regex(/^[a-f0-9]{64}$/),  // sha256 hex
  protocolVersion: z.string().regex(/^\d+\.\d+$/),
  parentPid: z.number().int().positive(),
})
export type HandshakeMessage = z.infer<typeof HandshakeMessageSchema>

export const RpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.enum([
  'register-instance',
  'deregister-instance',
  'configure-instance',
  'get-status',
  'override-restart',
  'shutdown',
  'ping',
  ]),
  params: z.record(z.string(), z.unknown()).optional(),
})

export const RpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
  }).optional(),
})

export const SupervisorStateSchema = z.object({
  innerWatchdogPid: z.number().int().nullable(),
  startedAt: z.number().int().nullable(),
  lastInnerHeartbeatAt: z.number().int().nullable(),
  innerHealthy: z.boolean(),
  channelStates: z.record(RpcChannelSchema, z.boolean()),
  spawnAttempts: z.number().int(),
  lastSpawnError: z.string().nullable(),
  windowsServiceInstalled: z.boolean(),
})
export type SupervisorState = z.infer<typeof SupervisorStateSchema>

export const SessionTokenContextSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int(),
  parentPid: z.number().int(),
  childPidExpected: z.number().int().nullable(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels_renderer_to_main:
  watchdog-supervisor:status:
  rate_limit: meta
  req: {}
  resp: SupervisorState
  watchdog-supervisor:respawn:
  rate_limit: low_freq_op
  req: { reason: string }
  resp: { success: boolean }
  watchdog-supervisor:install-service:
  rate_limit: low_freq_op
  req: { confirmAdmin: boolean }
  resp: { success: boolean, requiresElevation: boolean }
  watchdog-supervisor:uninstall-service:
  req: {}
  resp: { success: boolean }

rpc_methods_main_to_inner:  # JSON-RPC over named pipe
  - register-instance:  params { instanceId, pid, config } → result { ok: true }
  - deregister-instance:  params { instanceId } → result { ok: true }
  - configure-instance:  params { instanceId, patch } → result { ok: true }
  - get-status:  params {} → result { WatchdogStatus }
  - override-restart:  params { instanceId, action } → result { ok: true }
  - ping:  params {} → result { pong: true, ts: number }
  - shutdown:  params { graceMs: number } → result { ok: true }

named_pipe_paths:
  - "\\\\.\\pipe\\devhub-watchdog-{sessionToken8}"  # 主通道
  - "\\\\.\\pipe\\devhub-watchdog-event-{sessionToken8}"  # 事件流（半双工）

tcp_localhost_fallback:
  - 127.0.0.1:{ephemeralPort}  # 仅 loopback bind
  - port 由 OS 分配后写入 marker 文件供 supervisor 读
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| InnerWatchdog spawn 失败 | E_SPAWN_FAILED |
| named pipe 创建失败 | E_RUNTIME |
| handshake sessionToken 不匹配 | E_PERMISSION_DENIED |
| RPC 协议版本不兼容 | E_VALIDATION |
| 三通道全部失联 | E_WATCHDOG_DEAD（FATAL） |
| Windows Service 安装需管理员 | E_PERMISSION_DENIED |
| InnerWatchdog 反向 ping 主进程超时 → 自身降级 | E_TIMEOUT（warn） |
| spawn 重试超 5 次 | E_RUNTIME（FATAL） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础启动 + 握手):
  given: DevHub 启动
  when: WatchdogSupervisor 启动 InnerWatchdog
  then:
  - InnerWatchdog spawn 成功，pid 写入 SupervisorState
  - named pipe 握手成功，sessionToken 验证通过
  - SupervisorState.innerHealthy === true 在 5s 内

GWT-2 (kill InnerWatchdog 自动 respawn):
  given: InnerWatchdog 正常运行
  when: 外部 taskkill /F /PID <innerPid>
  then:
  - 30s 内 SupervisorState 检测到失联（三通道都断）
  - 自动 respawn 新 InnerWatchdog
  - audit log 记录 respawn 原因

GWT-3 (DevHub 主进程崩溃 InnerWatchdog 不变):
  given: InnerWatchdog 已运行
  when: DevHub 主进程被杀
  then:
  - InnerWatchdog 检测到反向 ping 失败
  - InnerWatchdog 进入 'orphan' 模式：仅维持已注册的心跳监控，不接受新指令
  - DevHub 重启后通过 sessionToken 接管 InnerWatchdog

GWT-4 (三通道任一断时降级):
  given: named pipe 因系统资源失败
  when: 主进程检测
  then:
  - 自动降级到 TCP localhost
  - SupervisorState.channelStates['named-pipe'] === false
  - 功能不受影响

GWT-5 (Windows Service 安装):
  given: 用户在设置点击"安装 Watchdog 服务"
  when: 调用 watchdog-supervisor:install-service with confirmAdmin=true
  then:
  - 触发 spec-03 单次 UAC 提权
  - sc create devhub-watchdog binPath="..."
  - SupervisorState.windowsServiceInstalled === true

GWT-6 (重启风暴防护):
  given: spawnAttempts === 5 在 1 小时内
  when: 第 6 次 InnerWatchdog 崩溃
  then:
  - 不再 respawn
  - 通知用户 FATAL "Watchdog 子进程反复崩溃，请手动检查日志"
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-17-watchdog-subprocess.spec.ts
test('GWT-2 kill InnerWatchdog respawns', async ({ page, electronApp }) => {
  const initial = await page.evaluate(() => window.electronAPI.watchdogSupervisor.status())
  const oldPid = initial.innerWatchdogPid
  await electronApp.evaluate(({ }, pid) => {
  require('child_process').execSync(`taskkill /F /PID ${pid}`)
  }, oldPid)
  // wait for respawn
  await page.waitForFunction(async (oldPid) => {
  const s = await window.electronAPI.watchdogSupervisor.status()
  return s.innerHealthy && s.innerWatchdogPid !== oldPid
  }, oldPid, { timeout: 60000 })
  const after = await page.evaluate(() => window.electronAPI.watchdogSupervisor.status())
  expect(after.innerWatchdogPid).not.toBe(oldPid)
  expect(after.innerHealthy).toBe(true)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'execa@9.5':  spawn InnerWatchdog
  - 'json-rpc-2.0@1.7':  JSON-RPC framework
  - 'win-named-pipe@x':  Windows named pipe（如 net.createServer + path \\.\\pipe\\）
  - 'crypto':  sessionToken sha256
  - 'systeminformation@5.x':  pid 存在性检查
  - 'node-windows@1.x':  Windows Service 安装（仅当用户启用）
inspirations:
  - "Chrome multi-process architecture"
  - "VSCode extension host watchdog"
  - "Erlang/OTP supervisor 树"
sessionToken_generation: |
  sha256(`${parentPid}-${startedAt}-${randomBytes(32).toString('hex')}`)
named_pipe_acl:
  - 仅 current user 可访问（PIPE_ACCESS_DUPLEX + DACL）
  - 拒绝其他进程绑定相同 path（O_EXCL 等价）
forge_config_addition:
  packagerConfig:
  extraResource: ["dist/watchdog-process/"]
  electronPackagerConfig:
  afterCopy: copy watchdog-process dir to resources
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~700
modified_loc: ~80
test_loc: ~320
total: ~1100
risk_areas:
  - named pipe 在 Windows Server / 受限用户上的 ACL 行为
  - InnerWatchdog 子进程打包到 Electron 资源（asar.unpack）
  - Windows Service 路径与升级时的兼容
  - sessionToken 跨重启持久化（写到 %APPDATA%/devhub/watchdog-token.dat）
```

---

## 10. implement_checklist

- [x] WatchdogSupervisor 启动时生成 sessionToken，写入 marker 文件
- [x] WatchdogSpawner spawn packaged `out/main/watchdog-process/main.js --token=...` 子进程，并在 Electron binary 路径下设置 `ELECTRON_RUN_AS_NODE=1`
- [x] WatchdogSpawner 可在配置 `childEntryFile` 时真实 spawn Node 子进程，并向子进程传入 64-hex token、marker 路径、`DEVHUB_WATCHDOG_TOKEN` 与 `DEVHUB_WATCHDOG_MARKER`
- [x] InnerWatchdog 启动时读取 marker、校验 tokenPrefix、尝试连接 named pipe 并发送 handshake；父侧 `WatchdogSupervisor.startNamedPipeServer()` 可真实监听 named-pipe、接收 handshake、提供鉴权 JSON-RPC `ping`，当父侧 server 尚不可用时真实降级为 marker-file 心跳，不伪造握手成功
- [x] MutualHeartbeat: 主→子每 5s ping；子→主每 5s ping；任一方 ≥ 3 次失败 → 进入 degraded — 2026-05-18 parent supervisor now owns `startMutualHeartbeat()` with a 5000ms default scheduler, child long-running mode keeps the existing 5000ms child-to-parent handshake/marker loop, and Vitest covers both real event-pipe scheduled parent pong and three repeated parent-ping failures without inventing child liveness.
- [x] 三通道：named pipe（默认）→ TCP localhost（fallback）→ marker 文件 mtime（最低）— 2026-05-18 parent supervisor exposes real named-pipe and TCP JSON-RPC servers; InnerWatchdog attempts named-pipe first, falls back to marker-provided TCP port when named pipe is unreachable, and still uses marker-file heartbeat as the lowest channel without inventing liveness.
- [x] respawn 策略：max=5/hour，间隔指数退避 1s/2s/4s/8s/16s
- [x] 'orphan' 模式：DevHub 失联时 InnerWatchdog 仅维持心跳监控，不接受新 RPC — 2026-05-18 InnerWatchdog long-running mode now keeps a real in-memory registered-instance map, accepts register/deregister/configure only while attached, refreshes existing instance `lastHeartbeatAt` on heartbeat ticks, surfaces `registeredInstanceCount`/summaries in `get-status`, and preserves registered state after the marker parent PID becomes orphaned while refusing new control RPC with `E_ORPHAN_READ_ONLY`.
- [x] DevHub 重启时尝试通过 marker 文件读 sessionToken → 重新握手已存在 InnerWatchdog — 2026-05-18 WatchdogSupervisor now adopts an existing persisted session token when the stored parent PID is no longer alive, rewrites the marker for the new parent PID without treating the parent write as child liveness, starts a real named-pipe server on the same session path, and verifies takeover through a real long-lived InnerWatchdog child that re-reads the marker, handshakes with the new parent, and reports attached mode with the new parent PID.
- [x] Windows Service：仅在用户主动启用时；安装走 spec-03 单次 UAC；卸载也需管理员 — 2026-05-19 code now routes confirmed install/uninstall through a real `sudo-prompt` elevated executor, verifies final state with `sc.exe query`, persists `windowsServiceInstalled`, and keeps unconfirmed calls refused; 2026-05-20 fixes the `WindowsServiceInstaller` `sc.exe query` path by explicitly importing `execFile` from `node:child_process` and verifies focused lint/test/typecheck; 2026-05-22 elevated Windows run refreshed `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json` with `admin.isAdministrator=true`, `service.installed=true`, `service.status=Stopped`, `service.scExitCode=0`, and `R8C_SPEC17_WINDOWS_SERVICE_INSTALLED` passed.
- [x] feature flag `R8.C.watchdog.subprocess` 默认 ON；`R8.C.watchdog.subprocess.windows-service` 默认 OFF
- [x] R8RuntimeService 写入中心审计行：respawn、Windows Service command plan、handshake-fail、channel-degrade，以及 supervisor surface 为 orphan 时的 orphan 事件
- [x] audit log: packaged InnerWatchdog 全生命周期 spawn / respawn / orphan / handshake-fail / channel-degrade — 2026-05-18 R8RuntimeService now records explicit local `watchdog-supervisor:spawn` rows for real spawn attempts, preserves existing `watchdog-supervisor:respawn`, `watchdog-supervisor:handshake-fail`, and `watchdog-supervisor:channel-degrade` rows, and records one-shot `watchdog-supervisor:orphan` plus `watchdog-supervisor:takeover` rows when a restarted DevHub adopts a session whose stored parent PID is dead. The audit target includes only token prefix/session status, PID, command/entry metadata, channel state, and evidence string; it does not log the full session token.
- [x] 性能：InnerWatchdog 自身 RSS < 80MB，CPU 空闲 < 0.5% — 2026-05-18 `pnpm -C devhub bench:watchdog-subprocess` ran the built `out/main/watchdog-process/main.js` child entry with a real marker heartbeat and measured RSS 44.82MB / CPU 0% against the 80MB / 0.5% budget.
- [x] vitest fixture：真实 spawn 后 kill 子进程并在 handshake grace 后检测 dead；显式 named-pipe channel fail 后检测 dead
- [x] vitest fixture：真实 named-pipe/event-pipe fixture 覆盖 kill / orphan / channel fail；其中 orphan 覆盖 InnerWatchdog 在父 PID 失联时拒绝新的 control RPC，channel fail 覆盖已建立 named-pipe 显式失败

---

## 11. dependencies

```yaml
upstream:
  - spec-16: WatchdogService 引擎
  - spec-31: IPC 限流（rpc 通过 spec-31 桶）
  - spec-33: Zod SoT
  - spec-34: 崩溃恢复（DevHub 重启接管）
  - R8.A spec-03: 单次 UAC 提权（Windows Service 安装）
downstream:
  - spec-18: restart-resume 注入由 InnerWatchdog 触发
  - spec-29: 反馈循环消费 supervisor 事件
  - spec-30: 通知 FATAL 级别 watchdog 死亡
```

---

## 12. fallback_strategy

```yaml
on_named_pipe_fail:
  - 自动尝试 TCP localhost
  - 通知用户 channel degraded（INFO）
on_all_channels_fail:
  - 主进程视 InnerWatchdog 已死 → respawn
  - 若 respawn 仍失败 5 次 → FATAL + 关闭 watchdog 功能（feature flag 临时关）
on_inner_orphan:
  - InnerWatchdog 进入只读心跳模式
  - 不接受新 register-instance
  - 等待 DevHub 重启接管或 Windows Service 重新拉起
on_windows_service_uninstall:
  - 用户卸载 Service 后退到双层（DevHub + InnerWatchdog）
flag_off_behavior:
  - R8.C.watchdog.subprocess=OFF → 退回到 spec-16 WatchdogService 在主进程内运行
```

---

## 13. performance_budget

```yaml
spawn_inner_watchdog_p95_ms: 1500
handshake_p95_ms: 300
mutual_heartbeat_interval_ms: 5000
mutual_heartbeat_failure_threshold: 3
respawn_backoff_initial_ms: 1000
respawn_backoff_max_ms: 16000
respawn_max_per_hour: 5
inner_watchdog_rss_mb_warn: 80
inner_watchdog_rss_mb_fatal: 200
inner_watchdog_cpu_idle_pct: 0.5
named_pipe_throughput_msg_per_sec: 1000
tcp_fallback_latency_p99_ms: 50
ipc_channel: watchdog-supervisor:* → meta 600 RPM（极低频）
```

## 14. implementation_checkpoint_2026_05_04_supervisor_contract_slice

```yaml
status: watchdog_supervisor_contract_verified
implemented:
  - Added shared Zod source-of-truth contracts for spec-17 RPC channels, handshake messages, JSON-RPC requests/responses, supervisor state, session token context, marker file payload, channel diagnostics, supervisor status, and explicit respawn/service requests.
  - Added WatchdogSupervisor as a real main-process outer-supervisor boundary over the existing runtime store. It generates a real 64-character sha256 sessionToken from parentPid, timestamp, and randomBytes entropy, writes a marker file under userData, exposes named-pipe and event-pipe paths, and persists channel health without claiming child success.
  - Added HandshakeProtocol validation for sessionToken, protocolVersion, and parentPid mismatch. Invalid token handshakes fail with E_PERMISSION_DENIED instead of being accepted as a simulated inner process.
  - Added MutualHeartbeat channel model for named-pipe, tcp-localhost, and marker-file. TCP or marker fallback can keep supervisor degraded/healthy only when a real channel heartbeat is recorded; parent-written marker files are not treated as child liveness before a child has started.
  - Added respawn storm governance for the supervisor boundary: five respawn attempts within one hour are allowed, the sixth is rejected as E_RESTART_STORM with fatal status and respawnAllowed false.
  - Added WatchdogSpawner command builder and spawn boundary using node:child_process spawn with timeout, AbortController signal, windowsHide, and explicit environment propagation. Tests do not start long-lived children.
  - Added WindowsServiceInstaller command-plan boundary for sc.exe create/delete. Install/uninstall return requiresElevation and do not execute sc.exe automatically, preserving the user-explicit administrator requirement.
  - Wired watchdog-supervisor:status, watchdog-supervisor:respawn, watchdog-supervisor:install-service, and watchdog-supervisor:uninstall-service through R8RuntimeService, IPC handlers, preload bridge, renderer global types, and the preload whitelist contract.
verified_by:
  - src/shared/schemas/watchdog-rpc.test.ts covers strict handshake, JSON-RPC method validation, response exclusivity, exhaustive channel state validation, and supervisor status parsing.
  - src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts covers token/marker generation, invalid-token rejection, named-pipe handshake, TCP fallback degradation, stale-channel dead detection, restart storm rejection, and Windows Service command plans.
  - src/main/services/R8RuntimeService.test.ts covers the integrated supervisor status/respawn/service methods without faking subprocess execution.
  - src/main/ipc/r8RuntimeHandlers.test.ts and src/preload/preloadContract.test.ts verify the executable IPC and preload contract surface.
  - pnpm test --run src/shared/schemas/watchdog-rpc.test.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 passed: 5 files / 50 tests.
  - pnpm typecheck passed.
  - pnpm lint passed, including no-emoji over 306 files.
  - pnpm test --run --maxWorkers=1 passed: 63 files / 534 tests.
  - pnpm check:license passed: 399 production package entries validated; 1 manifest exception documented.
  - npx gitnexus analyze --force refreshed the index to 3,797 nodes / 11,203 edges / 302 clusters / 300 flows; R8RuntimeService and WatchdogSupervisor impact checks are LOW.
known_boundaries:
  - InnerWatchdog packaged entrypoint, real named-pipe server/client, localhost TCP server, child process lifecycle ownership, orphan mode runtime loop, audit-log rows, and Windows Service UAC execution remain future implementation work and are not claimed complete in this slice. DevHub restart takeover is closed later by `implementation_status_2026_05_18_restart_takeover`; event-stream notifications are closed later by `implementation_status_2026_05_18_renderer_supervisor_event_stream`.
  - The supervisor writes real marker files and validates real handshake payloads, but it does not start a long-lived subprocess unless a child entry file is configured by a future packaged entrypoint.
  - Persistent supervisor storm state can truthfully surface fatal/E_RESTART_STORM across repeated runs; tests assert the no-fake-success invariant rather than clearing production persistence.
```

## 15. implementation_status_2026_05_11_supervisor_contract_sync

```yaml
status: watchdog_supervisor_contract_partial_verified
implemented:
  - Synced the spec-17 checklist to the already implemented supervisor contract slice for sessionToken plus marker-file creation, bounded respawn storm governance, and default feature flags.
  - Strengthened WatchdogSupervisor regression coverage for exponential respawn backoff reporting at 1s/2s/4s/8s/16s and the sliding one-hour governor window.
  - Strengthened feature-flag regression coverage for R8.C.watchdog.subprocess default ON and R8.C.watchdog.subprocess.windows-service default OFF with explicit user override.
  - Added marker provenance to the supervisor marker contract so parent-supervisor marker writes publish session metadata only, while marker fallback heartbeat requires writer=inner-watchdog, the current token prefix, and a non-stale updatedAt.
  - Tightened watchdog-supervisor:status snapshots so channel staleness is evaluated before status is returned; stale named-pipe heartbeats no longer remain healthy until evaluate() is called explicitly.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/shared/schemas/watchdog-rpc.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "watchdog supervisor|WatchdogSupervisor|watchdog rpc|marker|respawn|Windows Service|default disabled states|feature flag" passed: 5 files passed / 1 skipped, 20 tests passed / 94 skipped.
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/shared/schemas/watchdog-rpc.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 passed: 5 files / 42 tests.
known_boundaries:
  - The checklist remains intentionally partial: real InnerWatchdog process entrypoint, JSON-RPC named-pipe/TCP servers, bidirectional 5s heartbeat loops, orphan mode, Windows Service UAC execution, central audit rows, subprocess RSS/CPU benchmark, and kill/orphan E2E are not claimed complete. DevHub restart takeover is closed later by `implementation_status_2026_05_18_restart_takeover`.
```

## 16. implementation_status_2026_05_16_real_spawn_audit_boundary

```yaml
status: watchdog_supervisor_real_spawn_and_audit_partial_verified
implemented:
  - WatchdogSpawner now has focused regression evidence for a real short-lived Node child process when WatchdogSupervisor is configured with childEntryFile.
  - The child process receives the actual 64-hex session token and marker-file path through both argv and the DEVHUB_WATCHDOG_TOKEN / DEVHUB_WATCHDOG_MARKER environment variables.
  - WatchdogSupervisor preserves truthful startup state during the handshake grace window: a just-spawned child remains `starting` instead of being immediately collapsed to `dead` before it has a chance to handshake.
  - R8RuntimeService writes central AuditLogger rows for watchdog-supervisor respawn requests, Windows Service install/uninstall command plans, invalid handshake attempts, degraded channel observations, and orphan status if surfaced by supervisor evaluation.
  - The audit wrapper does not log the full session token; only the existing 8-character token prefix from the validated supervisor status is included.
  - Added low-resource lifecycle fixtures for a real spawned Node child killed with SIGTERM and an explicit named-pipe channel failure after a validated handshake.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "spawns a real node|watchdog supervisor|respawn|marker|Windows Service" passed: 1 file, 7 tests, 3 skipped.
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "spawns a real node|truthful subprocess supervisor|watchdog supervisor|respawn|marker|Windows Service" passed: 2 files, 10 tests, 109 skipped.
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 passed: 1 file, 12 tests.
known_boundaries:
  - The configured-child spawn proof is not the packaged `dist/watchdog-process/main.js` entrypoint and does not close the packaged InnerWatchdog runtime requirement.
  - Real named-pipe/TCP JSON-RPC servers, bidirectional heartbeat loops, orphan-mode runtime behavior, subprocess RSS/CPU benchmark, and kill/orphan E2E remain open. DevHub restart takeover is closed later by `implementation_status_2026_05_18_restart_takeover`.
  - The full lifecycle audit checkbox remains open until the packaged InnerWatchdog runtime emits real spawn/orphan/takeover events rather than only the current supervisor control-plane events.
```

## 17. implementation_status_2026_05_16_packaged_inner_watchdog_entrypoint

```yaml
status: watchdog_packaged_inner_entrypoint_partial_verified
implemented:
  - Added `devhub/src/watchdog-process/main.ts` as a real InnerWatchdog child-process entrypoint.
  - The entrypoint accepts `--token`, `--marker`, `--heartbeat-interval-ms`, `--handshake-timeout-ms`, and `--once`, validates the 64-hex session token, reads the marker file through the shared watchdog marker schema, rejects token-prefix mismatches, and writes `writer=inner-watchdog` marker heartbeats with the real child PID.
  - The entrypoint attempts a named-pipe handshake with `{ type: 'handshake', sessionToken, protocolVersion, parentPid }` when the parent PID is alive, then truthfully falls back to marker-file heartbeat if no parent named-pipe server is listening.
  - `electron.vite.config.ts` now builds the child entry as `out/main/watchdog-process/main.js`; `R8RuntimeService` resolves that built entry when present instead of reporting a configured child when the file is missing.
  - `WatchdogSpawner` propagates `DEVHUB_WATCHDOG_TOKEN`, `DEVHUB_WATCHDOG_MARKER`, and `ELECTRON_RUN_AS_NODE=1` so packaged Electron child execution can run in Node mode without starting another UI app.
  - `WatchdogSupervisor` now accepts a fresh `writer=inner-watchdog` marker heartbeat as fallback liveness even when no prior in-memory started state exists, which is necessary for future restart/takeover work and still refuses parent-written marker refreshes.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "InnerWatchdog entrypoint|spawns a real node|watchdog supervisor|marker"` passed: 1 file, 5 tests, 8 skipped.
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1` passed: 1 file, 13 tests.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub build` passed and emitted `out/main/watchdog-process/main.js`.
  - Direct local execution of `node out/main/watchdog-process/main.js --token=<64hex> --marker=<real marker> --handshake-timeout-ms=25 --once` passed and rewrote the marker as `writer=inner-watchdog` with a numeric child PID.
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/schemas/watchdog-rpc.test.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "watchdog supervisor|WatchdogSupervisor|watchdog-supervisor|watchdog rpc|preload"` passed: 4 files passed, 1 skipped, 22 tests passed, 138 skipped.
  - `pnpm -C devhub lint`, `pnpm -C devhub check:zod-sot`, `pnpm -C devhub check:no-cloud-deps`, and `pnpm -C devhub check:no-ocr-deps` passed.
known_boundaries:
  - Parent-side TCP JSON-RPC fallback is still not implemented.
  - The named-pipe path now has a real parent-side server for handshake and authenticated JSON-RPC `ping`, but the long-lived bidirectional 5s ping loop remains open.
  - Orphan-mode command refusal surface, Windows Service UAC execution, full lifecycle audit rows from the child runtime, subprocess RSS/CPU benchmark, and kill/orphan E2E remain open. DevHub restart takeover across a changed parent PID is closed later by `implementation_status_2026_05_18_restart_takeover`.
```

## 18. implementation_status_2026_05_18_parent_named_pipe_server

```yaml
status: watchdog_parent_named_pipe_server_partial_verified
implemented:
  - Added a real parent-side named-pipe server to `WatchdogSupervisor`.
  - The server listens on the session-specific `HandshakeProtocol.namedPipePath(token)` path and is started before a configured child-entry respawn is requested.
  - Added a real parent-side TCP localhost fallback server. It binds to `127.0.0.1:0`, persists the selected port into supervisor state, and rewrites the marker file with the concrete `tcpPort`.
  - Extended the InnerWatchdog entrypoint so it attempts named-pipe handshake first, then uses the marker-provided TCP port as the real fallback channel when named pipe is unavailable.
  - Incoming child handshake payloads are parsed through the existing `HandshakeProtocol` validation path, so sessionToken, protocolVersion, and parentPid mismatch still fail instead of being accepted as liveness.
  - Added an authenticated JSON-RPC `ping` method over both named-pipe and TCP channels. Requests must include the current `sessionToken` in params; invalid tokens return `E_PERMISSION_DENIED`.
  - Added supported `get-status` / `shutdown` parent-control responses and explicit `E_UNSUPPORTED` errors for methods not yet implemented in the parent control plane.
  - `R8RuntimeService.dispose()` now closes the supervisor named-pipe and TCP servers to avoid lingering local handles.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "named pipe|InnerWatchdog named-pipe|JSON-RPC ping"` passed with 1 file, 5 tests, 10 skipped.
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1` passed with 1 file and 17 tests.
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "supports watchdog history"` passed with 1 file, 1 test, 124 skipped.
not_claimed_complete:
  - No automatic long-lived parent-to-child 5s ping scheduler or 3-failure degraded loop.
  - DevHub restart takeover across a changed parent PID is closed later by `implementation_status_2026_05_18_restart_takeover`.
  - Orphan-mode registered-instance heartbeat carryover is closed later by `implementation_status_2026_05_18_registered_instance_orphan_carryover`.
  - No subprocess RSS/CPU benchmark or kill/orphan E2E closure.
```

## 19. implementation_status_2026_05_18_child_event_pipe_ping

```yaml
status: watchdog_child_event_pipe_bidirectional_ping_partial_verified
implemented:
  - Added a real child-side JSON-RPC server inside the long-lived InnerWatchdog runtime. It listens on the marker-provided `eventPipePath` and is only started for non-`--once` child runs, so one-shot marker fixtures still exit cleanly.
  - Added `WatchdogSupervisor.pingInnerWatchdog()` as a real parent-to-child ping path. The parent reads a fresh `writer=inner-watchdog` marker, connects to the child event pipe, sends an authenticated JSON-RPC `ping`, validates the response, and records a named-pipe heartbeat without faking success on missing marker, timeout, or RPC error.
  - Child RPC requests require the full 64-hex `sessionToken` in params; invalid tokens return `E_PERMISSION_DENIED`.
  - Child `ping` and `get-status` return real process PID, parent PID, protocol version/status data, and attached/orphan mode derived from the real parent PID liveness check.
  - When the parent PID is no longer alive, the child remains reachable for heartbeat/status/shutdown but refuses new control instructions such as `register-instance` with `E_ORPHAN_READ_ONLY`.
  - Existing child-to-parent heartbeat remains real: InnerWatchdog continues to write `writer=inner-watchdog` marker heartbeats and attempts parent named-pipe/TCP handshakes on the configured interval.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1` passed with 1 file and 19 tests.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/WatchdogSupervisor.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/watchdog-process/main.ts --max-warnings=0` passed.
not_claimed_complete:
  - Orphan command refusal is real in this slice; registered-instance heartbeat carryover is closed later by `implementation_status_2026_05_18_registered_instance_orphan_carryover`.
  - DevHub restart takeover across a changed parent PID is closed later by `implementation_status_2026_05_18_restart_takeover`.
  - Windows Service UAC execution and kill/orphan E2E remain open.
```

## 20. implementation_status_2026_05_18_parent_heartbeat_scheduler

```yaml
status: watchdog_parent_heartbeat_scheduler_verified
implemented:
  - Added `WatchdogSupervisor.startMutualHeartbeat()` with a default 5000ms interval and 1000ms ping timeout.
  - The scheduler calls the real `pingInnerWatchdog()` parent-to-child event-pipe path and records failures through the existing `MutualHeartbeat` diagnostics instead of treating timer ticks as liveness.
  - `WatchdogSupervisor.stopMutualHeartbeat()` and `dispose()` clear the interval, avoiding leaked timers in tests and runtime shutdown.
  - `R8RuntimeService.watchdogSupervisorRespawn()` starts the parent heartbeat scheduler only after a real successful child respawn.
  - The child runtime already uses a default 5000ms loop to write `writer=inner-watchdog` marker heartbeats and attempt child-to-parent named-pipe/TCP handshakes.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1` passed with 1 file and 21 tests.
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "supports watchdog history"` passed with 1 file, 1 test, and 124 skipped.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/WatchdogSupervisor.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/watchdog-process/main.ts --max-warnings=0` passed.
not_claimed_complete:
  - Registered-instance orphan heartbeat carryover is closed later by `implementation_status_2026_05_18_registered_instance_orphan_carryover`.
  - DevHub restart takeover across a changed parent PID is closed later by `implementation_status_2026_05_18_restart_takeover`.
  - Windows Service UAC execution and kill/orphan E2E remain open.
```

## 21. implementation_status_2026_05_18_watchdog_subprocess_benchmark

```yaml
status: watchdog_subprocess_benchmark_verified
implemented:
  - Added `devhub/scripts/bench-watchdog-subprocess.mjs`.
  - Added package script `bench:watchdog-subprocess`.
  - The benchmark runs the built `out/main/watchdog-process/main.js` entrypoint as a real child process with `ELECTRON_RUN_AS_NODE=1`, a generated 64-hex token, and a real marker file.
  - The benchmark waits for a real `writer=inner-watchdog` marker heartbeat, samples RSS and CPU from the real child PID, enforces RSS < 80MB and idle CPU < 0.5%, then terminates and removes its temp marker directory.
verified_by:
  - `pnpm -C devhub bench:watchdog-subprocess` passed with RSS 44.82MB and CPU 0%.
not_claimed_complete:
  - Windows Service UAC execution and kill/orphan E2E remain open.
```

## 22. implementation_status_2026_05_18_registered_instance_orphan_carryover

```yaml
status: watchdog_registered_instance_orphan_carryover_verified
implemented:
  - Added a real registered-instance state map inside the long-lived InnerWatchdog runtime instead of treating `register-instance` as an unsupported placeholder.
  - `register-instance`, `deregister-instance`, and `configure-instance` require the authenticated full `sessionToken`, validate a non-empty `instanceId`, and update real in-memory state while the child remains attached to a live parent PID.
  - The child heartbeat loop refreshes `lastHeartbeatAt` for every registered instance on each real heartbeat tick, so already-registered instances keep an observable carryover heartbeat even after the parent marker becomes orphaned.
  - Child `ping` and `get-status` now report `registeredInstanceCount`; `get-status` also returns bounded instance summaries with `instanceId`, `pid`, timestamps, and sorted config keys.
  - Orphan mode preserves the existing registered-instance map, allows `ping` / `get-status` / `shutdown`, and still refuses new `register-instance` control RPC with `E_ORPHAN_READ_ONLY`.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "registered instance heartbeat state"` passed with 1 real long-lived child-process test and 21 skipped tests.
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1` passed with 1 file and 22 tests.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub exec eslint src/watchdog-process/main.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --max-warnings=0` passed.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 728 files.
  - `git -C devhub diff --check` and `git diff --check` passed with only existing LF/CRLF warnings.
  - `npx --yes gitnexus impact WatchdogSupervisor --repo devhub --depth 2 --include-tests` reported LOW risk with 6 impacted upstream nodes and no affected processes.
not_claimed_complete:
  - Windows Service UAC execution remains open.
  - Renderer event notifications are closed later by `implementation_status_2026_05_18_renderer_supervisor_event_stream`.
  - Kill/orphan E2E remains open.
```

## 25. implementation_status_2026_05_18_renderer_supervisor_event_stream

```yaml
status: watchdog_supervisor_renderer_event_stream_verified
implemented:
  - Added a shared `WatchdogSupervisorEventStreamPayload` Zod contract under the existing watchdog-rpc schema family; renderer events carry a bounded status snapshot, event type, audit-style result, code/message/reason/channel/evidence metadata, and only the 8-character `sessionTokenPrefix`.
  - Registered `watchdog-supervisor:event-stream` as a main-to-renderer R8 IPC stream channel under `R8.C.watchdog.subprocess`.
  - `R8RuntimeService` now emits real renderer stream events for supervisor status changes, respawn refusals/results, spawn attempts, heartbeat scheduler start, Windows Service command-plan refusals, handshake success/failure, channel degradation, orphan evidence, takeover evidence, and fatal/dead/orphan evaluation results.
  - The stream broadcasts to the main window and every non-destroyed BrowserWindow through `webContents.send('watchdog-supervisor:event-stream', payload)` instead of relying on polling-only UI refresh.
  - The preload bridge exposes `window.devhub.r8.watchdog.onSupervisorEventStream()` with a cleanup function, and `R8OpsPanel` subscribes to the stream so supervisor status changes update the renderer immediately.
  - The legacy `watchdog:event-stream` remains intact; the new stream is scoped to the spec-17 outer/inner supervisor lifecycle and does not conflate spec-16 policy-engine events.
verified_by:
  - `pnpm -C devhub exec vitest run src/shared/schemas/watchdog-rpc.test.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/R8OpsPanel.test.tsx src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "watchdog rpc schemas|watchdog supervisor lifecycle notifications|updates watchdog supervisor status|WatchdogSupervisorEventStreamPayload|watchdog-supervisor:event-stream|R8 IPC"` passed with 3 files / 7 tests and `src/shared/schemas/r8-runtime.test.ts` skipped by filter.
  - `pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1` passed with 1 file / 23 tests.
  - `pnpm -C devhub exec vitest run src/preload/preloadContract.test.ts --maxWorkers=1` passed on 2026-05-19 with 1 file / 4 tests after synchronizing the legacy `prompts/0421/contracts/23-ipc-contracts-master.md` X2 whitelist with the public preload bridge, including `task:export-results` and `watchdog-supervisor:event-stream`.
not_claimed_complete:
  - Windows Service UAC execution remains open.
  - Kill/orphan E2E remains open.
```

## 23. implementation_status_2026_05_18_restart_takeover

```yaml
status: watchdog_restart_takeover_verified
implemented:
  - `WatchdogSupervisor.ensureSession()` now preserves the existing 64-hex session token when the stored parent PID differs from the current parent PID and the stored parent PID is no longer alive.
  - The adopted session updates only the parent PID, preserving the token-derived named-pipe/event-pipe/marker paths so a still-running InnerWatchdog child can be reached after DevHub restarts.
  - `WatchdogSupervisor.status()` publishes a one-shot forced parent marker after adoption even when the previous marker was written by `inner-watchdog`; the forced parent marker is not treated as child liveness.
  - The long-running child re-reads the takeover marker on its normal heartbeat loop, rewrites `writer=inner-watchdog` with the new parent PID, and sends a real named-pipe handshake to the new parent server.
  - If the old stored parent PID is still alive, the supervisor does not steal the token and falls back to a fresh session, avoiding cross-instance takeover.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "takes over an existing InnerWatchdog session"` passed with a real long-lived child process and 22 skipped tests.
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1` passed with 1 file and 23 tests.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/WatchdogSupervisor.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/watchdog-process/main.ts --max-warnings=0` passed.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 728 files.
  - `git -C devhub diff --check` and `git diff --check` passed with only existing LF/CRLF warnings.
  - `npx --yes gitnexus impact WatchdogSupervisor --repo devhub --depth 2 --include-tests` reported LOW risk with 6 impacted upstream nodes and no affected processes.
not_claimed_complete:
  - Windows Service UAC execution remains open.
  - Renderer event notifications are closed later by `implementation_status_2026_05_18_renderer_supervisor_event_stream`.
  - Kill/orphan E2E remains open.
```

## 24. implementation_status_2026_05_18_lifecycle_audit_rows

```yaml
status: watchdog_lifecycle_audit_rows_verified
implemented:
  - `watchdog-supervisor:spawn` audit rows are emitted from `R8RuntimeService.watchdogSupervisorRespawn()` when the supervisor produces a real `WatchdogSpawnResult`; rows include spawn success, PID, command, entry file, status, channel states, respawn reason, and confirmer.
  - Existing `watchdog-supervisor:respawn` audit rows remain the respawn lifecycle record and are still emitted for permission refusal, spawn success, spawn failure, and restart-storm refusal.
  - Existing `watchdog-supervisor:handshake-fail` rows remain the invalid-handshake lifecycle record and continue to redact full session tokens.
  - Existing `watchdog-supervisor:channel-degrade` rows remain the channel failure/degraded lifecycle record.
  - `watchdog-supervisor:orphan` and `watchdog-supervisor:takeover` rows are emitted once per observed takeover evidence when a restarted DevHub adopts an existing session whose stored parent PID is dead.
  - The takeover/orphan audit dedupe key is local to the service instance and keyed by token prefix plus evidence, preventing repeated status polling from flooding audit logs.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "supports watchdog history"` passed with the watchdog supervisor audit assertions and 124 skipped tests.
  - `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1` passed with 1 file and 23 tests.
  - `pnpm -C devhub typecheck` passed.
  - `pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/watchdog-process/main.ts --max-warnings=0` passed.
  - `pnpm -C devhub check:zod-sot` passed.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 728 files.
  - `git -C devhub diff --check` and `git diff --check` passed with only existing LF/CRLF warnings.
  - `npx --yes gitnexus impact R8RuntimeService --repo devhub --depth 1 --include-tests` reported LOW risk with 3 direct upstream files and no affected processes.
  - `npx --yes gitnexus impact WatchdogSupervisor --repo devhub --depth 2 --include-tests` reported LOW risk with 6 impacted upstream nodes and no affected processes.
not_claimed_complete:
  - Windows Service UAC execution remains open.
  - Renderer event notifications are closed later by `implementation_status_2026_05_18_renderer_supervisor_event_stream`.
  - Kill/orphan E2E remains open.
```

## 26. implementation_status_2026_05_19_packaged_kill_orphan_e2e

```yaml
status: watchdog_packaged_kill_orphan_e2e_verified
implemented:
  - Normalized WatchdogSupervisor named-pipe and child event-pipe paths to the Node/Electron-supported Windows root `\\.\pipe\`, matching the benchmark and renderer fixture contract.
  - Removed Node `spawn({ timeout })` from the long-lived InnerWatchdog spawn path so the child is not terminated after the startup timeout; liveness is governed by explicit supervisor heartbeat, kill, orphan, and cleanup paths instead.
  - Added a packaged Electron Playwright E2E file for spec-17 using the built `out/main/index.js` and built `out/main/watchdog-process/main.js` entrypoint.
  - Added `DEVHUB_USER_DATA_DIR` as a main-process test-isolation env path; the app creates the directory and calls `app.setPath('userData', ...)` before Electron Store instances are created.
  - The kill-respawn E2E launches an isolated built Electron app, requests a real supervisor respawn through the preload IPC bridge, kills the actual InnerWatchdog PID, waits for supervisor `dead`, then requests a second real respawn and verifies a different live child PID.
  - The orphan E2E launches a fresh isolated built Electron app, requests a real supervisor respawn, registers an instance through the child event pipe, terminates the marker-recorded real parent PID without killing the child process tree, then verifies `get-status` reports `mode=orphan` and `register-instance` returns `E_ORPHAN_READ_ONLY`.
  - Hardened the orphan unit fixture so it waits for a real child event-pipe RPC response instead of treating the inner marker heartbeat as event-pipe readiness; marker heartbeat remains audit/liveness evidence, not a fake RPC readiness signal.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "refuses new control instructions in orphan mode"
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "spawns a real node|killed real spawned child|child event pipe|orphan mode|registered instance heartbeat|takes over"
  - pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/HandshakeProtocol.ts src/main/services/watchdog-supervisor/WatchdogSpawner.ts src/main/index.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts e2e/watchdog-subprocess.spec.ts --max-warnings=0
  - pnpm -C devhub typecheck
  - pnpm -C devhub build
  - pnpm -C devhub test:e2e e2e/watchdog-subprocess.spec.ts --reporter=line --workers=1
not_claimed_complete:
  - Windows Service UAC execution remains open and still requires a real elevated service install/uninstall execution path.
  - `pnpm -C devhub check:r8-external-blockers` currently exits non-zero by design with `admin=false`, `devhub-watchdog` not installed, and `scExitCode=1060`; this is the repeatable evidence boundary for the remaining live Windows Service gate.
```

## 27. implementation_status_2026_05_20_windows_service_installer_typecheck

```yaml
status: partial_boundary_hardening
completed:
  - Fixed the real Windows Service verifier dependency chain by importing `execFile` from `node:child_process` in `devhub/src/main/services/watchdog-supervisor/WindowsServiceInstaller.ts`, so the `sc.exe query` verification path is type-safe and runtime-resolvable.
  - Preserved the existing `sudo-prompt` UAC boundary, `confirmAdmin=true` requirement, `sc.exe query` postcondition, and no-fake-service-state behavior.
verified_by:
  - pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/WindowsServiceInstaller.ts --max-warnings=0
  - pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "Windows Service"
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "truthful subprocess supervisor contracts|watchdog supervisor control channels"
  - pnpm -C devhub exec tsc --noEmit --pretty false
  - pnpm -C devhub check:no-emoji
evidence_boundary:
  - `gitnexus context WindowsServiceInstaller` shows the class is imported by `WatchdogSupervisor.ts` and `watchdog-supervisor/index.ts`; the full unstaged GitNexus change detector remains `critical` because this shared worktree already contains 88 dirty `devhub` files, so this slice relies on file-scoped diff checks plus the focused verification commands above for this one-line import fix.
not_claimed_complete:
  - Live Windows Service UAC install/uninstall still has not been executed in this non-admin shell.
  - `devhub-watchdog` remains not installed until a real elevated install flow is accepted and verified by `sc.exe query`.
```
