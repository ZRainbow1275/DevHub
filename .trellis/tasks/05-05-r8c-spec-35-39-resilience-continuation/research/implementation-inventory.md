# R8.C spec-35..39 Implementation Inventory

## Existing Surfaces Found

- `devhub/src/shared/feature-flags.ts` already declares `R8.C.backup.restore`, `R8.C.diagnostic.export`, `R8.C.permission.ttl`, `R8.C.skill.cloud-sync`, and `R8.C.ocr.interface`.
- `devhub/src/shared/schemas/r8-runtime.ts` already has lightweight channels and schemas for backup, diagnostic, permission, cloud sync disabled, and OCR disabled contracts.
- `devhub/src/main/services/R8RuntimeService.ts` already contains lightweight methods for `createBackup`, `listBackups`, `restoreBackup`, `deleteBackup`, `exportDiagnosticPack`, `cloudSyncDisabled`, and `recognizeOcr`.
- `devhub/src/main/ipc/r8RuntimeHandlers.ts` already wires lightweight legacy channels for `backup:create/list/restore/delete`, `diagnostic:export/list/purge`, `permission:ttl-config/confirm/allowlist/reset`, `skill:cloud-sync-disabled`, and `ocr:recognize`.
- `devhub/src/preload/index.ts` and `devhub/src/renderer/types/global.d.ts` already expose matching lightweight renderer APIs.

## Known Gaps Against specs 35..39

- Backup is not yet a classified schema-versioned bundle with per-category sha256, redacted files, schedule config, restore plan, and pre-restore snapshot verification.
- Diagnostic export is not yet a full local pack builder with nine independent sections, preview, redactor rule listing, screenshot request contract, and redacted ZIP manifest.
- Permission TTL is not yet the spec-37 seven-channel grant/check/revoke/list/configure/stream contract with persistent grant policies for eight sensitive operations.
- Cloud sync is currently a single disabled method, not the three spec-38 channels with full Zod contracts and no-cloud dependency verifier.
- OCR is currently a single disabled recognize method, not the three spec-39 channels with capabilities, supported languages, full Zod contracts, and no-OCR dependency verifier.

## Implementation Guidance

- Extend existing R8RuntimeService/IPC/preload patterns rather than introducing a parallel stack.
- Add new domain schema files and namespace exports, then register their schemas in `r8RuntimeSchemaRegistry`.
- Keep legacy methods/channels compatible where they already exist.
- Use real local filesystem artifacts for backup and diagnostic tests. A deterministic local archive format is acceptable only if it is a real file artifact and explicitly documented; do not return fake paths.
- Use dependency-injected roots and temporary directories in tests; no mock success responses.
- Preserve low resource usage by using `--maxWorkers=1`.

## External Practice Check 2026-05-05

Grok Search query: `Electron desktop application diagnostic bundle export redaction best practices local-only no telemetry backup restore manifest sha256`.

Relevant public references returned:

- Cloudera diagnostic bundle redaction guidance: `https://docs.cloudera.com/cdp-private-cloud-base/7.1.8/monitoring-and-diagnostics/topics/cm-redaction-of-sensitive-information-diagnostic-bundles.html`
- Confluent diagnostics tooling docs: `https://docs.confluent.io/platform/current/tools/diagnostics-tool.html`
- Electron crash reporter docs: `https://electronjs.org/docs/latest/api/crash-reporter`
- Electron security tutorial: `https://electronjs.org/docs/latest/tutorial/security`

Findings to apply:

- Diagnostic exports should be user-initiated, local filesystem only, and must not upload automatically.
- Bundles should include a manifest with file list, versions, timestamps, and SHA256 hashes.
- Redaction should cover emails, local paths with usernames, API keys, tokens, passwords, JWTs, and IPs before export.
- Screenshots and raw memory/crash data are privacy-sensitive and should be opt-in or omitted.
- Restore/import should validate manifest hashes before processing and refuse tampered bundles.
- Electron file I/O should stay in the main process behind typed IPC with context isolation preserved.

## Context7 Node.js API Check 2026-05-05

Context7 library: `/nodejs/node`.

Findings to apply without adding archive dependencies:

- Use `node:fs/promises` for asynchronous filesystem operations, but avoid concurrent writes to the same file path.
- Use `node:crypto` `createHash('sha256')` for per-file and bundle integrity.
- Use `node:stream/promises` `pipeline()` with `node:zlib` streams when compression is needed; `pipeline()` handles stream errors more safely than manual `pipe()` chains.
- If a deterministic directory artifact is used instead of a ZIP because no archive dependency is installed, it must still be a real local artifact with manifest and sha256 validation. Do not return fake ZIP paths.
