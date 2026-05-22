# contracts/24 — 权限控制规格

> 目的：统一 DevHub 在 Windows 上对系统资源的访问权限策略
> 关联：spec/14（进程权限降级）、spec/07（窗口标题修改）、spec/12（kill 进程）

---

## 一、权限分层模型

```
Layer 0: Renderer 进程（无任何系统权限）
  ├─ 仅能通过 preload.ts 白名单通道调用 IPC
  └─ 不得直接访问 node / child_process / ffi

Layer 1: Main 进程 — 普通用户权限
  ├─ 可访问当前用户的进程/窗口/端口信息
  ├─ 可 kill 自己的进程
  └─ 可 SetWindowText 自己窗口，但对受保护进程的窗口 access-denied

Layer 2: Main 进程 — 管理员权限（通过 app:relaunch-as-admin 触发）
  ├─ 可访问所有进程（含 System / svchost 等受保护）
  ├─ 可 kill 其他用户进程
  ├─ 可 SetWindowText 所有窗口
  └─ 可读 WMI 所有命名空间
```

---

## 二、权限探测

### 2.1 ProcessAccessProbe (spec/14)

```typescript
// main/services/process-access/AccessProbe.ts
export class ProcessAccessProbe {
  static async probe(pid: number): Promise<AccessReport> {
    const currentUser = await getCurrentUsername()
    const elevationRequired = !await isElevated()

    try {
      const handle = await openProcess(pid, PROCESS_QUERY_LIMITED_INFORMATION)
      if (!handle) return {
        pid, elevationRequired, scanAttempted: true,
        scanResult: 'access-denied', currentUser,
        suggestion: elevationRequired ? 'relaunch-as-admin' : 'none',
        triedAt: Date.now()
      }
      // ...
    } catch (e) {
      return { /* access-denied */ }
    }
  }
}
```

### 2.2 isElevated

```typescript
// main/services/elevation/ElevationProbe.ts
export async function isElevated(): Promise<boolean> {
  // Windows: check TokenElevation via advapi32
  // fallback: try 'net session' — non-elevated returns 'Access is denied'
}
```

---

## 三、管理员重启 (spec/14)

### 3.1 AdminRelaunch

```typescript
export class AdminRelaunch {
  static async relaunch(): Promise<{ ok: boolean; reason?: string }> {
    try {
      const execPath = app.getPath('exe')
      const { spawn } = require('child_process')
      // ShellExecute 'runas' verb → triggers UAC
      await spawn('powershell', [
        '-NoProfile',
        '-Command',
        `Start-Process -FilePath '${execPath}' -Verb RunAs`
      ], { detached: true, stdio: 'ignore' })
      setTimeout(() => app.quit(), 500)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, reason: e?.message ?? 'unknown' }
    }
  }
}
```

### 3.2 UAC 结果处理

- 用户确认 → 旧实例退出，新实例以管理员启动
- 用户取消 → 返回 `ADMIN_RELAUNCH_DENIED`，面板显示"已取消重启"
- 写自身路径失败 → `ADMIN_RELAUNCH_IO_ERROR`，建议用户手动右键"以管理员身份运行"

---

## 四、破坏性操作确认

### 4.1 Kill 进程

```typescript
// renderer/api/process.ts
async function killProcess(pid: number, name: string): Promise<boolean> {
  const confirmed = await confirmDialog({
    title: '结束进程',
    message: `确认结束进程 ${name} (PID ${pid})？`,
    description: '未保存的工作将丢失。',
    confirmText: '结束',
    confirmStyle: 'destructive',
    requiresTyping: pid > 1000 ? null : name  // 系统进程需打字确认
  })
  if (!confirmed) return false
  return window.api.invoke('process:kill', { pid })
}
```

### 4.2 Close 窗口 vs Kill

| 操作 | 含义 | 确认级别 |
|------|------|---------|
| Close | 发 WM_CLOSE，允许程序保存 | 无或 toast |
| Kill | TerminateProcess，强制结束 | 对话框 + 打字确认（对 PID < 1000） |

---

## 五、SetWindowText 权限

### 5.1 规则

| 目标窗口 | 当前权限 | 结果 |
|---------|---------|------|
| 当前用户的非系统进程窗口 | 普通 | 成功 |
| 当前用户的系统进程窗口 | 普通 | access-denied |
| 其他用户的窗口 | 普通 | access-denied |
| 任意窗口 | 管理员 | 成功（除 UIPI 保护） |

### 5.2 降级

若 SetWindowText 失败：
1. 若是 UIPI → "该窗口受 UIPI 保护，无法修改标题"
2. 若是 access-denied → 提示"以管理员重启"
3. 若成功但 WM_SETTEXT 被目标应用覆盖 → 显示警告"目标应用会自我重置标题"

---

## 六、文件系统操作

| 操作 | 路径 | 权限 |
|------|------|------|
| 读项目 package.json | 用户项目目录 | read |
| 写 electron-store | `%APPDATA%/DevHub/` | read-write |
| 写 log | `%APPDATA%/DevHub/logs/` | read-write |
| 写截图 | `%TEMP%/DevHub-screenshots/` | read-write |
| 读系统目录 | C:\Windows, C:\Program Files | read-only（用户权限受限） |

文件操作全部经 `FsSandbox.ts` 白名单校验，拒绝穿越。

---

## 七、WMI / PowerShell 沙箱

PowerShellGateway (spec/03) 对每条命令做：

1. **白名单参数**：只允许预定义 cmdlet（`Get-Process`, `Get-CimInstance Win32_Process/Win32_Service`, `Get-NetTCPConnection` 等）
2. **参数注入防护**：所有用户输入使用 `execFile` 的参数数组，禁用 shell 拼接
3. **超时**：执行超时强制 `tree-kill(pid, 'SIGKILL')`
4. **资源配额**：并发 ≤ 2；每秒 ≤ 5 次；每命令 stdout ≤ 8 MB

---

## 八、Preload 白名单

```typescript
// preload.ts
const ALLOWED_INVOKE = new Set([
  'process:get-list', 'process:get-deep-detail', 'process:probe-access', 'process:kill',
  'port:get-list', 'port:get-detail-incremental', 'port:switch-query-mode',
  'window:get-list', 'window:focus', 'window:minimize', /* ... 见 contracts/23 ... */,
  // ...
])

contextBridge.exposeInMainWorld('api', {
  invoke: async (channel: string, ...args: any[]) => {
    if (!ALLOWED_INVOKE.has(channel)) throw new Error(`IPC not allowed: ${channel}`)
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, fn: (...args: any[]) => void) => {
    if (!channel.startsWith('broadcast:')) throw new Error(`Subscribe denied: ${channel}`)
    ipcRenderer.on(channel, (_, ...args) => fn(...args))
  }
})
```

严格的 `contextIsolation: true` + `nodeIntegration: false`。

---

## 九、错误矩阵

| 错误码 | 含义 | 恢复 |
|-------|-----|------|
| `PERM_ADMIN_REQUIRED` | 操作需 admin 但当前非 admin | 提示重启 |
| `PERM_ACCESS_DENIED` | ACL 拒绝 | 显示 reason |
| `PERM_UIPI_BLOCKED` | 低完整性进程想访问高完整性 | 无恢复 |
| `PERM_DEV_ONLY` | 生产环境调用 dev-only 通道 | reject |
| `PERM_CHANNEL_BLOCKED` | IPC 通道不在白名单 | 报错（DEV 模式）/ 静默（prod） |

---

## 十、审计日志

所有权限敏感操作写入 `%APPDATA%/DevHub/logs/security-audit.log`：

```json
{"ts":1712345678,"op":"process:kill","pid":1234,"name":"node.exe","user":"ZRainbow","outcome":"success"}
{"ts":1712345679,"op":"app:relaunch-as-admin","user":"ZRainbow","outcome":"user-cancelled"}
{"ts":1712345680,"op":"window:set-title","hwnd":12345,"oldTitle":"…","newTitle":"Claude/Fix login bug","user":"ZRainbow","outcome":"win32-error:access-denied"}
```

---

## 十一、验收

- [ ] 所有破坏性操作有确认 UI
- [ ] Kill PID < 1000 需打字确认
- [ ] SetWindowText 失败给出 actionable 提示
- [ ] 管理员重启流程可走通
- [ ] preload 白名单 100% 覆盖 contracts/23
- [ ] 审计日志按天轮转，保留 30 天


---

## 十二、2026-04-30 实现快照：X3 TEST-PASS

本轮将 `contracts/24` 的审计日志要求落到真实主进程实现，并已通过真实 Electron E2E 验证窗口敏感操作会写入 `userData/logs/security-audit.log`。

### 12.1 AuditLogger 落盘与保留策略

- `devhub/src/main/services/AuditLogger.ts` 保持既有 `log(action, target, result, reason?)` API，避免破坏 `processHandlers` 与 `PortScanner` 的现有调用。
- 默认路径从旧的 `app.getPath('userData')/devhub-audit.log` 迁移为 `app.getPath('userData')/logs/security-audit.log`，对应 Windows `%APPDATA%/DevHub/logs/security-audit.log`。
- 单条日志同时保留旧字段 `timestamp/action/target/result/reason`，并新增 `ts/op/outcome`，使审计记录兼容旧调用和本规格第十节示例。
- 日志写入前会创建 `logs/` 目录；若当前 `security-audit.log` 的文件日期不是写入日期，则轮转为 `security-audit-YYYY-MM-DD.log`；轮转日志默认保留 30 天。
- 审计写入失败只写 main 进程 console 错误，不阻断原敏感操作返回路径，避免审计设备临时故障导致 UI 卡死。

### 12.2 敏感操作覆盖

- 既有进程/端口审计继续覆盖：`process:kill`、`process:cleanup-zombies`、`process:kill-tree`、`process:set-priority`、`app:relaunch-as-admin`、`port:release`。
- 新增窗口审计覆盖：`window:move`、`window:close`、`window:create-group`、`window:remove-group`、`window:rename-group`、`window:save-layout`、`window:restore-layout`、`window:remove-layout`、`window:apply-layout`、`window:save-snapshot`、`window:update-snapshot`、`window:delete-snapshot`、`window:restore-snapshot`、`window:restore-previous`、`window:tile-group`、`window:minimize-group`、`window:close-group`、`window:set-topmost`、`window:set-opacity`、`window:set-title`、`window:send-keys`、`window:tile-layout`、`window:cascade-layout`、`window:stack-layout`、`window:minimize-all`、`window:restore-all`、`window:add-to-group`、`window:restore-group`、`window:screenshot`、`window:toggle-favorite`、`window:open-working-dir`。
- `window:set-title` 的审计 target 记录 `newTitleLength` 与 `newTitlePreview`，不完整落盘潜在敏感标题全文；真实 Win32 返回结果仍通过 `result/outcome/reason` 表达。

### 12.3 自动验证

- `pnpm typecheck` 通过。
- `pnpm exec vitest run src/main/services/AuditLogger.test.ts src/main/ipc/windowHandlers.audit.test.ts src/main/services/PortScanner.test.ts src/main/services/WindowManager.test.ts src/main/store/AppStore.test.ts` 通过，合计 74 个 targeted tests。
- `pnpm lint` 通过，并通过 `check:no-emoji`，输出 `No emoji found in 207 files.`。
- `git diff --check -- src/main/services/AuditLogger.ts src/main/services/AuditLogger.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/windowHandlers.audit.test.ts` 通过，仅报告 Windows `core.autocrlf` 的 LF/CRLF 提示。

### 12.4 剩余边界

- `E2E-X3-audit` 已在真实 Electron 会话中触发窗口敏感操作：测试创建真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd，调用真实 preload/IPC `windowManager.setTitle()` 覆盖成功与校验失败路径，并读取 Electron `userData/logs/security-audit.log` 断言 `timestamp/action/op/target/result/outcome/reason` 结构化字段。验证命令：`pnpm build` 通过；`pnpm exec playwright test e2e/example.spec.ts -g "X3" --timeout=120000 --workers=1` 为 `1 passed (4.1s)`。
- `P2.1` 仍绑定 60 分钟长跑、bench 与退出后子进程归零证据，不能因本轮审计实现而提升状态。
