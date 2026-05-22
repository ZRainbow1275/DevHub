# R8.C spec-31 continuation implementation

## Goal

继续沿 `prompts/0503-2` 的 R8 PRD/spec 开发队列，完成 `R8.C/spec-31-ipc-rate-limit.md` 的真实实现、验证、审查和文档回写。当前范围只承载本轮 `spec-31`，不声明 80 份 PRD/spec 已全部完成。

## What I already know

- R8 硬约束来自 `prompts/0503-2/00-r8-master-prd.md`：不删除现有功能、不使用 Emoji、不使用 mock、不做大重构、优先集成现有库、Zod 单一来源。
- 上一轮交接显示 `R8.C/spec-30-notification-system.md` 已完成并通过完整验证；本轮从 `R8.C/spec-31-ipc-rate-limit.md` 继续。
- `spec-31` 要求新增 IPC 4 级 token bucket 限流：`high_freq_scan=30`、`medium_query=60`、`low_freq_op=120`、`meta=600` RPM。
- 每个 IPC 通道必须注册 `rateClass`；未声明默认 `medium_query`，但启动期 registry 仍要能检查未注册通道并给出 `E_VALIDATION`。
- 超限必须真实拒绝并返回 `E_RATE_LIMITED` 与 `retryAfterMs`，不能 mock、不能只做 UI 空壳。
- 需要暴露 `ipc:rate-limit-stats`、`ipc:rate-limit-channel-list`、`ipc:override-rate-class`，其中 override 只能在 development 环境使用。
- 需要统计命中、拒绝率、滑窗指标，供后续 `spec-32` observability panel 消费。
- 工作树已有大量历史 dirty/untracked 文件；本轮不得删除、reset、clean 或误纳入无关变更。

## Assumptions

- `devhub/` 是本轮代码实现仓库，父级 `prompts/0503-2` 是 R8 文档真相源。
- 资源谨慎优先，验证命令统一优先 `--maxWorkers=1`。
- `teamCreate` 工具当前未暴露；如无法使用，只记录事实并使用 Trellis sub-agent 或主线程低并发执行，不伪造 team 调用。

## Requirements

- 新增或复用 Zod SoT，为 rate class、channel registration、verdict、stats 提供 schema，并由 `z.infer` 派生类型。
- 新增全局单例 `RateLimiter`，实现 monotonic clock token bucket、burst、per-channel 或 per-sender bucket、flag off 时只记录不限流。
- 新增 `IpcChannelRegistry`，登记通道、rate class、burst、描述、可选 perSenderBucket，并能输出列表、校验通道覆盖。
- 新增 `RateLimitMiddleware` 或等价包装层，让 `ipcMain.handle` 类 handler 统一经过限流，不逐点复制判断。
- 保留现有 IPC handler 行为和旧功能，不删除现有通道、不改大架构。
- 接入 `ipc:rate-limit-stats`、`ipc:rate-limit-channel-list`、`ipc:override-rate-class` 三个 meta 通道。
- 为现有 R8 runtime/notification 等通道补充注册，确保至少本仓库已接入的 IPC 入口有 rate class。
- 增加 Vitest 覆盖 `spec-31` 的 5 条 GWT：基本限流、4 级独立、突发桶、统计、未注册通道校验。
- 更新 R8 文档 checklist、实施报告、必要共享 IPC/Zod/质量规范文档。

## Acceptance Criteria

- [x] `RateLimiter` 对 `high_freq_scan` 在 1 分钟内超过 30 次会真实拒绝并给出 `E_RATE_LIMITED`。
- [x] 4 个 rate class 的 bucket 互不污染，`meta` 高配额不影响 `high_freq_scan`。
- [x] `burstAllowance=5` 时瞬时突发可被吸收，超过突发与 RPM 容量后拒绝。
- [x] `ipc:rate-limit-stats` 可返回每通道总请求、拒绝请求、拒绝率、窗口起点。
- [x] registry 能对未注册通道执行启动期校验并抛出业务语义错误。
- [x] `R8.C.ipc.rate-limit=OFF` 时仅记录统计和 audit，不拒绝真实请求。
- [x] `pnpm typecheck`、定向测试通过，测试低并发运行。
- [x] `pnpm lint`、`pnpm check:no-emoji`、`pnpm check:license`、全量 Vitest 通过。
- [x] `git diff --check` 通过。

## Definition of Done

- 代码真实接入生产 IPC 路径，无 mock、无模拟生产逻辑。
- 单元测试覆盖新增 limiter、registry、middleware 和 IPC handler。
- 文档回写到 `prompts/0503-2/R8.C/spec-31-ipc-rate-limit.md`、`docs/r8bc-implementation-report.md`，必要时同步 `_shared` 与 `.trellis/spec`。
- 不提交、不清理历史 dirty/untracked 文件。

## Technical Notes

- 权威入口：
  - `prompts/0503-2/00-r8-implementation-quickstart.md`
  - `prompts/0503-2/00-r8-master-prd.md`
  - `.trellis/tasks/archive/2026-05/05-03-r8-prd-spec-batches/HANDOFF.md`
  - `prompts/0503-2/R8.C/prd.md`
  - `prompts/0503-2/R8.C/spec-31-ipc-rate-limit.md`
- 共享契约入口：
  - `prompts/0503-2/_shared/ipc-channels.md`
  - `prompts/0503-2/_shared/zod-schemas.md`
  - `prompts/0503-2/_shared/feature-flags.md`
  - `prompts/0503-2/_shared/testing-strategy.md`
