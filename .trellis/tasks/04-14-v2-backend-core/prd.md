# Team 1: Backend-Core -- T1 AI Tool Detection + T3 Process Detail Fix

## Project Context

DevHub is an Electron desktop app at `devhub/` subdirectory (electron-vite + React 18 + TypeScript + Zustand + TailwindCSS). It manages dev projects, monitors system processes, ports, windows, and AI CLI tools.

## Scope

This task covers TWO problem domains:

### T1: AI Tool Detection Enhancement
### T3: Process Detail Fix

---

## T1 Requirements

### Current Problem

- `src/main/services/ToolMonitor.ts` only detects 3 tools (codex, claude-code, gemini-cli)
- Detection depends on PowerShell to get node command lines -- native binaries not well supported
- `AITaskTracker.ts` completion detection has high false positive rate
- Notifications don't include window identity

### T1.1 Expand Tool Detection Config

Expand `TOOL_DETECTION_CONFIG` in `src/main/services/ToolMonitor.ts` to support 9+ tools:

| Tool ID | Display Name | Native Binary | Node CommandLine Pattern | Exclude |
|---------|-------------|---------------|-------------------------|---------|
| claude-code | Claude Code | claude.exe | @anthropic-ai/claude-code, /claude-code/cli.js | mcp-server |
| codex | Codex CLI | codex.exe | @openai/codex, /codex/bin/codex.js | codex-mcp, mcp-server |
| gemini-cli | Gemini CLI | gemini.exe | @google/gemini-cli, gemini-cli | mcp-server |
| opencode | OpenCode | opencode.exe | opencode, /opencode/ | mcp-server |
| aider | Aider | aider.exe (python.exe) | aider | - |
| cursor | Cursor | Cursor.exe | - | - |
| windsurf | Windsurf | Windsurf.exe | - | - |
| continue | Continue.dev | - (node.exe) | continue, .continue/ | mcp-server |
| cline | Cline | - (node.exe) | cline, saoudrizwan.claude-dev | mcp-server |

### T1.2 Multi-Layer Detection Strategy

```
Layer 1: Native binary name matching (fastest)
  -> Check allProcessNames for claude.exe/codex.exe/etc.

Layer 2: Node command line pattern matching (existing, enhance)
  -> Batch PowerShell query for all node.exe CommandLine
  -> Match against commandPatterns, exclude excludePatterns
  -> Also check python.exe for aider

Layer 3: Window title auxiliary matching (new)
  -> Scan window titles for patterns like /Claude Code/i, /Codex/i
  -> Cross-validate with Layer 1/2 results
```

### T1.3 AI Task Completion Detection Improvement

In `src/main/services/AITaskTracker.ts`:

- Change `confirmationWindowMs: 3000` -> `8000`
- Add secondary confirmation: after first trigger, wait additional 5s and re-verify
- Enhance `COMPLETION_PATTERNS`:
  - Claude Code specific: `/^\s*>\s*$/m`, `/Welcome to Claude Code/i`
  - Codex specific: `/codex>\s*$/m`, `/Ready/`
  - Gemini specific: `/gemini>\s*$/m`
- Add per-tool `promptPatterns` for tool-specific waiting states
- Track `falsePositiveCount` dynamically -- if too many false positives, raise `completionThreshold`

### T1.4 Notification Format with Window Alias

In `src/main/services/NotificationService.ts`:

- Accept optional `alias` parameter
- Format: `[alias] ToolName - 任务完成` (if alias) or `ToolName - 任务完成` (if no alias)
- Example: `[MyProject 前端] Claude Code - 任务完成`

In `src/main/services/ToolMonitor.ts` `onCompletion` callback:

- Look up alias from AIAliasManager by HWND or PID
- Pass alias to NotificationService

### T1.5 Update Types

In `src/shared/types-extended.ts`:

- Add new tool IDs to `AIToolType` union
- Add `NativeBinaryDetectionConfig` interface
- Extend `AIToolDetectionConfig` with `windowTitlePatterns`, `nativeBinaries`

---

## T3 Requirements

### Current Problem

- Most processes show "无法获取进程信息 (PID: XXXXX)" when clicked
- `ProcessDetailPanel.tsx` shows error when `fetchRelationship` returns null
- Backend PowerShell queries frequently timeout or lack permission

### T3.1 Graceful Degradation in SystemProcessScanner.ts

Add three-level fallback pattern to `getFullRelationship(pid)`:

```
Level 1 (always succeeds): Basic info from in-memory cache
  - PID, name, CPU, memory, status, type
  - Read directly from processes Map, no PowerShell

Level 2 (optional, 3s timeout): Extended info
  - commandLine, workingDir, userName, priority, threadCount, handleCount
  - Wrap each PowerShell call in withTimeout(promise, 3000, null)

Level 3 (optional, 5s timeout): Relationships
  - children, ancestors, siblings, relatedPorts, relatedWindows
  - Graceful fallback to empty arrays on timeout/permission error
```

- Add LRU cache for relationship queries (capacity 50, TTL 10s)
- Add `withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T>` helper
- For protected processes (System, svchost), return basic info with `requiresElevation: true` flag

### T3.2 Multi-Tab ProcessDetailPanel.tsx Redesign

Rewrite `ProcessDetailPanel.tsx` to accept PARTIAL data gracefully:

```
State transitions:
- null relationship + no basic: show small "正在加载..." (not full error)
- null relationship + has basic: show basic info, note "部分信息不可用"
- full relationship: show all tabs with rich data

Tab Layout: [基础] [资源] [网络] [环境] [模块]

Basic Tab (always shows):
  - PID, PPID, name, status, type, startTime, userName, commandLine, workingDir
  - Priority, threadCount, handleCount (if available)
  - "刷新" button to retry failed queries

Resources Tab (lazy load):
  - CPU usage with sparkline history
  - Memory usage with sparkline history
  - I/O read/write stats (if available)

Network Tab (lazy load):
  - Bound ports list (from relatedPorts)
  - Network connections list (from getProcessConnections IPC)

Environment Tab (lazy load):
  - Environment variables table (from getProcessEnvironment IPC)
  - Search filter
  - Show "需要管理员权限" if requiresElevation

Modules Tab (lazy load):
  - Loaded DLL/modules list (from getProcessModules IPC)
  - Show "需要管理员权限" if requiresElevation
```

- Each tab only triggers its IPC fetch when user clicks the tab
- Loading spinner per tab (not global)
- Error per tab is local (doesn't break other tabs)

### T3.3 Pass Basic Info from Renderer

The renderer already has the basic process info in `processStore`. When opening detail:

1. `ProcessView.tsx` passes the `ProcessInfo` object to `ProcessDetailPanel`
2. `ProcessDetailPanel` uses it as Level 1 fallback even if IPC fails
3. Background IPC fetches attempt to enrich the data

Add a new prop: `initialProcess?: ProcessInfo` to `ProcessDetailPanel`.

---

## Acceptance Criteria

### T1 Acceptance
- [ ] At least 9 AI tools detectable in TOOL_DETECTION_CONFIG
- [ ] Native binary detection works for claude.exe, codex.exe, gemini.exe
- [ ] Multi-instance: can distinguish multiple Claude Code sessions
- [ ] Completion detection false positive rate visibly reduced (confirmation window 8s)
- [ ] Notifications include window alias when set: `[Alias] ToolName - 任务完成`
- [ ] TypeScript compiles with no errors

### T3 Acceptance
- [ ] Clicking any process opens detail panel showing AT LEAST basic info
- [ ] No more "无法获取进程信息 (PID: XXXXX)" full-error screen
- [ ] 5 tabs all functional (lazy load for non-basic)
- [ ] Protected processes show "需要管理员权限" note rather than total failure
- [ ] Each PowerShell call wrapped in timeout (max 3s for details, 5s for relationships)
- [ ] Cache hits prevent re-query within TTL window

---

## Critical Rules

- **NO deletion** of any existing code/components/functions
- **NO mock data** -- all data from real system calls
- **NO emoji icons** -- use SVG icons from `src/renderer/components/icons/index.tsx`
- TypeScript strict mode, no `any`
- All user-facing text in Chinese
- PowerShell queries MUST have timeout wrapper (max 3s)
- Run `cd devhub && npx tsc --noEmit` before committing

## Files In Scope

### Backend
- `devhub/src/main/services/ToolMonitor.ts` -- T1 multi-layer detection rewrite
- `devhub/src/main/services/AITaskTracker.ts` -- T1 completion detection improvement
- `devhub/src/main/services/AIAliasManager.ts` -- T1 alias lookup for notifications
- `devhub/src/main/services/NotificationService.ts` -- T1 notification format
- `devhub/src/main/services/SystemProcessScanner.ts` -- T3 graceful degradation + cache
- `devhub/src/main/services/WindowManager.ts` -- READ ONLY (for window title scanning)
- `devhub/src/main/ipc/processHandlers.ts` -- T3 handlers remain, add optional basic-info endpoint
- `devhub/src/main/ipc/aiTaskHandlers.ts` -- T1 wiring notifications

### Frontend (minimal)
- `devhub/src/renderer/components/monitor/ProcessDetailPanel.tsx` -- T3 multi-tab redesign
- `devhub/src/renderer/components/monitor/ProcessView.tsx` -- T3 pass initialProcess prop

### Shared
- `devhub/src/shared/types-extended.ts` -- add new types (ADDITIONS ONLY)

### Preload
- `devhub/src/preload/extended.ts` -- add new IPC channel if needed

## Out of Scope (DO NOT TOUCH)

- Port panel (Team 2)
- Window view UI (Team 2 -- backend shared via WindowManager read-only)
- Topology/Flow graphs (Team 3)
- Project list/cards (Team 4)
- Sidebar/HeroStats (Team 4)
- Theme CSS (Team 5)
- `globals.css`, `tokens/*.css`, styles files (Team 5)
