# Batch 2 & 3 执行清单

> 基于验证报告 `10-batch2-batch3-verification.md`
> 状态: 准备阶段 ✅

---

## 前置条件 (P0)

- [ ] **建立 Git 版本控制** (CRITICAL)
  ```bash
  cd D:/Desktop/CREATOR ONE/devhub
  git init
  git add .
  git commit -m "Initial commit - DevHub project (Batch 1 completed)"
  git log --oneline  # 验证成功
  ```
  - 影响: 后续所有 Batch 2/3 修改必须有版本历史

---

## Batch 2: 性能优化 + 无障碍 (6 项)

### PERF-01: 虚拟化监控视图

#### Task 1: ProcessView 虚拟化
- [ ] 文件: `src/renderer/components/monitor/ProcessView.tsx`
- [ ] 当前: 使用 `.map()` 直接渲染，第 78 行 `animationDelay: ${index * 50}ms`
- [ ] 修复方案:
  ```tsx
  import { useVirtualizer } from '@tanstack/react-virtual'

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filteredProcesses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT, // ~100px
    overscan: 5
  })

  // 使用 virtualizer.getVirtualItems() 替代 .map()
  ```
- [ ] 预期收益: 1000 进程 → DOM 从 1000+ 降至 ~20
- [ ] 验证: 加载 1000+ 进程时滚动流畅度 ✅

#### Task 2: PortView 虚拟化
- [ ] 文件: `src/renderer/components/monitor/PortView.tsx`
- [ ] 当前: 同样无虚拟化，第 52 行 `animationDelay: ${index * 50}ms`
- [ ] 修复方案: 参考 Task 1 的实现
- [ ] 预期收益: 同上
- [ ] 验证: 加载 1000+ 端口时滚动流畅度 ✅

#### Task 3: AITaskView 虚拟化 (如存在)
- [ ] 文件: `src/renderer/components/monitor/AITaskView.tsx`
- [ ] 当前: 检查是否有 history 列表需虚拟化
- [ ] 修复方案: 参考 Task 1
- [ ] 验证: 加载 1000+ 任务历史时流畅度 ✅

---

### PERF-02: 修复动画延迟线性增长

#### Task 4: ProcessView 动画延迟修复
- [ ] 文件: `src/renderer/components/monitor/ProcessView.tsx`
- [ ] 当前: 第 78 行 `style={{ animationDelay: ${index * 50}ms }}`
- [ ] 修复:
  ```tsx
  // 方案 A: 限制最大延迟
  const delay = Math.min(index * 50, 500) // 最多 500ms

  // 方案 B: 仅可见项有延迟
  const delay = isInViewport ? Math.min(visibleIndex * 30, 300) : 0
  ```
- [ ] 选择方案: **方案 A**（简单可靠）
- [ ] 验证: 1000+ 项目时最后一项在 500ms 内出现动画 ✅

#### Task 5: PortView 动画延迟修复
- [ ] 文件: `src/renderer/components/monitor/PortView.tsx`
- [ ] 当前: 第 52 行 `style={{ animationDelay: ${index * 50}ms }}`
- [ ] 修复: 同 Task 4

#### Task 6: MonitorPanel Tab 动画延迟修复
- [ ] 文件: `src/renderer/components/monitor/MonitorPanel.tsx`
- [ ] 当前: 第 82 行 `animationDelay: ${index * 50}ms`
- [ ] 修复: 同 Task 4
- [ ] 注意: Tab 数量通常 < 10，此修复优先级较低

---

### PERF-03: 实现可见性感知轮询

#### Task 7: 创建 useVisibilityAwarePolling Hook
- [ ] 文件: 新建 `src/renderer/hooks/useVisibilityAwarePolling.ts`
- [ ] 实现:
  ```typescript
  import { useEffect } from 'react'

  export function useVisibilityAwarePolling(
    callback: () => void,
    intervalMs: number
  ): void {
    useEffect(() => {
      const [isVisible, setIsVisible] = React.useState(!document.hidden)

      const handler = () => setIsVisible(!document.hidden)
      document.addEventListener('visibilitychange', handler)

      return () => {
        document.removeEventListener('visibilitychange', handler)
      }
    }, [])

    useEffect(() => {
      if (!isVisible) return

      callback()
      const id = setInterval(callback, intervalMs)
      return () => clearInterval(id)
    }, [isVisible, intervalMs, callback])
  }
  ```
- [ ] 验证:
  - [ ] 应用最小化时轮询停止 ✅
  - [ ] 恢复前台时轮询继续 ✅
  - [ ] 后台 CPU 占用下降 ✅

#### Task 8: 集成到各轮询服务 (Renderer)
- [ ] ProcessView: 使用 hook 替代直接 setInterval
- [ ] PortView: 使用 hook 替代直接 setInterval
- [ ] AITaskView: 使用 hook 替代直接 setInterval
- [ ] 验证: 各视图在后台标签页时不更新 ✅

#### Task 9: 集成到各轮询服务 (Main Process) - 可选
- [ ] SystemProcessScanner: 考虑集成应用 visibility 事件
- [ ] AITaskTracker: 考虑集成应用 visibility 事件
- [ ] ToolMonitor: 考虑集成应用 visibility 事件
- [ ] 技术方案: 通过 IPC 监听应用 show/hide 事件
- [ ] 预期收益: 后台 CPU 使用降低 90%+

---

### A11Y-01: 补充 ARIA 属性

#### Task 10: MonitorPanel Tab 无障碍
- [ ] 文件: `src/renderer/components/monitor/MonitorPanel.tsx`
- [ ] 当前: 第 69-88 行 Tab 导航
- [ ] 修复:
  ```tsx
  {TABS.map((tab, index) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls={`panel-${tab.id}`}
      tabIndex={activeTab === tab.id ? 0 : -1}
      // ... 其他属性
    >
      {tab.icon}
      <span className="hidden sm:inline">{tab.label}</span>
    </button>
  ))}
  ```
- [ ] 对应面板:
  ```tsx
  <div
    role="tabpanel"
    id={`panel-${tab.id}`}
    aria-labelledby={`tab-${tab.id}`}
  >
    {/* 内容 */}
  </div>
  ```
- [ ] 验证:
  - [ ] Tab 顺序正确 ✅
  - [ ] 屏幕阅读器识别 Tab 和 Panel 关系 ✅
  - [ ] 键盘导航可用 ✅

#### Task 11: ContextMenu 无障碍
- [ ] 文件: `src/renderer/components/ui/ContextMenu.tsx`
- [ ] 当前: 第 66-100 行菜单结构
- [ ] 修复:
  ```tsx
  <div
    ref={menuRef}
    role="menu"
    aria-label="Context menu"
    // ... 其他属性
  >
    {items.map((item, index) => {
      if (item.divider) {
        return <div key={`divider-${index}`} role="separator" />
      }
      return (
        <button
          key={item.key}
          role="menuitem"
          onClick={item.onClick}
          disabled={item.disabled}
          // ... 其他属性
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      )
    })}
  </div>
  ```
- [ ] 验证:
  - [ ] 屏幕阅读器识别菜单 ✅
  - [ ] Escape 关闭菜单 ✅

#### Task 12: ScriptSelector 无障碍
- [ ] 文件: `src/renderer/components/ui/ScriptSelector.tsx`
- [ ] 当前: 第 40-82 行下拉菜单
- [ ] 修复:
  ```tsx
  <div className="relative" ref={menuRef}>
    <button
      onClick={() => setIsOpen(!isOpen)}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls="script-listbox"
      // ... 其他属性
    >
      {/* 按钮内容 */}
    </button>

    {isOpen && (
      <div
        id="script-listbox"
        role="listbox"
        className="absolute right-0 top-full mt-1 ..."
      >
        {scripts.map(script => (
          <button
            key={script}
            role="option"
            aria-selected={script === defaultScript}
            onClick={() => {
              onSelect(script)
              setIsOpen(false)
            }}
            // ... 其他属性
          >
            <span className="font-mono">{script}</span>
            {script === defaultScript && (
              <span className="text-[10px] text-text-muted">(默认)</span>
            )}
          </button>
        ))}
      </div>
    )}
  </div>
  ```
- [ ] 键盘导航:
  - [ ] 上/下箭头在选项间移动
  - [ ] Enter/Space 确认选择
  - [ ] Escape 关闭菜单
  - [ ] Tab 进入/离开菜单
- [ ] 验证:
  - [ ] 屏幕阅读器正确识别 ✅
  - [ ] 键盘完全可操作 ✅

---

## Batch 3: 架构重构 (2 项)

### ARCH-01: 系统命令统一抽象层

#### Task 13: 创建 SystemCommandRunner 服务
- [ ] 文件: 新建 `src/main/services/SystemCommandRunner.ts`
- [ ] 接口定义:
  ```typescript
  export interface CommandResult<T> {
    success: boolean
    data?: T
    error?: string
    duration: number
  }

  export class SystemCommandRunner {
    async getProcessList(): Promise<CommandResult<ProcessInfo[]>>
    async getNetstat(): Promise<CommandResult<PortInfo[]>>
    async getWindowList(): Promise<CommandResult<WindowInfo[]>>
    async killProcess(pid: number): Promise<CommandResult<void>>
    async getWmicData(query: string): Promise<CommandResult<any>>
  }
  ```
- [ ] 实现特性:
  - [ ] 统一错误处理
  - [ ] 统一日志记录
  - [ ] 结果缓存（5s）
  - [ ] 速率限制（防 PowerShell 并发）
- [ ] 迁移服务:
  - [ ] ProcessManager (使用 spawn，基本保留)
  - [ ] PortScanner (迁移 netstat → 使用 SystemCommandRunner)
  - [ ] SystemProcessScanner (迁移 WMIC → 使用 SystemCommandRunner)
  - [ ] AITaskTracker (迁移 WMIC → 使用 SystemCommandRunner)
  - [ ] ToolMonitor (迁移 tasklist → 使用 SystemCommandRunner)
  - [ ] WindowManager (迁移 PowerShell → 使用 SystemCommandRunner)
- [ ] 验证:
  - [ ] 所有服务正常工作 ✅
  - [ ] WMIC 命令能顺利替换为 Get-CimInstance ✅
  - [ ] 日志输出统一 ✅

#### Task 14: 创建 PollingScheduler 统一调度器
- [ ] 文件: 新建 `src/main/services/PollingScheduler.ts`
- [ ] 接口定义:
  ```typescript
  interface PollingJob {
    id: string
    interval: number
    handler: () => Promise<void>
    priority: 'high' | 'normal' | 'low'
    lastRun?: number
    nextRun?: number
  }

  export class PollingScheduler {
    register(id: string, config: Omit<PollingJob, 'id'>): void
    unregister(id: string): void
    pause(): void  // 应用最小化时
    resume(): void // 应用恢复前台时
    private tick(): void  // 主轮询循环
  }
  ```
- [ ] 实现特性:
  - [ ] 集中管理所有轮询任务
  - [ ] 支持优先级调度
  - [ ] 应用最小化时自动暂停
  - [ ] 结果共享（如 process scan 和 port scan 的 PID 映射）
  - [ ] 动态调整频率
- [ ] 迁移服务:
  - [ ] SystemProcessScanner.startAutoRefresh() → scheduler.register('system-processes')
  - [ ] AITaskTracker.startTracking() → scheduler.register('ai-tasks')
  - [ ] ToolMonitor.start() → scheduler.register('tool-monitor')
- [ ] 验证:
  - [ ] 应用最小化时所有轮询暂停 ✅
  - [ ] 应用恢复时轮询继续 ✅
  - [ ] CPU 占用显著下降 ✅
  - [ ] 结果正确性不变 ✅

---

## 验收标准

### Batch 2 验收

| 项目 | 标准 | 测试方法 |
|------|------|---------|
| PERF-01 虚拟化 | 1000+ 项目加载不卡顿 | 加载测试数据，滚动观察 FPS |
| PERF-02 动画延迟 | 最长延迟 ≤ 500ms | 检查最后一项的 animationDelay 值 |
| PERF-03 可见性 | 后台标签页无更新 | 最小化应用，观察网络/日志 |
| A11Y-01 ARIA | 屏幕阅读器可用 | 使用 NVDA/JAWS/VoiceOver 测试 |
| A11Y-01 键盘 | 完全键盘可操作 | 禁用鼠标，使用 Tab/箭头/Enter |

### Batch 3 验收

| 项目 | 标准 | 测试方法 |
|------|------|---------|
| ARCH-01 抽象 | 所有命令调用来自 SystemCommandRunner | Grep 验证无直接 execFile 调用 |
| ARCH-01 WMIC 迁移 | 可轻松切换为 Get-CimInstance | 验证代码中 WMIC 调用集中 |
| ARCH-02 调度 | 所有轮询通过 PollingScheduler | Grep 验证无独立 setInterval |
| ARCH-02 最小化 | 最小化时 CPU ↓90% | 测量最小化前后 CPU 占用 |

---

## 时间估算

| Phase | 任务数 | 估算工作量 |
|-------|--------|-----------|
| 前置条件 | 1 | 5 分钟 |
| **Batch 2 - 虚拟化** | 3 | 3 × 2h = 6h |
| **Batch 2 - 动画延迟** | 3 | 3 × 0.5h = 1.5h |
| **Batch 2 - 可见性轮询** | 3 | 2h (hook) + 2h (集成) = 4h |
| **Batch 2 - 无障碍** | 3 | 3 × 1h = 3h |
| **Batch 3 - 抽象层** | 1 | 3h (实现) + 3h (迁移) = 6h |
| **Batch 3 - 调度器** | 1 | 2h (实现) + 2h (集成) = 4h |
| **总计** | 14 | ~24.5h (~3 个开发日) |

---

## 注意事项

### 通用

- [ ] 所有修改必须在 Git 分支上进行（之后创建 PR）
- [ ] 保持现有的代码风格和约定
- [ ] 避免引入新的依赖（除非必要）
- [ ] 更新相关的 TypeScript 类型定义

### Batch 2 特别注意

- [ ] 虚拟化实现时需注意 `estimateSize` 的准确性
- [ ] 动画延迟修改时保留原有的视觉效果（延迟只是上限）
- [ ] A11Y 修改时使用自动化工具验证（如 axe DevTools）

### Batch 3 特别注意

- [ ] SystemCommandRunner 的缓存机制需与业务逻辑协调
- [ ] PollingScheduler 需处理任务异常不中断其他任务
- [ ] 迁移时逐服务测试，确保功能正确性
- [ ] 关注性能：调度器的 tick 循环需保持高效

---

## 相关文档

- 原始审查报告: `00-review-summary.md`
- 验证报告: `10-batch2-batch3-verification.md`
- 性能规格: `03-spec-performance.md`
- 无障碍规格: `04-spec-a11y-ux.md`
- 架构规格: `05-spec-architecture.md`
- Batch 2 PRD: `11-prd-batch2.md`
- Batch 3 PRD: `12-prd-batch3.md`
