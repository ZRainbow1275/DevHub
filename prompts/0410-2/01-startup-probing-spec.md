# 启动时主动勘探 — 技术设计 Spec

> 对应 PRD: 2.0 启动时主动勘探 (P0)
> 状态: NEW — 第二轮测试新发现

---

## 1. 问题描述

当前 DevHub 的数据加载是**惰性模式**：用户点击某个 Tab（进程/端口/窗口）后，才触发对应 Scanner 开始扫描。这导致：

- 首屏看到空白/骨架屏，体验差
- Tab 切换时有明显的扫描延迟（1-3 秒）
- 后台无持续监控，无法及时发现系统状态变化
- AI 工具实例可能在用户查看窗口列表之前就已经启动并完成任务，错过通知

---

## 2. 目标架构

```
App Startup
  │
  ├── Electron Main Process Ready
  │     │
  │     ├── [并行] ProcessScanner.startBackground()    ── 2s 轮询
  │     ├── [并行] PortScanner.startBackground()       ── 5s 轮询
  │     ├── [并行] WindowManager.startBackground()     ── 3s 轮询
  │     └── [并行] AITaskTracker.startBackground()     ── 1s 轮询
  │     │
  │     └── 所有扫描结果 → 内存缓存 (ScannerCache)
  │
  ├── Renderer Process Ready
  │     │
  │     └── 首次渲染从 ScannerCache 取数据 → 即时渲染（无等待）
  │
  └── 持续运行
        ├── Scanner 定时刷新 → 更新 ScannerCache
        ├── ScannerCache 变更 → IPC push → Renderer 增量更新
        └── Tab 切换 → 直接读缓存 → 0 延迟
```

---

## 3. ScannerCache 设计

### 3.1 数据结构

```typescript
interface ScannerCache {
  processes: {
    data: ProcessInfo[]
    lastUpdated: number
    isScanning: boolean
    error: string | null
  }
  ports: {
    data: PortInfo[]
    lastUpdated: number
    isScanning: boolean
    error: string | null
  }
  windows: {
    data: WindowInfo[]
    lastUpdated: number
    isScanning: boolean
    error: string | null
  }
  aiTasks: {
    data: AITaskInfo[]
    lastUpdated: number
    isScanning: boolean
    error: string | null
  }
  systemSummary: {
    processCount: number
    activePortCount: number
    windowCount: number
    aiToolCount: number
    cpuTotal: number
    memoryUsedPercent: number
  }
}
```

### 3.2 缓存更新策略

```
┌──────────────┬──────────┬───────────────────────────────────┐
│ Scanner      │ 轮询间隔 │ 更新方式                           │
├──────────────┼──────────┼───────────────────────────────────┤
│ Process      │ 2s       │ 全量扫描 → diff → 仅推送变化部分  │
│ Port         │ 5s       │ 全量扫描 → diff → 仅推送变化部分  │
│ Window       │ 3s       │ 全量扫描 → diff → 仅推送变化部分  │
│ AI Task      │ 1s       │ 仅扫描已知 AI 窗口的状态变化      │
│ Summary      │ 2s       │ 从其他缓存聚合计算                │
└──────────────┴──────────┴───────────────────────────────────┘
```

### 3.3 IPC 推送机制

```typescript
// Main → Renderer 推送
ipcMain.on('scanner:subscribe', (event) => {
  // Renderer 订阅缓存更新
  scannerCache.on('processes:updated', (diff) => {
    event.sender.send('scanner:processes:diff', diff)
  })
  scannerCache.on('ports:updated', (diff) => {
    event.sender.send('scanner:ports:diff', diff)
  })
  // ... 其他类型
})

// Renderer 首次请求全量快照
ipcMain.handle('scanner:snapshot', () => {
  return scannerCache.getSnapshot()
})
```

---

## 4. 启动序列

```
T+0ms    Electron app.ready
T+50ms   创建 BrowserWindow（显示启动画面/骨架屏）
T+100ms  并行启动所有 Scanner
T+500ms  ProcessScanner 完成首次扫描 → 缓存更新
T+800ms  WindowManager 完成首次扫描 → 缓存更新
T+1200ms PortScanner 完成首次扫描 → 缓存更新
T+1500ms Renderer 加载完成 → 请求 snapshot → 即时渲染
T+1500ms+ 所有 Scanner 进入定时轮询模式
```

---

## 5. 首屏初始化 UI

```
┌──────────────────────────────────────────────┐
│                  DevHub                       │
│                                              │
│  ◉ 正在初始化系统勘探...                       │
│                                              │
│  ✓ 进程扫描完成    328 个进程已发现            │
│  ✓ 窗口扫描完成     42 个窗口 (3 个 AI 工具)  │
│  ◎ 端口扫描中...   [████████░░] 80%          │
│  ◎ 网络分析中...   [██░░░░░░░░] 20%          │
│                                              │
└──────────────────────────────────────────────┘
```

首次扫描全部完成后自动过渡到 Dashboard 视图。

---

## 6. Dashboard 摘要面板

启动后首屏应展示系统摘要，而非空白：

```
┌─────────────────────────────────────────────────────────────┐
│ 系统概览                                    刷新: 2秒前     │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ 进程     │ 端口     │ 窗口     │ AI 工具  │ 系统资源        │
│ 328      │ 47       │ 42       │ 3        │ CPU: 34%        │
│ (+12)    │ (0)      │ (-2)     │ (+1)     │ MEM: 68%        │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
```

- 括号内数字为自上次刷新以来的变化量
- AI 工具数量单独统计，点击可直达 AI 窗口列表
- 系统资源为全局 CPU/内存使用率

---

## 7. 实现要点

### 7.1 Scanner 生命周期管理

```typescript
class BackgroundScannerManager {
  private scanners: Map<string, BackgroundScanner> = new Map()
  private cache: ScannerCache

  async startAll(): Promise<void> {
    // 并行启动，互不阻塞
    await Promise.allSettled([
      this.startScanner('process', new ProcessScanner(), 2000),
      this.startScanner('port', new PortScanner(), 5000),
      this.startScanner('window', new WindowManager(), 3000),
      this.startScanner('aiTask', new AITaskTracker(), 1000),
    ])
  }

  private async startScanner(name: string, scanner: BackgroundScanner, intervalMs: number) {
    // 首次全量扫描
    const data = await scanner.scan()
    this.cache.update(name, data)

    // 定时增量扫描
    const timer = setInterval(async () => {
      try {
        const newData = await scanner.scan()
        const diff = this.cache.diff(name, newData)
        if (diff.hasChanges) {
          this.cache.update(name, newData)
          this.pushToRenderer(name, diff)
        }
      } catch (err) {
        this.cache.setError(name, err.message)
      }
    }, intervalMs)

    this.scanners.set(name, { scanner, timer })
  }

  stopAll(): void {
    for (const [, { timer }] of this.scanners) {
      clearInterval(timer)
    }
    this.scanners.clear()
  }
}
```

### 7.2 Diff 算法

```typescript
interface ScannerDiff<T> {
  hasChanges: boolean
  added: T[]
  removed: T[]
  updated: Array<{ id: string; changes: Partial<T> }>
}

function computeDiff<T extends { id: string }>(
  prev: T[],
  next: T[]
): ScannerDiff<T> {
  const prevMap = new Map(prev.map(x => [x.id, x]))
  const nextMap = new Map(next.map(x => [x.id, x]))

  return {
    hasChanges: false,  // 计算后设置
    added: next.filter(x => !prevMap.has(x.id)),
    removed: prev.filter(x => !nextMap.has(x.id)),
    updated: next
      .filter(x => prevMap.has(x.id))
      .map(x => ({ id: x.id, changes: shallowDiff(prevMap.get(x.id)!, x) }))
      .filter(x => Object.keys(x.changes).length > 0),
  }
}
```

### 7.3 Renderer 端 Store 集成

```typescript
// Zustand store
interface MonitorStore {
  processes: ProcessInfo[]
  ports: PortInfo[]
  windows: WindowInfo[]
  aiTasks: AITaskInfo[]
  summary: SystemSummary
  initStatus: 'loading' | 'partial' | 'ready'

  // 初始化
  initialize: () => Promise<void>
  // 增量更新
  applyDiff: (type: string, diff: ScannerDiff<any>) => void
}
```

---

## 8. 验收标准

- [ ] 应用启动后 2 秒内完成进程首次扫描
- [ ] 应用启动后 3 秒内完成窗口首次扫描
- [ ] 切换 Tab 时无可感知的加载延迟（< 100ms）
- [ ] Dashboard 摘要面板在首次扫描完成后立即显示
- [ ] 后台扫描不中断，即使当前不在对应 Tab
- [ ] 内存占用增量 < 50MB（缓存所有扫描数据）
