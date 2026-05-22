# 16 — CSV 任务驱动器深度需求表

> **填写时长**: 约 30–45 分钟
> **重要程度**: ⭐⭐⭐⭐⭐ R8 最大新增模块，用户原话"用 Python 脚本根据 CSV 逐条拉起或并行拉起 codex 持续工作验收的模式"
> **依赖**: 完成 V1-§07 (E 节) + V2-§13 + V2-§15 + V2-§17 (Watchdog)
> **核心命题**: CSV → 真实拉起 codex/claude/gemini → 持续工作 → 自动验收，每一步都可重现、可追溯、可补跑

---

## 引言：CSV 18 列的精确语义

V1-Q-7.E.1 用户已勾选**全部 18 列**，但每列的精确语义、约束、示例尚未确定。本表逐列定义，并对照 GitHub Actions YAML 的设计借鉴。

**Agent A 市场调研建议**: bullmq / better-queue（V1-Q-10.D.1 用户选 E + C，本地 SQLite + graphlib）+ 借鉴 Temporal.io 的 workflow + Prefect 的 task。

**Agent B 源码事实**: SystemProcessScanner 已用 papaparse 做 WMIC/Get-Process 的 CSV 解析（仅作进程信息读取），任务驱动 CSV 完全未实现。

---

## A. CSV Schema 18 列逐列澄清

### [Q-16.A.1] **id** 列  锚定 [Must]

**含义**: 任务唯一标识符。

**选项**:
- A. **UUID v4**（系统自动生成）
- B. **用户自定义字符串**（必须唯一）
- C. **B + 自动校验**（重复 → 启动失败）
- D. **C + 自动补全**（用户可留空，系统按行号填）

**推荐默认**: D

**约束**:
- 长度 1–64 字符
- 字母 / 数字 / 下划线 / 短横线
- 同一 CSV 内必须唯一

**示例**: `task-001` / `refactor-auth-flow` / `7e8f3a2c`

**用户回答**: ________________________

---

### [Q-16.A.2] **tool** 列  锚定 [Must]

**含义**: 用哪个 AI 工具执行。

**选项**（支持的工具值）:
- [ ] codex
- [ ] claude
- [ ] gemini
- [ ] cursor
- [ ] copilot
- [ ] aider
- [ ] continue
- [ ] open-interpreter
- [ ] auto（DevHub 自动选择最合适的）
- [ ] any-of:codex|claude|gemini（按优先级 fallback）

**推荐默认**: 全选 + auto + any-of

**约束**:
- 区分大小写不敏感
- 不支持的值 → 启动失败 + 提示

**用户回答**: ________________________

---

### [Q-16.A.3] **prompt** 列  锚定 [Must]

**含义**: 提示词内容或 SKILL 引用。

**选项**（支持的格式）:
- A. **纯文本**（"重构 src/auth.ts 为函数式风格"）
- B. **A + 变量插值**（`{{cwd}} / {{file}}` 等运行时变量）
- C. **B + SKILL 引用**（`@skill:code-review file=src/auth.ts`）
- D. **C + 多行**（CSV 用 `"..."` 包裹支持换行）
- E. **D + 外部文件引用**（`@file:prompts/refactor.md`）

**推荐默认**: E

**约束**:
- 最大长度 65535 字符
- 必须非空
- SKILL 引用必须存在

**示例**:
```csv
"重构 {{cwd}}/src/auth.ts 为函数式风格，确保所有测试通过"
"@skill:code-review file={{cwd}}/src/auth.ts standard=strict"
"@file:prompts/refactor-task-001.md"
```

**用户回答**: ________________________

---

### [Q-16.A.4] **cwd** 列  锚定 [Must]

**含义**: 任务的工作目录。

**选项**:
- A. **绝对路径**（`D:/projects/myapp`）
- B. **相对 CSV 文件路径**（`./repos/myapp`）
- C. **环境变量**（`%PROJECTS%/myapp`）
- D. **A + B + C 任一**

**推荐默认**: D

**约束**:
- 路径必须存在
- 必须可写
- 不允许指向系统目录（`C:/Windows` / `C:/Program Files`）

**用户回答**: ________________________

---

### [Q-16.A.5] **timeout** 列  协商 [Should]

**含义**: 单任务最大运行时间。

**选项**（值的格式）:
- A. **秒**（`3600`）
- B. **持续时间字符串**（`1h30m` / `2d`）
- C. **B + ∞ 表示不限**

**推荐默认**: C

**约束**:
- 最小 60 秒
- 最大 7 天
- 留空 = 默认 1 小时

**示例**: `1h` / `30m` / `2d12h` / `∞`

**用户回答**: ________________________

---

### [Q-16.A.6] **retry** 列  协商 [Should]

**含义**: 失败重试次数。

**选项**（值的格式）:
- A. **整数**（`3`）
- B. **A + 退避策略**（`3@exponential` / `3@linear:30s` / `3@fixed:60s`）
- C. **B + 最大间隔**（`3@exp:max=10m`）

**推荐默认**: C

**示例**: `3@exp:max=10m` / `5@fixed:30s` / `0`（不重试）

**用户回答**: ________________________

---

### [Q-16.A.7] **on_fail** 列  锚定 [Must]

**含义**: 任务失败后的策略。

**选项**（关联 V1-Q-7.E.6 用户已选"全部支持"）:
- next（跳过继续）
- abort（整批中止）
- retry（按 retry 列重试）
- fallback-tool（切换工具）
- escalate-model（升级模型）
- human（暂停等人工）
- execute-skill（调用修复 SKILL）

**新增 V2 复合策略**:
- [ ] `retry → fallback-tool → human`（链式）
- [ ] `retry@3 || fallback-tool=claude || abort`（DSL 表达）

**推荐默认**: 简单值 + 链式语法都支持

**示例**:
```csv
"retry"
"retry@3 → fallback-tool=claude → human"
"abort"
```

**用户回答**: ________________________

---

### [Q-16.A.8] **dependency** 列  锚定 [Must]

**含义**: 任务依赖（DAG 编排）。

**选项**:
- A. **逗号分隔的 id 列表**（`task-001,task-002`）
- B. **A + 关系类型**（`after:task-001`）
- C. **B + 条件依赖**（`after:task-001 if=success`）
- D. **C + 表达式**（`(task-001 OR task-002) AND task-003`）

**推荐默认**: C（轻量起步，D 视用户需求）

**示例**:
```csv
"task-001"  # 简单 after
"after:task-001 if=success"  # 仅 task-001 成功后
"after:task-001|task-002 if=any"  # 任一成功即可
```

**用户回答**: ________________________

---

### [Q-16.A.9] **parallel_group** 列  协商 [Should]

**含义**: 同组任务可并行。

**选项**:
- A. **字符串组名**（同组并行）
- B. **空 = 串行**
- C. **A + 组内并发上限**（`group-1:max=3`）

**推荐默认**: C

**示例**: `frontend` / `backend:max=2` / `(空)`

**用户回答**: ________________________

---

### [Q-16.A.10] **success_criteria** 列  锚定 [Must]

**含义**: 任务成功的判定。

**关联 V1-Q-7.E.7 用户选"全部支持"**

**选项**（要支持的判定，可多选 + 组合）:
- A. exit-code:0
- B. stdout-contains:"completed"
- C. stdout-not-contains:"error"
- D. git-diff:lines>0
- E. git-diff:files=src/auth.ts
- F. test-cmd:"npm test"
- G. lint-cmd:"npm run lint"
- H. file-exists:dist/main.js
- I. file-content-match:src/auth.ts:/^export/
- J. ai-self-report:"DONE"
- K. custom-script:scripts/check-task-001.sh

**新增 V2 复合**:
- [ ] **AND 组合**（`exit-code:0 AND test-cmd:"npm test"`）
- [ ] **OR 组合**（`exit-code:0 OR ai-self-report:"DONE"`）
- [ ] **NOT 组合**（`NOT stdout-contains:"FAIL"`）

**推荐默认**: 全选 + 复合表达式

**示例**:
```csv
"exit-code:0 AND test-cmd:\"npm test\""
"git-diff:lines>10 AND lint-cmd:\"npm run lint\""
"ai-self-report:\"DONE\" OR exit-code:0"
```

**用户回答**: ________________________

---

### [Q-16.A.11] **post_action** 列  协商 [Should]

**含义**: 成功后的动作。

**选项**:
- A. commit（git add . && git commit -m "task-001 done"）
- B. push（git push）
- C. next（继续下条任务，默认）
- D. notify-webhook:URL
- E. send-slack:CHANNEL（V1-Q-9.H.1 用户拒绝外发，故 D/E 仅本地 webhook）
- F. trigger-task:task-id（手动触发非 dependency 后续任务）
- G. backup-artifacts（保存 output_files 到 archive 目录）
- H. run-script:scripts/post-task.sh

**推荐默认**: A + C + F + G + H（不外发到第三方）

**用户回答**: ________________________

---

### [Q-16.A.12] **env** 列  委托 [Could]

**含义**: 任务的环境变量。

**选项**:
- A. **JSON 内联**（`{"NODE_ENV":"prod","API_KEY":"..."}`）
- B. **A + 引用文件**（`@env-file:.env.task-001`）
- C. **B + 变量插值**（`{"PROJECT":"{{cwd_basename}}"}`）
- D. **C + secret 标记**（`{"API_KEY":"!secret:openai"}` 从加密 store 读）

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.A.13] **input_files** 列  协商 [Should]

**含义**: 任务启动前注入到工作目录的文件。

**选项**:
- A. **逗号分隔路径**（`tasks/inputs/task-001.json,tasks/inputs/spec.md`）
- B. **A + glob**（`tasks/inputs/task-001/*`）
- C. **B + 链接 vs 复制**（`link:tasks/...` vs `copy:tasks/...`）

**推荐默认**: C

**用户回答**: ________________________

---

### [Q-16.A.14] **output_files** 列  协商 [Should]

**含义**: 任务结束后自动收集的产出文件。

**选项**:
- A. **逗号分隔 glob**（`dist/**,build/**.log`）
- B. **A + 收集到 archive**（`archive/task-001/dist/...`）
- C. **B + 时间戳归档**（`archive/2026-05-03/task-001/...`）

**推荐默认**: C

**用户回答**: ________________________

---

### [Q-16.A.15] **alias** 列  委托 [Could]

**含义**: 任务别名（用于通知 / 日志显示）。

**约束**:
- 1–64 字符
- 留空 = id 兜底

**用户回答**: ________________________

---

### [Q-16.A.16] **priority** 列  委托 [Could]

**含义**: 任务优先级。

**选项**:
- A. high / normal / low
- B. **整数 0–100**
- C. **A + B 兼容**

**推荐默认**: C

**用户回答**: ________________________

---

### [Q-16.A.17] **tags** 列  委托 [Could]

**含义**: 用户自由标签。

**选项**:
- A. 逗号分隔字符串
- B. 用于 UI 过滤 + 报表统计

**推荐默认**: A + B

**用户回答**: ________________________

---

### [Q-16.A.18] 是否支持 **第 19 列：notes** 备注  委托 [Could]

**新增建议**: 用户可写人类可读的备注，不影响执行。

**用户回答**: A. 加 / B. 不加

---

## B. CSV 文件级 metadata

### [Q-16.B.1] CSV 文件头部 metadata  协商 [Should]

**背景**: 标准 CSV 18 列是任务级。但批次级 metadata（版本 / 作者 / 创建时间 / 总超时）应放在哪？

**选项**:
- A. **不支持**（仅按任务级）
- B. **专用 metadata header 行**（CSV 第一行 `# devhub-csv-version=1.0; ...`）
- C. **B + 同名 .meta.json 文件**（`tasks.csv` + `tasks.csv.meta.json`）
- D. **C + UI 创建批次时设置**

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.B.2] CSV schema 版本  锚定 [Must]

**选项**:
- A. **不版本化**（每次破坏性升级硬切）
- B. **header 版本号**（`# devhub-csv-version=1.0`）
- C. **B + 自动迁移**（旧版本 CSV 启动时自动升级）

**推荐默认**: C

**用户回答**: ________________________

---

### [Q-16.B.3] CSV 校验时机  锚定 [Must]

**选项**:
- A. **启动时**（载入 → 校验 → 失败终止）
- B. **A + 行级校验**（每行独立报错，无效行跳过）
- C. **B + IDE 集成**（编辑 CSV 时实时校验，类似 VSCode JSON Schema）

**推荐默认**: B + C（C 通过 vscode-csv-schema-validator 等扩展提供 schema）

**用户回答**: ________________________

---

## C. CSV 拉起 codex 的中间层架构

### [Q-16.C.1] 拉起方式  锚定 [Must]

**关联 V1-Q-7.E.3 用户选 D（A+B+C 全部支持）**: DevHub 内置 + Python 脚本 + CLI 子命令

**精细化选项**:
- A. **DevHub 主进程内置 runner**（最直接，无外部依赖）
- B. **DevHub spawn Python 子进程**（通过 spawn-pty 启动 `devhub-batch.py`）
- C. **CLI 子命令**（`devhub run-csv tasks.csv` 在终端用）
- D. **A + B + C 全部支持**

**推荐默认**: D

**重要决策**: 用户原话"编写 Python 脚本根据 CSV 逐条拉起或并行拉起 codex 持续工作验收的模式"——意味着 B 必须实现。

**影响范围**: B 需要 DevHub 内置或调用 Python 运行时（建议调用系统 Python，提供 `devhub-batch.py` 脚本）

**用户回答**: ________________________

---

### [Q-16.C.2] Python 脚本的位置  协商 [Should]

**选项**:
- A. **DevHub 安装目录的 scripts/devhub-batch.py**
- B. **用户全局 %APPDATA%/devhub/scripts/**
- C. **项目级 .devhub/scripts/**
- D. **A 默认 + B 用户自定义版本**

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.C.3] Python 与 DevHub 的通信协议  锚定 [Must]

**选项**:
- A. **stdout JSON 流**（python 输出每行 JSON，DevHub 监听）
- B. **A + named pipe**（双向通信）
- C. **B + WebSocket localhost**（更通用）
- D. **B + IPC unix domain socket**（Windows 上用 named pipe）

**推荐默认**: D（最高效）

**用户回答**: ________________________

---

### [Q-16.C.4] Python 脚本的责任划分  锚定 [Must]

**选项**（python 脚本要做的事）:
- A. **仅 CSV 解析**（DevHub 拿到结构化数据后自己跑）
- B. **A + 任务调度**（python 自己跑 better-queue 调度）
- C. **B + 真实拉起 codex**（python 用 subprocess 启动 codex）
- D. **C + 监控 + 验收**（python 完整闭环）

**推荐默认**: D（python 完整闭环，DevHub 仅展示状态）

**影响范围**: D 让 python 成为真正的"运行器"，DevHub 仅观察 + 控制；A 让 DevHub 自己跑

**用户回答**: ________________________

---

### [Q-16.C.5] DevHub 内置 runner 与 Python runner 二选一  锚定 [Must]

**选项**:
- A. **二者并存，用户选**
- B. **DevHub runner 默认，python 兜底（如系统无 Python）**
- C. **Python runner 默认，DevHub runner 兜底**
- D. **完全独立分支**（用户在 CSV metadata 中标 `runner=devhub` 或 `runner=python`）

**推荐默认**: A + D（用户每个 CSV 自由选择）

**用户回答**: ________________________

---

## D. 任务执行的"幂等性 + 补跑"

### [Q-16.D.1] 同一 CSV 多次运行  锚定 [Must]

**背景**: 用户跑了一次，部分任务失败，第二次想"只补跑失败的"。

**选项**:
- A. **每次重跑全部**（最简单）
- B. **跳过已成功任务**（基于持久化任务状态）
- C. **B + 用户可选"强制重跑"** （--force）
- D. **C + 部分参数变更检测**（task definition 变了就重跑）

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.D.2] 任务状态持久化  锚定 [Must]

**选项**:
- A. **内存**（崩溃即丢）
- B. **JSON 文件**（每次执行写盘）
- C. **SQLite**（与 [Q-15.D.3] 一致）
- D. **C + 增量写入**（只 append，不覆盖）

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.D.3] 失败任务的"补跑"入口  锚定 [Must]

**选项**:
- A. **CLI**: `devhub run-csv tasks.csv --resume`
- B. **DevHub UI**: "重新运行失败任务"按钮
- C. **状态栏徽章**: 失败任务计数 + 一键补跑
- D. **A + B + C 全部**

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.D.4] 补跑的数据范围  协商 [Should]

**选项**:
- A. **仅失败任务**
- B. **A + 受失败影响的下游**（dependency chain）
- C. **B + 用户可选范围**（"补跑 task-001 + 它所有下游"）

**推荐默认**: C

**用户回答**: ________________________

---

## E. Artifact 收集

### [Q-16.E.1] 每个任务的 artifact 默认收集  协商 [Should]

**选项**（默认收集的 artifact 类型）:
- [ ] stdout / stderr 全文
- [ ] 退出码
- [ ] 任务运行时长
- [ ] 资源占用（CPU / RSS）
- [ ] git diff（任务前后）
- [ ] output_files 列指定的文件
- [ ] 屏幕截图（每 N 秒一张，可关）
- [ ] AI 信号融合得分历史
- [ ] 状态机翻转日志

**推荐默认**: 全选

**用户回答**: ________________________

---

### [Q-16.E.2] Artifact 存储位置  委托 [Could]

**选项**:
- A. `%APPDATA%/devhub/artifacts/{batch-id}/{task-id}/`
- B. CSV 文件同目录的 `artifacts/`
- C. 用户自定义
- D. A 默认 + C 可改

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.E.3] Artifact 的归档策略  委托 [Could]

**选项**:
- A. **永不删除**
- B. **30 天后自动归档为 .tar.gz**
- C. **B + 90 天后删除**
- D. **用户可配置**

**推荐默认**: D（默认 B + C）

**用户回答**: ________________________

---

## F. 任务级日志标准

### [Q-16.F.1] 每个任务的日志格式  协商 [Should]

**选项**:
- A. **JSONL append-only**（每行 JSON 事件）
- B. **A + 时间戳 ISO 8601**
- C. **B + 标准字段**（task_id / event / level / message / context）
- D. **C + OpenTelemetry trace_id**（未来联通分布式追踪）

**推荐默认**: C 默认 + D 加分

**用户回答**: ________________________

---

### [Q-16.F.2] 日志级别  委托 [Could]

**关联 V1-Q-9.C.1 用户选 A（TRACE/DEBUG/INFO/WARN/ERROR/FATAL）**

**任务专属新增**:
- [ ] **TASK-START**: 任务启动
- [ ] **TASK-PROGRESS**: 进度变化
- [ ] **TASK-COMPLETE**: 任务结束
- [ ] **TASK-RETRY**: 重试
- [ ] **TASK-FALLBACK**: 切换工具
- [ ] **TASK-HUMAN-PAUSE**: 等待人工
- [ ] **TASK-INJECT**: 自动注入
- [ ] **TASK-WATCHDOG-ACTION**: Watchdog 介入

**推荐默认**: 全选

**用户回答**: ________________________

---

### [Q-16.F.3] 日志查看器  协商 [Should]

**选项**:
- A. **不实现**（仅文件）
- B. **应用内日志查看器**（按任务过滤 + 关键字搜索）
- C. **B + 实时滚动**
- D. **C + 日志可点击跳转**（点击 stdout 行 → 跳到任务录像对应位置）

**推荐默认**: D

**用户回答**: ________________________

---

## G. 模板与脚手架

### [Q-16.G.1] 内置 CSV 模板库  协商 [Should]

**选项**（DevHub 自带的 CSV 模板）:
- [ ] 单文件代码评审批次
- [ ] 全项目重构批次
- [ ] 测试编写批次
- [ ] 文档生成批次
- [ ] PR 描述生成批次
- [ ] 多 AI 工具对比基准测试批次（同一任务交给不同工具）
- [ ] 长任务串联批次（A 完成后 B 开始）
- [ ] 周期定时批次（不在本期，留接口）

**推荐默认**: 全选

**用户回答**: ________________________

---

### [Q-16.G.2] CSV 编辑器  协商 [Should]

**选项**:
- A. **不实现**（用户用外部编辑器）
- B. **应用内表格编辑器**（类 Excel）
- C. **B + 列校验**（实时高亮无效值）
- D. **C + 快速插入模板**（"插入新任务" 按钮，含变量提示）
- E. **D + DAG 可视化**（编辑时实时显示依赖图）

**推荐默认**: E

**用户回答**: ________________________

---

### [Q-16.G.3] CSV 导入向导  委托 [Could]

**选项**（用户首次创建 CSV 的引导）:
- A. **空白模板**
- B. **从模板创建**（V1-G.1 选项）
- C. **从已有 CSV 复制 + 修改**
- D. **AI 辅助**（描述需求 → AI 生成 CSV 草稿）

**推荐默认**: A + B + C + D

**用户回答**: ________________________

---

## H. CSV 与 GitHub Actions YAML 的设计对比

### [Q-16.H.1] 借鉴 GitHub Actions 的特性  协商 [Should]

**选项**（GHA 有但 V1 未涉及的特性）:
- [ ] **matrix strategy**（同一任务跑多个变量组合）
- [ ] **conditional steps**（`if: success()` / `if: failure()`）
- [ ] **environment variables 继承**（job-level → step-level）
- [ ] **secrets 管理**（与 [Q-16.A.12] D 联动）
- [ ] **outputs 在任务间传递**（task-001 的 output 可作为 task-002 的 input）
- [ ] **timeout 多层**（job-timeout + step-timeout）
- [ ] **continue-on-error**（task 失败但批次继续）
- [ ] **needs**（与 dependency 等价）
- [ ] **concurrency groups**（同 group 同时只跑一个）

**推荐默认**: 全选（最大化能力）

**用户回答**: ________________________

---

### [Q-16.H.2] CSV 是否扩展为 YAML  委托 [Could]

**背景**: 18 列 + 复合表达式 + matrix → CSV 已经撑不住，YAML 更合适。

**选项**:
- A. **仅 CSV**（保持简单）
- B. **CSV + YAML 双格式**（用户选）
- C. **YAML 优先 + CSV 兼容**
- D. **延后**（R8.C 仅 CSV，R9 加 YAML）

**推荐默认**: D（V2 预留接口，R8 仅 CSV）

**用户回答**: ________________________

---

## I. 失败案例处理

### [Q-16.I.1] CSV 中某行 schema 错误  锚定 [Must]

**选项**:
- A. **整批中止**（最严格）
- B. **跳过错误行 + 启动 + 高亮提示**
- C. **B + 用户决定后续**（弹"3 个错误行，是否继续"）
- D. **C + 错误行写到 errors.csv 让用户修后单独跑**

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.I.2] AI 工具未安装  协商 [Should]

**选项**（CSV 中 tool=codex 但用户机没装 codex）:
- A. **整批失败**
- B. **该任务失败，其他继续**
- C. **B + 自动 fallback-tool 应用**
- D. **C + 用户安装提示**

**推荐默认**: D

**用户回答**: ________________________

---

### [Q-16.I.3] cwd 不存在  协商 [Should]

**选项**:
- A. **任务失败**
- B. **A + 提示"是否创建该目录"**
- C. **A + 提示 + 自动 git clone（如 cwd 形如 git URL）**

**推荐默认**: B

**用户回答**: ________________________

---

### [Q-16.I.4] 依赖循环  锚定 [Must]

**选项**（CSV 中 task-A 依赖 task-B，task-B 依赖 task-A）:
- A. **整批中止**（无法启动）
- B. **A + 高亮显示循环路径**
- C. **B + 建议自动断开**（用户授权）

**推荐默认**: B

**用户回答**: ________________________

---

## J. 安全与权限

### [Q-16.J.1] CSV 任务的"危险动作"白名单  锚定 [Must]

**关联 V1-Q-9.A.2 + V2-§18 自动注入**

**选项**（哪些动作允许 CSV 任务执行）:
- [ ] 修改任意文件（cwd 内）
- [ ] 删除文件（cwd 内）
- [ ] git commit / push
- [ ] npm install / pip install
- [ ] 运行任意 shell 命令
- [ ] 启动子进程
- [ ] 发起 HTTP 请求
- [ ] 注入文本到其他窗口
- [ ] 修改注册表
- [ ] 修改系统设置

**推荐默认**: 前 7 项白名单 + 后 3 项必须用户授权

**用户回答**: ________________________

---

### [Q-16.J.2] CSV 任务的资源限制  协商 [Should]

**选项**（每个任务的资源 cap）:
- [ ] CPU 上限（百分比 / 单核）
- [ ] RSS 上限（MB）
- [ ] 网络带宽
- [ ] 子进程数上限
- [ ] 文件描述符数

**推荐默认**: 仅 CPU + RSS（其他不限制）

**用户回答**: ________________________

---

### [Q-16.J.3] CSV 任务的隔离  委托 [Could]

**选项**:
- A. **不隔离**（与 DevHub 同进程空间）
- B. **轻量隔离**（独立子进程）
- C. **B + Job Object（Windows）限资源**
- D. **沙箱**（Docker / WSL2）

**推荐默认**: B + C

**用户回答**: ________________________

---

## K. 监控与可视化

### [Q-16.K.1] 批次实时监控  协商 [Should]

**关联 V1-Q-7.E.8 用户选 E（任务列表 + 甘特 + DAG + 看板全部）**

**新增 V2 实时**:
- [ ] **每秒刷新**（吞吐率 / 平均时长 / 失败率）
- [ ] **资源压力图**（DevHub 主进程资源 + 各任务进程资源）
- [ ] **AI 信号源活跃度**（哪些信号在贡献）
- [ ] **Watchdog 介入次数**

**推荐默认**: 全选

**用户回答**: ________________________

---

### [Q-16.K.2] 历史批次报表  委托 [Could]

**选项**:
- A. **不做**
- B. **基础统计**（成功率 / 平均时长 / TOP 失败原因）
- C. **B + 趋势图**（最近 30 天）
- D. **C + 导出 PDF/CSV**

**推荐默认**: D

**用户回答**: ________________________

---

## L. CSV 任务驱动小结

### Q-16.L.1
您是否同意"CSV runner 由 DevHub + Python 脚本双轨实现，用户在 metadata 中选择"？（A. 同意 / B. 仅 DevHub / C. 仅 Python）

**用户回答**: ________________________

---

### Q-16.L.2
您是否要求"补跑必须支持任意失败任务的回溯"？（A. 必须 / B. 仅最近一次 / C. 不要求）

**用户回答**: ________________________

---

### Q-16.L.3
您是否希望 R8 阶段就支持 GitHub Actions 风格的 matrix / outputs？（A. 必须 / B. R9 再加 / C. 不需要）

**用户回答**: ________________________

---

### Q-16.L.4
您日常会用 CSV 还是 YAML 编辑任务？（A. CSV / B. YAML / C. 表格 UI / D. AI 辅助生成）

**用户回答**: ________________________

---

### Q-16.L.5
若一个 CSV 含 100 个任务，并发上限 6，预计总时长 24h，您希望 DevHub 的 UI 表现是？（A. 全屏看板 / B. 状态栏徽章 + 命令面板查询 / C. popout 浮窗常驻 / D. 全部支持）

**用户回答**: ________________________

---

### Q-16.L.6
上述以外，CSV 任务驱动还有什么必须明确的？自由填写：

**用户回答**: ________________________
