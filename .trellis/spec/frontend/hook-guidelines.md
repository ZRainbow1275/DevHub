# Hook Guidelines

> How hooks are used in this project.

---

## Overview

<!--
Document your project's hook conventions here.

Questions to answer:
- What custom hooks do you have?
- How do you handle data fetching?
- What are the naming conventions?
- How do you share stateful logic?
-->

(To be filled by the team)

---

## Custom Hook Patterns

### Pattern: Refresh-token guard for async IPC hooks

**Problem**: When a data-fetch hook is called with a changing key (e.g., `projectId`), the previous in-flight request may resolve AFTER the new one, overwriting the latest data with stale results.

**Solution**: Use a `useRef<number>` counter that increments on every new fetch. Only commit the result when the token matches the ref's current value.

**Reference**: `src/renderer/hooks/useProjectDetails.ts` — `useProjectGitInfo` and `useProjectDependencies`.

**Example**:

```typescript
export function useProjectGitInfo(projectId: string | null) {
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const refreshTokenRef = useRef(0)

  const fetchGitInfo = useCallback(async (id: string, token: number) => {
    setLoading(true)
    try {
      const info = await window.devhub.projects.getGitInfo(id)
      // GUARD: only commit if this is still the latest request
      if (token === refreshTokenRef.current) {
        setGitInfo(info)
      }
    } finally {
      if (token === refreshTokenRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!projectId) {
      setGitInfo(null)
      return
    }
    const token = ++refreshTokenRef.current
    fetchGitInfo(projectId, token)
  }, [projectId, fetchGitInfo])

  return { gitInfo, loading, refresh: () => { /* bump token + re-fetch */ } }
}
```

**Why**: Without the token, rapid project-switches cause "flicker" — the UI shows data for Project A even after the user selected Project B, because A's slow IPC resolved last. Using `AbortController` is an alternative, but the token pattern is simpler when the underlying IPC doesn't support cancellation.

**When to use**:
- Any hook that fetches per-entity data and whose key can change rapidly.
- Any hook exposing a manual `refresh()` — the token also invalidates stale refreshes.

### Pattern: Lazy enrichment via optional prop

**Problem**: A list component renders many instances of the same card. If every card unconditionally fires IPC for extra info (git, dependencies), the IPC surge hurts initial paint.

**Solution**: Gate enrichment behind a prop — pass `null` to the hook in compact/dense lists, pass the real id only when the user needs the detail.

**Reference**: `ProjectCard.tsx` — `showEnrichedInfo` prop; `useProjectGitInfo` accepts `projectId | null` and no-ops on null.

```typescript
// Card
<ProjectCard showEnrichedInfo={true} /* default */ />
<ProjectCard showEnrichedInfo={false} /* dense grid */ />

// Hook contract
useProjectGitInfo(null)  // returns {gitInfo: null, loading: false, ...}, never calls IPC
```

---

---

## Data Fetching

<!-- How data fetching is handled (React Query, SWR, etc.) -->

(To be filled by the team)

---

## Naming Conventions

<!-- Hook naming rules (use*, etc.) -->

(To be filled by the team)

---

## Common Mistakes

<!-- Hook-related mistakes your team has made -->

(To be filled by the team)
