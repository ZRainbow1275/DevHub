# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

- All code must pass `tsc --noEmit` and `eslint .` with zero errors before commit.
- No `console.log` in production code (use `console.error` / `console.warn` for error paths only).
- No `any` types; no non-null assertions (`x!`).

---

## Forbidden Patterns

### Don't: execFileAsync / spawn without timeout

**Problem**:
```typescript
// Don't do this
await execFileAsync('powershell', ['-Command', cmd], { windowsHide: true })
```

**Why it's bad**: On Windows, PowerShell or external processes can hang indefinitely, blocking the main thread or service loop.

**Instead**:
```typescript
// Always include a timeout
await execFileAsync('powershell', ['-Command', cmd], { windowsHide: true, timeout: 15000 })
```

**Convention**: All `execFileAsync` calls in this project use `timeout: 15000` (15 seconds). See `WindowManager.ts` `scanWindows` as the reference implementation.

### Don't: Default unknown enum values to a valid member

**Problem**:
```typescript
// Don't do this
private normalizeState(state: string): PortState {
  const stateMap: Record<string, PortState> = { ... }
  return stateMap[state] ?? 'LISTENING' // Unknown states silently become LISTENING
}
```

**Why it's bad**: Causes false positives (e.g., a port in `SYN_SENT` state reported as `LISTENING`).

**Instead**:
```typescript
// Return null for unknown values and filter at the call site
private normalizeState(state: string): PortState | null {
  const stateMap: Record<string, PortState> = { ... }
  return stateMap[state] ?? null
}

// In parseNetstatOutput:
const normalizedState = this.normalizeState(state)
if (normalizedState === null) continue
```

---

## Required Patterns

### Convention: Subprocess timeout

Every `execFileAsync`, `execAsync`, or `spawn` call **must** include a `timeout` option. The standard timeout for PowerShell window operations is `15000` ms.

### Convention: Polling interval for file watchers

When `usePolling: true` is required (e.g., Windows `fs.watch` unreliability), use `interval: 30000` (30 seconds) for directory watchers to reduce CPU load on large project trees. See `ProjectWatcher.ts`.

### Convention: ProjectId-based IPC with path validation + TTL cache

**What**: When an IPC handler needs to access a project's filesystem path, the renderer passes only the `projectId`. The main process resolves the path via `appStore.getProject()`, validates it through `validatePath()` against the settings allow-list, and only then calls the service. Service results are cached per-path for a short TTL to absorb bursts.

**Why**: (1) The renderer must not be trusted with raw paths — it could be XSS'd. (2) The service call may be expensive (git CLI, disk read) so needs caching.

**Reference**: `src/main/ipc/index.ts` — `project:get-git-info` and `project:get-dependencies` handlers; `src/main/services/ProjectScanner.ts` — `getGitInfo` + `getDependencies` with 10-second TTL.

**Pattern**:

```typescript
// IPC handler (main/ipc/index.ts)
ipcMain.handle('project:get-git-info', withRateLimit(
  'project:get-git-info', RATE_LIMITS.QUERY,
  async (_, projectId: unknown) => {
    if (typeof projectId !== 'string') {
      throw new Error('projectId must be a string')
    }
    const project = appStore.getProject(projectId)
    if (!project) return null

    const settings = appStore.getSettings()
    const validation = validatePath(project.path, settings.scan.allowedPaths)
    if (!validation.valid) return null

    return projectScanner.getGitInfo(validation.normalized!)
  }
))

// Service (main/services/ProjectScanner.ts)
private readonly gitInfoCache = new Map<string, CacheEntry<GitInfo | null>>()
private readonly GIT_CACHE_TTL_MS = 10_000

async getGitInfo(projectPath: string): Promise<GitInfo | null> {
  const cached = this.gitInfoCache.get(projectPath)
  if (cached && Date.now() - cached.timestamp < this.GIT_CACHE_TTL_MS) {
    return cached.data
  }
  // ... resolve, then cache ...
  this.gitInfoCache.set(projectPath, { data: info, timestamp: Date.now() })
  return info
}
```

**Rules**:
- Renderer MUST pass `projectId` (string), never a path.
- Handler MUST call `validatePath(project.path, settings.scan.allowedPaths)` and check `valid`.
- Handler MUST return `null` / empty array on validation failure (do NOT throw — caller displays empty state).
- Service MUST cache per-normalized-path, TTL 10 seconds for git/deps.
- Service MUST use `execFileAsync('git', [...args], { cwd, timeout: 3000, windowsHide: true })` — NEVER `exec()` (shell injection).

### Convention: Git CLI timeout

**What**: Git commands in background services use `timeout: 3000` (3 seconds), not the standard 15s for PowerShell. Git is local and a 3s hang signals a broken repo or filesystem issue.

**Reference**: `ProjectScanner.getGitInfo` — `GIT_COMMAND_TIMEOUT_MS = 3000`.

---

## Testing Requirements

- New pure functions require unit tests.
- Bug fixes require a regression test verifying the fix.
- When changing the return type of an internal method (e.g., `T` to `T | null`), update all tests that assert on the old behavior.

---

## Code Review Checklist

- [ ] All `execFileAsync` / `spawn` calls include `timeout`
- [ ] No unknown enum/union values silently mapped to valid members
- [ ] Polling intervals are reasonable (>= 30s for directory watchers)
- [ ] No `console.log` (use `console.error` / `console.warn` in error paths)
- [ ] No `any` types or non-null assertions
