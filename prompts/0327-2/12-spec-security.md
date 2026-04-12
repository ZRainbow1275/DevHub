# Security Spec — 安全加固技术规格

## SEC-P2-01: 保护进程列表

**位置**: `src/shared/types-extended.ts`

```typescript
export const PROTECTED_PROCESSES: ReadonlySet<string> = new Set([
  'csrss.exe', 'lsass.exe', 'smss.exe', 'wininit.exe', 'winlogon.exe',
  'services.exe', 'svchost.exe', 'dwm.exe', 'system', 'registry',
  'explorer.exe', 'runtimebroker.exe', 'taskhostw.exe', 'conhost.exe',
  'msmpeng.exe', 'searchindexer.exe', 'spoolsv.exe', 'audiodg.exe',
  'fontdrvhost.exe', 'sihost.exe', 'ctfmon.exe',
  'electron.exe', 'devhub.exe' // 自身保护
])

export function isProtectedProcess(name: string): boolean {
  return PROTECTED_PROCESSES.has(name.toLowerCase())
}
```

**检查点**:
- `SystemProcessScanner.killProcess()` 入口
- `PortScanner.releasePort()` 查 PID 对应进程名后
- `WindowManager.closeWindow()` 查窗口对应进程名后

---

## SEC-P2-02: DEV_PROCESS_PATTERNS 清理

**当前**:
```typescript
['node.exe', 'python.exe', ..., 'WindowsTerminal.exe', 'cmd.exe', 'powershell.exe', 'chrome.exe', 'msedge.exe', 'firefox.exe', ...]
```

**修改后**:
```typescript
export const DEV_PROCESS_PATTERNS = [
  // 运行时
  'node.exe', 'python.exe', 'python3.exe', 'java.exe', 'go.exe',
  'cargo.exe', 'rustc.exe', 'ruby.exe', 'php.exe', 'dotnet.exe',
  // IDE
  'code.exe', 'idea64.exe', 'pycharm64.exe', 'webstorm64.exe',
  'Cursor.exe', 'windsurf.exe',
  // 基础设施
  'docker.exe', 'redis-server.exe', 'mongod.exe', 'postgres.exe'
] as const
```

**移除**: powershell.exe, cmd.exe, WindowsTerminal.exe, chrome.exe, msedge.exe, firefox.exe

---

## SEC-P2-03: 僵尸检测收紧

**当前** (SystemProcessScanner.ts):
```typescript
findZombieProcesses(): ProcessInfo[] {
  return processes.filter(p => p.cpu < 1 && uptime > 1h)
}
cleanupZombies() { kill(pid, 'SIGKILL') } // 直接强杀
```

**修改为**:
```typescript
findZombieProcesses(): ProcessInfo[] {
  return processes.filter(p =>
    p.cpu < 0.5 &&
    p.memory < 10 && // MB
    (now - p.startTime) > 2 * 60 * 60 * 1000 && // 2 小时
    !isProtectedProcess(p.name) &&
    this.isDevServerProcess(p.name, p.command)
  )
}

async cleanupZombies(): Promise<number> {
  for (const zombie of zombies) {
    // 先 SIGTERM
    kill(zombie.pid, 'SIGTERM')
    // 等 5s
    await new Promise(r => setTimeout(r, 5000))
    // 检查是否还活着
    if (isProcessAlive(zombie.pid)) {
      kill(zombie.pid, 'SIGKILL')
    }
  }
}

private isDevServerProcess(name: string, cmd: string): boolean {
  const devRuntimes = ['node.exe', 'python.exe', 'ruby.exe', 'java.exe']
  const serverKeywords = ['dev', 'serve', 'start', 'watch', 'run']
  return devRuntimes.some(r => name.toLowerCase().includes(r)) &&
         serverKeywords.some(k => cmd.toLowerCase().includes(k))
}
```

---

## SEC-P2-04: 端口释放安全

**位置**: `src/main/services/PortScanner.ts`

```typescript
async releasePort(port: number): Promise<boolean> {
  const info = await this.checkPort(port)
  if (!info) return true

  // 1. 查进程名
  const processName = await this.getProcessName(info.pid)

  // 2. 保护进程检查
  if (isProtectedProcess(processName)) {
    console.warn(`Refused: port ${port} held by protected process ${processName}`)
    return false
  }

  // 3. 开发进程检查
  if (!DEV_PROCESS_PATTERNS.some(p => processName.toLowerCase() === p.toLowerCase())) {
    console.warn(`Refused: port ${port} held by non-dev process ${processName}`)
    return false
  }

  // 4. 审计日志
  auditLogger.log('port:release', { port, pid: info.pid, processName })

  return this.killProcessGracefully(info.pid)
}
```

---

## SEC-P2-05: 破坏性操作限速

**位置**: `src/main/utils/rateLimiter.ts`

```typescript
export const RATE_LIMITS = {
  SCAN: 12,
  ACTION: 30,
  QUERY: 60,
  DESTRUCTIVE: 5  // 新增
} as const
```

应用到:
- `PROCESS_KILL` → DESTRUCTIVE
- `PROCESS_CLEANUP_ZOMBIES` → DESTRUCTIVE
- `PORT_RELEASE` → DESTRUCTIVE

---

## SEC-P2-06: 审计日志

**新文件**: `src/main/services/AuditLogger.ts`

```typescript
import { app } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'

interface AuditEntry {
  timestamp: string
  action: string
  target: Record<string, unknown>
  result: 'success' | 'refused' | 'error'
  reason?: string
}

class AuditLogger {
  private logPath: string

  constructor() {
    this.logPath = join(app.getPath('userData'), 'devhub-audit.log')
  }

  log(action: string, target: Record<string, unknown>, result: 'success' | 'refused' | 'error', reason?: string): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      target,
      result,
      reason
    }
    appendFileSync(this.logPath, JSON.stringify(entry) + '\n')
  }
}

export const auditLogger = new AuditLogger()
```
