# R8.C spec-35..39 Resilience Continuation

## Scope

Continue the `prompts/0503-2` implementation after the completed spec-34 crash recovery slice by implementing and verifying the downstream R8.C resilience specs:

- `prompts/0503-2/R8.C/spec-35-backup-restore.md`
- `prompts/0503-2/R8.C/spec-36-diagnostic-pack-export.md`
- `prompts/0503-2/R8.C/spec-37-permissions-time-bounded.md`
- `prompts/0503-2/R8.C/spec-38-skill-cloud-sync-deferred.md`
- `prompts/0503-2/R8.C/spec-39-ocr-interface-disabled.md`

This task is a continuation slice, not a claim that every `prompts/0503-2` R8.A/R8.B/R8.C document is complete.

## Non-Negotiable Constraints

- Preserve all existing modules, components, IPC channels, renderer surfaces, compatibility APIs, tests, docs, and schema registry behavior.
- No mock, fake success, fake ZIP, fake restore, fake diagnostic export, fake permission grant, fake cloud sync, or fake OCR.
- Keep cloud sync deferred and OCR disabled. These interfaces must be contract-complete while making zero network calls and importing zero cloud/OCR SDKs.
- Backup and diagnostic exports must be local-only and redact secrets, API keys, tokens, usernames, hostnames, paths, and IP addresses where applicable.
- Restore paths must create a pre-restore snapshot before overwriting any user state.
- Destructive/stateful operations must require explicit confirmation and produce audit records.
- Use existing design language and installed icon components only; no emoji.
- Keep validation schema-first through shared Zod schemas and synchronized IPC/preload contracts.
- Keep validation low-resource: use `--maxWorkers=1` for Vitest.

## Required Capabilities

### spec-35 Backup Restore

- Add shared backup schemas for categories, manifests, schedule config, restore plans, restore results, and delete/export responses.
- Create local classified backup bundles for `settings`, `csv-tasks`, `skills`, and `audit-log`.
- Store a manifest with `schemaVersion`, per-category `sha256`, file counts, sizes, total size, createdBy, redacted fields, and bundle path.
- Redact API keys and tokens before writing backup content.
- Verify sha256/category integrity before restore.
- Support selective restore by category and conflict policy.
- Create a pre-restore snapshot before restoring selected categories.
- Support schedule config and retention metadata with schedule disabled by default.
- Wire `backup:create`, `backup:list`, `backup:restore`, `backup:delete`, `backup:configure-schedule`, and `backup:export-classified`.

### spec-36 Diagnostic Pack Export

- Add shared diagnostic-pack schemas for sections, redaction rules, options, preview, screenshot request/result, manifest, and list responses.
- Implement a local diagnostic pack builder with independent section collectors for observability snapshot, audit log, state-machine history, misreport records, system info, screenshots, recovery report, feature flags, and redacted environment/config.
- Add a redactor with at least the default API key, GitHub token, AWS key, JWT, Windows path, POSIX path, username/hostname, email, and IPv4 patterns.
- Provide preview with per-section sample text capped to 2 KB and redaction counts.
- Keep screenshots default-off; screenshot failure should add warnings and not fail the whole pack.
- Produce a real local ZIP or deterministic archive artifact with a manifest; do not upload or phone home.
- Wire `obs:export-diagnostic-pack`, `diagnostic:preview`, `diagnostic:list-redaction-rules`, `diagnostic:capture-screenshot`, `diagnostic:list-packs`, and legacy `diagnostic:export/list/purge` compatibility.

### spec-37 Permission TTL

- Add shared permission TTL schemas for sensitive operations, grant scope, grants, policies, check results, request/revoke/list/configure responses, and expiry-stream payloads.
- Implement persistent TTL grants with wall-clock expiry and monotonic timestamps for the current process.
- Cover the eight sensitive operations: `inject`, `shim-install`, `kill-pid`, `file-write`, `fs-elevated`, `webhook`, `smtp`, and `store-api-key`.
- Default TTL is 30 minutes, allowed range is 1 minute to 24 hours.
- Support check, request, revoke, revoke-all, list-active, configure-policy, and a throttled expiry stream.
- Revoked or expired grants must be immediately denied and audited.

### spec-38 Cloud Sync Deferred

- Add shared cloud-sync schemas for provider, remote manifest, conflict policy, sync request/result, status, and remote list response.
- Implement a facade that always returns `E_FEATURE_DEFERRED`, `scheduledRelease='R9'`, `enabled=false`, no pending remote skills, and no network calls.
- Wire `skill:cloud-sync-status`, `skill:cloud-sync-trigger`, and `skill:cloud-sync-list-remote`.
- Add a no-cloud-deps verifier script that fails on cloud SDK dependencies/imports.
- Keep `R8.C.skill.cloud-sync` default OFF.

### spec-39 OCR Disabled

- Add shared OCR schemas for languages, request, text block, result, capabilities, and supported languages response.
- Implement an OCR facade that always returns `E_OCR_DISABLED`, `success=false`, `blocks=[]`, and `enabled=false`.
- Wire `ocr:capabilities`, `ocr:recognize`, and `ocr:list-supported-languages`.
- Add a no-OCR-deps verifier script that fails on OCR package dependencies/imports.
- Keep `R8.C.ocr.interface` hard-disabled for R8.

## Acceptance Criteria

- [x] Backup create/list/delete/export-classified produce real local artifacts and manifests.
- [x] Backup restore verifies sha256, creates pre-restore snapshot, and restores only selected categories.
- [x] Backup redaction tests prove `sk-`, `tok-`, `AKIA`, JWT-like tokens, and common secret keys do not survive in bundle content.
- [x] Diagnostic preview and export produce real local artifacts with redaction counts and no screenshots unless requested.
- [x] Diagnostic export includes recovery reports and can forward from `obs:export-diagnostic-pack`.
- [x] Permission TTL grants expire, persist, revoke, revoke-all, and rate-limit according to spec.
- [x] Cloud sync exposes all deferred channels and returns `E_FEATURE_DEFERRED` without network dependencies.
- [x] OCR exposes all disabled channels and returns `E_OCR_DISABLED` without OCR dependencies.
- [x] Shared Zod registry, IPC channel registry, preload whitelist, and renderer global types are synchronized for spec-35.
- [x] Existing legacy backup channels and renderer bridge call shapes remain compatible.
- [x] Targeted tests, typecheck, lint/no-emoji, license check, Zod SoT check, no-cloud/no-OCR dependency checks, and diff whitespace checks pass.

## Completion Boundary

This task completes R8.C specs 35 through 39 only. It does not complete the remaining R8.A/R8.B documents or all 81 markdown files under `prompts/0503-2`.

## Implementation Progress 2026-05-05

### spec-35 Backup Restore

- Completed executable main-process slice for classified local backup artifacts, category manifests, redaction, SHA256 restore verification, selective restore, pre-restore checkpoints, explicit export/delete, schedule config persistence, IPC handlers, preload bridge, renderer global types, and registry synchronization.
- Tests passed: `pnpm -C devhub typecheck`; schema/IPC/preload contract Vitest; focused backup create/restore/tamper/export/delete/schedule Vitest with `--maxWorkers=1`.
- Full `R8RuntimeService.test.ts` was also run; 48 of 49 tests passed and the remaining failure is the pre-existing/resource-sensitive `opens monitor BrowserWindow via R8.B popout bridge and applies guarded prefs` timeout, not a spec-35 backup assertion.

### spec-36 Diagnostic Pack Export

- Completed executable local diagnostic pack slice for deterministic on-disk artifact directories, manifest JSON, independent section files, SHA256 section hashes, redaction counts, preview parity, optional screenshot capture, diagnostic pack listing, and `obs:export-diagnostic-pack` forwarding.
- Redaction rules cover API keys, `tok-` secrets, GitHub tokens, AWS keys, JWT-like strings, bearer tokens, Windows/POSIX paths, usernames, hostnames, email addresses, and IPv4 addresses. Preview samples are capped at 2 KB per section.
- Screenshots remain default-off. Screenshot failure is represented as pack warnings and does not make the whole export pretend to fail or succeed remotely.

### spec-37 Permission TTL

- Completed persistent TTL grant slice for request/check/revoke/revoke-all/list-active/configure-policy/expiry payloads, wall-clock expiry, monotonic grant timestamp recording, policy bounds, request rate limits, and audit records.
- Covered sensitive operations: `inject`, `shim-install`, `kill-pid`, `file-write`, `fs-elevated`, `webhook`, `smtp`, and `store-api-key`.
- Added test isolation for the real `electron-store` permission grant key so local operator grants cannot pollute deterministic `revoke-all` assertions.

### spec-38 Cloud Sync Deferred

- Completed contract facade for `skill:cloud-sync-status`, `skill:cloud-sync-trigger`, and `skill:cloud-sync-list-remote`.
- All calls return `enabled=false`, `scheduledRelease='R9'`, and `E_FEATURE_DEFERRED` without network calls, cloud SDK imports, or remote skill entries.
- Added `check:no-cloud-deps` and `scripts/verify-no-cloud-deps.mjs`.

### spec-39 OCR Disabled

- Completed disabled OCR contract for `ocr:capabilities`, `ocr:recognize`, and `ocr:list-supported-languages`.
- `ocr:recognize` validates request shape but does not decode images or call an OCR engine; it returns `success=false`, `errorCode='E_OCR_DISABLED'`, and `blocks=[]`.
- Added `check:no-ocr-deps` and `scripts/verify-no-ocr-deps.mjs`.

### Verification 2026-05-05

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm check:no-cloud-deps
pnpm check:no-ocr-deps
pnpm typecheck
pnpm test --run src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "diagnostic packs|permission TTL|deferred cloud sync|OCR facades"
pnpm check:zod-sot
pnpm check:no-emoji
pnpm check:license
pnpm lint
git diff --check
```

Results:

- No-cloud dependency verifier: passed.
- No-OCR dependency verifier: passed.
- TypeScript typecheck: passed.
- Schema/IPC/preload contract regression: 3 files passed, 31 tests passed with `--maxWorkers=1`.
- Focused spec-36..39 service regression: 1 file passed, 3 tests passed with `--maxWorkers=1`.
- Zod SoT, no-emoji, license, lint, and whitespace checks passed. Git reported only existing LF-to-CRLF warnings during `git diff --check`.

### Remaining Scope

- No remaining executable scope for R8.C spec-35..39 in this task.
- Not claimed complete: all remaining R8.A/R8.B/R8.C documents under `prompts/0503-2`, renderer backup/diagnostic management views, real background backup cron execution, future R9 cloud sync, future OCR implementation, or packaged long-run soak.
