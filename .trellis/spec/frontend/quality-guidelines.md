# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

- All code must pass `tsc --noEmit` and `eslint .` with zero errors before commit.
- No `console.log` in production code.
- No `any` types; no non-null assertions (`x!`).
- Prefer type guards and helper functions over nested type assertions.

---

## Forbidden Patterns

### Don't: Nested type assertions for data extraction

**Problem**:
```typescript
// Don't do this
const rawTheme = (s as Record<string, unknown> | null)?.theme as string
```

**Why it's bad**: Hard to read, fragile, hides potential runtime errors.

**Instead**:
```typescript
// Extract a type guard
function isLegacySettings(s: unknown): s is { theme: string } {
  return typeof s === 'object' && s !== null && 'theme' in s && typeof (s as { theme: unknown }).theme === 'string'
}

// Use a safe extraction helper
function extractThemeValue(s: { appearance?: { theme?: string } } | null): string {
  if (s?.appearance?.theme) return s.appearance.theme
  if (isLegacySettings(s)) return s.theme
  return ''
}
```

See `useTheme.ts` for the reference implementation.

### Don't: Fire-and-forget async calls on toggle without race protection

**Problem**:
```typescript
// Don't do this
const handleToggle = () => {
  setFlag(prev => {
    const next = !prev
    asyncOperation(next) // No protection against rapid toggles
    return next
  })
}
```

**Why it's bad**: If the user toggles rapidly, the first async call may complete after the second, writing stale data to the store.

---

## Required Patterns

### Pattern: Race condition guard with useRef version counter

**Problem**: Async operations triggered by user toggles can overlap, causing stale results to overwrite fresh data.

**Solution**: Use a `useRef` counter to track the latest operation version. After the async completes, check if the counter still matches. If not, issue a corrective operation with the latest state.

**Example** (from `WindowView.tsx`):
```tsx
const scanVersionRef = useRef(0)
const latestShowSystemRef = useRef(false)

const handleToggle = useCallback(() => {
  setFlag(prev => {
    const next = !prev
    latestShowSystemRef.current = next
    const version = ++scanVersionRef.current
    scan(next).then(() => {
      if (scanVersionRef.current !== version) {
        // Stale -- corrective re-scan with latest value
        scan(latestShowSystemRef.current)
      }
    })
    return next
  })
}, [scan])
```

**Why**: This is the project's established pattern for async race protection in React components. Apply it whenever a user-triggered toggle fires an async operation whose results are written to a shared store.

### Convention: Type guards over type assertions

When extracting data from loosely-typed sources (e.g., settings stores, IPC responses), always use type guard functions instead of inline `as` casts. This centralizes validation logic and improves readability.

---

## Testing Requirements

- New pure functions require unit tests.
- Bug fixes require a regression test.
- When introducing a new pattern (e.g., race condition guard), document it in this spec file.

---

## Code Review Checklist

- [ ] No nested type assertions; use type guards instead
- [ ] Async operations on user toggles have race condition protection
- [ ] No `console.log` in production code
- [ ] No `any` types or non-null assertions
- [ ] New patterns documented in quality-guidelines.md
