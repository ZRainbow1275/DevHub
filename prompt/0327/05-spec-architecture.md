# Architecture Spec — DevHub 架构重构规格

> 优先级: MEDIUM (Batch 3)
> 影响范围: main process 服务层

---

## ARCH-01: 统一系统命令抽象层

**问题**:
6 个服务直接调用 PowerShell/WMIC/netstat，无统一抽象:
- ProcessManager → spawn
- PortScanner → netstat + WMIC
- SystemProcessScanner → WMIC
- AITaskTracker → WMIC + PowerShell
- WindowManager → PowerShell
- ToolMonitor → tasklist

**修复方案**:
```typescript
// services/SystemCommandRunner.ts
interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
}

class SystemCommandRunner {
  async getProcessList(): Promise<CommandResult<ProcessInfo[]>> { ... }
  async getNetstat(): Promise<CommandResult<PortInfo[]>> { ... }
  async getWindowList(): Promise<CommandResult<WindowInfo[]>> { ... }
  async killProcess(pid: number): Promise<CommandResult<void>> { ... }
}
```

**收益**:
1. WMIC → Get-CimInstance 迁移只需改一处
2. 可添加统一缓存（5s 内的 process list 共享）
3. 可添加统一错误处理和日志
4. 可添加统一速率限制

---

## ARCH-02: 统一轮询调度器

**问题**:
每个监控视图和服务独立 setInterval，导致:
- 后台标签页浪费资源
- 多个 PowerShell 进程并发
- 无法协调扫描频率
- 扫描结果不共享

**修复方案**:
```typescript
// main process
class PollingScheduler {
  private jobs: Map<string, PollingJob> = new Map();

  register(id: string, config: {
    interval: number;
    handler: () => Promise<void>;
    priority: 'high' | 'normal' | 'low';
  }): void;

  pause(): void;   // 当应用最小化时
  resume(): void;  // 当应用恢复前台时

  // Smart batching: 合并同时段的扫描
  private tick(): void;
}
```

**收益**:
1. 应用最小化时自动降频或暂停
2. 可合并 process scan + port scan 的 PID 查询
3. 统一管理所有定时器

---

## ARCH-03: 显式状态机

**问题**:
项目和进程的状态转换是隐式的（通过 if-else），缺乏显式状态机:
- 项目状态: idle → starting → running → stopping → stopped / error
- 进程状态: scanning → detected → tracked → completed / lost

**修复方案**:
使用有限状态机（FSM）模式:
```typescript
type ProjectState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
type ProjectEvent = 'START' | 'STARTED' | 'STOP' | 'STOPPED' | 'ERROR' | 'RESET';

const projectStateMachine: Record<ProjectState, Partial<Record<ProjectEvent, ProjectState>>> = {
  idle: { START: 'starting' },
  starting: { STARTED: 'running', ERROR: 'error' },
  running: { STOP: 'stopping', ERROR: 'error' },
  stopping: { STOPPED: 'stopped', ERROR: 'error' },
  stopped: { START: 'starting' },
  error: { RESET: 'idle', START: 'starting' },
};
```

**收益**: 防止非法状态转换，使并发操作更安全。

---

## ARCH-04: 代码生成脚本清理

**问题**:
`scripts/update-projectlist.cjs`, `update-sidebar.cjs`, `update-toolmonitor.cjs` 是代码生成器，
但生成的文件已被手动修改，脚本与实际代码不同步。

**修复方案**:
1. 确认脚本生成的代码与当前代码的差异
2. 如果当前代码更优，删除脚本
3. 如果需要保留生成能力，将配置迁移到 JSON/YAML 而非硬编码
4. 在 package.json 中移除或标记为废弃

---

## ARCH-05: 渲染进程扫描逻辑迁移

**问题**:
当前扫描操作由渲染进程的 useEffect + setInterval 触发 IPC 调用。
这意味着渲染进程控制了扫描节奏。

**修复方案**:
主进程统一调度扫描，通过 push 模式将数据发送到渲染进程:
```
当前: Renderer setInterval → IPC invoke → Main scan → return data
目标: Main PollingScheduler → scan → IPC send → Renderer update store
```

**收益**:
1. 渲染进程无需管理轮询
2. 主进程可智能合并扫描
3. 多窗口场景下不会重复扫描
