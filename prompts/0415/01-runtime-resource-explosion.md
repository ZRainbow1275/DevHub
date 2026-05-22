# N1 — Runtime 资源爆炸：PowerShell CIM 调用洪峰 + 僵尸进程遗留

> 日期: 2026-04-15
> 严重性: **P0-Blocker**（必须优先修复，否则任何长时间手测都会复现系统卡死）
> 首次暴露: R5（R1-R4 PRD 未提及）
> 关联代码: `SystemProcessScanner.ts`, `AITaskTracker.ts`, `WindowManager.ts`

---

## 一、用户反映的症状

> **"整个监控模块在长时间开启后将占据大量内存以及 CPU，导致系统极其卡顿。这个问题必须要得到解决"**

---

## 二、证据链

### 日志证据（`bw1n9enib.output` 2.3 MB / 16613 行）

前 ~500 行高密度出现以下失败：

```
getProcessTree failed: Command failed: powershell.exe -NoProfile -NonInteractive
  -Command ... Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq <PID> } ...

Get-CimInstance : 内存不足
CategoryInfo: ResourceBusy: (root\cimv2:Win32_Process:String) [Get-CimInstance], CimException
FullyQualifiedErrorId: HRESULT 0x80041006
```

```
Process enumeration failed: powershell.exe ... Get-CimInstance Win32_Process
  | Select-Object ProcessId,Name,CommandLine,WorkingSetSize,KernelModeTime,UserModeTime ...

未能加载文件或程序集 System.Data, Version=4.0.0.0 ...
由于一个或多个必要的文件太小，无法完成操作  HRESULT: 0x800705AF  (页面文件耗尽)
```

失败的函数名（均位于主进程 services）：
- `getProcessTree` （进程树查询，含 `ParentProcessId -eq X` 过滤）
- `Process enumeration` （全量 Win32_Process 枚举）
- `AITaskTracker: fetchIOCounters` （IO 计数器查询）
- `PowerShell command line check` （命令行过滤查询）
- `enrichProcessNames` （批量 PID → Name 映射，单次传 60+ 个 PID 用 OR 串）
- `batchGetProcessNames` （Get-Process + ToCsv）

**关键观察**：`enrichProcessNames` 一次查询里拼接了 **60+ 个 `OR ProcessId = X`** 过滤条件（单行 2KB+），这种模式会让 CIM 把整张 Win32_Process 表拉到内存再过滤，内存成本随 PID 数线性放大。

### 系统证据（应用退出后）

应用已关闭，`BackgroundScannerManager` 已 stop，但 `tasklist` 显示遗留 **9 个 powershell.exe** 僵尸进程：

| PID | 内存 | 说明 |
|-----|------|------|
| 2512 | **90,432 KB** | 未被 kill 的 CIM 调用 |
| 42572 | **90,308 KB** | 未被 kill 的 CIM 调用 |
| 61484 | 65,284 KB | ... |
| 57388 | 59,620 KB | ... |
| 68992 | 25,484 KB | ... |
| 其余 4 | 2-3 MB 各 | 轻量调用残留 |

**合计遗留 ≈ 330 MB**，这是**单次会话**后遗留的。用户"长时间开启"时，残留量会随时间线性堆积，直接对应"系统极其卡顿"。

---

## 三、根因假设（ultrathink 深度推断）

### 根因 A：PowerShell 进程未加 lifecycle 管理

- 每次扫描都 spawn 一个 `powershell.exe -NoProfile -NonInteractive -Command ...`
- PowerShell 启动成本：冷启动 ~300-500 ms，每个进程 60-90 MB peak
- 当**前一次调用还未返回**时，新一轮扫描周期又启动新一个 PowerShell，**叠加**
- 如果 Node 侧的 `child_process.exec` 没有 `timeout` + `killSignal`，PowerShell 一旦卡在 CIM 内存不足，就**永远不退出**，变成僵尸

### 根因 B：扫描周期过密 + 无串行化

- 从日志行数密度反推（16613 行 / 会话时长几分钟），扫描频率在**每秒多次**
- 多个 scanner（System / Port / AITask / Window / ProcessTree）**各自独立**定时器，各自 spawn PowerShell
- 峰值并发同时跑 5-10 个 powershell.exe → CIM 被锁、内存被耗尽

### 根因 C：查询本身代价过高

- `Get-CimInstance Win32_Process` **全表扫描**（Windows 上 300-500 进程）
- 每次返回 `CommandLine` 等字段要穿越 CIM → WMI → 每进程 QueryInformation → 累加 CPU
- `enrichProcessNames` 用 `ProcessId = X OR ProcessId = Y OR ...` 的单行 2KB 查询，**不如分批 50 个一组**，更不如用 `Get-Process` / Node 原生 API

### 根因 D：缺少跨扫描缓存（`ScannerCache.ts` 已存在但可能未覆盖这些路径）

- 同一批 PID 在 1 秒内被 `enrichProcessNames`、`getProcessTree`、`fetchIOCounters` 各查一遍
- 结果未共享 → 3 次 PowerShell 启动 + 3 次 CIM 调用，本可 1 次

### 根因 E：应用关闭时未 kill 子进程

- 遗留 9 个 powershell 僵尸证明：Electron `app.on('before-quit')` 或服务的 `dispose()` 没有追踪所有 spawn 过的子进程并 kill

---

## 四、修复方向（不写代码，只给方案骨架）

### 方向 1：替换查询基础设施（最根本）
- **放弃** `Get-CimInstance Win32_Process` 作为高频数据源
- 替换为：
  - Node 原生 `os.cpus()`, `process.memoryUsage()` 不适用（只看自身）
  - **PDH/Perfmon 计数器**（Windows Performance Data Helper）通过 native addon
  - 或长驻 `powershell.exe` + WebSocket / NamedPipe 持久连接，避免反复 spawn
  - 或 Rust/C++ addon（`ffi-napi` 或 `node-win-process` 等）直接调 Win32 API `CreateToolhelp32Snapshot` + `Process32First/Next`
- 判定准则：同一次 PID 列表查询应在 <10 MB 峰值内、<50 ms 完成

### 方向 2：强化 lifecycle 守护（短期救急）
- 所有 `exec/spawn powershell` 统一包裹到一个 `PowerShellRunner`：
  - 超时强制 kill（3s 以内）
  - 全局 spawn 数上限（并发 ≤ 2）
  - 超过上限排队或直接 fallback 到缓存
  - 应用退出时 tracked 的 PID 全部 `process.kill(pid, 'SIGTERM')`

### 方向 3：严格串行化扫描周期
- 每类扫描合并到一个 `Coordinator` 单例
- 一轮只做一次全进程枚举，结果**广播**给需要进程数据的所有订阅者
- 周期 ≥ 2s（当前疑似亚秒级）

### 方向 4：利用已有 `ScannerCache.ts`
- 审查 `ScannerCache.ts` 是否覆盖 `enrichProcessNames`、`fetchIOCounters`、`getProcessTree`
- 加 TTL 缓存（短 500ms-1s），避免 3 次调用变 1 次

---

## 五、影响面评估

| 维度 | 评估 |
|------|------|
| 用户感知 | 极高（用户已明确"必须解决"） |
| 技术复杂度 | 高（需要引入 native API 或长驻进程架构） |
| 回归风险 | 中（涉及所有 scanner 数据源重构） |
| 前置依赖 | Gitnexus 需重新 analyze 定位所有 `powershell` / `exec` / `spawn` 调用点 |

---

## 六、下一步探索指令（给下对话）

```
1. gitnexus_query({query:"Get-CimInstance powershell spawn"})
2. serena.search_for_pattern(
     substring_pattern:"exec\\(.*powershell|spawn\\(.*powershell",
     relative_path:"devhub/src/main"
   )
3. serena.find_symbol(name_path_pattern:"enrichProcessNames", depth:1, include_body:true)
4. serena.find_symbol(name_path_pattern:"getProcessTree",    depth:1, include_body:true)
5. serena.find_symbol(name_path_pattern:"fetchIOCounters",   depth:1, include_body:true)
6. gitnexus_impact({target:"SystemProcessScanner", direction:"both"})
```

配合验收标准：
- 连续运行 30 分钟后 powershell.exe 残留 **= 0**
- Electron 主进程内存增长 **< 50 MB / 30min**
- `BackgroundScannerManager` 每轮扫描 **≤ 1 次 powershell spawn**
