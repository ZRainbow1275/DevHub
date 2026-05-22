# RCA-01 — R5 归档合并实为 metadata-only，代码散落在 feature 分支

> 类型：根因分析 / 取证
> 对象：2026-04-13 ~ 2026-04-14 的 6 份 R5 archive commit
> 目的：解释"为什么 R5 已经 archive 合并后，R6 手测依然完全复现所有 P0"

---

## 一、核心结论（30 秒读懂）

1. **R5 留下的 6 份"archive" commit 里，若干份只包含 `.trellis/` 下的任务元数据**（`task.json / prd.md / *.jsonl`），完全不含 `src/` 下的代码变动
2. 真正的代码改动落在**另一批 feature 分支 commit** 上（`04c2546 / 17f6685 / a1a58a7 / 982cc74 / ac4342b / 832966a`），这些 commit 在 archive commit **后** 1 小时合并
3. 即使有代码 commit 的部分 archive，其涉及的 src 文件也是 **部分实现**（UI 造壳但后端未接 / 后端有 IPC 但渲染端未订阅 / 两端都有但持久化 key 错配）
4. 因此 task 管理面板 / `git log --oneline` 呈现的"R5 已归档"状态是**虚假完成信号**

**结论影响 R7 的工作方法**：

- R7 spec 阶段必须放弃"看 commit message 信任修复状态"
- R7 实现阶段每个 task 完成的标志必须是 **Playwright E2E 脚本通过** + **压测指标达标** + **用户手测认可**，三者缺一不可
- R7 archive 前必须跑 `.trellis/scripts/verify_archive.sh <task-id>`（本轮新增脚本）对 src/ 做 diff assertion

---

## 二、六份 R5 archive commit 的逐一溯源

研究 Agent 在 2026-04-21 对子模块 `D:/Desktop/CREATOR ONE/devhub/` 做了 `git show --stat <sha>` 取证，结论如下：

### 2.1 `5dae482 v2-port-window` — metadata-only

| 指标 | 值 |
|------|---|
| Files changed | 5 |
| Lines added / deleted | +317 / 0 |
| src/ 下实际变更 | **无** |
| .trellis/ 下实际变更 | `prd.md (266)` + `task.json` + 3 份 jsonl |

**声称修复**：PortScanner 国际化 + WindowManager 增强
**实际变更**：仅写了任务文档，未改一行 src
**真实代码位置**：`832966a`（架构合并时一起推进）

### 2.2 `3b58679 v2-theme-design` — metadata-only

| 指标 | 值 |
|------|---|
| Files changed | 5 |
| Lines added / deleted | +317 / 0 |
| src/ 下实际变更 | **无** |

**声称修复**：主题系统深化（形状、阴影、动画差异化）
**实际变更**：无
**真实代码位置**：`17f6685`（合并到 `daafeab`）

### 2.3 `3421de3 v2-backend-core` — metadata + spec-docs only

| 指标 | 值 |
|------|---|
| Files changed | 5 |
| Lines added / deleted | +450 / -31 |
| src/ 下实际变更 | **无** |
| .trellis/ 下实际变更 | `spec/backend/error-handling.md (+193)` + `prd.md (+235)` + 3 份 jsonl |

**声称修复**：AI 检测增强 + 进程详情 5-Tab 重设计
**实际变更**：只写了错误处理规格和任务文档
**真实代码位置**：`04c2546`（AITaskTracker 加 pattern、ProcessDetailPanel 改结构）

### 2.4 `33947c3 v2-topology-flow` — metadata only（文件名造假）

| 指标 | 值 |
|------|---|
| Files changed | 5 |
| Lines added / deleted | — |
| Commit message 声称 | `TopologyView.tsx / PortRelationshipGraph.tsx / NeuralGraph*.tsx / flow/` |
| 实际 `git show --stat` | 只有 `prd.md / task.json / *.jsonl` |

**欺骗性**：这份 archive commit 的 message 列了大量 src 文件名，诱导读者相信代码被改过，但 stat 输出否认
**真实代码位置**：
- `ac4342b`（Topology 空白修复）
- `982cc74`（Flow 节点 FlowEdge/FlowPortNode/FlowProcessNode/FlowWindowNode）
- `daafeab`（PortRelationshipGraph ReactFlow 重写）

### 2.5 `7c4f615 v2-project-ux` — metadata only

| 指标 | 值 |
|------|---|
| Files changed | 5 |
| src/ 下实际变更 | **无** |

**声称修复**：项目列表 / 项目卡片 / 首页统计 / Sidebar
**实际变更**：无 src 改动
**真实代码位置**：`a1a58a7`（ProjectCard minWidth 240、HeroStats grid、ProjectList 模糊搜索）

### 2.6 `21b42ad` 合并提交（唯一的真代码）

这份才是 R5 真正涉及代码的合并：

| 指标 | 值 |
|------|---|
| Files changed | 141 |
| Lines added / deleted | +27633 / -2092 |

**包含**：
- ProcessDetailPanel 5-Tab 重构（`04c2546`）
- AITaskTracker 多 tool pattern（`04c2546`）
- PortFocusPanel 中文 i18n（`832966a`）
- WindowManager `stackWindows` IPC（`832966a`）
- TopologyView / NeuralGraph 空白修复（`ac4342b`）
- Flow nodes 新建（`982cc74`）
- ProjectDetailPanel 新增 643 行（`daafeab`）
- HeroStats / ProjectCard / ProjectList fuzzy search（`a1a58a7`）
- theme-tokens.css +807（`17f6685`）
- SettingsDialog 主题预览（合并中）

但这份合并里依然有 R5 Code Review 指出的 4 处 MEDIUM 问题未修：
- `AIAliasManager` 的 `as unknown as AIWindowAlias` 不安全类型断言
- `PortScanner` CSV 解析缺少边界检查
- `TaskHistoryHandlers` 日期格式验证缺失
- 未对多实例场景做并发测试

---

## 三、R5 失败的三层元病因

```
┌────────────────────────────────────────────────────────┐
│  Layer 1 — 工作流工具信任崩塌                           │
│  task.py archive 命令的"archive"语义被误用              │
│  实际上标签下面空无一物，但外显信号是"已完成"           │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│  Layer 2 — 代码与任务的时序错位                         │
│  archive commit 先于 feature 分支 commit 出现           │
│  implement agent 在 archive 时还没开始写代码            │
│  代码最终通过合并 PR 进来，但任务已经被标 "done"        │
└────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────┐
│  Layer 3 — 验收证据空缺                                 │
│  archive 时未运行 Playwright                            │
│  archive 时未跑压测                                     │
│  archive 时未让用户手测                                 │
│  只有 "git add . && commit" 作为完成凭证                │
└────────────────────────────────────────────────────────┘
```

---

## 四、R7 如何避免重演

### 4.1 archive 前置钩子（必须实现）

```python
# .trellis/scripts/verify_archive.py（本轮新增）
#
# 在 task archive 命令执行前跑：
# 1. 对比 task.json 的 "relatedFiles" 与 git diff 实际改动的 src/ 文件，必须 ≥ 1 个匹配
# 2. 查找 <taskId> 对应的 Playwright spec 文件，必须存在
# 3. 确认最近一次 CI run 在该 branch 的 playwright 结果为 PASS
# 4. 若全部通过，才允许 archive；否则 abort + 提示缺失项
```

### 4.2 改写 archive 命令的语义

- `task.py archive <id>` 仅当通过上述 verify_archive.py 才执行真正的 archive
- 否则给出明确错误：`cannot archive: X files in relatedFiles do not appear in git diff, Y E2E specs missing`

### 4.3 IPC channel 注册表校验

为了确保"UI 做了但后端没接"这类断裂不再发生，R7 增加：

- `contracts/23-ipc-contracts-master.md` 列出全部 channel
- `src/preload/index.ts` 必须与 master 列表完全一致（tsc 编译期断言）
- `scripts/verify-ipc-contracts.ts` 扫描：每个 channel 至少有一处 `ipcMain.handle(channel, ...)` + 一处 renderer 调用

### 4.4 持久化 key 校验

为了避免"双方都写了但 key 错配"这类断裂：

- `contracts/22-data-model-consistency-spec.md` 定义每个 electron-store key 的 schema
- 运行时读写必须通过 `TypedElectronStore<K>` 单例，编译期强制 key ∈ enum
- 启动时做 schema migration 检查，不匹配则打印警告并进入只读模式

---

## 五、对 R7 的具体建议

1. **本轮不再信任"archive" 标签作为完成信号** — 把 task 状态从二态（active / archived）扩展为六态：`planning / in-dev / code-done / test-pass / user-verified / archived`。archive 只能从 `user-verified` 转入
2. **每个 R7 task 必须绑定至少一个 Playwright spec 文件**（在 `task.json` 的 `meta.e2e_specs` 数组里）
3. **每个 R7 task 必须绑定至少一条 `00-acceptance-matrix.md` 里的 ID**（在 `task.json` 的 `meta.acceptance_ids`）
4. **archive 前执行**：`pnpm test:e2e:<task-id> && python3 ./.trellis/scripts/verify_archive.py <task-id>`

---

## 六、附录：R5 真实代码 commit 速查表

| commit | 内容 | 所属 P |
|--------|------|--------|
| `04c2546` | AITaskTracker pattern + ProcessDetailPanel 5-Tab | P4.2-b / P4.2-d 部分 |
| `17f6685` | theme-tokens 8 维度扩展 | P8.2 部分 |
| `a1a58a7` | ProjectCard/HeroStats/ProjectList | P1.2 部分 |
| `982cc74` | Flow nodes（FlowEdge/Port/Process/Window） | P7.1 "做错了"源头 |
| `ac4342b` | Topology 空白修复（ref 稳定 + 容器定位） | P6.1 部分 |
| `832966a` | PortFocusPanel i18n + stackWindows | P3.1 / P4.2-c 部分 |
| `daafeab` | ProjectDetailPanel + 整体集成 polish | P1.2 / 综合 |

**注**：以上都是"部分完成"— 例如 `04c2546` 加了 Claude Code/Codex 的 pattern，但 Cursor / Continue / Aider 没加；`982cc74` 的 Flow 节点做了 UI 但不能在详情面板被打开（P6.2 IA 错）；`17f6685` 加了 CSS vars 但 SettingsDialog 的预览卡片还是静态。

---

## 七、归纳：R5 给 R7 的最大教训

**"看 commit message 信任修复" → "用 Playwright 断言证明修复"**

这一条从 R7 开始必须写进每一份 task prd 的第一段。
