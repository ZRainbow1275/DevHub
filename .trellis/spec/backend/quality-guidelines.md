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
