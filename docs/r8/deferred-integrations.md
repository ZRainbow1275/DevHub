# R8 Deferred Integrations

This document records the R8 user-facing boundary for integrations that are intentionally unavailable in this release.

## Skill Cloud Sync

- Status: deferred to R9.
- Feature flag: `R8.C.skill.cloud-sync`, default OFF and treated as unavailable in R8.
- Runtime behavior: `skill:cloud-sync-status`, `skill:cloud-sync-trigger`, and `skill:cloud-sync-list-remote` return disabled/deferred contracts.
- Error contract: sync attempts return `E_FEATURE_DEFERRED`, `enabled=false`, and `scheduledRelease='R9'`.
- Dependency boundary: R8 must not import cloud SDKs or perform external cloud network calls.
- Audit boundary: every cloud-sync status, trigger, disabled compatibility, and remote-list call is recorded as a refused local audit event.

## OCR

- Status: not supported in R8.
- Feature flag: `R8.C.ocr.interface`, hard OFF and not user-enableable in R8.
- Runtime behavior: `ocr:capabilities` returns `enabled=false`; `ocr:recognize` validates request shape but never decodes images, starts OCR engines, imports OCR SDKs, or calls network OCR services.
- Error contract: recognition attempts return `success=false`, `code='E_OCR_DISABLED'`, `errorCode='E_OCR_DISABLED'`, and `blocks=[]`.
- Dependency boundary: R8 must not import OCR engines or cloud OCR SDKs.
- Audit boundary: every OCR capabilities, recognize, and supported-language call is recorded as a refused local audit event.

## Verification

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "cloud sync|OCR|ocr|feature flag|resilience contracts|deferred"
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub typecheck
```
