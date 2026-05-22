# prompts/0503 Root Scope Audit

Generated: 2026-05-15; refreshed: 2026-05-19

## Objective Restatement

The active continuation objective says to keep developing until all `prompts/0503` development tasks are complete.

In the current repository there are three adjacent prompt trees:

- `prompts/0503`
- `prompts/0503-1`
- `prompts/0503-2`

This audit prevents a false completion claim by separating survey/user-acceptance documents from executable PRD/spec documents.

## Authority Findings

`prompts/0503/00-master-v2.md` explicitly defines `prompts/0503` as a survey refinement round:

- It is a "沟通表深化轮（Survey Refinement Round）".
- It says this round does not write source code, PRD, or Spec.
- It says the later implementation phase happens after V1/V2 answers are consolidated into rewritten PRD/specs.
- It says the already-written and implementable R8.A/R8.B/R8.C specs live under `prompts/0503-2/`.

`prompts/0503/28-final-acceptance-checklist.md` is not an implementation spec by itself:

- It depends on V1, V2, and all R8.A/B/C specs being complete.
- It requires the user to personally validate each item in DevHub.
- Its unchecked boxes are user acceptance checks, not code tasks that can be truthfully marked complete by implementation alone.

## File Count Snapshot

Current `prompts/0503` Markdown files: 34.

The root acceptance checklist contains 285 unchecked boxes. Across the whole `prompts/0503` tree, the current checkbox snapshot is 1301 unchecked and 104 checked boxes because most V2 survey documents are intentionally user-questionnaires rather than implementation ledgers.

## Completion Rule

Do not mark the overall objective complete while either of these is true:

1. `prompts/0503-2` completion ledger still has `partial` or `missing` implementation evidence.
2. `prompts/0503/28-final-acceptance-checklist.md` has not been converted into a user-validated acceptance evidence pack after R8.A/B/C implementation closure.

## Working Interpretation

For current coding work, continue using:

- `prompts/0503-2/00-r8-implementation-quickstart.md`
- `prompts/0503-2/00-r8-master-prd.md`
- `.trellis/tasks/archive/2026-05/05-03-r8-prd-spec-batches/HANDOFF.md`
- `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md`

The immediate next implementation work must reduce verified gaps in the `0503-2` ledger. `prompts/0503` remains a root survey and final user-acceptance source, not a direct checkbox list for this agent to self-check.
