# prompts/0503 Scope Audit

Date: 2026-05-19

## Objective Checked

The active continuation text mentioned `prompts/0503`, while the current Trellis task and completion ledger are scoped to `prompts/0503-2`.

This audit records the filesystem truth so future continuation does not conflate the two document sets.

## Filesystem Truth

- `prompts/0503` exists and contains 34 Markdown files.
- `prompts/0503-2` exists and contains 81 Markdown files.
- The active Trellis task `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/prd.md` explicitly scopes implementation closure to `prompts/0503-2`.

## prompts/0503 Contract Type

`prompts/0503/00-overview.md` states that the round is a requirements survey round and that it does not write source code, PRDs, or specs.

`prompts/0503/00-master-v2.md` states that the V2 round is a survey refinement round, also not a source-code or PRD/spec implementation round. It further states that subsequent R8.A/R8.B/R8.C specs live under `prompts/0503-2`.

`prompts/0503/28-final-acceptance-checklist.md` is a user-facing final acceptance checklist. It explicitly depends on V1, V2, and all R8.A/B/C specs being completed, and requires the user to personally verify each item. Therefore its open checkboxes cannot be closed by code evidence alone in this session.

## Checkbox Snapshot

The open checklist count in `prompts/0503` is large because the files are surveys and a final user acceptance checklist, not implementation status ledgers.

High-signal examples:

- `prompts/0503/28-final-acceptance-checklist.md`: 285 open user acceptance items.
- `prompts/0503/14-three-graph-systems-survey.md`: 102 open survey choices.
- `prompts/0503/07-ai-task-orchestration-survey.md`: 74 open survey choices.
- `prompts/0503/27-easter-egg-shortcuts-survey.md`: 74 open survey choices.
- `prompts/0503/12-cross-module-jump-survey.md`: 70 open survey choices.
- `prompts/0503/16-csv-task-driver-deep-survey.md`: 68 open survey choices.

## Relationship To Current Work

Current implementation work remains correctly anchored to `prompts/0503-2`, because that directory contains the PRD/spec decomposition derived from `prompts/0503`.

`prompts/0503` should be treated as upstream requirements and acceptance context unless the user explicitly starts a separate task to convert its open survey/acceptance items into executable PRD/spec work.

## Current Non-Completion Boundary

The overall R8 objective is not complete:

- `prompts/0503-2/R8.B/spec-02-port-floating-window.md` still has 1 open item: the real second-display packaged assertion / live multi-display hardware verification.
- `prompts/0503-2/R8.B/spec-11-window-virtual-desktop.md` has no open checklist boxes and now has the true VD-switch readiness gate satisfied; it remains partial only for live physical monitor disconnect/reconnect hardware verification.
- The 2026-05-20 `check:r8-external-blockers` probe found only one renderable Electron/BrowserWindow display on this machine, so the second-display and physical disconnect/reconnect assertions cannot be truthfully claimed here.
- `prompts/0503-2/R8.C/spec-17-watchdog-subprocess.md` still has 1 open Windows Service UAC item.
- The 2026-05-20 `check:r8-external-blockers` probe returned `admin=false`, `devhub-watchdog` service-not-installed, and `scExitCode=1060`. No UAC prompt, service install, service uninstall, or admin mutation was executed.
- The 2026-05-20 `check:r8-external-blockers` probe now reuses `verify-zero-egress-capture --preflight` and reports `windows=true`, `pktmonAvailable=true`, `admin=false`, `ready=false`, and `preflightExitCode=2`; no 60-second packet capture was executed or claimed.
- The 2026-05-20 external-blocker verifier now also records `packageJsonLicense=AGPL-3.0-or-later`, `licenseFileExists=true`, and no explicit legal-decision evidence, so the license/legal acceptance boundary remains blocked without pretending an agent can make that product/legal decision.
- The 2026-05-20 strict verifier now requires a machine-readable runbook for every external blocker gate, including owner, prerequisite, verification command, required evidence, and unblock rule. Current coverage is complete; six external gates remain failed by real evidence while the true VD-switch readiness gate is satisfied.
- `prompts/0503/28-final-acceptance-checklist.md` remains a user-facing acceptance checklist and cannot be closed by local implementation tests alone.

## 2026-05-20 Partial Row Re-Audit

The current strict completion gate still reports five partial R8 rows. This re-audit checks whether any of those rows can be truthfully closed by local code or documentation work alone.

| Partial row | Current local evidence | Blocking evidence still required | Local closure possible now |
|---|---|---|---|
| `prompts/0503-2/R8.B/prd.md` | R8.B has verified local slices, but inherits partial child rows. | Child blockers from spec-02 and spec-11 must clear. | no |
| `prompts/0503-2/R8.B/spec-02-port-floating-window.md` | BrowserWindow popout lifecycle, bridge heartbeat, pin/close survival, drag-back/demote, RSS benchmarks, unit tests, and packaged Electron E2E are recorded as verified. | Real second-display packaged assertion, live multi-display hardware verification, and multi-display drag-back placement evidence. | no |
| `prompts/0503-2/R8.B/spec-11-window-virtual-desktop.md` | VD/monitor schemas, COM/registry discovery, monitor APIs, popout display-affinity restore, latency cache, focused tests, build, `bench:vd-info`, and true VD-switch readiness (`registryDesktopCount=2`, `foregroundHookOptIn=true`) are recorded as verified. | Live physical monitor disconnect/reconnect evidence with at least two real renderable displays. | no |
| `prompts/0503-2/R8.C/prd.md` | R8.C has verified local slices, but inherits partial child rows. | Child blocker from spec-17 must clear. | no |
| `prompts/0503-2/R8.C/spec-17-watchdog-subprocess.md` | Supervisor schemas, real token/marker generation, child process entrypoint, named-pipe/TCP/marker RPC, heartbeat, respawn, orphan/takeover, packaged E2E, and service executor code paths are recorded as verified. | Live Windows Service UAC install/uninstall from an Administrator shell with `devhub-watchdog` installed and verified. | no |

Conclusion: `promptCheckboxLocalClosurePossibleOpenRows=0` remains correct. The remaining partial rows are not safe to close from local static edits, generated reports, or self-tests.

## Current Completion Audit

Objective restated as concrete deliverables:

1. Treat `prompts/0503` as upstream survey and user-acceptance context.
2. Treat `prompts/0503-2` as the executable R8 PRD/spec implementation contract.
3. Maintain a prompt-to-artifact ledger for all 81 `prompts/0503-2` Markdown files.
4. Do not claim completion for hardware/admin/user-acceptance gates without real evidence.

Current prompt-to-artifact checklist:

| Requirement or gate | Concrete evidence inspected | Current status |
|---|---|---|
| `prompts/0503` filesystem scope | `find prompts/0503 -type f -name '*.md'` returns 34 Markdown files | context only |
| `prompts/0503` checkbox truth | Current scan returns 1301 unchecked and 104 checked boxes; `28-final-acceptance-checklist.md` has 285 unchecked user-acceptance items | not locally closable |
| `prompts/0503-2` filesystem scope | `find prompts/0503-2 -type f -name '*.md'` returns 81 Markdown files | tracked |
| `prompts/0503-2` ledger coverage | `0503-2-completion-ledger.md` contains 81 file rows: 74 verified, 5 partial, 2 not-applicable | partial |
| R8.A gate assertions | Ledger reports 12/12 R8.A files verified and all five R8.A assertions verified | verified |
| R8.B implementation batch | Ledger reports 15 verified and 3 partial R8.B rows | partial |
| `ASSERT_BROWSERWINDOW_SECOND_DISPLAY` | `prompts/0503-2/R8.B/spec-02-port-floating-window.md:532` remains unchecked; `check:r8-external-blockers` reports one renderable Electron/BrowserWindow display | blocked |
| True VD switch event readiness | `spec-11-window-virtual-desktop.md` records opt-in foreground-hook plumbing; `r8-external-blockers-current.json` reports `registryDesktopCount=2` and `foregroundHookOptIn=true` | verified |
| Physical monitor disconnect/reconnect | `spec-11-window-virtual-desktop.md` still has no live physical unplug/replug proof; `check:r8-external-blockers` reports physical unplug/replug cannot be verified with fewer than two displays | blocked |
| R8.C implementation batch | Ledger reports 38 verified and 2 partial R8.C rows | partial |
| Windows Service UAC install/uninstall | `prompts/0503-2/R8.C/spec-17-watchdog-subprocess.md:309` remains unchecked; `check:r8-external-blockers` reports `admin=false`, service not installed, `scExitCode=1060` | blocked |
| Zero-egress packet capture | H.1.1/J.1.6 require a live 60-second `pktmon` packet capture with `packetCount=0`; external blocker report records Windows and `pktmon` present but `admin=false`, so only preflight is available | blocked |
| License/legal decision | `prompts/0503/24-legal-compliance-survey.md` recommends product/legal selection; external blocker report records AGPL package/license file but no explicit legal-decision evidence | blocked |
| External blocker closure paths | `0503-ledger-verification.json` reports `runbookMissingFields=[]`; `0503-strict-completion-report.md` lists owner, prerequisite, verification command, required evidence, and unblock rule for each failed gate | verified blocker metadata |
| Acceptance evidence pack | `0503-acceptance-pack.md` and `0503-acceptance-pack.json` aggregate strict status, ledger coverage, external runbook actions, owner/kind counts, SHA256 hashes for 7 source evidence files, all 115 prompt-to-artifact rows, and the checkbox manifest summary | generated, not-complete |
| Root package preservation | Root `package.json` keeps the existing eight font dependencies while exposing the 0503 check scripts, and `pnpm-lock.yaml` remains synchronized with those eight dependencies, preventing completion tooling from deleting pre-existing package dependency state | verified preservation |
| Checkbox requirement manifest | `0503-checkbox-manifest.md` and `0503-checkbox-manifest.json` inventory 2109 checkbox rows across both prompt scopes: 1303 open and 806 checked, with file, line, heading, text, and text hash | generated inventory |
| Checkbox closure classification | Open rows classify as 948 survey-context, 315 user-product-acceptance, 38 legal-product-acceptance, 1 hardware-verification, and 1 admin-service-verification | generated responsibility map |
| Owner action queue | `0503-owner-action-queue.md` and `0503-owner-action-queue.json` combine 6 failed external-gate actions with 5 checkbox closure-class actions; owner counts are operator 7, legal-product 2, product 1, user-product 1; the Markdown queue includes an Evidence Submission Template for artifact path, command, environment, and unblock result capture | generated action map |
| Current environment readiness | Owner action queue records `displayCount=1`, `isAdministrator=false`, `serviceInstalled=false`, `serviceStatus=not-installed`, `virtualDesktopCount=2`, `zeroEgressPreflightReady=false`, and `legalDecisionEvidenceExists=false` | blocked environment |
| Evidence pack integrity | `pnpm check:0503-acceptance-pack` now regenerates the pack and then runs `check:0503-evidence-pack`; the verifier checks acceptance-pack source hashes, 34/81 prompt manifest rows, checkbox manifest totals, dynamically derived owner action queue consistency with order-insensitive owner count comparison, completion status consistency, completion audit consistency, and referenced evidence path existence | verified integrity |
| Low-noise evidence refresh | `check:r8-external-blockers -- --quiet --write-report ...` suppresses console JSON while still writing the full blocker report; `check:0503-acceptance-pack` uses this path before integrity verification, and `check:0503-strict` now calls the Node verifier directly with `--quiet --write-report` to avoid pnpm passthrough noise | verified tooling |
| Completion status snapshot | `0503-completion-status.md` and `0503-completion-status.json` provide a small dashboard snapshot with `complete=false`, 115 prompt artifact rows, 2109 checkbox rows, 5 partial R8 rows, 6 failed external gates, 3 survey acceptance rows, and 11 owner actions | generated status |
| Completion audit | `0503-completion-audit.md` and `0503-completion-audit.json` restate the objective, map 115 prompt-to-artifact rows, verify 11 success criteria including root package dependency and lockfile preservation, verify 28 command checklist items, and list 19 missing or incomplete requirements; `check:0503-evidence-pack` verifies this audit against the pack, checkbox manifest, owner queue, and completion status | generated audit |
| No emoji rule | `pnpm -C devhub check:no-emoji` passed with `No emoji found in 779 files` | verified |
| Docs/workspace whitespace | Targeted file-level whitespace checks passed for updated R8 docs and audit ledgers | verified |
| External blocker verifier | `pnpm -C devhub check:r8-external-blockers` exits 1 with real blocker evidence and is intentionally not treated as a passing code gate | verified blocker |

## Next Action

Continue `prompts/0503-2` implementation closure only where real local evidence is possible. Do not mark the aggregate goal complete until either:

1. a real second display and a safe packaged Electron second-display run are available for `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`,
2. live physical monitor disconnect/reconnect behavior is verified without event simulation,
3. the Windows Service install/uninstall path is executed through the intended user-confirmed UAC flow and verified without fabricating service state, and
4. explicit product/legal license-decision evidence exists and is passed through the strict gate,
5. the generated acceptance evidence pack reports `acceptanceStatus=complete`, and
6. final user-facing acceptance is performed or explicitly descoped,

or the user explicitly revises the scope to exclude those hardware/admin-gated requirements.

## 2026-05-20 Low-Resource Continuation Revalidation

This continuation pass intentionally avoided Electron startup, E2E, packaging, and packet capture because the current blockers require hardware, elevation, or owner evidence that cannot be manufactured by a local static edit.

Commands rerun:

- `pnpm --silent check:0503-strict`
- `pnpm --silent check:0503-owner-evidence -- --list-actions`
- `pnpm --silent -C devhub check:r8-external-blockers`
- `pnpm check:0503-local`

Observed results:

| Check | Result | Evidence |
|---|---|---|
| Strict completion | failed as expected | `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |
| Owner queue | blocked | 12 current actions: operator 8, legal-product 2, product 1, user-product 1 |
| External blockers | blocked | 1 display, non-admin shell, `devhub-watchdog` not installed, 1 virtual desktop, zero-egress preflight not ready, no legal decision evidence |
| Local low-resource gate | passed | `pnpm check:0503-local` passed owner evidence self-tests, no-emoji checks, Zod SoT, no-cloud/no-OCR guards, typecheck, lint, diff checks, acceptance-pack verification, and 0503 no-emoji verification |

Conclusion: this pass found no remaining local-only development action that can truthfully close the aggregate objective. The next state transition requires real external evidence intake, not more generated ledgers or template files:

- operator evidence for real second display, physical monitor reconnect, true virtual desktop switch event, administrator shell, installed `devhub-watchdog` service, and 60-second `pktmon` zero-egress capture;
- legal-product evidence for the AGPL-3.0-or-later license decision and legal/product acceptance rows;
- product and user-product evidence for survey and user-facing acceptance rows.

Completion remains blocked until those evidence submissions are validated and `pnpm check:0503-strict` passes.

## 2026-05-20 Owner Evidence Intake Follow-Up

After confirming there are no local-only closure actions, the owner evidence workflow was narrowed further to reduce handoff ambiguity without changing any completion gate.

Implemented intake support:

- `verify-0503-owner-evidence.mjs` now supports `--owner-summary`.
- `--owner-summary --owner <owner>` returns a single responsibility lane with action ids, closure-kind counts, and the verification commands that owner must run.
- The summary output includes an explicit boundary that it is an intake planning aid only and that strict completion remains authoritative.
- `check:0503-local` now runs both all-owner and operator-filtered owner summaries before listing action details.
- `generate-0503-acceptance-pack.mjs` documents the owner-summary command in the completion audit and owner action queue workflow.
- `verify-0503-evidence-pack.mjs` now fails if the generated owner action queue markdown omits the owner-summary workflow.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated 0503 scripts | passed |
| `pnpm --silent check:0503-owner-evidence:self-test` | passed |
| `pnpm --silent check:0503-owner-evidence -- --owner-summary` | passed; reported 4 owners and 12 actions |
| `pnpm --silent check:0503-owner-evidence -- --owner-summary --owner operator` | passed; reported 8 operator actions |
| `pnpm --silent check:0503-acceptance-pack` | passed; regenerated acceptance pack and verified evidence pack consistency |
| `pnpm check:0503-local` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is not completion evidence. It only makes the remaining external evidence intake path more explicit and easier to execute by owner lane.

## 2026-05-20 Submission Template Directory Follow-Up

The owner evidence workflow now also supports bulk generation of non-passable submission JSON templates per owner lane.

Implemented intake support:

- `verify-0503-owner-evidence.mjs` now supports `--print-template-dir <repo-relative-dir> --owner <owner>`.
- Generated submission templates include `templateOnly=true`.
- The verifier now rejects any owner evidence submission that still contains `templateOnly=true`, so generated templates cannot be accidentally accepted as evidence.
- `check:0503-local` generates operator submission templates into a temporary task research directory and removes that directory in the same command chain.
- `generate-0503-acceptance-pack.mjs` documents the bulk submission-template command and explicitly tells owners to remove `templateOnly` before validation.
- `verify-0503-evidence-pack.mjs` verifies that generated owner action queue Markdown documents the bulk submission-template workflow and the `templateOnly` removal boundary.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated 0503 scripts | passed |
| `pnpm --silent check:0503-owner-evidence:self-test` | passed |
| `pnpm --silent check:0503-owner-evidence -- --print-template-dir .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/_tmp-submission-templates --owner operator` | passed; generated 8 non-passable operator templates |
| Temporary template cleanup | passed; `_tmp-submission-templates` did not remain after cleanup |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm check:0503-local` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is still not completion evidence. It reduces owner submission formatting errors while preserving the rule that only fresh, real evidence can close an action.

## 2026-05-20 Owner Lane Command Contract Follow-Up

The owner action queue now carries machine-readable lane commands for every owner that still has required evidence actions.

Implemented intake support:

- `0503-owner-action-queue.json` now includes `ownerLaneCommands`.
- Each owner lane records commands for owner summary, action listing, submission-template directory generation, raw-evidence-template directory generation, owner-scoped `--require-complete`, and owner-scoped coverage report generation.
- `0503-owner-action-queue.md` now renders an `Owner Lane Commands` table before the per-action execution plan.
- `verify-0503-evidence-pack.mjs` verifies that the generated JSON contains exactly the expected owner lanes and that the Markdown includes every lane command.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated acceptance-pack and evidence-pack scripts | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm check:0503-local` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is still not completion evidence. It makes the remaining external-evidence handoff less ambiguous while preserving the strict completion boundary.

## 2026-05-20 Submission Schema Version Follow-Up

Owner evidence submission templates now include a stable schema version so future external submissions can be identified and validated consistently.

Implemented intake support:

- Generated owner evidence submission templates now include `schemaVersion=devhub-0503-owner-evidence-submission-v1`.
- `verify-0503-owner-evidence.mjs` accepts submissions without `schemaVersion` for backward compatibility, but rejects any present schema version that does not match `devhub-0503-owner-evidence-submission-v1`.
- `0503-owner-action-queue.md` documents the submission schema version in the evidence submission template section.
- `verify-0503-evidence-pack.mjs` now fails if the generated owner action queue Markdown omits the submission schema version.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated 0503 scripts | passed |
| `pnpm --silent check:0503-owner-evidence:self-test` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm check:0503-local` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This remains an intake-format hardening only. It does not close any owner action without real evidence.

## 2026-05-20 Owner Evidence Coverage JSON Follow-Up

Owner evidence directory validation now has both human-readable and machine-readable coverage outputs.

Implemented intake support:

- `verify-0503-owner-evidence.mjs` now accepts `--coverage-json <repo-relative-report.json>` alongside the existing Markdown `--coverage-report`.
- Coverage JSON files include `schemaVersion=devhub-0503-owner-evidence-coverage-v1`, an explicit strict-completion boundary, the coverage summary, and normalized submission rows.
- `generate-0503-acceptance-pack.mjs` adds `coverageJsonCommand` to every owner lane in `0503-owner-action-queue.json`.
- `0503-owner-action-queue.md` renders the new `Coverage JSON` command column for legal-product, operator, product, and user-product lanes.
- `verify-0503-evidence-pack.mjs` now fails if the generated owner action queue JSON or Markdown omits the owner-scoped coverage JSON command.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated 0503 scripts | passed |
| `pnpm --silent check:0503-owner-evidence:self-test` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm --silent check:0503-no-emoji` | passed |
| `pnpm check:0503-local` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is still not completion evidence. It gives CI, reviewers, and external owners a stable coverage artifact once real submissions exist, while preserving `pnpm check:0503-strict` as the only completion gate.

## 2026-05-20 Owner Lane Command Export Follow-Up

Owner lane commands can now be exported directly from the owner evidence verifier without opening generated queue files by hand.

Implemented intake support:

- `verify-0503-owner-evidence.mjs` now accepts `--owner-lane-commands`.
- The command returns `schemaVersion=devhub-0503-owner-lane-commands-v1`, an explicit strict-completion boundary, `laneCount`, `ownerFilter`, and the selected owner lane command rows.
- `--owner-lane-commands --owner <owner>` returns only the requested owner lane and fails if the current queue lacks a matching lane.
- `generate-0503-acceptance-pack.mjs` documents `--owner-lane-commands --owner <owner>` in the evidence intake workflow.
- `verify-0503-evidence-pack.mjs` now fails if the owner action queue Markdown omits the `--owner-lane-commands` workflow.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated 0503 scripts | passed |
| `pnpm --silent check:0503-owner-evidence:self-test` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands --owner operator` | passed; returned the operator lane with coverage JSON and coverage Markdown commands |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm --silent check:0503-no-emoji` | passed |
| `git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This remains an owner-evidence handoff aid only. It does not reduce the required external evidence count and cannot close any row without real submissions plus a passing strict gate.

## 2026-05-20 Owner Submission Unknown Field Reporting Follow-Up

Owner evidence submissions now report unknown JSON fields instead of silently ignoring them.

Implemented intake support:

- `verify-0503-owner-evidence.mjs` classifies required submission fields, optional generated-template fields, and unknown fields.
- Single-submission validation summaries now include `unknownSubmissionFields`.
- Evidence-directory summaries carry `unknownSubmissionFields` into both Markdown coverage reports and JSON coverage reports.
- Unknown fields are non-fatal for backward compatibility, but they are not treated as required evidence fields or strict-completion evidence.
- `generate-0503-acceptance-pack.mjs` documents the `unknownSubmissionFields` review step in the evidence intake workflow.
- `verify-0503-evidence-pack.mjs` now fails if generated owner action queue Markdown omits the unknown-field review rule.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated 0503 scripts | passed |
| `pnpm --silent check:0503-owner-evidence:self-test` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm --silent check:0503-no-emoji` | passed |
| `git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is schema hygiene only. It improves reviewability of real owner submissions without weakening evidence requirements.

## 2026-05-20 Owner Action Dossier Follow-Up

Owner evidence intake now supports a one-action dossier for owners who need all action-level instructions in one machine-readable output.

Implemented intake support:

- `verify-0503-owner-evidence.mjs` now accepts `--action-dossier --action <actionId>`.
- The dossier returns `schemaVersion=devhub-0503-owner-action-dossier-v1`, the selected action row, the owning lane commands, a non-passable raw evidence template, a non-passable submission template, and the final strict completion command.
- The dossier uses the canonical `actionId`; ambiguous closure-kind matches are rejected by the existing action filter logic.
- `generate-0503-acceptance-pack.mjs` documents `--action-dossier --action <actionId>` in the evidence intake workflow.
- `verify-0503-evidence-pack.mjs` now fails if the owner action queue Markdown omits the action dossier workflow.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated 0503 scripts | passed |
| `pnpm --silent check:0503-owner-evidence:self-test` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY` | passed; returned the selected action row, owner lane commands, raw evidence template, and submission template |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm --silent check:0503-no-emoji` | passed |
| `git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is still only a handoff aid. The dossier templates remain `templateOnly=true` and cannot close any owner action without real evidence.

## 2026-05-20 Owner Action Queue Schema Version Follow-Up

The generated owner action queue now declares its own schema version so downstream evidence-intake tooling can reject stale or drifted queue formats.

Implemented intake support:

- `generate-0503-acceptance-pack.mjs` now writes `schemaVersion=devhub-0503-owner-action-queue-v1` into `0503-owner-action-queue.json`.
- `0503-owner-action-queue.md` now renders the queue schema version near the generated timestamp.
- `verify-0503-evidence-pack.mjs` now fails if the owner action queue JSON omits or changes the expected schema version.
- The verifier self-test fixture includes the schema version so Markdown integrity coverage stays aligned with the generated queue contract.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated acceptance-pack and evidence-pack scripts | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `pnpm --silent check:0503-owner-evidence -- --owner-lane-commands --owner operator` | passed against the regenerated queue |
| `pnpm --silent check:0503-no-emoji` | passed |
| `git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is a queue-format guard only. It does not close any prompt row or external evidence gate.

## 2026-05-20 Local Verification Coverage Follow-Up

The root `check:0503-local` command now exercises the newer owner evidence CLI surfaces in addition to self-tests, and its final acceptance-pack step now uses the `check:0503-acceptance-pack:no-refresh` alias so local verification re-renders from an already audited strict report without re-evaluating env-sensitive gates.

The strict completion path also now has a shell-portable `pnpm check:0503-strict:vd-watch` alias. This sets `DEVHUB_R8_VD_FOREGROUND_WATCH=1` inside the Node runner before external blocker probes, avoiding WSL/bash environment-prefix loss when the actual pnpm/Node process is Windows-side.

Implemented verification support:

- `package.json` now runs `pnpm check:0503-owner-evidence -- --owner-lane-commands --owner operator` inside `check:0503-local`.
- `package.json` now runs `pnpm check:0503-owner-evidence -- --action-dossier --action ASSERT_BROWSERWINDOW_SECOND_DISPLAY` inside `check:0503-local`; raw evidence template and submission template command coverage is verified by the owner output matrix and evidence-pack command-set checks rather than this single local sample.
- `package.json` now exposes `pnpm check:0503-strict:vd-watch` as the recommended strict completion command for the VD foreground-watch evidence lane.
- `verify-0503-evidence-pack.mjs` now verifies the updated root `check:0503-local` command text, including the no-refresh acceptance-pack alias, so future drift in local verification coverage fails the evidence pack verifier.
- The local suite still keeps `pnpm check:0503-strict:self-test` separate from the real strict completion command; strict completion remains a final external-evidence gate, not a local self-test.

Validation rerun:

| Check | Result |
|---|---|
| `node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8")); console.log("package.json ok")'` | passed |
| `node --check .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-evidence-pack.mjs` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm check:0503-local` | passed |
| `pnpm --silent check:0503-strict:self-test` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |
| `pnpm --silent check:0503-strict:vd-watch` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=6; surveyAcceptanceRows=3; externalReportFresh=true` |

This improves local verification coverage and shell-portable strict invocation only. It does not claim prompt completion or reduce the remaining owner evidence queue.

## 2026-05-20 Strict Blocker Crosswalk Follow-Up

The completion audit now carries a machine-readable crosswalk from every strict blocker to the relevant owner action path.

Implemented audit support:

- `generate-0503-acceptance-pack.mjs` now writes `strictBlockerCrosswalk` into `0503-completion-audit.json`.
- Each crosswalk row includes the blocker type, blocker id, current evidence, owner, source, strict completion command, verification command, and an action dossier command when a current owner action exists.
- Failed external gates and open checkbox closure classes map directly to matching `ownerActionId` values.
- Survey acceptance rows map to `survey-context`, `legal-product-acceptance`, or `user-product-acceptance` owner actions according to their source file class.
- Partial R8 rows stay explicitly unmapped to an owner action and point back to `pnpm check:0503-strict`, because they are ledger-level blockers that cannot be closed by a generated owner submission alone.
- `0503-completion-audit.md` now renders a `Strict Blocker Crosswalk` table.
- `verify-0503-evidence-pack.mjs` now verifies that the crosswalk row count matches `missingOrIncompleteRequirements`, that every blocker is represented, and that direct owner-action blockers have the expected action dossier command.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated acceptance-pack and evidence-pack scripts | passed |
| `pnpm --silent check:0503-acceptance-pack:self-test` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `node -e 'const a=require("./.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-audit.json"); console.log(JSON.stringify({crosswalkRows:a.strictBlockerCrosswalk.length, missingRows:a.missingOrIncompleteRequirements.length}, null, 2))'` | passed; `crosswalkRows=20`, `missingRows=20` |
| `pnpm --silent check:0503-no-emoji` | passed |
| `git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is audit traceability only. A crosswalk row is not evidence; it only points reviewers to the exact action or strict gate that must be satisfied with real evidence.

## 2026-05-20 Completion Status Crosswalk Count Follow-Up

The completion status summary now exposes the strict blocker crosswalk count so reviewers can detect drift between the status page and completion audit.

Implemented status support:

- `generate-0503-acceptance-pack.mjs` now calculates `strictBlockerCrosswalkRowCount` from partial R8 rows, failed external gates, survey acceptance rows, and open checkbox closure classes.
- `0503-completion-status.json` now carries `strictBlockerCrosswalkRowCount`.
- `0503-completion-status.md` now renders `Strict blocker crosswalk rows` in the count summary.
- `nonCompletionReasons` now includes `strictBlockerCrosswalkRows=<count>`.
- `verify-0503-evidence-pack.mjs` now verifies `strictBlockerCrosswalkRowCount` against the same blocker formula.

Validation rerun:

| Check | Result |
|---|---|
| `node --check` for updated acceptance-pack and evidence-pack scripts | passed |
| `pnpm --silent check:0503-acceptance-pack:self-test` | passed |
| `pnpm --silent check:0503-evidence-pack:self-test` | passed |
| `pnpm --silent check:0503-acceptance-pack` | passed |
| `node -e 'const s=require("./.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-status.json"); console.log(JSON.stringify({strictBlockerCrosswalkRowCount:s.strictBlockerCrosswalkRowCount, nonCompletionReasons:s.nonCompletionReasons.filter(x=>x.includes("strictBlocker"))}, null, 2))'` | passed; `strictBlockerCrosswalkRowCount=20` |
| `pnpm --silent check:0503-no-emoji` | passed |
| `git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger` | passed |
| `pnpm --silent check:0503-strict` | failed as expected with `partialRows=5; missingEvidenceRows=0; failedExternalGateIds=7; surveyAcceptanceRows=3; externalReportFresh=true` |

This is status observability only. The count confirms blocker visibility; it does not satisfy any blocker.
