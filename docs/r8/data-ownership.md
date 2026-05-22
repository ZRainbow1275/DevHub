# R8 Data Ownership

## Scope

The data ownership slice exposes the local data locations DevHub uses on the current machine and connects them to an in-app viewer plus a classified ZIP export path.

This is a local-only feature. It does not upload, sync, or fabricate data. The runtime service reads real paths under Electron `userData` and related local stores, validates every IPC boundary with Zod, and reuses the classified backup pipeline for export.

## User-Facing Contracts

- Settings contains a `Data / OWNERSHIP` category.
- The panel lists local storage roots including the Electron `userData` directory, settings store, R8 runtime store, task queue SQLite database, CSV task directory, skills directories, recordings, backups, diagnostics, audit logs, feedback, injection databases, and recovery snapshots.
- Each root displays existence, kind, sensitivity, exportability, file count, byte size, last update time, and truncation state.
- The app data viewer can inspect a selected root and browse real directory entries up to a bounded limit.
- Path traversal is rejected before directory listing. Requests outside the selected root fail with `E_DATA_OWNERSHIP_PATH_OUT_OF_SCOPE`.
- `Export all local data` calls the same classified backup path as R8.C backup restore and creates a real ZIP archive for `settings`, `csv-tasks`, `skills`, and `audit-log`.
- Exported data uses the existing backup redaction and manifest-hash contracts; sensitive entries are visible as local paths but are not uploaded.
- Imported or legacy settings fields whose key names look like secrets (`apiKey`, `token`, `secret`, `password`, `credential`, `authorization`, and SMTP password variants) are protected at the `AppStore` persistence boundary with Electron `safeStorage` envelopes before they are written to disk. This keeps the R8 rule of no API-key input UI while preventing imported secret-shaped fields from being stored as plaintext.
- The Windows NSIS uninstaller asks whether DevHub local data should also be deleted. The prompt defaults to keeping data, is skipped during update flows, and deletes only the fixed DevHub application-data directories under `%APPDATA%\DevHub` and `%LOCALAPPDATA%\DevHub` when the user explicitly chooses Yes.

## IPC and Schema Contracts

The runtime bridge exposes these data ownership calls:

- `data-ownership:list-paths`
- `data-ownership:list-entries`
- `data-ownership:export-all`

The shared Zod source of truth includes:

- `DataOwnershipRootCategory`
- `DataOwnershipPathKind`
- `DataOwnershipPathSummary`
- `DataOwnershipListPathsResponse`
- `DataOwnershipListEntriesRequest`
- `DataOwnershipEntry`
- `DataOwnershipListEntriesResponse`
- `DataOwnershipExportAllRequest`

## Implementation Map

- `src/shared/schemas/r8-runtime.ts` defines channel registration, namespaces, schemas, and exported types.
- `src/main/services/R8RuntimeService.ts` implements root discovery, directory summarization, scoped entry listing, traversal protection, and classified ZIP export.
- `src/main/ipc/r8RuntimeHandlers.ts` registers the three data ownership IPC handlers behind the shared rate-limit wrapper.
- `src/preload/index.ts` exposes `window.devhub.r8.dataOwnership`.
- `src/renderer/types/global.d.ts` keeps renderer global types aligned with the preload bridge.
- `src/renderer/components/settings/SettingsDialog.tsx` renders the Settings data ownership category, path inventory, entry viewer, open-path actions, and export action.
- `src/main/store/AppStore.ts` encrypts imported or legacy secret-shaped settings values at rest through Electron `safeStorage` before writing to `electron-store`.
- `build/installer.nsh` defines the NSIS `customUnInstall` prompt for uninstall-time local data deletion.
- `scripts/verify-nsis-uninstall-data-prompt.mjs` verifies the NSIS include wiring, update guard, default-safe prompt, and scoped delete paths.
- `prompts/0421/contracts/23-ipc-contracts-master.md` whitelists the public renderer invoke channels.

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/settings/SettingsDialog.data-ownership.test.tsx --maxWorkers=1 -t "data ownership|Data Ownership|SettingsDialog data ownership"
pnpm -C devhub exec vitest run src/main/store/AppStore.test.ts --maxWorkers=1 -t "safeStorage|sensitive settings|Settings Management"
pnpm -C devhub check:nsis-uninstall-data
pnpm -C devhub exec tsc --noEmit --pretty false
```

## Boundaries

- Uninstall-time data deletion is implemented in the Windows NSIS uninstaller only. Development-mode runs do not trigger it.
- The uninstaller intentionally does not follow `DEVHUB_USER_DATA_DIR` because that value can point outside the fixed DevHub profile. Custom user-data roots remain operator-managed.
- This slice does not add API-key input UI. The R8 master PRD requires users to configure API keys in their CLI tools, so DevHub protects imported or legacy secret-shaped settings fields rather than introducing new credential forms.
- The viewer is intentionally bounded to keep the Settings dialog responsive on large local profile directories.
