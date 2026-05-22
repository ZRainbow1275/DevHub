# tests/28 — 性能基线与压测方案

> 目的：R5 的 Runtime Killer 问题必须用量化指标 gatekeep，防止回归
> 产出：可复现 benchmark + 阈值 + CI gate

---

## 一、核心指标

| 指标 | 单位 | 阈值（R7 目标） | 测量方法 |
|------|-----|----------------|---------|
| **冷启动时间** | ms | ≤ 1500 | Electron `ready` event 时间 |
| **首屏可交互** | ms | ≤ 2500 | `domcontentloaded` + 首次 IPC 响应 |
| **主进程 RSS**（空闲 5 min） | MB | ≤ 200 | `process.memoryUsage().rss` |
| **主进程 RSS**（扫描 30 min） | MB | ≤ 400 | 同上 |
| **主进程 RSS**（2 hr 长时间） | MB | ≤ 500 | 同上 |
| **渲染进程 heap**（idle） | MB | ≤ 120 | Performance API |
| **CPU 均值**（idle） | % | ≤ 3 | process.cpuUsage() / 系统 |
| **CPU 均值**（扫描活跃） | % | ≤ 15 | 同上 |
| **PowerShell 子进程并发** | 个 | ≤ 2 | ChildProcessRegistry |
| **PowerShell 单次耗时 P95** | ms | ≤ 1500 | PowerShellGateway metrics |
| **IPC 响应 P95** | ms | ≤ 50 | `obs:get-metrics` |
| **IPC 丢弃率** | % | ≤ 0.5 | truncated / total |
| **扫描循环吞吐** | 周期/分钟 | 5 (进程) / 4 (窗口) / 3 (端口) | 配置目标 |
| **UI 主线程阻塞**（长任务） | ms | ≤ 50 | PerformanceObserver('longtask') |
| **SVG 节点渲染数**（拓扑） | 个 | ≤ 200 | 达上限后用聚合节点 |

---

## 二、基准场景

### 2.1 Scenario-A: Idle
- 系统负载: 仅 OS 自身进程 (~80 processes)
- 持续时间: 5 min
- 触发行为: 无用户操作
- 关注: RSS 稳态、CPU 基线

### 2.2 Scenario-B: Normal Use
- 负载: 120 进程 / 30 端口 / 15 窗口
- 持续时间: 30 min
- 用户行为:
  - 切 tab 每 30s
  - 打开某进程详情每 2 min
  - 重命名 AI alias 每 5 min
- 关注: RSS 增长、IPC 响应、CPU 均值

### 2.3 Scenario-C: Heavy Load
- 负载: 400 进程 / 100 端口 / 40 窗口 / 10 AI 任务
- 持续时间: 2 hr
- 用户行为: 脚本化随机操作（见 test/28.3）
- 关注: 内存不泄漏、扫描吞吐稳定

### 2.4 Scenario-D: Stress Spike
- 突发: 5 min 内产生 1000 个短生命周期进程
- 持续时间: 短
- 关注: 不崩溃、降级生效

---

## 三、采集管道

```typescript
// devhub/src/main/services/PerfProbe.ts
export class PerfProbe {
  private interval: NodeJS.Timeout | null = null

  start() {
    this.interval = setInterval(() => {
      const mem = process.memoryUsage()
      const cpu = process.cpuUsage()
      const sample: PerfSample = {
        ts: Date.now(),
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        cpuUser: cpu.user / 1000,    // ms
        cpuSystem: cpu.system / 1000,
        psChildren: childProcessRegistry.count(),
        ipcP95: ipcMetrics.p95(),
        scanMetrics: scannerRegistry.allMetrics(),
      }
      appendJsonl(sample)
    }, 5000)
  }
}
```

日志文件：`%APPDATA%/DevHub/perf/perf-<ts>.jsonl`

---

## 四、Benchmark harness

```typescript
// tests/perf/harness.ts
import { launchDevHub } from '../e2e/helpers/launch'
import fs from 'fs/promises'
import path from 'path'

export async function runBenchmark(scenario: 'A' | 'B' | 'C' | 'D', durationMs: number) {
  const { app, win } = await launchDevHub({
    mockProcesses: scenario === 'A' ? 80 : scenario === 'C' ? 400 : 120,
    mockPorts: scenario === 'C' ? 100 : 30,
    mockWindows: scenario === 'C' ? 40 : 15,
  })

  // 收集
  const samples: PerfSample[] = []
  const start = Date.now()
  while (Date.now() - start < durationMs) {
    await new Promise(r => setTimeout(r, 5000))
    const sample = await app.evaluate(() => (globalThis as any).perfProbe.snapshot())
    samples.push(sample)
  }

  // 生成报告
  const report = summarize(samples)
  await fs.writeFile(
    path.join(__dirname, '../../perf-reports', `scenario-${scenario}-${Date.now()}.json`),
    JSON.stringify(report, null, 2)
  )
  await app.close()
  return report
}
```

---

## 五、CI Gate

`.github/workflows/perf-gate.yml`:

```yaml
on:
  pull_request:
    paths:
      - 'devhub/src/main/services/**'
      - 'devhub/src/main/scanners/**'
      - 'devhub/src/main/ipc/**'

jobs:
  perf-gate:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:perf:B  # scenario B (30min)
      - run: node tests/perf/verify-thresholds.mjs
        # 若任何指标超阈值 → exit 1
      - uses: actions/upload-artifact@v4
        with:
          name: perf-report
          path: perf-reports/
```

验证脚本：

```javascript
// tests/perf/verify-thresholds.mjs
const report = JSON.parse(await fs.readFile('perf-reports/latest.json', 'utf8'))
const thresholds = {
  rss_p99: 400 * 1024 * 1024,
  cpu_avg: 15,
  ipc_p95: 50,
  ps_children_max: 2,
}
const failures = []
for (const [k, v] of Object.entries(thresholds)) {
  if (report[k] > v) failures.push(`${k}: ${report[k]} > ${v}`)
}
if (failures.length) {
  console.error('Perf regression:\n' + failures.join('\n'))
  process.exit(1)
}
```

---

## 六、泄漏检测

### 6.1 启发式

对 Scenario-B 30 min 样本做线性拟合：

```
slope = linearRegression(samples.rss).slope   // bytes/sec
if (slope > 10_000) report.leakSuspected = true  // 每秒增 10KB+
```

### 6.2 Heap snapshot 对比

- 第 5 分钟 take heap snapshot
- 第 25 分钟 take heap snapshot
- 计算 retain size diff；top 10 类 > 10MB 的要排查

### 6.3 ChildProcess leak 检测

```typescript
// 每 60s 检查
if (childProcessRegistry.count() > 2) {
  console.error('PS child leak detected:', childProcessRegistry.list())
}
```

---

## 七、性能可视化

DevObservabilityPanel (spec/06) 提供实时指标：

- RSS / heap 折线图（近 10 min）
- CPU 折线图
- IPC 响应时间直方图
- 扫描循环周期散点图
- PS 子进程数 gauge

---

## 八、Release gate

| 指标 | R6 实测（回归） | R7 目标 | R7 验收 |
|------|---------------|---------|---------|
| 2hr RSS | ~1.2 GB（失败） | ≤ 500 MB | 需 Scenario-C 通过 |
| PS child 堆积 | 是（15+） | ≤ 2 | Chaos 通过 |
| CPU 长期 | > 50% | ≤ 15% | Scenario-B 通过 |
| 泄漏 slope | 正（持续增） | ≈ 0 | 泄漏检测通过 |

---

## 九、历史归档

每次 release 的 perf-report 归档到 `.trellis/workspace/ZRainbow/perf-history/<release>/` 便于长期对比。

## 2026-04-29 BENCH-P2.1 archived result

- Command: `pnpm bench:p2.1`.
- Report: `devhub/perf-reports/bench-p2-longrun-2026-04-29T11-19-59-787Z.json`.
- Result: `passed=true`, `acceptanceEligible=true`, `durationMinutes=60`, `baselineMinutes=10`, `sampleCount=359`.
- Observed thresholds: `maxCpu5m=1.4`, `maxIpcRpm=8`, `mainRatio=1.0677540986832446`, `rendererRatio=1.0757544784203639`, `maxPsChildren=2`, `psChildrenAfterExit=0`, `remainingAfter=[]`.
- This report supersedes the failed 2026-04-29 run `bench-p2-longrun-2026-04-29T09-51-28-932Z.json`, whose only failed gate was `maxCpu5m=10.5`.

## 2026-04-29 BENCH-P4.2-b AI accuracy harness

- Command shape: `pnpm bench:p4.2-b -- --duration-minutes=30 --sample-interval-ms=5000 --expected-completions=6 --active-alias=<real-active-claude> --idle-alias=<real-idle-claude> --completion-events=<real-jsonl>`.
- Harness: `devhub/scripts/bench-p4-ai-accuracy.mjs`; it launches the built Electron app with `--enable-dev-obs`, reads real `window.devhub.aiTask.getActive()` / `getHistory()` / `getConfidenceReport()`, and writes immutable JSON reports under `devhub/perf-reports/`.
- Real short-run smoke report: `devhub/perf-reports/bench-p4-ai-accuracy-2026-04-29T12-13-40-050Z.json`. It observed `maxClaudeCount=3`, `falsePositives=0`, `sampleCount=2`, and correctly returned `passed=false` because it was not a 30-minute run and had no completion-events oracle.
- 2026-04-30 rerun in the current session produced `devhub/perf-reports/bench-p4-ai-accuracy-2026-04-29T17-16-02-421Z.json`: `passed=false`, `sampleCount=1`, `maxClaudeCount=0`, `completionEvents=0`. This is valid negative evidence for the harness gate under no visible Claude instances, not an acceptance pass.
- Release gate for `P4.2-b`: 30 real minutes, at least two observed Claude Code instances, at least 6 real completion events for the active alias, all oracle events matched in DevHub history, idle alias false positives <= 1, missed completions = 0, and max notification delay < 5000ms.
- The completion-events file must be produced from a real source. Claude Code official hooks documentation confirms `Stop` fires when Claude finishes responding, `SubagentStop` when a subagent finishes, and `TaskCompleted` when a task is being marked completed; these hooks are acceptable oracle producers. Manually typed or synthetic completion events are not acceptable evidence.
