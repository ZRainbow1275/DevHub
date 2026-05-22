# P2.1 — 监控模块长时间运行内存/CPU 爆炸 [P0-Blocker]

> Round: R6 · 2026-04-20
> 用户原话：**"包括进程，整个监控模块在长时间开启后将占据大量内存以及cpu，导致系统极其卡顿。这个问题必须要得到解决"**
> R5 锚点：`prompts/0415/01-runtime-resource-explosion.md`（**未修复**，症状已泛化）

---

## 一、症状差异：R5 → R6

| 维度 | R5 N1（2026-04-15） | R6（2026-04-20） |
|------|-------------------|-----------------|
| 范围 | 聚焦 PowerShell CIM 调用爆炸 + 9 个 powershell.exe 僵尸进程（330MB） | **泛化为"整个监控模块"**（进程 + 端口 + 窗口 + AI 任务） |
| 证据 | Runtime 日志 2.3MB / 16613 行，rate-limit 971 次 | 用户体感"系统极其卡顿"（待 R6 复现时采集具体证据） |
| 表达 | "长时间运行后遗留 330MB" | "**必须要得到解决**"（用户措辞升级，说明对历次修复失去耐心） |

R5 修复批次 `04-14-v2-backend-core` 改动了 `SystemProcessScanner.ts / ToolMonitor.ts / AITaskTracker.ts / processHandlers.ts / aiTaskHandlers.ts / ProcessView.tsx / ProcessDetailPanel.tsx`。但 R6 仍复现，说明：

1. 修改的范围**未覆盖**端口扫描器、窗口扫描器、拓扑图的数据流
2. 或者扫描器改了，但 **IPC 高频调用（R5 N2）**仍未处理 → 渲染层仍在轮询导致 CPU 占用
3. 或者 React 订阅没做 memo，数据更新一次全树 re-render

---

## 二、需要复现并量化的指标

R6 之后的修复必须先能复现症状并采集以下指标，否则无法回归：

| 指标 | 采集方式 | 可接受阈值（建议） |
|------|---------|------------------|
| Electron 主进程 RSS（长期运行 1h） | `process.memoryUsage().rss` 每 30s 打点 | 不应高于启动后 10 分钟基线的 1.5x |
| 渲染进程 RSS | 同上，通过 webContents IPC 回传 | 不高于基线 1.5x |
| `powershell.exe` 子进程数 | `tasklist | findstr powershell` 每 1 分钟采样 | 持续 ≤ 1，应用退出后 = 0 |
| CPU % 平均（5 分钟窗口） | `os.cpus()` 负载 | 空闲状态 ≤ 5% |
| IPC 调用频率 Top 10 | 主进程侧 `ipcMain.on` 前置计数器 + 日志 | 单通道 ≤ 10 calls/min |
| React 重渲染次数（关键组件） | `why-did-you-render` 或 `React.Profiler` | 监控 Tab 前台时 ≤ 60 renders/min |

> **强硬要求**：这些指标在主界面增加"开发者观测栏"直接展示，让用户在手测时实时看到是否真的改好了。不要再用"看似改过"的方式做下一轮。

---

## 三、根因假设树（验证驱动）

### 假设 A — 扫描器未去抖/去重
- 现象：某扫描器被多个组件订阅时每个订阅都触发一次 child_process
- 验证：`serena.find_referencing_symbols({name_path:"startScanning"}) ∪ {"scan"}` 看调用点
- 修复：单例 + 订阅计数 + 双缓冲

### 假设 B — IPC 高频轮询
- 现象：R5 N2 中 `process:get-history` 971 次限流
- 验证：在 `ipcMain.handle` 前埋 counter 日志，看 1 分钟内各通道调用次数
- 修复：渲染层用 Zustand subscribe + event-driven，而非 setInterval

### 假设 C — PowerShell 子进程泄漏
- 现象：R5 遗留 9 个 powershell.exe 共 330MB
- 验证：启动应用 → 30 分钟后 `tasklist | findstr /i powershell` 统计
- 修复：
  - 用 `tree-kill` 在应用退出时强杀子进程树
  - 改用 `wmic` / 原生 WinAPI / `systeminformation` npm 包，减少 PowerShell 依赖
  - 若必须用 PowerShell，改为**长连接的持久化子进程**（stdin 命令流），而非每次 spawn 新实例

### 假设 D — React 整树 re-render
- 现象：拓扑图或监控面板每次扫描器数据更新都重算 layout
- 验证：在拓扑/流程组件加 `React.Profiler`，查看 commit 频率
- 修复：selector 细粒度 + `useMemo` + 节点/边 diff 而非全量替换

### 假设 E — Zustand store 污染
- 现象：monolithic store 任何字段更新都触发所有订阅
- 验证：看 `aiTaskStore / windowStore / projectStore` 是否拆分 selector
- 修复：用 `zustand/shallow` + 具体字段 selector

### 假设 F — 拓扑/流程图订阅重建
- 现象：每次扫描 tick 都从零重建 node/edge 数组
- 验证：在 `useProcessTopology.ts` 内 console.log 触发频率
- 修复：incremental diff；仅 id 变化才 patch，属性变化用 in-place update

---

## 四、推荐落地顺序

1. **先采集基线**（30 分钟空闲运行的 RSS / CPU / IPC 计数）
2. **打开观测栏** — 新增 `DevObservabilityPanel`，让指标可视化
3. **压力测试脚本** — 1h 长跑 + 周期性打开/关闭各 Tab，断言指标不超阈
4. **按假设 A → F 顺序验证**，每验证一个立即修一个，并复跑压力测试
5. **最终指标 + 修复 diff 一起提交**，作为"真的改过"的证据

---

## 五、不要做的事

- ❌ 再写一个"综合修复"任务把 6 个假设混在一起
- ❌ 只改扫描器不加观测栏
- ❌ 没有压力测试就 archive
- ❌ 只在本地跑 10 分钟就说"看起来好了"

---

## 六、关联任务 / 文档

- R5 N1 原文：`prompts/0415/01-runtime-resource-explosion.md`
- R5 N2 IPC 循环：`prompts/0415/02-ipc-rate-limit-loop.md`
- R5 修复 commit：`3421de3 v2-backend-core`（未达效果）
- 子模块当前指向：`efb9d43 → devhub de634f9`
