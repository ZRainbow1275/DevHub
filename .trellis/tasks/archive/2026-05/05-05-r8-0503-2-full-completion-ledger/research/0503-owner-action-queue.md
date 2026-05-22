# 0503 Owner Action Queue

Generated at: 2026-05-22T17:43:48.007Z
Schema version: devhub-0503-owner-action-queue-v1
Acceptance status: complete

## Owner Counts

No owner actions.


## Owner Lane Commands

No owner lane commands.


## Owner Execution Plan

No owner execution plan.

## Current Environment Readiness

| Signal | Value |
| --- | --- |
| adminUser | ZRAINBOW\ZRainbow |
| displayCount | 1 |
| isAdministrator | true |
| serviceInstalled | true |
| serviceStatus | Stopped |
| virtualDesktopCount | 2 |
| zeroEgressPreflightReady | true |


## Actions

No remaining actions.


## Checkbox Closure Source Files

No checkbox closure source files.

## Boundary

- This queue is an ownership map, not completion evidence.
- Actions are complete only when their required evidence exists and the strict completion gate passes.

## Evidence Intake Workflow

1. Summarize owner responsibility lanes with `pnpm --silent check:0503-owner-evidence -- --owner-summary`; add `--owner <owner>` when an operator owner is preparing only their own lane.
2. List current canonical action ids with `pnpm --silent check:0503-owner-evidence -- --list-actions`; filter a responsibility lane with `--owner <owner>` when detailed current evidence and command text are needed.
3. Inspect owner readiness with `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>` to see `blockingActions`, blocker taxonomy rows, closure bundle commands, weighted open rows, and require-complete intake commands in one diagnostic output; when real owner submissions already exist, run `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>` or copy the `nextEvidenceDirectoryCommand` field from readiness output to coverage-check them without treating readiness as completion evidence.
4. Query partial R8 dossier rows with `pnpm check:0503-owner-evidence -- --partial-r8-dossier --owner <owner>` when a partial PRD/spec row needs its linked action ids, owner readiness evidence-dir commands, and strict boundary in one JSON output; add `--file <prompt-file>` to narrow this to one exact partial row and expose the action dossier, raw evidence template, and submission template commands for that row.
5. Inspect owner lane commands directly with `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands --owner <owner>`.
6. Export a one-action dossier with `pnpm --silent check:0503-owner-evidence -- --action-dossier --action <actionId>` when an owner needs the action row, lane commands, verification command note, raw evidence template, and submission template in one JSON output.
7. Generate an action-specific submission template with `pnpm --silent check:0503-owner-evidence -- --print-template --action <actionId>`, or generate all non-passable submission templates for one owner lane with `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner <owner>`; directory output is versioned scaffolding and remains `templateOnly`.
8. Optionally generate non-passable raw evidence shape files with `pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner <owner>` so each owner can prepare their lane without copying templates from chat output; directory output is versioned scaffolding and remains `templateOnly`.
9. Run the action row verification command in the required real environment and save its raw output, binary capture, screenshot, or decision file under a repo-relative evidence path.
10. Keep the raw evidence file separate from the JSON submission file; `evidenceFilePath` must not point to the submission JSON itself.
11. Ensure the raw evidence file is regenerated or recopied after this owner action queue `Generated at` timestamp so file mtime freshness can be verified.
12. Calculate the binary-safe evidence digest with `pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>`; the hash output includes `devhub-0503-owner-evidence-hash-v1`, `hashAlgorithm=sha256`, evidence file path, file size, file mtime, a strict boundary, and the shell-portable strict command so the digest cannot be confused with completion evidence.
13. Fill the JSON submission with the real owner identity, result summary, timestamp, evidence path, and SHA-256 digest; remove `templateOnly` before validation because the verifier rejects template files as evidence.
14. Validate one submission with `pnpm check:0503-owner-evidence -- --evidence <submission.json>` or a directory with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir>`; validation output includes schema and boundary fields, checkbox closure evidence must use `devhub-0503-checkbox-closure-evidence-v1` and match the current row count/source files, and structured external blocker or zero-egress reports must show semantic pass values for the submitted action.
15. Review `unknownSubmissionFields` in the verifier output; extra fields are reported for audit hygiene but are not treated as evidence contract fields.
16. Optionally write a Markdown coverage summary with `--coverage-report <repo-relative-report.md>` and a machine-readable coverage JSON report with `--coverage-json <repo-relative-report.json>`; these reports include evidence file mtime, file size, and hashAlgorithm metadata for audit traceability, but remain intake checklists only and are not completion evidence.
17. Before final closure, require directory coverage for every current owner action with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --require-complete`.
18. Rerun `pnpm --silent check:0503-strict:vd-watch`; completion can only be claimed if strict completion passes. Legacy `pnpm check:0503-strict` command text remains a compatibility field for submissions that explicitly control the shell environment.
19. If you only want to re-render the acceptance pack from an already audited strict report, use `--no-refresh`; otherwise the pack refreshes strict evidence in the current shell and env-sensitive gates may change with the invocation environment.

## Evidence Submission Template

- Schema version: `devhub-0503-owner-evidence-submission-v1` when using generated submission templates.
- Owner: `<operator>` for current R8 0503-2 strict owner lanes.
- Action id: exact canonical `actionId` from `--list-actions`; use the gate id when present, otherwise the closure kind.
- Evidence file path: `<repo-relative path to real evidence>`; must be raw evidence, not the submission JSON file.
- Evidence modified at: exact `evidenceModifiedAt` from `--hash-evidence`; mismatched file mtime is rejected.
- Evidence size bytes: exact `evidenceSizeBytes` from `--hash-evidence`; mismatched file size is rejected.
- Evidence SHA-256: `<binary-safe sha256 digest of the evidence file>`
- Hash algorithm: `sha256`; owner submissions with missing or different `hashAlgorithm` are rejected.
- Verification command: exact listed command for the action; final closure should rerun `pnpm --silent check:0503-strict:vd-watch`.
- Result summary: `<pass/fail plus key measured values>`
- Evidence timestamp: `<ISO timestamp>` from after the current owner action queue was generated; the evidence file mtime must also be fresh.
- Checkbox closure evidence schema: `devhub-0503-checkbox-closure-evidence-v1` with matching `actionId`, `closureKind`, `owner`, `rowCount`, and `sourceFiles` from this queue.
- Approver or operator identity: `<real person or Windows identity>`
- Boundary statement: `<what is still not claimed>`; do not claim completion, no remaining work, or unblock status because strict completion remains authoritative.
- Unknown submission fields: reported as `unknownSubmissionFields` for audit hygiene, but not accepted as required evidence fields.

Summarize owner responsibility lanes with `pnpm --silent check:0503-owner-evidence -- --owner-summary`, or filter one lane with `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner <owner>`.
Inspect owner readiness with `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner>` to see `blockingActions`; add `--evidence-dir <repo-relative-dir>` to include real submission coverage, but this remains diagnostic and does not waive strict completion.
Export owner lane commands with `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands`, or filter one lane with `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands --owner <owner>`.
Export one action dossier with `pnpm --silent check:0503-owner-evidence -- --action-dossier --action <actionId>`; each current R8 0503-2 dossier includes the verification command note on the main action row and both templates.
List current canonical action ids with `pnpm --silent check:0503-owner-evidence -- --list-actions`, filter one with `--action <actionId-or-closureKind>`, or filter one responsibility lane with `--owner <owner>`.
Generate a generic JSON template with `pnpm --silent check:0503-owner-evidence -- --print-template`, an action-specific template with `pnpm --silent check:0503-owner-evidence -- --print-template --action <actionId>`, or one owner lane of non-passable templates with `pnpm --silent check:0503-owner-evidence -- --print-template-dir <repo-relative-dir> --owner <owner>`.
Generate a non-passable raw evidence shape with `pnpm --silent check:0503-owner-evidence -- --print-evidence-template --action <actionId>`.
Generate non-passable raw evidence shape files with `pnpm --silent check:0503-owner-evidence -- --print-evidence-template-dir <repo-relative-dir> --owner <owner>`.
Calculate the binary-safe evidence file digest with `pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>`; require the `devhub-0503-owner-evidence-hash-v1` schema, `hashAlgorithm=sha256`, boundary, evidence file path, file size, and file mtime fields in the copied digest output.
Validate a submitted JSON file with `pnpm check:0503-owner-evidence -- --evidence <submission.json>`.
Validate multiple submitted JSON files with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir>`.
Validate owner-scoped directory coverage with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner <owner> --require-complete` when one owner is submitting only their lane.
Write a Markdown coverage summary with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --coverage-report <repo-relative-report.md>`; the coverage report includes evidence mtime, file size, and hashAlgorithm metadata.
Require a directory to cover every current owner action with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --require-complete`.

Do not use this template as evidence by itself. It is only the required structure for future real evidence submission.
