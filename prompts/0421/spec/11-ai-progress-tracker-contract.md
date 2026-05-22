# spec/11 — AI 进度条契约（状态 ⇄ 进度派生关系）

> 严重度：P0-Critical
> 对应用户诉求：P4.2-d（监控进度与实际 AI 任务对齐，反馈 6 次）+ P5.1（AI 进度监控失效）
> 对应验收矩阵：P4.2-d、P5.1
> 本 spec 与 spec/08（感测引擎）紧密耦合：感测引擎产出 `AIMonitorState`，本 spec 规定如何把 state **派生** 出 progress。

---

## 一、动机

### 1.1 用户原话
> "'监控进度'功能现在做的依然不够好，无法真正做到监视进度。多次出现迟报、漏报、错误后依然报的情况，与实际AI窗口的任务是不相符合的"

截图证据：`Claude Code-1 空闲 56%` —— 状态与进度矛盾。

### 1.2 R5 病根
- `task.status.state` 在 `determineMonitorState` 更新
- `task.status.progressEstimate.percentage` 在 `estimateProgress` 独立计算
- 两者可能在一个 tick 内不一致（比如 state 已切到 idle，但 estimateProgress 用 1 tick 前的 phase=coding 计算出 56%）
- UI 直接把两个值分别渲染 → 出现"空闲 + 56%"

### 1.3 R7 设计原则
**进度不是独立字段，而是 state 的派生视图**。同一 state 下进度取值范围固定；UI 必须同时读取两者并做 invariant 校验。

---

## 二、受影响源码

- `devhub/src/main/services/AITaskTracker.ts:994-1073`（detectPhase + estimateProgress）— 由派生函数替代
- `devhub/src/renderer/components/monitor/AITaskView.tsx:150-180`（progress bar 渲染）— 读 invariant 合法的 `derivedProgress`
- NEW: `devhub/src/shared/detection/derive-progress.ts` — 单一源头派生函数
- NEW: `devhub/src/renderer/components/monitor/ai-task/ProgressBar.tsx` — 拆成独立组件
- NEW: `devhub/src/renderer/components/monitor/ai-task/ProgressTimeline.tsx` — 重构时间轴

---

## 三、派生函数（核心契约）

```typescript
// src/shared/detection/derive-progress.ts

export interface DerivedProgress {
  mode: 'hidden' | 'indeterminate' | 'determinate'
  percentage?: number             // 仅 determinate
  label: string                   // e.g. "思考中" / "编码中"
  phase: AITaskPhase
  accentColor: 'neutral' | 'info' | 'active' | 'success' | 'warning' | 'error'
  confidence?: number             // 0..1，用于 UI 显示不确定性
}

export function deriveProgress(state: AIMonitorState, ctx: {
  phase?: AITaskPhase
  elapsedMs?: number
  estimatedTotalMs?: number
  confidence?: number
}): DerivedProgress {
  switch (state) {
    case 'idle':
      return { mode: 'hidden', label: '空闲', phase: 'done', accentColor: 'neutral' }
    case 'initializing':
      return {
        mode: 'determinate',
        percentage: clamp(5 + (ctx.elapsedMs ?? 0) / 200, 5, 15),
        label: '初始化',
        phase: 'init',
        accentColor: 'info'
      }
    case 'thinking':
      return {
        mode: 'indeterminate',   // 思考没有可靠百分比
        label: '思考中',
        phase: 'thinking',
        accentColor: 'active'
      }
    case 'coding':
      const basePct = 40
      const extraFromTime = ctx.estimatedTotalMs
        ? Math.min(35, (ctx.elapsedMs ?? 0) / ctx.estimatedTotalMs * 35)
        : 20
      return {
        mode: 'determinate',
        percentage: clamp(basePct + extraFromTime, 40, 75),
        label: '编码中',
        phase: 'coding',
        accentColor: 'active',
        confidence: ctx.confidence
      }
    case 'compiling':
      return { mode: 'determinate', percentage: 78, label: '编译中', phase: 'compiling', accentColor: 'active' }
    case 'validating':
      return { mode: 'determinate', percentage: 92, label: '确认中', phase: 'validating', accentColor: 'info' }
    case 'waiting-input':
      return { mode: 'determinate', percentage: 98, label: '等待输入', phase: 'validating', accentColor: 'warning' }
    case 'completed':
      return { mode: 'determinate', percentage: 100, label: '已完成', phase: 'done', accentColor: 'success' }
    case 'error':
      return { mode: 'determinate', percentage: 100, label: '出错', phase: 'failed', accentColor: 'error' }
  }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
```

### 3.1 Invariant（编译期断言）

```typescript
// src/shared/detection/progress-invariants.ts

export function assertProgressInvariant(state: AIMonitorState, progress: DerivedProgress): void {
  if (state === 'idle' && progress.mode !== 'hidden') {
    throw new Error(`INVARIANT: idle state must have hidden progress, got ${progress.mode}`)
  }
  if (state === 'completed' && progress.percentage !== 100) {
    throw new Error(`INVARIANT: completed must be 100, got ${progress.percentage}`)
  }
  if (state === 'thinking' && progress.mode !== 'indeterminate') {
    throw new Error(`INVARIANT: thinking must be indeterminate`)
  }
  // 更多断言...
}
```

### 3.2 消费契约（渲染层）

```typescript
// AITaskView 渲染时必须：
const derived = deriveProgress(task.status.state, { ... })
assertProgressInvariant(task.status.state, derived)
return <ProgressBar derived={derived} state={task.status.state} />
```

UI 层**禁止**直接读 `task.status.progressEstimate.percentage` —— 统一走 `deriveProgress`。

---

## 四、ProgressBar 组件契约

```typescript
// src/renderer/components/monitor/ai-task/ProgressBar.tsx

export interface ProgressBarProps {
  derived: DerivedProgress
  state: AIMonitorState  // 用于 invariant & UI 标签
  compact?: boolean
}

// 规则：
// - mode='hidden' → 不渲染任何 bar 或 %（整个容器 display:none）
// - mode='indeterminate' → CSS 动画 bar 往复移动；不显示 %
// - mode='determinate' → 按 percentage 填充；显示 %
// - 状态切换动画 < 300ms；动画使用 CSS transition，不使用 Emoji 作为装饰
```

---

## 五、错误矩阵

| 错误码 | 触发 | 文案 | 日志 | 恢复 |
|-------|-----|------|------|------|
| `PROGRESS_INVARIANT_VIOLATED` | assertProgressInvariant 抛错 | DEV toast "进度 invariant 违反" | ERROR | fallback 到 hidden 模式，并上报 |
| `PROGRESS_STATE_UNKNOWN` | state 枚举外的值 | — | ERROR | hidden |
| `PROGRESS_ELAPSED_NEGATIVE` | elapsedMs < 0 | — | WARN | 用 0 |
| `PROGRESS_TIMELINE_RENDER_FAILED` | ProgressTimeline 组件崩溃 | 显示"时间轴渲染失败" | ERROR | ErrorBoundary fallback |

---

## 六、验收条件

### E2E-P4.2-d-no-impossible-combinations

```
Given AI task 在任意 state
When 通过 DEV IPC 抓取 1000 次 100ms 间隔快照
Then 无一次快照满足 state='idle' && percentage !== undefined
And 无一次满足 state='completed' && percentage !== 100
And 无一次满足 state='thinking' && mode='determinate'
```

### E2E-P4.2-d-state-transition-smooth

```
Given task 从 coding → completed
When 观察 UI
Then 进度条平滑从 ~70% → 100%，动画 < 300ms
And label 从 "编码中" 切换到 "已完成" + 800ms 后卡片折叠到 history
```

### E2E-P4.2-d-idle-hides-bar

```
Given task 进入 idle
When 观察卡片
Then 进度条容器（data-testid="ai-progress-bar"）display:none
And 卡片只显示状态 badge "空闲"，不显示任何百分比
```

### E2E-P4.2-d-timeline-consistency

```
Given ProgressTimeline 展开
When 查看状态序列
Then 每段时间区间的 state 与 derivedProgress.label 一一对应
And 时间轴颜色使用 spec/19 定义的 accent token（不使用 Emoji）
```

---

## 七、E2E 脚本草案

```typescript
// tests/e2e/ai-progress-derived.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub, driveAITask } from './helpers'

test('invariant: never idle+percentage nor completed<100', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-ai-task"]')
  const samples: Array<{state: string, mode?: string, pct?: number}> = []
  for (let i = 0; i < 1000; i++) {
    const sample = await win.evaluate(() => {
      const card = document.querySelector('[data-testid="ai-task-card"]') as HTMLElement | null
      if (!card) return null
      return {
        state: card.dataset.state,
        mode: card.dataset.progressMode,
        pct: Number(card.dataset.progressPct)
      }
    })
    if (sample) samples.push(sample as any)
    await win.waitForTimeout(100)
  }
  for (const s of samples) {
    expect(s.state === 'idle' && s.mode !== 'hidden').toBeFalsy()
    expect(s.state === 'completed' && s.pct !== 100).toBeFalsy()
    expect(s.state === 'thinking' && s.mode === 'determinate').toBeFalsy()
  }
  await app.close()
})
```

---

## 八、参考实现 / 库

- Radix UI `<Progress>` primitive — 已支持 indeterminate / determinate
- CSS `@keyframes` 做 indeterminate 动画
- 参考 VS Code 的 ProgressBarPart 实现（indeterminate 两段动画）
- 参考 GitHub Actions "Running..." 状态 UI
- Zod runtime schema 校验 state / progress 配对

---

## 九、贡献到 contracts/22

- `DerivedProgress`
- `assertProgressInvariant`
- `deriveProgress`（纯函数类型）

---

## 十、实装进度（2026-04-30）

### 10.1 已落地

- `src/shared/detection/derive-progress.ts` 已成为进度派生单一源头，导出 `DerivedProgress`、`deriveProgress()`、`assertProgressInvariant()` 与 `toDerivableProgressState()`；legacy `AITaskState` 只在 shared 层映射为可展示的派生状态。
- `AITaskView` 已改为消费 `DerivedProgress`，不再直接读取 `task.status.progressEstimate.percentage` 来决定进度条模式或百分比展示；卡片保留 `data-state`、`data-progress-mode`、`data-progress-pct` 作为 E2E 快照采样点。
- 新增 `src/renderer/components/monitor/ai-task/ProgressBar.tsx`，统一处理 hidden / indeterminate / determinate 三种模式；indeterminate 模式不渲染百分比，也不设置 `aria-valuenow`，与 MDN / WAI-ARIA progressbar 当前指引一致。
- `src/renderer/styles/tokens/animations.css` 新增 `ai-progress-indeterminate-sweep`，用于 thinking 等不可估算阶段的真实 CSS 横向流动效果，不使用 Emoji。
- `TimelineEntry` 已携带 `monitorState`，`AIProgressTimeline` 按 `monitorState ?? status` 渲染 validating / waiting-input 等细粒度阶段，避免 timeline 只能显示 legacy `running` / `waiting`。
- `src/main/index.ts` 的 dev/test-only runtime hook 增加 `driveAITaskProgressScenarioForTests()`，仅在 unpackaged / dev observability 环境暴露；E2E 先启动真实子进程并由真实 tracker 扫描，再通过该 hook 推进主进程 tracker 状态，不向 renderer store 注入 mock。

### 10.2 已验证

- `pnpm exec vitest run src/shared/detection/derive-progress.test.ts src/renderer/components/monitor/ai-task/ProgressBar.test.tsx` 通过：11 tests。
- `pnpm exec vitest run src/main/services/AITaskTracker.test.ts` 通过：39 tests。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过，内部 `check:no-emoji` 对 186 个文件零命中。
- `pnpm check:no-emoji` 单独通过：No emoji found in 185/186 files（新增测试后 lint 阶段为 186 files）。
- 相关文件 `git diff --check` 通过，仅有 Windows CRLF 提示。
- 2026-04-30 真实 Electron 专项通过：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-d/P5.1" --timeout=180000 --workers=1` 为 `1 passed (48.1s)`。该 E2E 启动真实 codex-like Node 子进程，经真实 `AITaskTracker` 扫描和真实 IPC 更新 renderer，采集 1020 次 DOM 快照，覆盖 impossible-combination、idle hidden、timeline consistency、coding -> completed 100 以及完成后 history 折叠。

### 10.3 TEST-PASS 结论

- `E2E-P4.2-d-no-impossible-combinations` 已由真实 Electron 1020 次 DOM 快照覆盖，无 idle+percentage、completed<100、thinking determinate 等矛盾组合。
- 真实 tracker task 的 `coding -> completed` 已通过 E2E 覆盖：coding 阶段保持 40..75，completed 阶段变为 100，并通过真实 `task-completed` IPC 折叠到 history。
- `ProgressTimeline` 展开后读取真实 `ai-task:get-timeline`，`monitorState` 序列包含 idle / thinking / coding / validating / waiting-input / error，并在 UI 中显示对应中文标签。
- 用户手测确认仍作为 `[USER-VERIFIED]` 边界；自动化验收状态已提升为 `[TEST-PASS]`。
