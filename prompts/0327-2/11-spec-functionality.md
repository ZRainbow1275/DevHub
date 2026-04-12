# Functionality Spec — 功能修复技术规格

## FUNC-01: 项目自动发现

**触发条件**: `appStore.getProjects().length === 0 && !settings.firstLaunchDone`

**流程**:
```
main/index.ts: app.whenReady()
  → 检查 projects 为空 && !firstLaunchDone
  → projectScanner.scanCommonLocations()
  → mainWindow.webContents.send('projects:auto-discovered', results)
  → appStore.updateSettings({ firstLaunchDone: true })

renderer/App.tsx:
  → 监听 'projects:auto-discovered'
  → 显示 AutoDiscoveryDialog
  → 用户勾选 → 批量 addProject()
```

**AutoDiscoveryDialog 组件**:
- 列出发现的项目（名称、路径、scripts 列表）
- 每行一个 checkbox
- "全选" / "全不选" 按钮
- "导入选中" 按钮

---

## FUNC-02: 端口-项目关联

**数据流**:
```
SystemProcessScanner.scan()
  → 获取所有进程（含 PID、workingDir）
  → 传入 knownProjects 列表
  → 对每个进程：如果 workingDir 匹配某 project.path → 设置 projectId

PortScanner.scanAll()
  → 获取所有端口（含 PID）
  → 对每个端口：查 processScanner.getProcessByPid(pid)
  → 如果进程有 projectId → 填充到 PortInfo.projectId
```

**新 API**: `port:get-by-project(projectId: string) → PortInfo[]`

---

## FUNC-03: CPU 指标

**替换 WMIC**:
```typescript
// 旧方法（SystemProcessScanner.ts）
const cmd = 'wmic process get ProcessId,Name,CommandLine,WorkingSetSize /format:csv'

// 新方法
const psCmd = `Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine,WorkingSetSize | ConvertTo-Csv -NoTypeInformation`
```

**CPU 计算**:
```typescript
// 第一次采样
const t1 = Date.now()
const cpuTimes1 = await getCpuTimes(pids) // Get-Process -Id x | Select CPU

// 500ms 后第二次采样
await sleep(500)
const t2 = Date.now()
const cpuTimes2 = await getCpuTimes(pids)

// 计算
const elapsedSec = (t2 - t1) / 1000
const numCores = os.cpus().length
for (const pid of pids) {
  const deltaCpu = cpuTimes2[pid] - cpuTimes1[pid]
  processInfo.cpuPercent = (deltaCpu / elapsedSec / numCores) * 100
}
```

**存储上次值**: `Map<number, number>` 字段，跨扫描周期保留。

---

## FUNC-04: 窗口管理 Fallback

**当前问题**: `ensureWindowHelper()` 编译 C# 类失败 → 所有操作永久失败

**修复策略**:
```typescript
class WindowManager {
  private windowHelperCompiled = false
  private compilationAttempts = 0
  private readonly MAX_COMPILE_ATTEMPTS = 2

  async ensureWindowHelper(): Promise<boolean> {
    if (this.windowHelperCompiled) return true
    if (this.compilationAttempts >= this.MAX_COMPILE_ATTEMPTS) return false

    this.compilationAttempts++
    try {
      // 尝试编译 C# helper
      await this.compileHelper()
      this.windowHelperCompiled = true
      return true
    } catch (error) {
      console.error(`WindowHelper compilation attempt ${this.compilationAttempts} failed:`, error)
      return false
    }
  }

  async focusWindow(hwnd: number): Promise<ServiceResult> {
    const hasHelper = await this.ensureWindowHelper()

    if (hasHelper) {
      // 使用已编译的 helper
      return this.focusWithHelper(hwnd)
    } else {
      // Fallback: 内联 Add-Type
      return this.focusWithInline(hwnd)
    }
  }

  private async focusWithInline(hwnd: number): Promise<ServiceResult> {
    const script = `
      Add-Type @"
        using System; using System.Runtime.InteropServices;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
      [WinAPI]::ShowWindow([IntPtr]${hwnd}, 9)
      [WinAPI]::SetForegroundWindow([IntPtr]${hwnd})
    `
    // 执行 PowerShell
  }
}
```

**新 IPC**: `window:health → { helperCompiled: boolean, lastError: string | null, attempts: number }`

---

## FUNC-05: AI 工具检测修复

**问题 1: Cursor commandPatterns 为空**

```typescript
// 修复 detectAIToolType()
function detectAIToolType(name: string, cmd: string): AIToolType {
  for (const [toolType, sig] of Object.entries(AI_TOOL_SIGNATURES)) {
    const nameMatch = sig.processPatterns.some(p =>
      name.toLowerCase().includes(p.toLowerCase())
    )
    if (!nameMatch) continue

    // 修复：如果 commandPatterns 为空，仅用 processName 匹配
    if (sig.commandPatterns.length === 0) {
      return toolType as AIToolType
    }

    const cmdMatch = sig.commandPatterns.some(r => r.test(cmd))
    if (cmdMatch) return toolType as AIToolType
  }
  return 'other'
}
```

**问题 2: Claude Code regex 太严格**

```typescript
// 旧
'claude-code': { commandPatterns: [/claude\s+/i] }
// 新
'claude-code': { commandPatterns: [/\bclaude\b/i, /@anthropic-ai\/claude-code/i, /claude-code/i] }
```

**问题 3: 终端内 AI 工具**
- 如果 processName 是 WindowsTerminal.exe，检查窗口标题
- 需要 WindowManager 提供窗口-PID 映射
- AITaskTracker.scanForAITasks 接收窗口数据参数

**问题 4: windowHwnd 未赋值**
- 扫描时通过 PID 匹配窗口：`windows.find(w => w.pid === process.pid)`
- 赋值到 `task.windowHwnd = matchedWindow.hwnd`
