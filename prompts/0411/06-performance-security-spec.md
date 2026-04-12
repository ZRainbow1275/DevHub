# Spec: 性能优化与安全加固 [已后置]

> 关联 PRD: `00-prd-round3.md` § 3.6
> 优先级: ~~P0-Critical~~ → **后置**（R4 决策 2026-04-12）
> 层级: Full Stack
> **状态: 后置处理，不在当前开发批次中。本文档保留作为后期参考。**

---

## 1. 问题描述

### 1.1 性能
- 端口探查极慢（已有独立 spec）
- 扫描器 stopped 后不恢复
- 大量数据渲染可能卡顿
- IPC 高频调用可能瓶颈

### 1.2 安全
- 未配置 CSP
- IPC 参数缺乏校验
- PowerShell 命令可能存在注入风险
- 进程操作无安全防护

---

## 2. 性能优化

### 2.1 渲染优化

#### 虚拟滚动
项目已引入 `@tanstack/react-virtual`，需检查是否在以下列表中正确应用：
- [ ] 进程列表（可能 500+ 行）
- [ ] 端口列表（可能 100+ 行）
- [ ] 窗口列表（通常较少，但应预备）
- [ ] 日志面板（可能 10000+ 行）

#### Zustand Selector 粒度
```typescript
// ❌ 错误：每次 store 变化都 re-render
const { processes, ports, windows } = useScannerStore()

// ✅ 正确：仅订阅需要的字段
const processes = useScannerStore(s => s.processes)
```

检查所有 `useScannerStore` 调用的 selector 粒度。

#### React.memo / useMemo
- 卡片组件应使用 `React.memo` 避免无关 re-render
- 计算密集的派生数据使用 `useMemo`

#### 帧率目标
- 500+ 进程 + 100+ 端口场景：滚动帧率 ≥ 30fps
- 数据更新时的 re-render 不超过 16ms

### 2.2 后台扫描优化

#### 扫描器自动恢复
```typescript
class BackgroundScannerManager {
  private retryCount: Record<ScannerType, number> = { ... }
  private readonly MAX_RETRIES = 5

  private async handleScannerError(type: ScannerType, error: Error) {
    console.error(`Scanner ${type} failed:`, error)
    this.retryCount[type]++

    if (this.retryCount[type] <= this.MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, this.retryCount[type]), 30000)
      console.log(`Retrying ${type} scanner in ${delay}ms (attempt ${this.retryCount[type]})`)
      setTimeout(() => this.restartScanner(type), delay)
    } else {
      this.notifyRendererScannerFailed(type, error.message)
    }
  }

  private onScannerSuccess(type: ScannerType) {
    this.retryCount[type] = 0 // 成功后重置
  }
}
```

#### 动态扫描频率
| 状态 | 进程间隔 | 端口间隔 | 窗口间隔 | AI 任务间隔 |
|------|---------|---------|---------|-----------|
| 窗口聚焦 | 2s | 5s | 3s | 2s |
| 窗口最小化 | 10s | 30s | 10s | 5s |
| 窗口失去焦点 | 5s | 15s | 5s | 3s |

```typescript
// 监听窗口状态变化
mainWindow.on('focus', () => scannerManager.setFrequency('active'))
mainWindow.on('blur', () => scannerManager.setFrequency('inactive'))
mainWindow.on('minimize', () => scannerManager.setFrequency('minimized'))
```

#### 差分传输
- 扫描结果使用 diff 算法（已有 `ScannerDiff`），确认其正确使用
- 避免全量推送：只推送 added/removed/updated

### 2.3 内存管理
- **进程数据上限**：缓存最多 2000 条进程记录，超过则按最后更新时间淘汰
- **日志数据上限**：每个项目最多保留最近 50000 行日志
- **定期清理**：每 5 分钟检查一次缓存大小
- **内存监控**：定期记录 `process.memoryUsage()`，超过阈值（如 500MB）触发警告

### 2.4 IPC 优化
- **批量推送**：将多个小消息合并为一次 IPC 调用
  ```typescript
  // ❌ 每条变更单独推送
  diffs.forEach(d => win.webContents.send('diff', d))

  // ✅ 批量推送
  win.webContents.send('batch-diff', diffs)
  ```
- **限流**：相同类型的 IPC 消息限制发送频率（如 50ms 一次）
- **大对象传输**：超过 1MB 的数据使用分片传输或 SharedArrayBuffer

---

## 3. 安全加固

### 3.1 CSP (Content Security Policy)

#### 生产环境
```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",  // Tailwind 需要
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src 'none'"
      ].join('; ')
    }
  })
})
```

#### 开发环境
```typescript
// 允许 Vite dev server
"script-src 'self' http://localhost:* http://127.0.0.1:*"
"connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
```

### 3.2 IPC 参数校验

#### 校验框架
```typescript
import { z } from 'zod' // 或使用内置校验

// 定义 schema
const killProcessSchema = z.object({
  pid: z.number().int().positive(),
  force: z.boolean().optional()
})

// IPC handler 中校验
ipcMain.handle('process:kill', async (_, rawArgs) => {
  const args = killProcessSchema.parse(rawArgs) // 失败则抛出
  // ... 执行操作
})
```

#### 必须校验的 IPC 通道
| 通道 | 风险 | 校验内容 |
|------|------|---------|
| `process:kill` | 高 | PID 合法性、非系统进程 |
| `window:focus` | 中 | HWND 合法性 |
| `window:setPosition` | 低 | 坐标范围 |
| `projects:add` | 中 | 路径合法性、不含特殊字符 |
| `scanner:*` | 低 | 参数类型检查 |

### 3.3 PowerShell 注入防护

#### 当前风险
```typescript
// ❌ 危险：直接拼接用户输入
exec(`powershell -Command "Get-Process -Name '${userInput}'"`)
```

#### 修复
```typescript
// ✅ 安全：使用参数化
const args = ['-Command', 'Get-Process', '-Name', sanitizedName]
execFile('powershell.exe', args)

// ✅ 安全：转义特殊字符
function sanitizePowerShellArg(arg: string): string {
  return arg.replace(/[`$"'(){}|&;<>]/g, '`$&')
}
```

#### 审查清单
- [ ] 全文搜索 `exec(` 和 `execSync(`，检查是否有用户输入直接拼接
- [ ] 全文搜索 `powershell`，检查命令构造方式
- [ ] 将所有 `exec()` 替换为 `execFile()` + 参数数组

### 3.4 进程操作安全

#### 系统进程保护
```typescript
const PROTECTED_PIDS = new Set([0, 4]) // System Idle, System
const PROTECTED_NAMES = new Set([
  'csrss.exe', 'wininit.exe', 'winlogon.exe',
  'services.exe', 'svchost.exe', 'lsass.exe',
  'smss.exe', 'dwm.exe', 'explorer.exe'
])

function canKillProcess(pid: number, name: string): { allowed: boolean; reason?: string } {
  if (PROTECTED_PIDS.has(pid)) {
    return { allowed: false, reason: '系统核心进程，禁止操作' }
  }
  if (PROTECTED_NAMES.has(name.toLowerCase())) {
    return { allowed: false, reason: `${name} 是系统关键进程，终止可能导致系统不稳定` }
  }
  if (pid === process.pid) {
    return { allowed: false, reason: '不能终止 DevHub 自身进程' }
  }
  return { allowed: true }
}
```

#### 二次确认
- 结束进程 → 弹出确认对话框："确定要结束进程 {name} (PID: {pid}) 吗？"
- 结束进程树 → 更强烈的警告："这将结束 {name} 及其所有子进程（共 {count} 个），确定吗？"

#### 操作日志
```typescript
interface ProcessActionLog {
  timestamp: number
  action: 'kill' | 'kill-tree' | 'set-priority'
  pid: number
  processName: string
  result: 'success' | 'failed'
  error?: string
}
```

### 3.5 数据存储安全

- [ ] `electron-store` 文件权限：确认仅当前用户可读写
- [ ] **不缓存进程环境变量**：环境变量可能含 API Key/Token/Password
- [ ] 清理缓存时确保彻底删除（非仅删引用）
- [ ] 日志中不输出敏感数据（环境变量值、文件内容）

### 3.6 依赖安全
```bash
# 定期执行
pnpm audit
pnpm audit --fix  # 自动修复可修复的漏洞
```
- [ ] CI/CD 中集成 `pnpm audit` 检查
- [ ] 关注 Electron 安全公告

---

## 4. 验收标准

### 性能
- [ ] 500+ 进程列表滚动帧率 ≥ 30fps
- [ ] 扫描器异常后 30s 内自动恢复
- [ ] Electron 主进程内存 < 300MB（常态）
- [ ] IPC 消息频率不超过 20次/秒
- [ ] 虚拟滚动正确应用于所有长列表

### 安全
- [ ] CSP 配置生效（DevTools Console 无 CSP 警告）
- [ ] 所有高风险 IPC handler 有参数校验
- [ ] 无 PowerShell 命令注入向量
- [ ] 系统关键进程无法被终止
- [ ] `pnpm audit` 无 high/critical 漏洞
- [ ] 进程环境变量不被缓存到磁盘

---

## 5. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/index.ts` | 修改 | CSP 配置 |
| `src/main/services/BackgroundScannerManager.ts` | 修改 | 自动恢复、动态频率 |
| `src/main/services/ScannerCache.ts` | 修改 | 内存上限、定期清理 |
| `src/main/ipc/*.ts` | 修改 | 参数校验、批量推送 |
| `src/main/services/WindowManager.ts` | 修改 | PowerShell 注入防护 |
| `src/main/services/SystemProcessScanner.ts` | 修改 | 进程保护列表 |
| `src/renderer/stores/scannerStore.ts` | 检查 | selector 粒度 |
| `src/renderer/components/monitor/*.tsx` | 检查 | 虚拟滚动、React.memo |
