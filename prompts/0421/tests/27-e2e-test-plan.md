# tests/27 — E2E 测试方案

> 目的：将 spec/02~21 每条验收条件变为可执行 Playwright 用例；确保 R7 不再出现 R5 式"metadata-only 假修复"
> 执行器：`@playwright/test` + Electron launch helper
> 目录：`devhub/tests/e2e/`

---

## 一、整体策略

```
┌────────────────────────────────────────────────────────────────┐
│  Smoke suite        ─── 5 min，门槛：启动 + 主要导航 + 无崩溃  │
│  ↓                                                              │
│  Full Acceptance    ─── 30-45 min，覆盖 spec/02~21 所有 E2E-X  │
│  ↓                                                              │
│  Stability suite    ─── 1-4 hr，长时间运行 + 内存泄漏 + 泄漏检测 │
│  ↓                                                              │
│  Chaos suite        ─── 1 hr，故障注入（PS 超时 / IPC 丢包 等）│
└────────────────────────────────────────────────────────────────┘
```

运行矩阵：

| Suite | 触发 | 通过门槛 |
|-------|------|---------|
| Smoke | 每次 commit | 必须 100% pass |
| Full Acceptance | 每次 PR | 必须 100% pass |
| Stability | nightly | 失败允许 ≤ 2；必须附日志 |
| Chaos | weekly | failure mode 可控 |

---

## 二、helpers

```typescript
// tests/e2e/helpers/launch.ts
import { _electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'

export interface LaunchOptions {
  mockProcesses?: number
  mockPorts?: number
  mockWindows?: number
  adminMode?: boolean
  freshConfig?: boolean            // 清 %APPDATA%/DevHub
}

export async function launchDevHub(opts: LaunchOptions = {}): Promise<{
  app: ElectronApplication
  win: Page
}> {
  if (opts.freshConfig) await resetConfig()
  const app = await _electron.launch({
    args: [path.join(__dirname, '../../..', 'dist/main.js')],
    env: {
      ...process.env,
      DEVHUB_E2E: '1',
      DEVHUB_MOCK_PROCESSES: String(opts.mockProcesses ?? 0),
      DEVHUB_MOCK_PORTS: String(opts.mockPorts ?? 0),
      DEVHUB_MOCK_WINDOWS: String(opts.mockWindows ?? 0),
    },
    timeout: 30_000,
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  return { app, win }
}
```

> 注：此处 `mockProcesses` 等环境变量仅用于 E2E 注入受控测试进程，**真实 runtime 仍扫真实系统**，这不违反"禁止 mock"规则——测试桩与业务 mock 是两回事。

---

## 三、Suite 映射表（Full Acceptance）

| Suite 文件 | 覆盖 Spec | 用例数 |
|-----------|----------|-------|
| `01-ia-redesign.spec.ts` | spec/02 | 8 |
| `02-runtime-stability.spec.ts` | spec/03, 04 | 12 |
| `03-ipc-throttle.spec.ts` | spec/05 | 6 |
| `04-obs-dev-panel.spec.ts` | spec/06 | 5 |
| `05-ai-alias.spec.ts` | spec/07 | 9 |
| `06-ai-task-detection.spec.ts` | spec/08 | 11 |
| `07-window-groups.spec.ts` | spec/09 | 8 |
| `08-window-layout.spec.ts` | spec/10 | 7 |
| `09-ai-progress.spec.ts` | spec/11 | 6 |
| `10-window-ops.spec.ts` | spec/12 | 12 |
| `11-project-dropdown.spec.ts` | spec/13 | 3 |
| `12-process-fallback.spec.ts` | spec/14 | 5 |
| `13-port-scroll-layout.spec.ts` | spec/15 | 4 |
| `14-window-title-overflow.spec.ts` | spec/16 | 4 |
| `15-topology-rendering.spec.ts` | spec/17 | 4 |
| `16-responsive.spec.ts` | spec/18 | 4 |
| `17-theme-4axis.spec.ts` | spec/19 | 5 |
| `18-no-emoji.spec.ts` | spec/20 | 3 |
| `19-project-ux-polish.spec.ts` | spec/21 | 20 |
| **合计** | **19 spec** | **136** |

---

## 四、核心用例片段（举例）

### 4.1 Runtime 稳定性 — 30min 不泄漏

```typescript
test('scanner no double instance leak under 30min load', async () => {
  const { app, win } = await launchDevHub({ mockProcesses: 200 })

  await win.click('[data-testid="monitor-tab-process"]')
  const initialHeap = await app.evaluate(() => process.memoryUsage().heapUsed)

  // 模拟 30 min 高频扫描
  for (let i = 0; i < 30 * 60; i++) {
    await new Promise(r => setTimeout(r, 1000))
    if (i % 60 === 0) {
      const ps = await app.evaluate(({ processManager }) =>
        processManager.debug_getActiveChildren()  // 仅 DEV IPC
      )
      expect(ps.length).toBeLessThan(5)  // 不堆积
    }
  }

  const finalHeap = await app.evaluate(() => process.memoryUsage().heapUsed)
  expect(finalHeap - initialHeap).toBeLessThan(100 * 1024 * 1024)  // < 100MB 增长
  await app.close()
})
```

### 4.2 AI 别名 setTitle 真实生效

```typescript
test('AI alias rename applies to external window title', async () => {
  const { app, win } = await launchDevHub({ mockWindows: 1 })
  // 启动一个带 "Claude Code" 标题的测试外部窗口
  const testHwnd = await spawnTestWindow('Claude Code - test-alias')

  await win.click('[data-testid="nav-ai-tasks"]')
  await win.click(`[data-testid="ai-window-row"][data-hwnd="${testHwnd}"] [data-testid="rename-btn"]`)
  await win.fill('[data-testid="rename-input"]', 'Fix login bug')
  await win.check('[data-testid="apply-external"]')
  await win.click('[data-testid="rename-confirm"]')

  // 验证真实窗口标题已改
  const actualTitle = await getWin32WindowText(testHwnd)
  expect(actualTitle).toContain('Fix login bug')

  await closeTestWindow(testHwnd)
  await app.close()
})
```

### 4.3 无 emoji 全局扫

```typescript
test('no emoji anywhere in UI text', async () => {
  const { app, win } = await launchDevHub()
  const allTabs = ['projects', 'monitor', 'ai-tasks', 'settings']
  const EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u
  for (const tab of allTabs) {
    await win.click(`[data-testid="nav-${tab}"]`)
    await win.waitForLoadState('networkidle')
    const text = await win.locator('body').innerText()
    expect(text, `tab=${tab}`).not.toMatch(EMOJI)
  }
  await app.close()
})
```

### 4.4 拓扑附属视图（spec/02）

```typescript
test('topology is attached sub-tab in process detail', async () => {
  const { app, win } = await launchDevHub({ mockProcesses: 10 })
  await win.click('[data-testid="monitor-tab-process"]')
  await win.locator('[data-testid="process-row"]').first().dblclick()
  await expect(win.locator('[data-testid="process-detail-panel"]')).toBeVisible()

  // 附属 tab 存在且不是顶层导航
  await expect(win.locator('[data-testid="process-detail-tab-relationship"]')).toBeVisible()
  await expect(win.locator('[data-testid="nav-topology-standalone"]')).not.toBeVisible()

  await win.click('[data-testid="process-detail-tab-relationship"]')
  // root = 该进程
  const rootLabel = await win.locator('[data-testid="topology-root-label"]').innerText()
  expect(rootLabel).toContain('process')

  await app.close()
})
```

### 4.5 Progress 不矛盾（spec/11）

```typescript
test('progress 0 when state=idle', async () => {
  const { app, win } = await launchDevHub()
  await win.click('[data-testid="nav-ai-tasks"]')
  // 注入 idle 状态
  await win.evaluate(() => (window as any).__test__.setAITaskState({ state: 'idle' }))
  const state = await win.locator('[data-testid="ai-state-badge"]').innerText()
  const progress = await win.locator('[data-testid="ai-progress-percent"]').innerText().catch(() => '')
  expect(state).toBe('idle')
  if (progress) expect(parseInt(progress)).toBe(0)
  await app.close()
})
```

---

## 五、Chaos / 故障注入

| 场景 | 注入方式 | 期望 |
|------|---------|------|
| PowerShell 超时 | `DEVHUB_CHAOS_PS_TIMEOUT=1` | 降级显示 cached；不崩 |
| IPC 丢弃 | `DEVHUB_CHAOS_IPC_DROP=0.1` | UI 显示 "连接中"；自愈 |
| 主进程 OOM 边界 | 加载 10000 窗口 | 限流 + 失败降级 |
| 目标窗口突然销毁 | spawn + kill 测试窗口 | group 自动摘除 |
| 磁盘写入失败 | mock `fs.writeFileSync` | Settings 报错 + 重试 |
| UAC 取消 | mock `AdminRelaunch` | 显示 "已取消重启" |

---

## 六、性能基线

见 tests/28。

---

## 七、报告

- Playwright HTML report + 视频 / 截图
- 失败自动附：主进程 log / IPC seq dump / DevObservabilityPanel snapshot（spec/06）
- 每次 run 都生成 `E2E-REPORT-<timestamp>.md` 归档到 `.trellis/workspace/`
