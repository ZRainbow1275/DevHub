# R8.B URI Protocol

## Syntax

The supported in-app URI format is:

```text
devhub://<scope>/<id>?host=local&fallback=<key>:<value>,<key>:<value>
```

Supported scopes are `process`, `port`, `window`, `ai-task`, `csv-batch`, `project`, `skill`, and `snapshot`.

## Current Resolver Behavior

`R8RuntimeService.resolveCommandUri` performs these steps:

1. Validate the URI with the shared Zod `CommandResolveUriRequest` schema.
2. Parse `scope`, `id`, `host`, and `fallback`.
3. Check the live scanner snapshot for direct `port`, `process`, and `window` matches.
4. Check process fallback candidates by `exe` and `cwd`.
5. Return a typed `CommandResolvedUri` object with `exists`, `fallbackUsed`, and `candidateCount`.

The resolver is intentionally truth-preserving: missing scanner evidence returns `exists = false` rather than inventing a successful navigation target.

## OS Registration

`command:register-os-protocol` now registers or unregisters `devhub://` through Electron's `app.setAsDefaultProtocolClient`, `app.removeAsDefaultProtocolClient`, and `app.isDefaultProtocolClient` APIs. The action is exposed in Settings -> Advanced -> External URI Protocol and requires a `confirmedBy` value.

Deep links received by an already-running app are handled through the main process single-instance path:

- Windows/Linux: `second-instance` scans the second process argv for the `devhub://` URI.
- macOS: `open-url` receives the URI directly.
- If the renderer is not ready yet, the URI is queued and flushed after the main window finishes loading.
- The renderer resolves the URI through the same `command.resolveUri()` path as pasted in-app URIs.
- The packaged Electron `R8.B spec-04` Playwright scenario verifies this path by registering `devhub://` when needed, opening a real scanner-backed URI through Electron `shell.openExternal()`, and observing the exact `protocol-open` command event in the renderer.

## Examples

```text
devhub://port/3000
devhub://process/8812?fallback=exe:node.exe,cwd:D:/repo/devhub
devhub://window/123?host=local
```

## Deferred Items

- Candidate picker UI when direct and fallback lookup both fail.
- Persistent recent-URI ranking and custom URI aliases.
