# Phase 3A — 关键基础修复 PRD

> 优先级: P0 (阻塞所有后续工作)
> 类型: fullstack
> 预估修改文件: 8-12

---

## R1: 单实例锁（修复双窗口）

**问题**: 启动时出现两个 DevHub 窗口
**修复文件**: `src/main/index.ts`

### 要求
- 使用 `app.requestSingleInstanceLock()` 确保只有一个实例
- 如果第二个实例尝试启动，聚焦已有窗口
- 开发模式和生产模式均适用

### 实现
```typescript
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
```

---

## R2: PowerShell UTF-8 编码（修复窗口标题乱码）

**问题**: 窗口标题显示 ����（Unicode 字符被截断）
**修复文件**: `src/main/services/WindowManager.ts`

### 根因
- PowerShell stdout 默认使用系统 Code Page（CP936）
- C# GetWindowText 返回 UTF-16 字符串，在 stdout 管道中被错误编码

### 要求
- 所有 PowerShell 命令前添加 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`
- Node.js execFileAsync 添加 `encoding: 'utf8'`
- 适用于: scanWindows(), batchGetProcessNames(), 所有操作方法

### 实现模式
```typescript
const { stdout } = await execFileAsync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
    `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${actualCommand}`
  ],
  { windowsHide: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
)
```

---

## R3: CPU 测量修复与验证

**问题**: CPU 列全部显示 0.0%
**修复文件**: `src/main/services/SystemProcessScanner.ts`

### 调试步骤
1. 在 getCpuTimes() 中添加 console.log 输出实际 PowerShell stdout
2. 验证 `@(pid1,pid2)` 语法在 PowerShell 中正确生成数组
3. 验证 Get-Process -Id 返回 TotalProcessorTime
4. 检查 measureCpuUsage() 的两次采样逻辑是否正确触发

### 备选方案
如果 `Get-Process` 的 `TotalProcessorTime` 不可靠，改用:
```powershell
Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "IDProcess IN (pid1,pid2)" | Select IDProcess, PercentProcessorTime
```
此方法直接返回 CPU 百分比，无需两次采样计算差值。

### 同时修复: SystemProcessScanner PowerShell 编码
- 添加 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` 到所有 PowerShell 命令
- 添加 `encoding: 'utf8'` 到所有 execFileAsync 调用

---

## R4: StatCard 显示修复

**问题**: 数值被 truncate 截断（"0...." "2..."）
**修复文件**: `src/renderer/components/ui/StatCard.tsx`

### 要求
- **移除** 值元素上的 `truncate` class（数值不应被截断）
- 改用自适应字体大小：值短时大字体，值长时缩小
- 确保 `tabular-nums` 生效（等宽数字）
- 最小可读字体: 16px

### 实现
```tsx
// 根据值长度动态调整字体
const valueStr = String(value)
const fontSize = valueStr.length > 6 ? 'text-lg' : valueStr.length > 4 ? 'text-xl' : 'text-2xl'
```

---

## R5: 进程过滤模式收紧

**问题**: DEV_PROCESS_PATTERNS 匹配了 postgres 等数据库进程
**修复文件**: `src/shared/types-extended.ts`

### 要求
- 从 DEV_PROCESS_PATTERNS 中移除纯数据库进程（postgres, mysql, mongo 等）
- 只保留真正的开发工具进程:
  - 运行时: node.exe, python.exe, ruby.exe, java.exe, deno.exe, bun.exe
  - 工具: npm, pnpm, yarn, vite, webpack, tsc, esbuild
  - AI 工具: codex, claude, gemini, cursor
  - IDE 相关: code.exe (VS Code), Cursor.exe
- 添加注释说明每个 pattern 的用途

---

## R6: 项目手动发现

**问题**: firstLaunchDone=true 后无法再触发自动发现
**修复文件**: `src/renderer/App.tsx`, `src/renderer/components/project/ProjectList.tsx`

### 要求
- 在 ProjectList 的空状态视图中添加「扫描项目」按钮
- 点击后调用 `window.devhub.projects.discover()` 获取项目列表
- 显示发现结果并允许选择性导入
- 不依赖 firstLaunchDone 标志

---

## R7: 窗口操作验证

**问题**: 聚焦/最小化/关闭等窗口操作无效
**修复文件**: `src/main/services/WindowManager.ts`

### 调试
1. 在 focusWindow() 中添加 console.log 打印完整 PowerShell 命令
2. 验证 Add-Type + 操作在单个 PowerShell 命令中执行成功
3. 如果换行符 `\n` 在 Windows 上有问题，改用 `;` 分隔语句

### 关键修复
```typescript
// 使用分号而非换行符连接命令
const cmd = `${WindowManager.HELPER_ADD_TYPE}; [WindowHelper]::Focus([IntPtr]${hwnd})`
```

---

## Acceptance Criteria

- [ ] 只启动一个窗口
- [ ] 窗口标题正确显示中文和特殊字符
- [ ] CPU 列在 10 秒后显示非零数值
- [ ] StatCard 数值完整显示（不截断）
- [ ] 进程列表只显示开发相关进程
- [ ] 可以手动触发项目扫描
- [ ] 双击窗口可以聚焦该窗口
- [ ] `pnpm build` 成功
- [ ] `pnpm typecheck` 通过
