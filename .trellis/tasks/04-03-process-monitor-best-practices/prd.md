# Task: process-monitor-best-practices

## Overview

调研进程监控最佳实践，修复 `SystemProcessScanner.ts` 中 CPU 使用率始终为 0 的 bug，优化 PowerShell 命令执行策略，降低整体资源消耗。同时统一项目中分散的进程数据采集模式，确保不会引起驱动或内核崩溃。

## Requirements

### R1: 修复 CPU 使用率始终为 0 的 Bug

- 修复 `measureCpuUsage()` 方法的三层问题：
  1. **冷启动问题**：首次 `scan()` 时 `lastCpuSampleTime === 0`，整个 CPU 计算分支被跳过
  2. **PowerShell 命令可靠性**：`getCpuTimes()` 逐个 PID 调用 `Get-Process -Id`，权限不足/进程退出时被 `catch {}` 静默吞掉，导致 `currentCpuTimes` 返回空 Map，永久性 0 值循环
  3. **Locale 编码问题**：`TotalProcessorTime.TotalSeconds` 在某些 locale 下用逗号作小数分隔符（如 `12,345`），`parseFloat()` 解析失败

### R2: 优化 PowerShell 命令策略

- 将 `getRawProcesses()` + `getCpuTimes()` 的两次 PowerShell 调用合并为单次调用
- 使用 `Get-CimInstance Win32_Process` 的 `KernelModeTime` + `UserModeTime` 属性替代第二次 `Get-Process` 调用
- 迁移 `PortScanner.ts` 中的废弃 `wmic` 命令到 `Get-CimInstance`
- 统一项目中 PowerShell 命令的调用方式和错误处理模式

### R3: 降低资源消耗

- 消除 `ProcessView.tsx` 与 `startAutoRefresh()` 的双重轮询问题
- 统一为 push 模式：backend 定时扫描 + IPC 推送，前端仅在需要时手动触发
- 减少 PowerShell 进程启动次数（当前每次 scan 启动 2 个 PowerShell 进程）

### R4: 安全合规

- 绝不直接调用 `NtQuerySystemInformation` 等内核 API，只使用 PowerShell/WMI 用户态接口
- 严格维护 Protected Processes 白名单
- CPU 采样频率不低于 1 秒（当前 5 秒间隔安全）
- 使用 `execFile` 而非 `exec` 防止命令注入（已正确使用，需维持）

## Acceptance Criteria

- [ ] CPU 使用率在第二次 scan（5 秒后）开始返回非零的真实值
- [ ] 首次 scan 明确标记 CPU 数据为"采集中"状态，而非显示误导性的 0
- [ ] PowerShell 命令从每次 scan 2 次调用减少为 1 次
- [ ] `getCpuTimes()` 的 locale 兼容性问题已修复（支持逗号小数分隔符）
- [ ] PowerShell 命令失败时有明确的错误日志（不被 catch {} 静默吞掉）
- [ ] `wmic` 调用已迁移到 `Get-CimInstance`
- [ ] 双重轮询已消除（前端不再独立 setInterval scan）
- [ ] Protected Processes 白名单未被破坏
- [ ] `AITaskTracker` 的 `completionScore` 在 CPU 修复后计算正确
- [ ] `NotificationService` 的 high-resource 告警在 CPU 修复后能正常触发
- [ ] 现有单元测试通过
- [ ] 新增 CPU 采集逻辑的集成测试

## Technical Notes

### CPU 为 0 的根因分析（三层问题）

1. **冷启动问题**（L346）：`measureCpuUsage()` 需要两次采样间隔的 delta 才能计算 CPU 百分比。首次 `scan()` 调用时 `lastCpuSampleTime === 0`，整个计算分支被跳过。

2. **PowerShell 命令可靠性**（L388）：`getCpuTimes()` 中的 PowerShell 命令逐个对 PID 调用 `Get-Process -Id`。当进程已退出或权限不足时，`-ErrorAction SilentlyContinue` + `catch {}` 会静默吞掉错误，导致 `currentCpuTimes` 返回空 Map。空 Map 使得 `if (currentCpuTimes.size > 0)` 失败，`previousCpuTimes` 不更新，形成永久性 0 值循环。

3. **编码/换行问题**：PowerShell 输出的 `TotalProcessorTime.TotalSeconds` 在某些 locale 下使用逗号作为小数分隔符（如 `12,345` 而非 `12.345`），`parseFloat()` 无法正确解析，`isNaN(cpuTime)` 为 true 导致所有值被跳过。

### PowerShell 命令优化方向

- `Get-CimInstance Win32_Process` 的返回结果中已包含 `KernelModeTime` 和 `UserModeTime` 属性（单位：100 纳秒），可直接用于 CPU 计算，无需第二次 PowerShell 调用
- 考虑使用 `[System.Diagnostics.Process]::GetProcessById()` 的 .NET 方法替代 PowerShell cmdlet
- 批量查询替代逐个 PID 查询

### 进程数据采集模式统一

项目中存在 4 种不同的进程数据采集模式（Get-CimInstance / Get-Process / tasklist / wmic），建议统一为 `Get-CimInstance Win32_Process` 作为主要采集方式。

### 安全红线

- **绝不**直接调用 NtQuerySystemInformation 等内核 API
- **绝不**在 PowerShell 中使用 `Add-Type` 编译内联 C# 来访问进程信息（WindowManager.ts 的模式仅限窗口管理场景）
- **绝不**尝试访问系统关键进程的内存空间
- 所有进程终止操作必须经过 Protected Processes 白名单检查

## Out of Scope

- 不涉及窗口管理（WindowManager.ts）的 C# interop 改造
- 不涉及前端 UI 组件的视觉重设计
- 不涉及 Electron IPC 架构的根本性重构
- 不涉及跨平台（Linux/macOS）支持
- 不涉及新增进程管理功能（如进程优先级调整、亲和性设置）
