# R8 SKILL Metadata Format

SKILL metadata is stored in local YAML files and validated before scripts are listed or executed.

## Required Fields

```yaml
schemaVersion: "1.0.0"
name: "lint-fix"
displayName: "Lint Fix"
version: "1.0.0"
author: "local"
description: "Fixes lint failures with a local script."
license: "MIT"
sandbox: read-only
runtime: node
scriptPath: "./run.mjs"
inputs:
  - name: "prompt"
    type: "string"
    required: true
outputs:
  - name: "result"
    type: "json"
mcpServers: []
```

## Sandbox Levels

- `read-only`: script may read declared inputs and write only to the controlled artifact directory.
- `read-write`: script may write declared artifacts inside the task workspace.
- `system`: script may spawn child processes or call declared MCP stdio servers.

## Runtime Guarantees

- Script paths must stay inside the SKILL directory.
- Missing or malformed `@skill:name` references in CSV prompts fail before runtime launch.
- `on_fail` execution writes real artifacts before retry.
- MCP metadata is passed only to system-sandbox SKILL scripts.
- R8 does not run remote SKILL packages or cloud sync.
