# Task Completion Checklist

When a coding task is completed, run the following checks:

1. **Type Check**: `cd devhub && pnpm typecheck`
   - Must pass with zero errors

2. **Lint**: `cd devhub && pnpm lint`
   - Must pass, fix any new warnings introduced by changes

3. **Unit Tests**: `cd devhub && pnpm test`
   - All existing tests must pass
   - New features should have corresponding tests

4. **Impact Analysis**: `gitnexus_detect_changes()`
   - Verify only expected symbols and execution flows are affected
   - Check for HIGH/CRITICAL risk warnings

5. **Manual Verification** (for UI changes):
   - Start dev server: `cd devhub && pnpm dev`
   - Test the golden path and edge cases
   - Monitor for regressions in other features
