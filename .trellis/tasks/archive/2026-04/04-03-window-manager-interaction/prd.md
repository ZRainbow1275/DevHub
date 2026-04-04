# Task: window-manager-interaction

## Overview

窗口管理交互重构，解决四个核心问题：系统窗口污染扫描结果、聚焦操作不可靠、同PID多窗口缺乏分组展示、窗口标题乱码（?号替代字符）。涉及后端 `WindowManager.ts` 的 C#/PowerShell 交互层和前端 `WindowView.tsx` 的 UI 渲染层。

## Requirements

### R1: 过滤系统窗口

- 在 `WindowManager.ts` 的 `scanWindows()` 中基于 `className` 字段建立系统窗口黑名单
- 黑名单应包含：`Progman`（桌面）、`WorkerW`（桌面工作线程）、`Windows.UI.Core.CoreWindow`（UWP 核心窗口）、`ApplicationFrameWindow`（UWP 框架/设置应用）、`Shell_TrayWnd`（任务栏）、`Shell_SecondaryTrayWnd`（副屏任务栏）
- 在 `WindowInfo` 类型中添加 `isSystemWindow` 标记字段
- 后端默认过滤系统窗口（减少数据传输量）
- 前端在 `WindowView.tsx` 提供"显示系统窗口"切换开关，允许用户查看全部窗口

### R2: 修复聚焦操作

- 修复 `HELPER_ADD_TYPE` 中的 C# `Focus` 方法，当前 `SetForegroundWindow` 在 Electron 应用中不可靠
- 使用 `AttachThreadInput` + `BringWindowToTop` + `SetForegroundWindow` 组合策略：
  1. 获取目标窗口线程和当前前台窗口线程
  2. `AttachThreadInput` 关联两个线程的输入队列
  3. `BringWindowToTop` 提升窗口 Z-order
  4. `SetForegroundWindow` 设置前台窗口
  5. `AttachThreadInput` 解除关联
- 将 `ShowWindow(h, 9)` 改为 `ShowWindow(h, SW_RESTORE)` 并处理最小化窗口恢复
- 添加重试机制：如果首次聚焦失败，使用 `keybd_event` 模拟按键后重试

### R3: 处理同PID多窗口

- `windowStore.ts` 已有 `getWindowsByPid` 方法，前端需要利用该方法
- 在 `WindowView.tsx` 中添加"按进程分组"视图模式
- 同进程的多个窗口应可折叠/展开显示
- 分组头部显示进程名、PID、窗口数量
- 保持现有的扁平列表视图作为默认/可切换选项

### R4: 修复标题?号乱码

- 根因分析：PowerShell 默认使用系统 OEM 代码页输出到管道，`[Console]::OutputEncoding = UTF8` 不足以解决
- 修复方案（按优先级）：
  1. 在 C# 侧显式设置 `Console.OutputEncoding = System.Text.Encoding.UTF8`
  2. 额外设置 PowerShell 的 `$OutputEncoding = [System.Text.Encoding]::UTF8`
  3. 将 `string.Join("\\n", result)` 改为 JSON 输出格式，避免分隔符和编码问题
  4. 在 `execFileAsync` 调用时设置环境变量 `chcp 65001`
- 同时检查 `batchGetProcessNames` 方法的编码一致性

## Acceptance Criteria

- [ ] 扫描结果中不再出现系统窗口（Progman、Settings、CoreWindow 等）
- [ ] 前端有"显示系统窗口"切换开关，开启后可看到系统窗口（带明确标记）
- [ ] 聚焦操作可靠工作：点击聚焦后目标窗口确实出现在前台
- [ ] 对最小化窗口执行聚焦时，窗口能正确恢复并获得焦点
- [ ] 同一进程的多个窗口可以按PID分组查看
- [ ] 分组视图中显示进程名、PID、包含的窗口数
- [ ] 窗口标题中的中文/日文/特殊字符正确显示，不出现 `?` 替代符
- [ ] 所有现有的窗口操作（移动、最小化、最大化、关闭）仍正常工作
- [ ] TypeScript 类型定义完整、一致，无 `any` 类型

## Technical Notes

1. **系统窗口过滤**：基于 `className` 而非进程名过滤。C# 的 `GetClassName` 已在扫描时获取了 `className`（WindowManager.ts 第131行），TypeScript 层需要新增黑名单匹配逻辑。

2. **聚焦操作 C# 代码**：需要在 `HELPER_ADD_TYPE` 常量中新增 `GetWindowThreadProcessId`、`AttachThreadInput`、`BringWindowToTop`、`GetForegroundWindow` 的 P/Invoke 声明。注意 `AttachThreadInput` 必须在 finally 块中解除，避免线程输入队列泄漏。

3. **标题编码管道**：PowerShell → stdout → Node.js 的编码链路需要端到端 UTF-8。建议将 C# 输出格式从换行分隔的文本改为 JSON 格式（`JsonConvert` 或手动 JSON 拼接），这同时解决了分隔符和编码问题。

4. **同PID多窗口**：Chrome 等多进程浏览器每个标签页可能有独立 PID，而 VSCode 是单 PID 多窗口。分组逻辑应同时支持按 PID 和按 processName 两种维度。

5. **性能注意**：每次窗口操作都启动新 PowerShell 进程并重新编译 C# 类。本任务不改变此架构（属于后续优化范畴），但新增的 C# 代码应保持在同一个 `Add-Type` 调用中。

## Out of Scope

- PowerShell 进程池化/复用优化（性能优化后续任务）
- C# helper 预编译为 DLL
- 窗口管理的单元测试（当前项目中该模块无测试覆盖）
- 新增 IPC 通道（尽量复用现有通道，通过参数扩展实现）
- 窗口截图/预览功能
