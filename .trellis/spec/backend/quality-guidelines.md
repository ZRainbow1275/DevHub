# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

- All code must pass `tsc --noEmit` and `eslint .` with zero errors before commit.
- No `console.log` in production code (use `console.error` / `console.warn` for error paths only).
- No `any` types; no non-null assertions (`x!`).

---

## Forbidden Patterns

### Don't: execFileAsync / bounded spawn without timeout

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

### Don't: Use `spawn({ timeout })` for long-lived supervised daemons

**Problem**:
```typescript
spawn(electronBinary, [innerWatchdogEntry], {
  env,
  stdio: 'ignore',
  timeout: 15000
})
```

**Why it's bad**: Node treats `spawn` `timeout` as a lifetime limit and terminates the child when the timer expires. Long-lived supervisors such as InnerWatchdog must survive past startup and be governed by explicit heartbeat, kill, orphan, and cleanup paths instead.

**Instead**:
```typescript
const child = spawn(electronBinary, [innerWatchdogEntry], {
  env,
  stdio: 'ignore',
  windowsHide: true
})
```

Use a timeout only for bounded subprocess probes or one-shot commands. For long-lived daemons, validate startup through real marker/RPC heartbeat evidence and terminate them through an explicit cleanup path.

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

Every `execFileAsync`, `execAsync`, or bounded one-shot `spawn` call **must** include a `timeout` option. The standard timeout for PowerShell window operations is `15000` ms.

Long-lived supervised child processes are the exception: do not pass `timeout` to `spawn` for daemons that are expected to keep running. Their lifecycle must be controlled by explicit heartbeat, supervisor state, and cleanup/kill code paths.

### Convention: Windows process-name matching must normalize extensionless names

When matching executable whitelists against window or process scan output, normalize both full paths and Windows `Get-Process` `ProcessName` values before comparison. `Get-Process | Select-Object ProcessName` returns extensionless names such as `cursor` or `Code`, while whitelist specs often name executables as `cursor.exe` or `Code.exe`. Do not reject a real process solely because the scanner returned an extensionless basename; append `.exe` for extensionless basenames before applying the whitelist.

### Convention: Polling interval for file watchers

When `usePolling: true` is required (e.g., Windows `fs.watch` unreliability), use `interval: 30000` (30 seconds) for directory watchers to reduce CPU load on large project trees. See `ProjectWatcher.ts`.

### Convention: Queue schedulers must not fake executor success

Task queue services may enqueue, schedule, pause, retry, skip, and persist real state transitions before a worker exists, but they must not mark a task as `succeeded` unless an explicit executor completion path supplies a successful exit code. CSV dry runs and generated CLI commands must remain queued, dry-run, or command-generated with clear boundary messages.

---

## Testing Requirements

- New pure functions require unit tests.
- Bug fixes require a regression test verifying the fix.
- When changing the return type of an internal method (e.g., `T` to `T | null`), update all tests that assert on the old behavior.

---

## Code Review Checklist

- [ ] All `execFileAsync` / bounded `spawn` calls include `timeout`
- [ ] Long-lived daemon `spawn` calls omit `timeout` and have explicit heartbeat plus cleanup paths
- [ ] No unknown enum/union values silently mapped to valid members
- [ ] Polling intervals are reasonable (>= 30s for directory watchers)
- [ ] No `console.log` (use `console.error` / `console.warn` in error paths)
- [ ] No `any` types or non-null assertions

### Convention: Watchdog supervisor must not infer child liveness from parent writes

Outer-supervisor code may create marker files and command plans before an InnerWatchdog process exists, but it must not treat parent-created marker file mtime as proof of child liveness. A child process is considered healthy only after a validated handshake or an explicit channel heartbeat from named-pipe, TCP localhost, or marker-file fallback. Future-dated marker mtime values must be ignored rather than converted into a healthy signal.

### Convention: Inject execution must fail truthfully until a real mode succeeds

Inject dry-runs may normalize actions, hash text, chunk payloads, resolve targets, and write audit records, but execute paths must not report success unless a real mode adapter succeeds. Unavailable pty, UIA, clipboard, or native sendinput paths must return explicit failure kinds such as shim-not-installed, input-not-ready, clipboard-conflict, or native-disabled; they must not be converted into successful injected results.

### Convention: Multi-layer runtime state must use event-driven state machines

Runtime state that spans process, task, and UI layers must be modeled as independent event-driven state machines rather than direct field mutation. Use a coordinator service to route events, persist bounded transition history, evaluate cross-layer assertions, and keep legacy trackers running unchanged during migration. New assertion violations must be auditable, and IPC/preload contracts must return Zod-validated snapshots instead of exposing internal machine objects.

### Convention: Local feedback learning must stay local and bounded

User correction loops must persist feedback locally, avoid telemetry, and keep every learned-weight change conservative. Store feedback records in a durable local database or documented fallback file, redact user notes before audit logging, rate-limit repeated reports per instance, and enforce both per-feedback and cumulative adjustment caps before applying learned weights to runtime scoring.

### Convention: Notification delivery must route through the unified service

Runtime notifications must use the unified notification service rather than scattered renderer toasts or direct Electron notification calls. Keep the shared Zod notification schema as the boundary contract, keep email and webhook disabled until explicitly configured by the user, validate webhook URLs as HTTPS, apply per-channel rate limits, and aggregate repeated non-FATAL notifications by the canonical aggregation key. FATAL notifications must bypass aggregation and still trigger the desktop-bell channel. External delivery failures must degrade to local UI notification and audit channel suspension instead of silently disappearing.

### Convention: IPC handlers must route through the shared rate-limit middleware

Main-process IPC handlers must use the shared rate-limit wrapper instead of per-handler counters. Register every channel with `IpcChannelRegistry`, derive rate classes from the shared Zod IPC rate-limit schema, and keep `R8.C.ipc.rate-limit` flag-off behavior non-blocking while still recording local stats. Development-only overrides must throw `E_VALIDATION` outside development, and malformed persisted runtime artifacts must be skipped defensively instead of crashing unrelated IPC calls.

### Convention: Observability must remain local and bounded

Observability collectors must use shared Zod schemas at IPC/export boundaries, keep samples in bounded local ring buffers, and expose aggregated snapshots rather than privileged raw process internals. Stream subscriptions must return cleanup paths and enforce small subscriber limits. Diagnostic-pack bridges must forward to real local exporters; do not fabricate ZIP files or remote telemetry before the dedicated diagnostic export spec implements them.

## Scenario: Local-only diagnostic and deferred integration contracts

### 1. Scope / Trigger

- Trigger: R8 resilience features added cross-layer IPC/preload/schema contracts for diagnostic packs, permission TTL, deferred cloud sync, and disabled OCR.
- Applies to main-process services, shared Zod schemas, IPC handlers, preload bridges, renderer global types, dependency guard scripts, and tests.

### 2. Signatures

- Diagnostic export: `diagnostic:export`, `diagnostic:preview`, `diagnostic:list-redaction-rules`, `diagnostic:capture-screenshot`, `diagnostic:list-packs`, and `obs:export-diagnostic-pack`.
- Permission TTL: `permission:request`, `permission:check`, `permission:revoke`, `permission:revoke-all`, `permission:list-active`, `permission:configure-policy`, and `permission:expiry-stream`.
- Deferred integrations: `skill:cloud-sync-status`, `skill:cloud-sync-trigger`, `skill:cloud-sync-list-remote`, `ocr:capabilities`, `ocr:recognize`, and `ocr:list-supported-languages`.

### 3. Contracts

- Diagnostic packs must write real local artifacts with a manifest, bounded section payloads, SHA256 metadata, and redaction counts. They must not upload, phone home, or fabricate a ZIP path.
- Permission TTL grants must persist with wall-clock expiry and monotonic grant timestamps. Revoked or expired grants must be denied and auditable.
- Cloud sync must return `E_FEATURE_DEFERRED`, `enabled=false`, and `scheduledRelease='R9'` until a later release implements real sync.
- OCR must return `E_OCR_DISABLED`, `success=false`, and `blocks=[]`; request parsing is allowed, but image decode, OCR engine startup, OCR SDK imports, and network OCR calls are not.

### 4. Validation & Error Matrix

- Invalid diagnostic request -> Zod validation error at IPC boundary.
- Screenshot capture failure -> diagnostic warning, not fake full-pack failure or remote fallback.
- TTL below 1 minute or above 24 hours -> `E_VALIDATION`.
- Permission request over configured rate limit -> `E_RATE_LIMITED`.
- Any cloud-sync trigger in R8 -> `E_FEATURE_DEFERRED`.
- Any OCR recognition request in R8 -> `E_OCR_DISABLED`.
- Cloud/OCR dependency import detected -> dependency guard script fails.

### 5. Good/Base/Bad Cases

- Good: export a local diagnostic artifact directory, redact sensitive strings, and list the artifact through `diagnostic:list-packs`.
- Base: return stable disabled/deferred contracts for cloud sync and OCR without loading optional SDKs.
- Bad: return a successful cloud sync, create a fake OCR result, include unredacted secrets in a diagnostic section, or let stale `electron-store` grants pollute permission TTL tests.

### 6. Tests Required

- Shared schema, IPC handler, preload whitelist, and renderer global type tests must be updated together.
- Runtime service tests must prove diagnostic redaction, preview/export parity, permission expiry, revoke, revoke-all, and rate limits with `--maxWorkers=1`.
- Dependency guard scripts must be run for deferred cloud sync and disabled OCR.
- Tests that touch persistent `electron-store` keys must clear task-specific keys before assertions.

### 7. Wrong vs Correct

#### Wrong

```typescript
return { success: true, zipPath: 'diagnostics.zip' }
```

#### Correct

```typescript
return diagnosticPackManifestSchema.parse({
  packId,
  path: artifactPath,
  sections,
  sha256,
  redactionsApplied,
  warnings
})
```

#### Wrong

```typescript
await import('tesseract.js')
return { success: true, text: '' }
```

#### Correct

```typescript
return ocrDisabledResponseSchema.parse({
  success: false,
  errorCode: 'E_OCR_DISABLED',
  blocks: []
})
```

## Scenario: Evidence-backed completion status

### 1. Scope / Trigger

- Trigger: Generated completion, acceptance, or audit artifacts summarize whether a large PRD/spec batch is complete.
- Applies to local verifier scripts, generated JSON/Markdown status files, owner-action queues, strict-completion runners, and any future finish-work automation that consumes those artifacts.

### 2. Contracts

- `complete=true` must be derived from an explicit guard object whose boolean fields are each mapped to source evidence.
- A high-level status such as `acceptanceStatus='complete'`, a generated manifest, or a passing verifier is not sufficient by itself.
- The verifier must recompute the expected guard from source artifacts and reject missing guard keys, non-boolean guard values, guard/source mismatches, and `complete` values that do not equal `Object.values(guard).every(Boolean)`.
- Generated status and audit Markdown must render the guard evidence table so reviewers can see which condition blocks completion without opening raw JSON.
- The completion audit must mirror status guard evidence with source pointers back to the status artifact, and the verifier must reject drift between the status guard rows and audit guard rows.
- Partial PRD/spec rows must have a generated audit dossier that links each source row to its ledger evidence path, strict command, local verification command, and any owner-action dossier commands needed to close non-local blockers.
- False completion guards must have an audit crosswalk to the owner-action queue whenever a blocker maps to a canonical action id, and unmapped blockers must remain strict-only instead of being silently treated as closed.
- Completion audits must also provide owner-action backlinks so each evidence owner can see which guards and blockers a submitted action is expected to unblock.
- Owner-facing closure bundles may be generated from the audit and owner-action queue, but they are execution aids only; verifiers must confirm they cover every current action and must never treat bundle presence as completion evidence.
- When a generated command checklist describes verifier coverage, the generator and verifier must share an exact expected requirement string or otherwise assert exact parity. If verifier coverage expands, the command checklist text, verifier success output, generated audit JSON/Markdown, and self-tests must be updated in the same change.
- When a task PRD names source documents or context files, evidence-pack verifiers must validate the task's `implement.jsonl` and `check.jsonl` rows: each row must parse as JSON, have a non-empty `file` and `reason`, avoid duplicate files, point to an existing repo file, and include every required source document that downstream implementation or checking depends on.
- Owner evidence submissions are a strict schema boundary: unknown wrapper fields must be rejected instead of carried as advisory metadata. Free-form operator, legal, product, or user context belongs in the referenced raw evidence file whose hash, mtime, size, command, and structured content are validated by the submission wrapper.
- Environment-sensitive evidence refreshers must never overwrite a passing elevated report from a non-Administrator Windows shell. Strict runners, acceptance-pack generators, and ledger verifiers must share the same freshness window, preserve the real elevated report inside that window, and require explicit force/admin execution before replacing it.
- A completed owner-action queue is valid when `totalActionCount=0`; local gates must use zero-owner summary/list/matrix queries in that state instead of owner-filtered or action-filtered blocker commands that necessarily no longer exist.

### 3. Good/Base/Bad Cases

- Good: `completionGuard` lists strict pass, partial-row closure, external-gate closure, survey acceptance closure, local-closure exhaustion, and owner queue closure, and `complete` is the conjunction of those values.
- Base: `complete=false` with a mixed guard, guard-to-owner crosswalk, owner-action backlinks, owner closure bundles, a partial-row dossier, and an owner-action queue explaining the remaining non-local evidence.
- Bad: `complete: acceptanceStatus === 'complete'`, `complete=true` because a pack file exists, audit guard evidence that drifts from status guard evidence, treating template-only owner evidence as real evidence, accepting extra owner-submission wrapper fields as if they were validated evidence, downgrading elevated evidence from a non-admin refresh, or failing completion-state checks because owner-specific blocker commands still assume open actions.

### 4. Tests Required

- Generator self-tests must include both all-true and acceptance-status-only incomplete cases.
- Generator self-tests must reject stale command-checklist coverage text after removing a currently verified surface from the expected requirement.
- Verifier self-tests must reject a status object where `acceptanceStatus='complete'` but one or more guard conditions remain false, reject completion-audit guard evidence that drifts from the status artifact, reject guard-to-owner crosswalk drift, reject owner-action backlink drift, reject owner closure bundle drift, reject partial-row dossier command/source drift, reject command-checklist requirement drift, and reject task context JSONL that omits a required source document.
- Owner-evidence verifier self-tests must reject submissions with unknown wrapper fields, and generated owner template README files must tell operators that unknown submission fields are rejected.
- Local completion gates must be rerun in both strict mode and repeatable no-refresh mode after closing external blockers, proving that a completed zero-owner queue remains queryable and that non-admin local checks do not mutate privileged evidence.
