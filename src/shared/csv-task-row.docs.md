# CSV Task Row 18-Column Contract

This document is generated from the R8.C spec-13 implementation boundary and is kept beside the executable schema for operator reference.

| # | name | type | required | example | purpose |
|---|------|------|----------|---------|---------|
| 1 | `taskId` | string | yes | `task-001` | Unique id within one CSV group. |
| 2 | `taskName` | string | yes | `Review PR 42` | Human-readable task name. |
| 3 | `priority` | `P0`..`P3` | yes | `P1` | Queue priority; `P0` is highest. |
| 4 | `status` | enum | no | `pending` | CSV-authored lifecycle state. |
| 5 | `tool` | enum | yes | `codex` | Requested tool runner. |
| 6 | `skill` | string | yes | `code-review` | Local SKILL name. |
| 7 | `inputFile` | path | no | `src/app.ts` | Main input path. |
| 8 | `inputArgs` | JSON string | no | `{"prompt":"run checks"}` | Additional runner arguments. |
| 9 | `outputDir` | path | no | `out/reports` | Artifact directory. |
| 10 | `outputFormat` | enum | yes | `md` | Expected report format. |
| 11 | `tags` | csv string | no | `review,security` | Filter tags. |
| 12 | `dependsOn` | csv task ids | no | `task-001` | Dependency ids from same group. |
| 13 | `timeoutMs` | integer | yes | `60000` | Runtime timeout, max 24h. |
| 14 | `retries` | integer | yes | `1` | Retry count, max 5. |
| 15 | `concurrencyKey` | string | no | `frontend` | Parallel group key. |
| 16 | `createdAt` | ISO datetime | yes | `2026-05-03T08:00:00Z` | Creation timestamp. |
| 17 | `scheduledAt` | ISO datetime or `now` | yes | `now` | Requested start time. |
| 18 | `note` | string | no | `owner: local` | Operator note. |

Rules:

- Header names and order are strict.
- Rows with fewer than 18 cells are invalid.
- Rows with more than 18 cells are truncated and reported as row-level warnings.
- Parsed rows receive hidden `schemaVersion: "1.0"` metadata from the Zod schema; it is not a CSV column and must not be added to the 18-column header.
- `inputArgs` must be valid JSON.
- `dependsOn` is validated at group level after all rows are parsed.
- `skill` is validated against the local Skill library by the CSV driver.
