# R8 0503-2 Full Completion Ledger

## Objective

Complete the implementation closure for every Markdown development document under `prompts/0503-2` using a documented, mechanical ledger before any further code changes.

The target is not limited to the already-finished R8.C resilience slice. The completion boundary is the current filesystem truth:

- `prompts/0503-2` contains 81 Markdown files.
- Top-level batches are `R8.A`, `R8.B`, `R8.C`, and `_shared`.
- Historical handoff text says 80 files, but this task must use the current filesystem count.

## Non-Negotiable Constraints

- Do not delete existing features, modules, UI surfaces, scripts, or task artifacts.
- Do not perform a large refactor; only add, integrate, or patch narrowly.
- Do not introduce mock data, fake states, fake operations, fake screenshots, or simulated verification.
- Do not add emoji to UI, docs, logs, or test snapshots.
- Do not add OCR dependencies or cloud-sync dependencies.
- Do not add API-key input UI.
- Preserve production-parity validation: schemas must remain Zod single source of truth, with TypeScript types derived through `z.infer`.
- Keep resource usage low: one agent or one targeted validation at a time unless a later step proves safe.

## Source Documents

Must be treated as the implementation source of truth:

- `prompts/0503-2/00-r8-implementation-quickstart.md`
- `prompts/0503-2/00-r8-master-prd.md`
- `.trellis/tasks/archive/2026-05/05-03-r8-prd-spec-batches/HANDOFF.md`
- `prompts/0503-2/_shared/*.md`
- `prompts/0503-2/R8.A/*.md`
- `prompts/0503-2/R8.B/*.md`
- `prompts/0503-2/R8.C/*.md`

## Required Ledger

Create and maintain `research/0503-2-completion-ledger.md` with one row per Markdown file. Each row must include:

- file path
- batch
- open checkbox count
- completed checkbox count
- `implementation_status` presence
- `Not claimed complete` / `pending` / `TODO` marker count
- evidence status: `verified`, `partial`, `missing`, or `not-applicable`
- next action

The ledger must not mark a spec complete unless there is local evidence from code, tests, scripts, docs, or validated constraints.

## Prioritization

Use the ordering from the quickstart and master PRD:

1. R8.A gate assertions:
   - `ASSERT_PROCESS_FIELD_PARITY`
   - `ASSERT_TOPOLOGY_FIRST_GLANCE`
   - `ASSERT_THEME_NON_COLOR_DELTA`
   - `ASSERT_ALWAYS_ON_TOP_FUNCTIONAL`
   - `ASSERT_PORT_PANEL_BREATHING_ROOM`
2. R8.B acceptance assertions and remaining unchecked specs.
3. R8.C acceptance assertions and remaining unchecked specs.
4. `_shared` consistency files, only after implementation truth is known.

## Verification Gates

Use low-resource commands first:

- `pnpm -C devhub check:no-cloud-deps`
- `pnpm -C devhub check:no-ocr-deps`
- `pnpm -C devhub check:zod-sot`
- `pnpm -C devhub typecheck`
- `pnpm -C devhub lint`
- targeted `pnpm -C devhub test --run ... --maxWorkers=1`
- `git -C devhub diff --check`
- `git diff --check`

Do not run heavy E2E or packaging by default during ledger creation. Add those as blockers if a spec requires them and the machine cannot safely run them.

## Completion Criteria

- `research/0503-2-completion-ledger.md` exists and covers all 81 Markdown files.
- The ledger identifies which documents are truly verified, partial, missing, or non-applicable.
- R8.A assertion evidence is separated from R8.B/R8.C evidence.
- Follow-up implementation slices are ordered by dependency and risk.
- Every changed spec/doc is updated only when matching real implementation and validation evidence exists.
- `implement.jsonl` and `check.jsonl` provide the Trellis agents with the relevant specification context.
