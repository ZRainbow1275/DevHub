# 整理脏变更并切换 main 分支

## Goal

整理当前 `D:\Desktop\CREATOR ONE` 工作区的历史脏变更，尽量把可解释、可追踪的项目文件提交；同时把默认开发分支命名从 `master` 收敛到 `main`，避免继续使用 `master` 作为主要分支名。

## What I Already Know

- 用户要求“整理所谓的脏变更，尝试提交”，并明确“不应有 `master` 分支，应有 `main`”。
- 外层仓库与嵌套 `devhub` 都指向 `https://github.com/ZRainbow1275/DevHub.git`，但两者 Git 历史不同。
- `devhub` 的 app 历史已经可 fast-forward 推送，上一轮已推到远端 `master` 的 `c325220`。
- 外层仓库历史已经推到安全分支 `r8-0503-2-completion-ledger-parent`，直接推到远端 `master/main` 会与 app 历史冲突。

## Requirements

- 对脏变更做分组审查，而不是无条件 `git add .`。
- 提交可解释的项目变更，排除明显缓存、数据库、临时 dump、乱码根目录碎片和运行时锁文件。
- 本地分支名应从 `master` 切换为 `main`。
- 远端应提供 `main` 分支；删除或停用 `master` 时必须先确认不会破坏远端当前 app 历史。
- 禁止强推覆盖远端主线历史，除非有明确的安全祖先关系。

## Acceptance Criteria

- [ ] `git status --short` 中剩余未提交项仅为明确排除的临时/缓存/垃圾项，或全部已提交。
- [ ] 外层仓库至少产生一次整理提交，记录被纳入的脏变更。
- [ ] `devhub` 仓库分支切换为 `main`，并推送 `origin/main`。
- [ ] 外层仓库本地分支切换为 `main`；如不能安全推到 `origin/main`，需推到安全替代分支并说明原因。
- [ ] 尝试删除远端 `master`；若因默认分支保护等原因失败，记录明确错误。

## Definition of Done

- Git 提交完成并可在 `git log --oneline` 看到。
- 推送完成并通过 `git ls-remote --heads origin main master` 复核。
- 不删除未确认的用户文件，不清理全局资源，不强推破坏远端历史。

## Out of Scope

- 不重写 R8 业务实现。
- 不修改 `devhub` app 代码逻辑。
- 不强行合并外层仓库历史到远端 app 主线。

## Technical Notes

- 当前工作区存在大量历史脏变更，包含 Trellis/Claude/Codex 工具迁移、prompt 文档、以及明显临时文件。
- 明显不应提交的候选项包括 `.pnpm-store/`、`mitm_mcp_traffic.db`、`nul`、根目录乱码字段碎片、运行时 lock 和 dump 文件。
- 分支整理要区分外层 Trellis 包装仓库与嵌套 `devhub` app 仓库。
