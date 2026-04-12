# PRD 3: 安全加固

> 优先级: P0 (最高)
> 类型: backend (main process)
> 复杂度: Medium

## Goal
防止 DevHub 误杀系统关键进程，加固所有破坏性操作的安全边界。

## Requirements

### R3.1: 保护进程列表
- 创建 `PROTECTED_PROCESSES` 常量，包含：csrss.exe, lsass.exe, smss.exe, wininit.exe, winlogon.exe, services.exe, svchost.exe, dwm.exe, System, Registry, explorer.exe, RuntimeBroker.exe, taskhostw.exe, conhost.exe, MsMpEng.exe, SearchIndexer.exe
- `SystemProcessScanner.killProcess()` 检查进程名，拒绝杀保护进程
- `PortScanner.releasePort()` 查进程名后拒绝杀保护进程

### R3.2: 清理 DEV_PROCESS_PATTERNS
- 移除 `powershell.exe`, `cmd.exe`, `WindowsTerminal.exe` — 系统 shell 不应被视为开发进程
- 移除 `chrome.exe`, `msedge.exe`, `firefox.exe` — 浏览器不是开发专属进程
- 保留：node.exe, python.exe, java.exe, go.exe, cargo.exe, code.exe, docker.exe 等

### R3.3: 僵尸检测收紧
- 条件收紧为：cpu < 0.5% AND memory < 10MB AND uptime > 2h
- 先 SIGTERM，等 5s，再 SIGKILL（当前直接 SIGKILL）
- 仅对已确认的开发服务器进程生效

### R3.4: 端口释放安全
- 释放端口前查找进程名
- 非开发进程 → 拒绝释放
- 常见数据库端口（3306/5432/6379/27017）需额外确认

### R3.5: 破坏性操作限速
- 新增 `RATE_LIMITS.DESTRUCTIVE = 5`（5次/分钟）
- 应用到：PROCESS_KILL, PROCESS_CLEANUP_ZOMBIES, PORT_RELEASE

### R3.6: 审计日志
- 创建 `AuditLogger` 服务
- 记录到 `devhub-audit.log`（userData 目录）
- 每条记录：timestamp, action, target(PID/port), processName, result

## Acceptance Criteria
- [ ] kill csrss.exe/lsass.exe/explorer.exe → 返回 false + 日志警告
- [ ] DEV_PROCESS_PATTERNS 不含 powershell/cmd/browser
- [ ] 僵尸清理先 SIGTERM 后 SIGKILL
- [ ] 端口释放检查进程身份
- [ ] 破坏性操作限速 5/min
- [ ] devhub-audit.log 记录所有 kill/release

## Files

### New
- `src/main/services/AuditLogger.ts`

### Modified
- `src/shared/types-extended.ts` — PROTECTED_PROCESSES, DEV_PROCESS_PATTERNS
- `src/main/services/SystemProcessScanner.ts` — killProcess 保护检查，僵尸收紧
- `src/main/services/PortScanner.ts` — releasePort 进程身份检查
- `src/main/ipc/processHandlers.ts` — DESTRUCTIVE 限速
- `src/main/ipc/portHandlers.ts` — DESTRUCTIVE 限速，进程检查
- `src/main/utils/rateLimiter.ts` — 新增 DESTRUCTIVE 层级
