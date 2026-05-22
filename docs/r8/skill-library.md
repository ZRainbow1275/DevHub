# R8.C Skill Library

This document records the implemented boundary for `prompts/0503-2/R8.C/spec-09-skill-library-yaml.md` and `prompts/0503-2/R8.C/spec-10-skill-builtin-10.md`.

## Scope

- The Skill library is a local metadata registry for Agent Skill-compatible `SKILL.md` files.
- It loads built-in skills from `src/shared/skill-builtins` and user skills from Electron `userData/skills`, `userData/r8-skills`, and the compatibility `.codex/skills` root.
- The library validates metadata only. Script execution is performed only by the downstream task-queue `on_fail=execute-skill` path.
- All paths, validation failures, audit rows, and stream updates stay local. There is no telemetry and no remote upload of SKILL names or content.

## Contracts

- `SkillFrontmatter`, `Skill`, `SkillLoadError`, `SkillValidationResult`, `SkillTemplate`, and `SkillListStreamPayload` are defined in `src/shared/schemas/r8-runtime.ts`.
- Required/defaulted SKILL metadata includes name, description, version, author, license, inputs, outputs, runtime, permissions, sandbox level, and optional `mcpServers`.
- `sandbox` is one of `read-only`, `read-write`, or `system`; `mcpServers` declares local stdio MCP servers that a system SKILL may call.
- `skill:list`, `skill:get`, `skill:validate-yaml`, `skill:validate`, `skill:install-from-path`, `skill:uninstall`, and `skill:reload` are executable IPC handlers.
- `skill:builtin-list`, `skill:builtin-readme`, and `skill:builtin-fork` are executable built-in catalog IPC handlers.
- `skill:list-stream` is a main-to-renderer stream with a 100ms throttle and payload fields `added`, `updated`, `removed`, `skills`, `errors`, `source`, and `emittedAt`.
- `window.devhub.r8.skill.onListStream()` exposes the stream to renderer code with a cleanup function.

## Built-in Catalog

- `src/shared/skill-builtins/index.ts` is the typed source of truth for exactly 10 built-ins: `code-review`, `explain-code`, `write-test`, `refactor`, `fix-bug`, `doc-generate`, `translate-i18n`, `lint-fix`, `migrate-version`, and `security-audit`.
- Each built-in manifest is schema-valid, local-only, offline, `runtime=node`, `license=MIT`, `sandbox=read-only`, `mcpServers=[]`, and limited to `permissions=['fs-read']`; no built-in contains network URL or API-key patterns.
- `R8.C.skill.builtin` defaults ON through the shared feature-flag registry and gates the built-in-only operations.
- When `R8.C.skill.builtin` is OFF, `listSkills()` continues loading user skills but skips built-ins; `skill:builtin-list` returns an empty catalog and builtin read/fork paths return `E_FEATURE_DISABLED`.
- `skill:builtin-fork` materializes real user files under Electron `userData/skills/<targetName>/`: `SKILL.md`, `run.js`, and `README.md`.

## Filesystem Rules

- `gray-matter` parses frontmatter and uses the local `js-yaml` engine.
- Strict Zod schemas reject unknown fields, missing required fields, unsupported permission values, and unsafe YAML custom tags.
- `scriptPath` must be relative, must remain inside the skill directory after resolution, and must point to an existing file for loaded skills.
- User skills with the same name as a built-in skill override the built-in record and produce a local audit row.

## Execution Sandbox And MCP Boundary

- `on_fail=execute-skill` executes real local SKILL scripts through `R8RuntimeService`; it writes `failure-context.json`, `stdout.txt`, `stderr.txt`, and `result.json` under `userData/task-queue/on-fail-skills`.
- Node SKILL execution uses a generated preload guard. `read-only` blocks filesystem write APIs, child-process APIs, and network APIs unless the matching permission is declared and the sandbox allows it.
- `read-write` permits filesystem writes but still blocks network and child-process APIs unless the SKILL uses the `system` sandbox.
- `system` permits explicit local child-process execution and can receive `mcpServers` metadata through `DEVHUB_SKILL_MCP_SERVERS_JSON`.
- Non-Node SKILL runtimes require `system` sandbox because DevHub cannot enforce the Node preload guard for those runtimes.
- `mcpServers` is local-only metadata. The verified path uses a system SKILL to start a real local stdio JSON-RPC MCP server and call its `initialize`, `tools/list`, and `tools/call` methods.

## Watcher

- `R8RuntimeService.startSkillWatcher()` watches `userData/skills` through chokidar with `ignoreInitial`, `depth=2`, `awaitWriteFinish`, `atomic`, `usePolling=false`, and `ignorePermissionErrors=true`.
- `add`, `change`, and `unlink` events for `SKILL.md` trigger a fresh real `listSkills()` pass and a diffed `skill:list-stream` payload.
- The watcher is closed from `R8RuntimeService.dispose()` to avoid leaked file handles.

## Verification

- `R8RuntimeService.test.ts` covers strict schema loading, invalid YAML/custom tags, script path traversal, user override audit, install/uninstall/fork audit, `skill:list-stream`, and real chokidar add/change/unlink events.
- `R8RuntimeService.test.ts` also covers default built-ins, user override behavior, forked built-in files, builtin README, and the flag-off path that leaves user skills visible while builtin operations return `E_FEATURE_DISABLED`.
- `R8RuntimeService.test.ts` covers real local `on_fail=execute-skill` execution, read-only write blocking, read-write artifact side effects, system child-process execution, and a real local stdio MCP server call from a SKILL.
- `feature-flags.test.ts` asserts `R8.C.skill.builtin` remains default-enabled in the shared registry.
- `r8RuntimeHandlers.test.ts` covers executable skill IPC routing, including `reload(force, watch)`.
- `r8-runtime.test.ts` covers channel registration and the shared `SkillListStreamPayload` schema.
- `preloadContract.test.ts` covers preload whitelist synchronization for invoke and listener channels.
