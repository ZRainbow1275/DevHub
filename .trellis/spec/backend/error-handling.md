# Error Handling

> How errors are handled in this project.

---

## Overview

<!--
Document your project's error handling conventions here.

Questions to answer:
- What error types do you define?
- How are errors propagated?
- How are errors logged?
- How are errors returned to clients?
-->

(To be filled by the team)

---

## Error Types

<!-- Custom error classes/types -->

(To be filled by the team)

---

## Error Handling Patterns

### Pattern: Return partial data with an explicit access report

Windows process and window APIs often fail partially: a process may expose `pid`, `name`, memory, or thread counts while denying command line, executable path, owner, modules, or environment variables. Do not collapse these cases into a generic failure.

Use this pattern for privileged OS reads:

1. Return every field that was actually read from the real system.
2. Mark the response with an explicit flag such as `requiresElevation: true` when privileged fields are missing in a non-elevated process.
3. Return a structured access report with `scanResult`, `currentUser`, optional `targetProcessUser`, and a `suggestion` such as `relaunch-as-admin`.
4. Let the renderer show the partial detail panel plus a permission notice. Do not render an error-only panel when basic fields are available.

Reference implementation: `devhub/src/main/services/SystemProcessScanner.ts#getProcessDeepDetail` and `probeProcessAccess`.

### Pattern: Bounded teardown for Electron E2E

Playwright's Electron context close is not a substitute for the app's own quit lifecycle. E2E teardown should request `app.quit()` inside the real Electron main process, wait for the `close` event, and only then fall back to Playwright context cleanup with a bounded timeout.

Reference implementation: `devhub/e2e/example.spec.ts#closeElectronApp`.

---

## API Error Responses

<!-- Standard error response format -->

(To be filled by the team)

---

## Common Mistakes

<!-- Error handling mistakes your team has made -->

(To be filled by the team)
