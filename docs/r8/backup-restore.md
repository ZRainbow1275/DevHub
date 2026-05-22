# R8.C Backup and Restore

## Scope

The backup and restore service persists local classified backup artifacts for R8 runtime state. It covers independent backup and restore categories for settings, CSV tasks, skills, and audit-log review data.

This document covers the verified local R8 backup and restore slice across `R8RuntimeService`, the preload/runtime bridge, `R8OpsPanel` RestoreWizard UI, the backup-content gate, and packaged Electron Playwright coverage.

## Verified Contracts

- Classified backups write real local artifact directories with `manifest.json` plus independent `settings/`, `csv-tasks/`, `skills/`, and `audit-log/` category payloads.
- Each manifest category stores a SHA256 hash. Restore verifies the hash before mutating any destination state and rejects tampered payloads with validation failure.
- Backup payloads redact sensitive field names and token-like strings, including API keys, `sk-`, `tok-`, `AKIA`, bearer tokens, and JWT-like tokens.
- Selective restore supports `settings`, `csv-tasks`, `skills`, and `audit-log` with `overwrite`, `merge`, and `skip` policies.
- Restore creates a spec-34 `pre-recovery` snapshot before mutation when `preRestoreSnapshot` is enabled.
- The default backup schedule is OFF. When enabled, `node-cron@4.2.1` creates a real named scheduled task with `noOverlap: true` and the local timezone.
- Scheduled runs call the same backup path as manual classified backups with `createdBy: 'schedule'`.
- Scheduled retention pruning deletes only backups created by the schedule and does not delete user-created backup artifacts.
- Five consecutive schedule failures disable the persisted schedule and record audit evidence.
- Backup manifest restore migrates `BackupManifest` records from `schemaVersion: "0.9.0"` to the current schema through a dedicated `SchemaMigration` instance before Zod parsing.
- Backup creation writes both deterministic local artifact directories and a real deflated `.zip` container with `manifest.zipPath` pointing at the generated ZIP.
- `scripts/verify-backup-content.mjs` scans real backup artifact files, directories, and ZIP entries, exits non-zero when forbidden secret patterns are present, and rejects unsupported ZIP compression methods instead of silently passing unscanned payloads.
- `R8OpsPanel` exposes a RestoreWizard with the four category checkboxes, backup selector, conflict policy selector, optional pre-restore snapshot, destructive second confirmation, selected-category backup creation, and selected-category restore status.

## Feature Flag

- `R8.C.backup.restore` gates backup and restore operations and defaults to ON for R8.

## Runtime Integration

The runtime bridge exposes these backup calls:

- `backup:create`
- `backup:list`
- `backup:restore`
- `backup:delete`
- `backup:configure-schedule`
- `backup:schedule-config`
- `backup:export-classified`

The Settings data ownership panel also reuses this classified backup path through `data-ownership:export-all`. See `docs/r8/data-ownership.md` for the local path inventory and in-app data viewer contract.

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "backup schedule|node-cron|backup content|schema migration|classified local backup|selected backup categories|tampered classified backup|exports and deletes classified"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "backup|Backup|restore|Restore|schema migration|node-cron|backup content"
pnpm -C devhub exec vitest run src/renderer/components/monitor/R8OpsPanel.test.tsx --maxWorkers=1
pnpm -C devhub check:backup-content -- <clean-backup-artifact-path>
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/R8OpsPanel.tsx src/renderer/components/monitor/R8OpsPanel.test.tsx e2e/example.spec.ts scripts/verify-backup-content.mjs
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.C spec-35" --reporter=line
node --check devhub/scripts/verify-backup-content.mjs
git -C devhub -c safe.directory='D:/Desktop/CREATOR ONE/devhub' diff --check -- package.json pnpm-lock.yaml scripts/verify-backup-content.mjs src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.ts src/renderer/components/monitor/R8OpsPanel.tsx src/renderer/components/monitor/R8OpsPanel.test.tsx e2e/example.spec.ts docs/r8/backup-restore.md
```

## Boundaries

- No known spec-35 blocker remains for the local R8 scope.
- Current restore coverage targets backups created by this local R8 implementation; external ZIP import-only recovery remains future release hardening.
- Larger backup performance fixtures and packaged installer upgrade-path validation remain future release hardening, not current spec-35 blockers.
