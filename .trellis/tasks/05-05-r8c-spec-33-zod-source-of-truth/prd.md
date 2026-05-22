# R8.C spec-33 Zod Source of Truth Implementation

## Scope

Implement `prompts/0503-2/R8.C/spec-33-zod-source-of-truth.md` as an executable DevHub vertical slice, continuing from the verified spec-32 observability panel.

## Non-Negotiable Constraints

- Preserve all existing schemas, IPC channels, runtime handlers, preload APIs, renderer surfaces, tests, and compatibility wrappers.
- No mock production paths and no simulated validation success. Every exposed validation path must use real Zod schemas from `src/shared/schemas`.
- Keep the implementation incremental. Do not rewrite all legacy `types-extended.ts` interfaces in this slice; enforce drift through a verifier with an explicit legacy allowlist and migrate newly touched runtime contracts to `z.infer`.
- IPC request and response guard failures must return structured `E_VALIDATION` payloads or throw typed validation errors at the IPC boundary, not crash the process silently.
- Keep resource usage low while validating. Use `--maxWorkers=1` for tests.

## Required Capabilities

- Add centralized shared schema exports and metadata:
  - `src/shared/schemas/index.ts`
  - `src/shared/schemas/_meta.ts`
- Add main-process Zod infrastructure:
  - `SchemaRegistry`
  - `IpcSchemaGuard`
  - `SchemaMigration`
- Promote the existing `zod:list-schemas`, `zod:validate-payload`, and `zod:migration-status` channels from ad-hoc methods to schema-backed services.
- Add request/response schemas for schema metadata, IPC schema pairs, validation verdicts, migration steps, and zod channel payloads.
- Add a real `scripts/verify-zod-sot.ts` CI verifier that scans shared schemas, runtime channel handlers, and legacy type definitions. It must fail on unregistered schema references or newly duplicated shared type definitions while allowing documented legacy debt.
- Add npm scripts and tests for the registry, IPC guard, migration status, and verifier.
- Update docs/spec status with exact validation evidence.

## Acceptance Criteria

- [x] `r8RuntimeSchemaRegistry` remains the source of schema names and is exposed through a typed registry service.
- [x] `zod:list-schemas` returns versioned metadata, not only raw names.
- [x] `zod:validate-payload` validates against real registered schemas and returns structured issue paths/messages.
- [x] `zod:migration-status` reports current schema version and real migration step metadata.
- [x] IPC guard can parse request and response schemas and returns structured `E_VALIDATION` failures for invalid payloads.
- [x] Verifier script detects missing schema exports and duplicated non-`z.infer` type aliases outside the documented legacy allowlist.
- [x] `package.json` exposes a low-cost `check:zod-sot` gate.
- [x] Targeted tests, typecheck, lint/no-emoji, and relevant regressions pass with low concurrency.

## Verification Evidence

- `pnpm check:zod-sot` passed on 2026-05-05. It validates schema index coverage, spec-33 runtime registry entries, guarded zod IPC handlers, and legacy duplicate type allowlisting.
- `pnpm typecheck` passed on 2026-05-05.
- `pnpm test --run src/main/services/zod/SchemaRegistry.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1` passed: 5 files, 78 tests.
- `pnpm lint` passed and includes `pnpm check:no-emoji`; no emoji found in 436 files.
- `pnpm check:license` passed: 422 production package entries validated and 1 manifest exception retained.
- `pnpm test --run --maxWorkers=1` passed: 90 files, 634 tests.
- `git diff --check` and `git -C .. diff --check` passed.

## Implementation Notes

- `src/shared/schemas/index.ts` uses namespace exports for individual schema modules and a top-level `r8-runtime` export to avoid existing duplicate schema names.
- `SignalContribution` remains in a documented verifier allowlist as legacy debt rather than being silently claimed migrated.
- `zod:validate-payload` now parses its IPC request with `zodValidatePayloadRequestSchema` and delegates to `SchemaRegistry.safeParse`-backed validation.

## Completion Boundary

This task completes spec-33 only. It must not claim a full rewrite of every historical interface in `types-extended.ts`, packaged CI workflow rollout, or completion of spec-34 crash recovery.
