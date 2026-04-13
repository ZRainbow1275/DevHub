# Error Handling

> How errors are handled in this project.

---

## Overview

In this Electron+Node project, most errors originate from Windows system calls (PowerShell / WMI / tasklist). The project prefers **graceful degradation over hard failure** at service boundaries so the UI always has *something* to render, and makes boundary errors explicit with `console.warn`/`console.error` (never swallowed silently).

---

## Error Handling Patterns

### Pattern: Three-Level Graceful Degradation (Subprocess Boundary)

**Problem**: A subprocess (PowerShell, WMI) query may hang, time out, lack permissions, or fail to parse. If a UI detail view binds to a single all-or-nothing call, any failure causes a full "cannot load" screen.

**Solution**: Split the data fetch into three layers and fall back progressively. Each layer is cheaper and more reliable than the next, and the UI always gets *at least* Level 1.

```typescript
// Example: SystemProcessScanner.getFullRelationship
async getFullRelationship(pid: number): Promise<ProcessRelationship | null> {
  // Cache check
  const cached = this.relationshipCache.get(pid)
  if (cached) return cached

  // Level 1 — always succeeds: build minimal info from in-memory state
  const level1 = this.buildLevel1Relationship(pid)

  try {
    // Level 2 — WMI query wrapped in timeout, fallback to Level 1
    const wmiResult = await withTimeout(
      this._getFullRelationshipFromWmi(pid),
      3000,
      null as ProcessRelationship | null
    )
    if (wmiResult) {
      this.relationshipCache.set(pid, wmiResult)
      return wmiResult
    }
    // Level 3 — ports/windows enrichment already included in wmi method (5s timeout)
    if (level1) this.relationshipCache.set(pid, level1)
    return level1
  } catch (err) {
    console.error('getFullRelationship: WMI stage failed, using level 1 fallback:',
      err instanceof Error ? err.message : err)
    return level1
  }
}
```

**Key points**:
- Level 1 must be **pure memory** (no IO) so it always succeeds
- Level 2+ wrapped in `withTimeout<T>(promise, ms, fallback)` helper — never blocks UI
- Errors logged via `console.warn`/`console.error`, never silently swallowed
- Result cached (LRU + TTL) so rapid UI interactions (tab switches) do not re-query

See `src/main/services/SystemProcessScanner.ts` for the reference implementation.

### Pattern: `withTimeout` Helper

**Problem**: Node/Electron does not offer a primitive for "run this promise but bound to N ms".

**Solution**: A small helper returning fallback on timeout (and cleaning up the timer).

```typescript
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
```

**Caveat**: The underlying promise is *not* aborted — callers must ensure their promise is cancelable or idempotent. Use this for read-only queries (WMI, port scan), not for stateful writes.

### Pattern: Per-Tab Lazy Load in UI

**Problem**: A detail panel with multiple tabs should not wait for *all* backend data before rendering; a slow or failed tab must not block other tabs.

**Solution**:

```typescript
interface TabState<T> {
  data: T | null
  loading: boolean
  error: string | null
  requiresElevation: boolean
}

// Each tab has its own state, its own fetch, its own error banner
const [networkState, setNetworkState] = useState<TabState<NetworkConnectionInfo[]>>(initialTabState)
const [envState, setEnvState]         = useState<TabState<Record<string,string>>>(initialTabState)
const [modulesState, setModulesState] = useState<TabState<LoadedModuleInfo[]>>(initialTabState)

// Lazy-trigger on tab switch; skip if already loaded
useEffect(() => {
  if (activeTab === 'network' && networkState.data === null && !networkState.loading) loadNetwork()
  // ...
}, [activeTab])
```

Key points:
- Error from one tab never leaks to another tab
- `requiresElevation: true` shows a friendly "需要管理员权限" instead of a stack trace
- Use a "retry" button per tab for manual refresh

See `src/renderer/components/monitor/ProcessDetailPanel.tsx` for the reference implementation.

---

## Common Mistakes

### Don't: Return `null` to the UI and show "failed to load"

**Problem**:
```typescript
async function getFullRelationship(pid: number) {
  const result = await runSlowWMIQuery(pid)
  if (!result) return null  // UI shows "cannot load process"
  return result
}
```

**Why it's bad**: A single timeout causes a fatal-looking error page when in fact most of the info (name, PID, CPU, memory) is already in memory.

**Fix**: Apply the three-level graceful degradation pattern above — build a Level 1 fallback from in-memory state so the UI always has something meaningful.

### Don't: Silently swallow subprocess errors

**Problem**:
```typescript
try {
  await execFileAsync('powershell', ['-Command', cmd])
} catch {
  // ignore
}
```

**Why it's bad**: We lose diagnostic signal. If PowerShell is broken, timing out, or misconfigured, we want logs.

**Fix**:
```typescript
try {
  await execFileAsync('powershell', ['-Command', cmd], { timeout: 15000 })
} catch (err) {
  console.warn('powershell failed:', err instanceof Error ? err.message : err)
}
```

Always log at boundaries. The rule is: **best-effort is fine, silent-effort is not.**

### Don't: Use non-null assertion to bypass null from async

**Problem**:
```typescript
const entry = map.get(key)!  // <- forbidden (quality-guidelines)
entry.foo = 1
```

**Why it's bad**: Violates `backend/quality-guidelines.md`. Hides real nullability bugs.

**Fix**: Check and construct if missing:
```typescript
let entry = map.get(key)
if (!entry) {
  entry = { /* default */ }
  map.set(key, entry)
}
entry.foo = 1
```

---

## Related

- `backend/quality-guidelines.md` — forbidden patterns (no `any`, no `!`, timeouts required)
- `backend/logging-guidelines.md` — how to log at boundaries
