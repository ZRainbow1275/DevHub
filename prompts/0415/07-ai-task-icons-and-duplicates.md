# AI-2 + N5 — AI 任务卡片：Emoji 图标 + 重复卡片

> 日期: 2026-04-15
> 严重性: P2（图标）+ P1（重复，数据正确性问题）
> 证据: Image #6

---

## 一、症状

### 1.1 图标问题（P2）
Image #6 "AI 任务追踪" 视图里，3 张任务卡片使用的是 **Emoji**：
- Claude Code-1 → 🤖（机器人脸）
- Codex CLI-1 → 🧠（粉色大脑）
- Codex CLI-1（第二张）→ 🧠（粉色大脑）

用户明确不满：「出现了 Emoji，而非这些 AI 工具自身的图标」

### 1.2 重复卡片（P1，数据正确性）
同一界面出现**两张 `Codex CLI-1`** 卡片：
- PID: **52748** | 运行时间 33m 33s | 28% ~1h 45m | 状态"空闲"，"思考中..."
- PID: **9512**  | 运行时间 33m 33s | 28% ~1h 45m | 状态"空闲"，"思考中..."

两张卡片**除了 PID 外数据完全一致**（甚至运行时间精确相同到秒）→ 疑似同一进程被枚举两次或缓存/去重失效。

---

## 二、根因假设

### 2.1 图标 Emoji
- 设计时为了快速起稿使用 Emoji 占位
- 未替换为真实 Logo SVG
- 可能设计师/开发没明确 "每个 AI 工具的品牌 Logo 从哪儿取"

### 2.2 重复卡片
几种可能：
- **假设 A**：进程枚举发现两个 node.exe 都匹配 "codex" 关键字（如一个主进程 + 一个子进程），被分别认作两个 AI 任务实例
- **假设 B**：`AITaskTracker` 的 dedup key 错误（如只按工具类型 + 名字，没按 PID），但又把 PID 各显示一份
- **假设 C**：历史任务与当前任务混在一起显示（`activeTasks` 里意外包含已结束的）
- **假设 D**：命名冲突 — 两个实例都自动生成 `Codex CLI-1` 因为编号器未递增

数据一致（运行时间 / 进度完全相同）支持**假设 D**（命名逻辑把两个不同进程都命名为 -1）或 **假设 A**（主子关系）。

---

## 三、修复方向

### 3.1 图标资源
创建 `devhub/resources/ai-tool-icons/`：
- `claude-code.svg`（Anthropic 官方 Logo 或使用 "C" 方形品牌图）
- `codex-cli.svg`（OpenAI 官方 Logo）
- `gemini-cli.svg`（Google Gemini 官方 Logo）
- `opencode.svg`
- `fallback.svg`（未识别工具的占位）

组件里根据 `task.toolType` 匹配资源路径。如担心版权，使用**文字化 monogram**（Cc / Cx / G / Oc）或**ASCII art**（契合 Soviet Constructivism 主题）。

### 3.2 重复卡片
调查优先顺序：
1. `AITaskTracker.ts` 里搜 "-1" 命名逻辑：
   ```
   serena.search_for_pattern(
     substring_pattern:"-\\$\\{|-\\d+\\)|toolType.*count",
     paths_include_glob:"devhub/src/main/services/AITaskTracker.ts"
   )
   ```
2. 检查 `activeTasks` 的 key：是否用 PID 而不是 name
3. 若是主/子进程识别问题：
   - 同一工具类型下，优先保留**父进程**（用 `parentPid` 判断）
   - 子进程（如 node 派生的 worker）不创建独立任务

---

## 四、关联代码

- `src/main/services/AITaskTracker.ts`（39KB）
- `src/main/services/ToolMonitor.ts`（15KB）
- `src/renderer/components/monitor/AITaskCard.tsx` 或类似
- `src/renderer/stores/aiTaskStore.ts`

探索指令：
```
serena.find_symbol(name_path_pattern:"AITaskCard", depth:2, include_body:true)
serena.find_symbol(
  name_path_pattern:"generateTaskName|getToolName|assignInstanceId",
  depth:1,
  include_body:true
)
gitnexus_context({name:"AITaskTracker"})
```

---

## 五、验收标准

- 每个 AI 工具显示其**官方或一致认可的品牌 Logo**，不用 Emoji
- 同一工具的实例命名递增（Claude Code-1, Claude Code-2, ...），**不重复**
- 同一 PID 永远只生成**一张**任务卡片
- 关闭 AI 实例后对应卡片立即从 `活跃` 移除（或迁移到 `历史`）
