# 进程深层勘探 — 技术设计 Spec

> 对应 PRD: 2.1 进程深层勘探不可达 (P0)
> 基于: `prompts/0410/01-process-management-spec.md` 增补
> 变更: 从"改进"升级为"核心功能修复"——当前完全不可用

---

## 1. 问题本质

点击进程后 **三个维度的信息完全不可达**：

| 维度 | 期望行为 | 当前行为 |
|------|---------|---------|
| 目录 | 显示 CWD、exe 路径、脚本路径 | 无任何显示 |
| 关系 | 展示父子链、端口关联、关联进程 | 无任何显示 |
| 详情 | 弹出侧边栏，含资源图表、连接列表、环境变量 | 无任何显示 |

根因推测：后端 `SystemProcessScanner` 当前仅采集浅层信息（PID、名称、CPU%、内存），未调用深层 WMI/PowerShell 查询。

---

## 2. 后端深层采集

### 2.1 分层采集策略

为避免性能问题，采集分两层：

```
Layer 1 — 列表层（定时全量采集，2s 轮询）
  采集内容: PID, Name, CPU%, Memory, ParentPID, Status
  数据量: 所有进程（300-500 个）
  方法: tasklist / WMI Win32_Process (轻量查询)

Layer 2 — 详情层（按需采集，用户点击时触发）
  采集内容: 完整命令行、CWD、环境变量、线程数、句柄数、
            网络连接、加载模块、完整进程树
  数据量: 单个进程
  方法: WMI 深度查询 + netstat 关联 + PowerShell Get-Process
```

### 2.2 Layer 1 — 列表层数据结构

```typescript
interface ProcessListItem {
  pid: number
  name: string
  parentPid: number
  cpuPercent: number
  memoryMB: number
  status: 'running' | 'suspended' | 'unknown'
  type: 'system' | 'user' | 'ai_tool' | 'dev_server' | 'service'
  hasChildren: boolean    // 是否有子进程（用于展开指示器）
  listeningPorts: number[] // 监听的端口列表（从 PortScanner 缓存交叉引用）
}
```

### 2.3 Layer 2 — 详情层数据结构

```typescript
interface ProcessDeepDetail {
  // 身份
  pid: number
  name: string
  executablePath: string        // 可执行文件完整路径
  commandLine: string           // 完整命令行参数
  workingDirectory: string      // 工作目录 (CWD)
  scriptPath: string | null     // 解释器进程的实际脚本路径
  startTime: string             // ISO 时间戳
  userName: string              // 运行用户

  // 资源
  cpuPercent: number
  cpuHistory: number[]          // 最近 60 秒的 CPU 历史（用于折线图）
  memoryRSS: number             // 物理内存 (MB)
  memoryVMS: number             // 虚拟内存 (MB)
  threadCount: number
  handleCount: number
  ioReadBytes: number
  ioWriteBytes: number
  ioReadOps: number
  ioWriteOps: number

  // 网络
  networkConnections: NetworkConnection[]

  // 模块
  loadedModules: LoadedModule[]

  // 环境
  environmentVariables: Record<string, string>

  // 进程树
  ancestorChain: ProcessTreeNode[]  // root → ... → parent → self
  children: ProcessTreeNode[]       // 直接子进程
  relatedProcesses: RelatedProcess[] // 通过端口/文件关联的进程
}

interface NetworkConnection {
  protocol: 'TCP' | 'UDP'
  localAddress: string
  localPort: number
  remoteAddress: string
  remotePort: number
  state: 'LISTENING' | 'ESTABLISHED' | 'CLOSE_WAIT' | 'TIME_WAIT' | 'FIN_WAIT_2'
}

interface LoadedModule {
  name: string
  path: string
  sizeKB: number
}

interface ProcessTreeNode {
  pid: number
  name: string
  cpuPercent: number
  memoryMB: number
  children?: ProcessTreeNode[]
}

interface RelatedProcess {
  pid: number
  name: string
  relation: 'shared_port' | 'shared_file' | 'pipe' | 'network_peer'
  detail: string  // 例: "共享端口 :3000" 或 "TCP 连接 → :8080"
}
```

### 2.4 脚本路径解析

对于解释器进程（node、python、java 等），需要从命令行中提取实际运行的脚本：

```typescript
function resolveScriptPath(name: string, commandLine: string): string | null {
  // Node.js: node server.js → "server.js"
  // Python: python -m flask run → "flask"
  // Java: java -jar app.jar → "app.jar"
  
  const interpreters: Record<string, RegExp> = {
    'node': /node(?:\.exe)?\s+(.+?)(?:\s+--|$)/,
    'python': /python(?:\d)?(?:\.exe)?\s+(?:-m\s+)?(.+?)(?:\s+--|$)/,
    'java': /java(?:\.exe)?.*?(?:-jar\s+)?(\S+\.jar)/,
    'ruby': /ruby(?:\.exe)?\s+(.+?)(?:\s+--|$)/,
  }

  for (const [interpreter, pattern] of Object.entries(interpreters)) {
    if (name.toLowerCase().includes(interpreter)) {
      const match = commandLine.match(pattern)
      if (match) return match[1].trim()
    }
  }
  return null
}
```

---

## 3. 后端采集实现

### 3.1 WMI 查询（进程详情）

```typescript
async function getProcessDeepInfo(pid: number): Promise<ProcessDeepDetail> {
  // 方案 A: PowerShell + WMI (推荐，信息最全)
  const psScript = `
    $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
    $w = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"
    
    @{
      ExecutablePath = $p.Path
      CommandLine = $w.CommandLine
      WorkingDirectory = $w.ExecutablePath | Split-Path -Parent
      StartTime = $p.StartTime.ToString('o')
      UserName = $w.GetOwner().User
      ThreadCount = $p.Threads.Count
      HandleCount = $p.HandleCount
      WorkingSet = $p.WorkingSet64
      VirtualMemory = $p.VirtualMemorySize64
      IOReadBytes = $p.PrivilegedProcessorTime  # 需要替换为实际 IO 计数器
    } | ConvertTo-Json
  `

  // 方案 B: 纯 WMI (备用)
  const wmiQuery = `
    Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" |
    Select-Object ProcessId, Name, ExecutablePath, CommandLine,
      CreationDate, ThreadCount, HandleCount,
      ReadTransferCount, WriteTransferCount |
    ConvertTo-Json
  `
}
```

### 3.2 网络连接查询

```typescript
async function getProcessConnections(pid: number): Promise<NetworkConnection[]> {
  // PowerShell Get-NetTCPConnection (Windows 10+)
  const psScript = `
    Get-NetTCPConnection -OwningProcess ${pid} -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State |
    ConvertTo-Json
  `
  // 回退: netstat -ano | findstr ${pid}
}
```

### 3.3 环境变量查询

```typescript
async function getProcessEnvironment(pid: number): Promise<Record<string, string>> {
  // 注意: 读取其他进程的环境变量需要管理员权限
  // 方案: 使用 WMI + ReadProcessMemory (复杂) 或 NtQueryInformationProcess
  // 简化方案: 仅对当前用户的进程使用 PowerShell
  const psScript = `
    (Get-Process -Id ${pid}).StartInfo.EnvironmentVariables |
    ConvertTo-Json
  `
  // 备注: 此方法可能无法获取所有进程的环境变量
  // 对于权限不足的进程，返回空对象并在 UI 中提示
}
```

### 3.4 进程树构建

```typescript
async function buildProcessTree(targetPid: number): Promise<{
  ancestors: ProcessTreeNode[]
  children: ProcessTreeNode[]
  related: RelatedProcess[]
}> {
  // 1. 从 ScannerCache 获取所有进程的 PID→PPID 映射
  const allProcesses = scannerCache.processes.data

  // 2. 向上追溯祖先链
  const ancestors: ProcessTreeNode[] = []
  let currentPid = targetPid
  while (currentPid > 0) {
    const proc = allProcesses.find(p => p.pid === currentPid)
    if (!proc || currentPid === proc.parentPid) break
    ancestors.unshift({ pid: proc.pid, name: proc.name, cpuPercent: proc.cpuPercent, memoryMB: proc.memoryMB })
    currentPid = proc.parentPid
  }

  // 3. 递归收集所有子进程
  function collectChildren(pid: number): ProcessTreeNode[] {
    return allProcesses
      .filter(p => p.parentPid === pid && p.pid !== pid)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpuPercent: p.cpuPercent,
        memoryMB: p.memoryMB,
        children: collectChildren(p.pid),
      }))
  }
  const children = collectChildren(targetPid)

  // 4. 从 PortScanner 缓存交叉引用端口关联的进程
  const targetPorts = scannerCache.ports.data
    .filter(p => p.pid === targetPid)
    .map(p => p.port)
  const related: RelatedProcess[] = scannerCache.ports.data
    .filter(p => targetPorts.includes(p.port) && p.pid !== targetPid)
    .map(p => ({
      pid: p.pid,
      name: allProcesses.find(x => x.pid === p.pid)?.name ?? 'unknown',
      relation: 'shared_port' as const,
      detail: `共享端口 :${p.port}`,
    }))

  return { ancestors, children, related }
}
```

---

## 4. IPC 接口

```typescript
// 新增 IPC Handler
ipcMain.handle('process:getDeepDetail', async (_, pid: number) => {
  return getProcessDeepInfo(pid)
})

ipcMain.handle('process:getTree', async (_, pid: number) => {
  return buildProcessTree(pid)
})

ipcMain.handle('process:getConnections', async (_, pid: number) => {
  return getProcessConnections(pid)
})

ipcMain.handle('process:getEnvironment', async (_, pid: number) => {
  return getProcessEnvironment(pid)
})

// 操作类
ipcMain.handle('process:kill', async (_, pid: number) => {
  return killProcess(pid)
})

ipcMain.handle('process:killTree', async (_, pid: number) => {
  return killProcessTree(pid)  // 使用 tree-kill 包
})

ipcMain.handle('process:setPriority', async (_, pid: number, priority: string) => {
  return setProcessPriority(pid, priority)
})

ipcMain.handle('process:openFileLocation', async (_, executablePath: string) => {
  shell.showItemInFolder(executablePath)
})
```

---

## 5. 前端详情面板

### 5.1 组件结构

```
ProcessDetailDrawer (抽屉/侧边栏)
├── Header
│   ├── 进程图标 + 名称 + PID
│   ├── 状态指示器（运行中/暂停）
│   └── 操作按钮组 [结束] [进程树] [优先级▾] [文件位置]
├── TabGroup
│   ├── Tab: 概览
│   │   ├── 基础信息（路径、命令行、CWD、启动时间、用户）
│   │   ├── 资源图表（CPU 折线图 + 内存柱状图，实时更新）
│   │   └── 快速统计（线程/句柄/IO/连接数）
│   ├── Tab: 网络
│   │   ├── 连接列表（表格：本地→远程，协议，状态）
│   │   ├── 监听端口列表
│   │   └── 连接状态分布饼图
│   ├── Tab: 进程树
│   │   ├── 可折叠树视图（祖先链 + 子进程树）
│   │   ├── 神经图视图（切换按钮）
│   │   └── 关联进程列表（通过端口/文件关联）
│   ├── Tab: 环境变量
│   │   ├── 搜索框
│   │   └── Key=Value 列表（可复制）
│   └── Tab: 模块 (可选)
│       └── 已加载 DLL/模块列表
└── Footer
    └── 上次更新时间 + 手动刷新按钮
```

### 5.2 交互规格

| 操作 | 行为 |
|------|------|
| 点击进程卡片 | 从右侧滑入详情面板（宽度 480px，可拖拽调整） |
| 点击面板外区域 | 不关闭面板（需要显式关闭） |
| 关闭面板 | 点击 × 或 ESC 键 |
| 结束进程 | 二次确认弹窗 → 调用 `process:kill` |
| 结束进程树 | 二次确认弹窗（列出将被终止的子进程数量）→ 调用 `process:killTree` |
| 打开文件位置 | 调用 `shell.showItemInFolder` → 打开资源管理器并选中文件 |
| 设置优先级 | 下拉菜单：Realtime/High/AboveNormal/Normal/BelowNormal/Idle |
| 刷新详情 | 重新调用 `process:getDeepDetail` |

### 5.3 CPU 历史折线图

```
采集策略:
- 每 2 秒采集一次 CPU% 样本
- 保留最近 60 秒数据（30 个数据点）
- 存储在 Renderer 端 Zustand store 中
- 使用 SVG <polyline> 或 Canvas 绘制（轻量，无需 chart 库）

视觉:
- 折线颜色: 主题主色调
- 面积填充: 半透明渐变
- Y 轴: 0-100%
- 无标注点，纯折线+填充（保持简洁）
- 高 CPU (>80%) 时折线变红
```

---

## 6. 验收标准

- [ ] 点击进程卡片后 < 500ms 弹出详情面板
- [ ] 详情面板包含：路径、命令行、CWD、启动时间
- [ ] 详情面板包含：实时 CPU 折线图（60 秒窗口）
- [ ] 详情面板包含：网络连接列表（协议、地址、状态）
- [ ] 详情面板包含：进程树（祖先链 + 子进程）
- [ ] 详情面板包含：环境变量列表（可搜索、可复制）
- [ ] "打开文件位置" 按钮正常打开资源管理器
- [ ] "结束进程" 和 "结束进程树" 功能正常（带确认弹窗）
- [ ] 解释器进程（node/python）正确解析脚本路径
- [ ] 权限不足时优雅降级（显示"需要管理员权限"提示，不崩溃）
