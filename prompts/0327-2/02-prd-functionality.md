# PRD 2: 功能修复

> 优先级: P1
> 类型: fullstack
> 复杂度: High

## Goal
修复 6 个不工作的子系统，使 DevHub 的核心功能可用。

## Requirements

### R2.1: 项目自动发现（Issue 3）
- 首次启动（projects 为空 + firstLaunchDone 为 false）自动触发 ProjectScanner.scanCommonLocations()
- 发现结果通过 IPC 发送到渲染进程
- 渲染进程弹出 AutoDiscoveryDialog，用户勾选要导入的项目
- 添加 `firstLaunchDone` flag 到 AppSettings 防止重复触发

### R2.2: 端口-项目关联（Issue 4）
- SystemProcessScanner 扫描后，通过 PID→workingDir→project 路径匹配
- 填充 PortInfo.projectId
- 新增 IPC channel `port:get-by-project`

### R2.3: CPU 指标修复（Issue 5）
- 替换 WMIC 为 PowerShell `Get-Process`
- 两次采样（间隔 500ms）计算 CPU 使用率
- 存储上次 CPU 时间用于增量计算
- cpuPercent = (deltaCPU / elapsedSec / numCores) * 100

### R2.4: 窗口管理修复（Issue 6）
- ensureWindowHelper() 编译失败时设置 flag + 记录完整错误
- 二次尝试编译，失败后 fallback 到内联 Add-Type
- 每个窗口操作都有内联 fallback 路径
- 新增 `window:health` IPC channel

### R2.5: AI 工具检测修复（Issue 7）
- Cursor: commandPatterns 为空时跳过命令行检查，仅用 processName 匹配
- Claude Code: regex 改为 `/\bclaude\b/i` 或检查 `@anthropic-ai/claude-code`
- 终端内 AI 工具：检查 WindowsTerminal.exe 的窗口标题
- 扫描时将 WindowManager 窗口数据传入 AITaskTracker 以匹配 hwnd

## Acceptance Criteria
- [ ] 首次启动弹出项目发现对话框
- [ ] 端口视图显示项目归属
- [ ] 进程视图 CPU 列显示真实数值
- [ ] 窗口 focus/move/close/minimize/maximize 操作可用
- [ ] Cursor 运行时被检测到
- [ ] Windows Terminal 中的 Claude Code 通过窗口标题检测
- [ ] `window:health` 返回编译状态

## Files

### New
- `src/renderer/components/project/AutoDiscoveryDialog.tsx`
- `src/preload/extended.ts` — 新 IPC channels

### Modified
- `src/main/index.ts` — 首次启动自动发现触发
- `src/main/ipc/index.ts` — projects:auto-discovered 事件
- `src/shared/types.ts` — firstLaunchDone
- `src/shared/types-extended.ts` — AI_TOOL_SIGNATURES 修复
- `src/main/services/SystemProcessScanner.ts` — PowerShell + CPU 计算
- `src/main/services/PortScanner.ts` — projectId 填充
- `src/main/services/WindowManager.ts` — fallback 编译 + health check
- `src/main/services/AITaskTracker.ts` — 空 pattern 逻辑 + hwnd 分配
- `src/main/ipc/portHandlers.ts` — port:get-by-project
- `src/main/ipc/windowHandlers.ts` — window:health
- `src/renderer/App.tsx` — 监听自动发现事件
- `src/renderer/hooks/useWindows.ts` — health check
