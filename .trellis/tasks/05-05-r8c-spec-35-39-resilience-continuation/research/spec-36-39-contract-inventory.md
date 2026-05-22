# Research: spec-36-39-contract-inventory

- Query: Inventory the current DevHub contract surface for R8.C spec-36 diagnostic pack export, spec-37 permission TTL, spec-38 cloud sync deferred, and spec-39 OCR disabled; identify required landing zones for channels, schemas, services, tests, and docs.
- Scope: internal
- Date: 2026-05-05

## Findings

### Files found

- `.trellis/tasks/05-05-r8c-spec-35-39-resilience-continuation/prd.md` — task PRD marking spec-35 done and spec-36..39 still pending.
- `prompts/0503-2/R8.C/spec-36-diagnostic-pack-export.md` — required diagnostic-pack channels, schemas, and affected files.
- `prompts/0503-2/R8.C/spec-37-permissions-time-bounded.md` — required TTL permission contracts and affected files.
- `prompts/0503-2/R8.C/spec-38-skill-cloud-sync-deferred.md` — required deferred cloud-sync facade contracts.
- `prompts/0503-2/R8.C/spec-39-ocr-interface-disabled.md` — required OCR-disabled facade contracts.
- `.trellis/spec/frontend/index.md` — frontend spec index is still template-level and adds no project-specific rules for this slice.
- `.trellis/spec/backend/index.md` — backend spec index is still template-level and adds no project-specific rules for this slice.
- `devhub/src/shared/feature-flags.ts` — feature-flag defaults and status for specs 36-39.
- `devhub/src/shared/schemas/r8-runtime.ts` — monolithic R8 IPC registry plus the current legacy placeholder schemas for specs 36-39.
- `devhub/src/shared/schemas/observability.ts` — current observability diagnostic-pack bridge contract.
- `devhub/src/main/services/R8RuntimeService.ts` — current implementation for permission storage, diagnostic export, deferred cloud sync, and disabled OCR.
- `devhub/src/main/ipc/r8RuntimeHandlers.ts` — current IPC handlers still bind legacy spec-36..39 channel names.
- `devhub/src/preload/index.ts` — renderer bridge still exposes only legacy diagnostic/skill/ocr APIs.
- `devhub/src/shared/schemas/r8-runtime.test.ts` — registry tests pin current legacy channels.
- `devhub/src/main/services/R8RuntimeService.test.ts` — service tests currently cover spec-35 deeply and spec-36..39 only lightly.
- `devhub/package.json` and `devhub/scripts/*` — existing checks cover no-emoji, license, and Zod SoT; no no-cloud/no-OCR verifier scripts exist yet.

### Code patterns

- Feature flags already exist for all four specs, but `isFeatureEnabled` still permits override activation for disabled flags, including OCR, despite spec-39 calling for a hard-disabled interface (`devhub/src/shared/feature-flags.ts:161-164`, `devhub/src/shared/feature-flags.ts:199-200`, `devhub/src/shared/feature-flags.test.ts:31-37`).
- The runtime registry still exposes legacy spec-36..39 channels: `skill:cloud-sync-disabled`, `diagnostic:export/list/purge`, `permission:ttl-config/confirm/allowlist/reset`, and only `ocr:recognize` (`devhub/src/shared/schemas/r8-runtime.ts:373`, `devhub/src/shared/schemas/r8-runtime.ts:444-450`, `devhub/src/shared/schemas/r8-runtime.ts:471`).
- Prompt-declared compatibility channels are already tracked separately: `diagnostic:share-config`, `obs:export-diagnostic-pack`, `permission:allowlist:list`, `permission:allowlist:revoke`, and `permission:ttl-stream` (`devhub/src/shared/schemas/r8-runtime.ts:518`, `devhub/src/shared/schemas/r8-runtime.ts:553`, `devhub/src/shared/schemas/r8-runtime.ts:558-560`).
- The current permission schema is far smaller than spec-37 requires: it only models `operation`, `subject`, `grantedAt`, `expiresAt`, and `confirmedBy` (`devhub/src/shared/schemas/r8-runtime.ts:1144-1150`).
- The current diagnostic export schema is far smaller than spec-36 requires: it only exposes four booleans and has no manifest, section enum, preview, screenshot contract, or redaction-rule model (`devhub/src/shared/schemas/r8-runtime.ts:1254-1259`).
- The current OCR schema is also minimal: only a request with `imagePath/imageBase64` and a disabled response object (`devhub/src/shared/schemas/r8-runtime.ts:1279-1288`).
- Current permission behavior is raw store filtering by `Date.now()` with no TTL manager, no grant IDs, no revoke model, no policy configuration, and no monotonic-clock handling (`devhub/src/main/services/R8RuntimeService.ts:1262-1271`, `devhub/src/main/services/R8RuntimeService.ts:3146-3153`).
- Current diagnostic export writes one redacted JSON file into `userData/diagnostics`; there is no section collector pipeline, preview, screenshot warning channel, archive builder, or manifest object (`devhub/src/main/services/R8RuntimeService.ts:1315-1336`).
- `obs:export-diagnostic-pack` currently just forwards into `exportDiagnosticPack` and returns `zipPath: null`, so the observability bridge is not yet a real pack export (`devhub/src/main/services/R8RuntimeService.ts:2889-2902`, `devhub/src/shared/schemas/observability.ts:85-94`).
- Current cloud-sync behavior is a single legacy method returning `E_SKILL_CLOUD_SYNC_DEFERRED`; current OCR behavior is a single disabled response method (`devhub/src/main/services/R8RuntimeService.ts:1383-1389`).
- Handler and preload layers are aligned to the same legacy surface: handlers register old 36-39 channels and preload only exposes `diagnostic.export/list/purge`, `skill.cloudSyncDisabled`, and `ocr.recognize` (`devhub/src/main/ipc/r8RuntimeHandlers.ts:225-240`, `devhub/src/main/ipc/r8RuntimeHandlers.ts:578-604`, `devhub/src/main/ipc/r8RuntimeHandlers.ts:635`, `devhub/src/preload/index.ts:342-345`, `devhub/src/preload/index.ts:347-363`, `devhub/src/preload/index.ts:403-404`).
- Existing tests currently pin the legacy registry and only lightly cover spec-36..39 behavior: `diagnostic:purge` confirmation, `permission:reset` confirmation, and one disabled cloud/OCR assertion (`devhub/src/shared/schemas/r8-runtime.test.ts:56-114`, `devhub/src/main/services/R8RuntimeService.test.ts:1091-1096`, `devhub/src/main/services/R8RuntimeService.test.ts:1250-1254`).

### Contract inventory checklist

#### spec-36 diagnostic pack export

- Channels:
  - Add `diagnostic:preview`, `diagnostic:list-redaction-rules`, `diagnostic:capture-screenshot`, and `diagnostic:list-packs`.
  - Keep compatibility for `diagnostic:export`, `diagnostic:list`, `diagnostic:purge`, and `obs:export-diagnostic-pack`.
  - Expected landing zones: `devhub/src/shared/schemas/r8-runtime.ts`, `devhub/src/main/ipc/r8RuntimeHandlers.ts`, `devhub/src/preload/index.ts`.
- Schema:
  - Add a dedicated `devhub/src/shared/schemas/diagnostic-pack.ts`.
  - Model section enum, redaction rules, pack options, preview rows, screenshot request/result, manifest, and list response.
  - Keep `observabilityDiagnosticPackRequest/Response` as a compatibility adapter, not the source of truth.
- Service:
  - Add builder/redactor/collector files under `devhub/src/main/services/diagnostic/`.
  - Replace the JSON-only `exportDiagnosticPack` implementation with a real archive + manifest + warning pipeline.
  - Keep `obs:export-diagnostic-pack` forwarding into the same builder so there is only one pack path.
- Tests:
  - Extend registry coverage in `r8-runtime.test.ts` for new channels and compatibility entries.
  - Add handler coverage in `r8RuntimeHandlers.test.ts` for preview/list/capture/list-packs plus observability forwarding.
  - Add service-level tests for redaction counts, preview 2 KB cap, screenshot failure warnings, archive manifest, and local-only export.
- Docs:
  - Add user-facing "local only / no upload" and "screenshots default OFF" messaging.
  - Keep the task PRD acceptance notes synchronized once preview/export behavior is implemented.

#### spec-37 permission TTL

- Channels:
  - Add `permission:check`, `permission:request`, `permission:revoke`, `permission:revoke-all`, `permission:list-active`, `permission:configure-policy`, and `permission:expiry-stream`.
  - Decide whether existing `permission:ttl-config/confirm/allowlist/reset` plus prompt-declared `permission:allowlist:list/revoke` and `permission:ttl-stream` remain as compat aliases or are migrated behind adapters.
- Schema:
  - Add a dedicated `devhub/src/shared/schemas/permission-ttl.ts`.
  - Model the 8 sensitive ops, grant scope, grant IDs, TTL bounds, monotonic timestamps, revoke metadata, policy, check result, responses, and expiry-stream payload.
- Service:
  - Add `PermissionTtlManager` / `PermissionStore` or an equivalent persistent manager layer.
  - Move away from raw array storage toward active+revoked state, expiry evaluation, policy configuration, revoke-all, and audit-ready transitions.
- Tests:
  - Add expiry, revoke, revoke-all, restart persistence, TTL range validation, policy configuration, and throttled stream tests.
  - Expand registry and handler coverage to the new channel set.
- Docs:
  - Surface default TTL 30 minutes, allowed range 1 minute to 24 hours, 8 sensitive ops, and revoke-all behavior in user-facing copy/help text.

#### spec-38 cloud sync deferred

- Channels:
  - Add `skill:cloud-sync-status`, `skill:cloud-sync-trigger`, and `skill:cloud-sync-list-remote`.
  - Preserve `skill:cloud-sync-disabled` only if a compatibility shim is needed.
- Schema:
  - Add a dedicated `devhub/src/shared/schemas/skill-cloud-sync.ts`.
  - Model provider, remote manifest, conflict policy, request/result, status, and remote-list response.
- Service:
  - Add `CloudSyncFacade` that always returns `E_FEATURE_DEFERRED`, `scheduledRelease='R9'`, `enabled=false`, and zero remote items.
  - Keep the implementation strictly zero-network and zero-cloud-SDK.
- Tests:
  - Add schema/registry/handler/service tests for all three channels.
  - Add verifier coverage for a new `devhub/scripts/verify-no-cloud-deps.ts`.
- Docs:
  - Add user-facing "R9 启用" / deferred messaging and a clear no-cloud note.

#### spec-39 OCR disabled

- Channels:
  - Add `ocr:capabilities` and `ocr:list-supported-languages`; keep `ocr:recognize`.
- Schema:
  - Add a dedicated `devhub/src/shared/schemas/ocr.ts`.
  - Model language enum, request, text block, result, capabilities, and supported-language response.
- Service:
  - Add `OcrFacade` that always returns `E_OCR_DISABLED`, `success=false`, `blocks=[]`, `enabled=false`, and no OCR/network dependency.
- Tests:
  - Add schema/registry tests for the expanded OCR channel set.
  - Add handler/service tests for capabilities, recognize, and supported-language list.
  - Add verifier coverage for a new `devhub/scripts/verify-no-ocr-deps.ts`.
- Docs:
  - Add explicit "OCR unsupported in R8" user-facing note.

### Existing gates to reuse

- `devhub/package.json` already wires `lint`, `typecheck`, `test`, `check:no-emoji`, `check:license`, and `check:zod-sot`; specs 38-39 need analogous no-cloud and no-OCR verifier entries added beside those existing checks.

### External references

- No external web docs were consulted in this pass.
- Library/version hints only came from the prompt specs and should be re-verified during implementation: `archiver@7.x`, `systeminformation@5.x`, and `better-sqlite3@11`.

### Related specs

- `prompts/0503-2/R8.C/spec-32-observability-panel.md`
- `prompts/0503-2/R8.C/spec-33-zod-source-of-truth.md`
- `prompts/0503-2/R8.C/spec-34-crash-recovery.md`
- `prompts/0503-2/R8.C/spec-35-backup-restore.md`
- `prompts/0503-2/R8.C/spec-29-misreport-feedback-loop.md`
- `prompts/0503-2/R8.C/spec-31-ipc-rate-limit.md`
- `prompts/0503-2/R8.C/spec-09-skill-library.md`
- R8.A spec-11 permission prompts (dependency called out by the spec-37 prompt)

## Caveats / Not Found

- `python3 ./.trellis/scripts/task.py current --source` returned `Current task: (none)` / `Source: none`; this research artifact was written under the explicitly requested task directory instead of a session-bound active task.
- Frontend/backend spec indexes are still placeholders, so there were no deeper project-specific `.trellis/spec/**` rules to load for this slice.
- No dedicated files currently exist for:
  - `devhub/src/shared/schemas/diagnostic-pack.ts`
  - `devhub/src/shared/schemas/permission-ttl.ts`
  - `devhub/src/shared/schemas/skill-cloud-sync.ts`
  - `devhub/src/shared/schemas/ocr.ts`
  - `devhub/src/main/services/diagnostic/*`
  - `devhub/src/main/services/permission/*`
  - `devhub/src/main/services/skill/CloudSyncFacade.ts`
  - `devhub/src/main/services/ocr/OcrFacade.ts`
  - `devhub/scripts/verify-no-cloud-deps.ts`
  - `devhub/scripts/verify-no-ocr-deps.ts`
- No renderer files matching the prompt-affected `DiagnosticView`, `PreviewDialog`, `PermissionPanel`, `CountdownBadge`, or `CloudSyncPanel` were found.
- Critical drift: OCR is described as hard-disabled, but the current flag helper and test suite still prove it can be force-enabled via override. That needs an explicit resolution before claiming spec-39 compliance.
