# Security Spec — DevHub 安全问题规格

> 优先级: CRITICAL / HIGH
> 影响范围: main process, preload, IPC handlers

---

## SEC-01: IPC 无速率限制

**风险等级**: HIGH
**位置**: `src/main/ipc/*.ts` 所有 handler

**问题描述**:
所有 IPC handler 均无速率限制。恶意或错误的渲染进程可以高频调用 IPC（如 `PORT_SCAN`、`PROCESS_SCAN`），
每次调用触发 `netstat -ano`、`wmic` 等系统命令，导致 CPU 飙升甚至系统 DoS。

**修复方案**:
```typescript
// 在 ipc/index.ts 中添加通用速率限制器
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function withRateLimit(channel: string, maxPerMinute: number, handler: Function) {
  return async (...args: any[]) => {
    const now = Date.now();
    const entry = rateLimiter.get(channel);
    if (entry && now < entry.resetAt && entry.count >= maxPerMinute) {
      throw new Error(`Rate limit exceeded for ${channel}`);
    }
    if (!entry || now >= entry.resetAt) {
      rateLimiter.set(channel, { count: 1, resetAt: now + 60000 });
    } else {
      entry.count++;
    }
    return handler(...args);
  };
}
```

**建议速率**:
- 扫描类 (SCAN): 12/min
- 操作类 (KILL/RELEASE): 30/min
- 查询类 (GET): 60/min

---

## SEC-02: WMIC 废弃风险

**风险等级**: HIGH
**位置**:
- `src/main/services/PortScanner.ts` — WMIC 查进程名
- `src/main/services/SystemProcessScanner.ts` — WMIC 枚举进程
- `src/main/services/AITaskTracker.ts` — WMIC 查窗口

**问题描述**:
WMIC 在 Windows 11 22H2+ 已标记为废弃，未来版本可能移除。当前代码完全依赖 WMIC。

**修复方案**:
迁移到 PowerShell `Get-CimInstance` 等效命令:

| 当前 (WMIC) | 替代 (PowerShell) |
|---|---|
| `wmic process get ProcessId,Name,CommandLine,WorkingSetSize /format:csv` | `Get-CimInstance Win32_Process \| Select ProcessId,Name,CommandLine,WorkingSetSize \| ConvertTo-Csv` |
| `wmic process where "ProcessId=X" get ProcessId,Name` | `Get-Process -Id X \| Select Id,ProcessName` |

**注意**: 此修复归入 Batch 3（架构层变更），当前批次仅添加 fallback 逻辑。

---

## SEC-03: CSP `unsafe-inline` 风险

**风险等级**: MEDIUM
**位置**: `src/main/index.ts` — CSP header 设置

**问题描述**:
`style-src 'self' 'unsafe-inline'` 允许内联样式，降低 XSS 防护。Tailwind 的 `style` 属性需要此设置。

**修复方案**:
- 短期: 保持现状（Tailwind 要求）
- 长期: 使用 nonce-based CSP + Vite 插件生成 nonce

**当前批次**: 不修复，记录为已知限制。

---

## SEC-04: PID 复用风险

**风险等级**: LOW-MEDIUM
**位置**: `src/main/ipc/processHandlers.ts` — `process:kill`

**问题描述**:
进程扫描与杀进程之间有时间差，操作系统可能已复用该 PID。
当前已有缓解措施（检查 PID 是否在已知进程列表中），但时间窗口仍存在。

**修复方案**:
在 kill 前重新验证进程名与 commandLine 匹配:
```typescript
// kill 前二次验证
const freshProcess = await verifyPidIdentity(pid, expectedName, expectedCmd);
if (!freshProcess) throw new Error('Process identity changed, aborting kill');
```

---

## SEC-05: 验证函数重复导致不一致风险

**风险等级**: MEDIUM
**位置**:
- `src/main/ipc/index.ts` — validatePath, validateTagOrGroup, proto-pollution check
- `src/main/ipc/notificationHandlers.ts` — proto-pollution check
- `src/main/ipc/taskHistoryHandlers.ts` — proto-pollution check
- `src/main/ipc/portHandlers.ts` — port validation
- `src/main/ipc/windowHandlers.ts` — hwnd validation

**问题描述**:
相同的验证逻辑在多处重复实现，未来修改可能遗漏某处，产生不一致。

**修复方案**:
统一提取到 `src/main/utils/validation.ts`:
```typescript
export function guardProtoPollution(obj: Record<string, unknown>): void { ... }
export function validatePid(pid: unknown): asserts pid is number { ... }
export function validatePort(port: unknown): asserts port is number { ... }
export function validateHwnd(hwnd: unknown): asserts hwnd is number { ... }
export function validatePath(path: unknown): asserts path is string { ... }
export function validateTagOrGroup(name: unknown): asserts name is string { ... }
```
