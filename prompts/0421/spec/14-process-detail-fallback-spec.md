# spec/14 — 进程详情降级显示规格（PID 9148 类问题）

> 严重度：P1
> 对应用户诉求：P2.2（PID 9148 显示 "无法获取进程信息"）
> 对应验收矩阵：P2.2
> 本 spec 以"权限降级 + 字段显示可得信息 + 明确用户操作"为核心。

---

## 一、动机

用户截图：`屏幕截图 2026-04-15 195107.png` 显示 PID 9148 在主进程列表可见（所以能拿到 pid / name），但点击详情后面板是一句冷冰冰的 "无法获取进程信息"。

### 1.1 根因
- `ProcessDetailPanel.tsx` 调 `process:get-deep-detail`，主进程 handler 调用 `Get-CimInstance Win32_Process -Filter "ProcessId=9148"`
- 若目标进程是受保护系统进程（如某些 svchost / System）或运行在其他账户，PowerShell 访问被 Windows 拒绝
- 当前代码在 catch 中直接 `return { error: '无法获取进程信息' }` → UI 端无降级

### 1.2 R7 目标
**进程卡片可见的任何字段，详情面板必须能渲染，哪怕其他字段全失败**。再加权限提示 + 一键以管理员重启 + 重试按钮。

---

## 二、受影响源码

| 文件 | 行号 | 变更 |
|------|------|------|
| `devhub/src/main/ipc/processHandlers.ts` | `process:get-deep-detail` handler | 改为部分失败也返回已得字段 |
| `devhub/src/main/services/SystemProcessScanner.ts` | `getProcessDeepDetail` / `getFullRelationship` | 改返回 `PartialDeepDetail` |
| `devhub/src/renderer/components/monitor/ProcessDetailPanel.tsx` | — | 渲染 partial + 权限提示 + 重试 |
| NEW: `devhub/src/main/services/process-access/AccessProbe.ts` | — | 判定当前 Electron 是否有权访问目标 pid |
| NEW: `devhub/src/renderer/components/monitor/process/PermissionNotice.tsx` | — | 权限提示条 |
| NEW: `devhub/src/main/services/elevation/AdminRelaunch.ts` | — | 以管理员权限重启 DevHub |

---

## 三、数据契约

```typescript
export interface PartialDeepDetail {
  pid: number
  name: string           // always available (from list)
  basicAvailable: boolean
  extendedAvailable: boolean
  modulesAvailable: boolean
  networkAvailable: boolean
  environmentAvailable: boolean
  // fields (all optional; present if its *Available flag is true)
  commandLine?: string
  workingDir?: string
  user?: string
  parentPid?: number
  startTime?: number
  memoryBytes?: number
  cpuPercent?: number
  threadCount?: number
  modules?: ModuleInfo[]
  connections?: ConnectionInfo[]
  environment?: Record<string, string>
  // access diagnostics
  accessReport: AccessReport
}

export interface AccessReport {
  pid: number
  elevationRequired: boolean
  scanAttempted: boolean
  scanResult: 'ok' | 'access-denied' | 'not-found' | 'timeout' | 'wmi-error'
  currentUser: string
  targetProcessUser?: string
  suggestion: 'relaunch-as-admin' | 'retry' | 'none'
  triedAt: number
}
```

---

## 四、错误矩阵

| 错误码 | 触发 | 文案 | 日志 | 恢复 |
|-------|-----|------|------|------|
| `PROC_ACCESS_DENIED` | WMI/OpenProcess 返回 access denied | "获取完整信息需要管理员权限" + 按钮"以管理员重启" | WARN | 显示 partial + 按钮 |
| `PROC_NOT_FOUND` | 目标 pid 在查询时已退出 | "进程已退出" | INFO | 自动关闭面板 |
| `PROC_TIMEOUT` | PS 调用超时 | "查询超时，已显示缓存数据" + 重试 | WARN | partial + 重试 |
| `PROC_WMI_ERROR` | PS 异常 stderr | "查询失败：<short reason>" + 重试 | ERROR | partial |
| `PROC_PARTIAL_MODULES_ONLY` | 只拿到 modules | 正常渲染；其他字段带 placeholder | INFO | 无 |
| `PROC_FIELD_UNAVAILABLE` | 单字段访问失败 | 该字段显示 "—" + 悬停显示原因 | DEBUG | 其他字段正常 |
| `ADMIN_RELAUNCH_DENIED` | 用户 UAC 取消 | "已取消重启" | INFO | 无 |
| `ADMIN_RELAUNCH_IO_ERROR` | 写入自身路径失败 | "重启失败，请手动重启并以管理员身份" | ERROR | 无 |

---

## 五、验收条件

### E2E-P2.2-a 降级显示
```
Given 列表存在某 PID 受保护（如 System / svchost.exe 某些）
When 用户点击查看详情
Then 详情面板显示：
  - 顶部：进程名 + PID + 权限提示条（橙色，含"以管理员重启"按钮）
  - 基础字段区（可见的字段如 name / pid）
  - 其他字段显示 "—"，悬停 tooltip "需要管理员权限"
  - 面板底部"重试"按钮
**禁止**：出现单一的"无法获取进程信息"错误
```

### E2E-P2.2-b 管理员重启
```
Given 权限提示条可见
When 用户点"以管理员重启"
Then UAC 弹窗
When 用户确认
Then DevHub 退出并以管理员重启；重启后再次打开同一进程详情能看到全部字段
```

### E2E-P2.2-c 进程已退出
```
Given 用户点进程后目标进程刚好退出
Then 详情面板显示 "进程已退出" + 3s 后自动关闭
And 主列表同步移除该 pid
```

---

## 六、E2E 脚本

```typescript
// tests/e2e/process-detail-fallback.spec.ts
import { test, expect } from '@playwright/test'

test('partial detail for access-denied PID', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="monitor-tab-process"]')
  // 过滤 System 账户进程（大概率 access denied for non-admin）
  await win.fill('[data-testid="process-filter"]', 'svchost')
  const row = win.locator('[data-testid="process-row"]').first()
  const pid = await row.getAttribute('data-pid')
  await row.dblclick()
  await expect(win.locator('[data-testid="process-detail-panel"]')).toBeVisible()
  await expect(win.locator('[data-testid="permission-notice"]')).toBeVisible()
  // 不能只显示错误
  const errorOnly = win.locator('[data-testid="detail-error-only"]')
  await expect(errorOnly).not.toBeVisible()
  // 基础字段可见
  await expect(win.locator(`[data-testid="detail-field-name"]`)).toContainText('svchost')
  await expect(win.locator(`[data-testid="detail-field-pid"]`)).toContainText(pid!)
  await app.close()
})
```

### 6.1 2026-04-30 当前实现与验证

- `ProcessView` 的 `pid:NNN` exact fallback 已在真实 Electron E2E 中通过：当 PID 不属于开发进程扫描集合时，renderer 调用 `systemProcess.getBasicInfo(pid)` 取得真实基础字段，并渲染 `process-exact-pid-banner` 与单行结果。
- `SystemProcessScanner.getProcessDeepDetail()` 已补齐 partial-read 判定：非管理员运行且 `userName` / `commandLine` / `executablePath` 等特权字段缺失时，返回 `requiresElevation=true`，但保留已经读取到的 `pid` / `name` / memory / thread 等真实字段。
- `SystemProcessScanner.probeProcessAccess()` 已将上述 partial-read 归类为 `access-denied`，并在当前进程非管理员时返回 `suggestion='relaunch-as-admin'`，使 UI 显示权限原因与“以管理员身份重启”入口。
- 验证证据：`pnpm exec playwright test e2e/example.spec.ts -g "P2.2|X2 preload" --timeout=90000 --workers=1` 通过 2 tests；`pnpm test:e2e` 通过 8 tests；`pnpm test` 通过 42 files / 405 tests。

---

## 七、参考实现 / 库

- `node-ffi-napi` + OpenProcess / QueryFullProcessImageName（部分信息不需管理员）
- `systeminformation` npm 库（内置权限处理 + WMI 封装）
- Electron `process.getProcessMemoryInfo` 仅限自身 Electron 进程，不适用
- 参考 Process Explorer (Sysinternals) 的权限提示模式

---

## 八、贡献到 contracts/22

- `PartialDeepDetail`, `AccessReport`, `ModuleInfo`, `ConnectionInfo`

## 九、贡献到 contracts/23

- `process:get-deep-detail`（EXISTING，response schema 改为 PartialDeepDetail）
- `app:relaunch-as-admin`（NEW）
- `process:probe-access`（NEW）
