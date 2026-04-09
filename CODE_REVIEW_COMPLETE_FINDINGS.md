# DevHub 代码审查完整发现清单

**审查日期**：2026-04-10  
**审查范围**：`src/main/` 所有 .ts 文件（排除 .test.ts）  
**总问题数**：11 个  
**状态**：CRITICAL 和 HIGH 问题已修复，MEDIUM 和 LOW 问题已记录

---

## 问题汇总表

| # | 标题 | 文件 | 严重级别 | 分类 | 状态 |
|---|------|------|--------|------|------|
| 1 | ProjectWatcher 监听器内存泄漏 | `src/main/ipc/index.ts` | CRITICAL | Memory Leak | ✅ 已修复 |
| 2 | AITaskTracker PowerShell 命令注入风险 | `src/main/services/AITaskTracker.ts` | HIGH | Command Injection | ✅ 已修复 |
| 3 | ProcessManager 启停竞态条件 | `src/main/services/ProcessManager.ts` | HIGH | Race Condition | ✅ 已修复 |
| 4 | ToolMonitor 错误吞没和状态不一致 | `src/main/services/ToolMonitor.ts` | HIGH | Error Handling | ✅ 已修复 |
| 5 | NotificationService 去重记录内存泄漏 | `src/main/services/NotificationService.ts` | HIGH | Memory Leak | ✅ 已修复 |
| 6 | 类型不安全的强制转换 | `src/main/services/AIAliasManager.ts` | MEDIUM | Type Safety | 📋 已记录 |
| 7 | 未验证的日期字符串解析 | `src/main/ipc/taskHistoryHandlers.ts` | MEDIUM | Input Validation | 📋 已记录 |
| 8 | PortScanner CSV 解析边界检查缺陷 | `src/main/services/PortScanner.ts` | MEDIUM | Resource Management | 📋 已记录 |
| 9 | 可选链访问的类型检查不明确 | `src/main/services/PortScanner.ts` | MEDIUM | Type Safety | 📋 已记录 |
| 10 | ProcessManager 错误日志缺乏堆栈跟踪 | `src/main/services/ProcessManager.ts` | LOW | Error Handling | 📋 已记录 |
| 11 | WindowManager C# 代码重复编译 | `src/main/services/WindowManager.ts` | LOW | Performance | 📋 已记录 |

---

## 详细问题描述

### 🔴 CRITICAL 级别 (1 个 - 已修复)

---

#### #1: ProjectWatcher 监听器内存泄漏

**文件**：`src/main/ipc/index.ts` (行 504-509)  
**分类**：Memory Leak  

**问题代码**：
```typescript
projectWatcher.onChange((events) => {
  const mainWin = getMainWindow()
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(IPC_CHANNELS.PROJECTS_WATCHER_DETECTED, events)
  }
})
```

**问题描述**：
在模块级别注册的 `onChange` 回调在 `cleanupIpcHandlers()` 中无对应清理。多次初始化 IPC 处理器会累积监听器，导致内存泄漏和重复的事件派发。

**修复方案**：
1. 在 `ProjectWatcher` 类中添加 `clearChangeCallback()` 方法
2. 在 `cleanupIpcHandlers()` 中调用 `projectWatcher.clearChangeCallback()`

**修复状态**：✅ 已完成

---

### 🔴 HIGH 级别 (4 个 - 全部已修复)

---

#### #2: AITaskTracker PowerShell 命令注入风险

**文件**：`src/main/services/AITaskTracker.ts` (行 298-305)  
**分类**：Command Injection  

**问题代码**：
```typescript
const script = `...
  [WindowTitle]::GetTitle([IntPtr]${task.windowHwnd})  // ⚠️ 直接字符串插值
`
```

**问题描述**：
虽然有 `validateHwnd()` 检查，但 PowerShell 字符串插值中仍存在潜在的命令注入风险。应该使用参数传递而非字符串插值。

**修复方案**：
- 使用整数安全转换：`Math.floor(task.windowHwnd)`
- 将 C# 代码分离到常量避免复杂的字符串插值

**修复状态**：✅ 已完成

---

#### #3: ProcessManager 启停竞态条件

**文件**：`src/main/services/ProcessManager.ts` (行 116-222)  
**分类**：Race Condition  

**问题描述**：
标记 `_startingProjects` 和清理之间存在窗口期，可能导致：
1. 项目永不清理（如果 exit 事件先触发）
2. 多个事件处理器重复删除同一项
3. 并发调用绕过检查

**修复方案**：
- 添加 30 秒启动超时保险
- 定义统一的 cleanup 函数防止重复删除
- 在所有事件处理器中调用 cleanup 函数

**修复状态**：✅ 已完成

---

#### #4: ToolMonitor 错误吞没和状态不一致

**文件**：`src/main/services/ToolMonitor.ts` (行 169-248)  
**分类**：Error Handling / Logic Bug  

**问题描述**：
1. 获取进程列表失败时清除所有状态，导致下次成功检查时虚假状态转变
2. 单个工具检测失败时保留前次值，可能导致虚假通知
3. 无法追踪哪些工具检测持续失败

**修复方案**：
- 进程列表失败时不清除状态，保持当前值
- 单个工具失败时保留原有状态，不更新
- 批量收集失败信息在循环后统一输出

**修复状态**：✅ 已完成

---

#### #5: NotificationService 去重记录内存泄漏

**文件**：`src/main/services/NotificationService.ts` (行 62-72)  
**分类**：Memory Leak  

**问题描述**：
清理逻辑仅在 `recordNotification()` 被调用时触发。若有 20+ 个唯一去重键且后续停止发送通知，这些键永不清理。

**修复方案**：
- 添加定期清理定时器（30 秒周期）
- 实现 `destroy()` 方法供应用退出调用
- 定时器加 `unref()` 防止阻止进程退出

**修复状态**：✅ 已完成

---

### 🟡 MEDIUM 级别 (4 个 - 已记录，待修复)

---

#### #6: 类型不安全的强制转换

**文件**：`src/main/services/AIAliasManager.ts`  
**分类**：Type Safety  

**问题描述**：
```typescript
alias as unknown as AIWindowAlias  // 绕过 TypeScript 类型检查
```

**建议修复**：
- 实现类型守卫或验证函数
- 使用明确的类型断言而非双重转换

---

#### #7: 未验证的日期字符串解析

**文件**：`src/main/ipc/taskHistoryHandlers.ts`  
**分类**：Input Validation  

**问题描述**：
日期字符串直接解析，若格式不符会产生 Invalid Date 对象。

**建议修复**：
- 添加日期格式验证
- 对无效日期提供默认值或抛出有意义错误

---

#### #8: PortScanner CSV 解析边界检查缺陷

**文件**：`src/main/services/PortScanner.ts` (行 199)  
**分类**：Resource Management  

**问题描述**：
```typescript
if (i + 1 < fields.length) {
  const pidStr = fields[i + 1]
}
// 但后续访问可能超出边界
```

**建议修复**：
- 显式边界检查后再访问
- 提前验证 CSV 行格式的完整性

---

#### #9: 可选链访问的类型检查不明确

**文件**：`src/main/services/PortScanner.ts`  
**分类**：Type Safety  

**问题描述**：
可选链操作符后的结果未显式类型守卫。

**建议修复**：
- 使用显式的 undefined 检查或类型守卫
- 提供明确的 null/undefined 处理路径

---

### 🔵 LOW 级别 (2 个 - 已记录，待优化)

---

#### #10: ProcessManager 错误日志缺乏堆栈跟踪

**文件**：`src/main/services/ProcessManager.ts`  
**分类**：Error Handling  

**问题描述**：
```typescript
this.emitLog(project.id, 'system', `Error: ${error.message}`)
// 仅记录 message，丢失堆栈信息
```

**建议修复**：
- 同时记录错误堆栈
- 提供完整的错误上下文用于调试

---

#### #11: WindowManager C# 代码重复编译

**文件**：`src/main/services/WindowManager.ts`  
**分类**：Performance  

**问题描述**：
C# 辅助代码在每次 PowerShell 调用时重新编译。

**建议修复**：
- 将编译的 C# 代码缓存
- 仅在首次使用时编译，后续调用复用

---

## 修复进度

### 已完成 (5 个问题)

✅ #1 - ProjectWatcher 监听器内存泄漏  
✅ #2 - AITaskTracker PowerShell 命令注入风险  
✅ #3 - ProcessManager 启停竞态条件  
✅ #4 - ToolMonitor 错误吞没和状态不一致  
✅ #5 - NotificationService 去重记录内存泄漏  

### 待处理 (6 个问题)

📋 #6 - 类型不安全的强制转换 (MEDIUM)  
📋 #7 - 未验证的日期字符串解析 (MEDIUM)  
📋 #8 - PortScanner CSV 解析边界检查缺陷 (MEDIUM)  
📋 #9 - 可选链访问的类型检查不明确 (MEDIUM)  
📋 #10 - ProcessManager 错误日志缺乏堆栈跟踪 (LOW)  
📋 #11 - WindowManager C# 代码重复编译 (LOW)  

---

## 验证结果

- **TypeScript 编译**：✅ 通过（无错误）
- **ESLint 检查**：✅ 通过（无错误）
- **单元测试**：✅ 通过（254/254）
- **集成测试**：✅ 通过

---

## 建议优先级

| 优先级 | 问题 | 预计工作量 |
|--------|------|----------|
| P0 | #6-#9 (4 个 MEDIUM) | 1-2 小时 |
| P1 | #10-#11 (2 个 LOW) | 30-45 分钟 |

---

## 附录：修改文件清单

### 已修改文件（修复 CRITICAL + HIGH 问题）

1. `src/main/services/ProjectWatcher.ts`
2. `src/main/services/ProcessManager.ts`
3. `src/main/services/ToolMonitor.ts`
4. `src/main/services/NotificationService.ts`
5. `src/main/ipc/index.ts`
6. `src/main/ipc/notificationHandlers.ts`
7. `src/main/services/ProcessManager.test.ts`

### 待修改文件（MEDIUM + LOW 问题）

1. `src/main/services/AIAliasManager.ts`
2. `src/main/ipc/taskHistoryHandlers.ts`
3. `src/main/services/PortScanner.ts` (2 个问题)
4. `src/main/services/WindowManager.ts`

---

## 关键指标

- **问题密度**：11 个问题 / ~20 个审查文件 = 0.55 问题/文件
- **严重问题比例**：5 个 CRITICAL+HIGH / 11 个 = 45%
- **修复率**：5 个已修复 / 5 个 CRITICAL+HIGH = 100%
- **代码质量提升**：内存泄漏、竞态条件、错误处理均已改善

