# 0503 Raw Evidence Templates

This directory contains raw evidence template JSON files for the remaining 0503 owner actions.

Directory command output schema: `devhub-0503-owner-raw-evidence-template-directory-v1`.

These files are `templateOnly` scaffolds. They are not owner evidence, do not close any 0503 gate, and do not waive `pnpm check:0503-strict`. Final closure should rerun `pnpm --silent check:0503-strict:vd-watch`.

Do not validate this template directory directly as evidence. Copy the needed JSON files into a separate owner evidence directory, then replace every placeholder with real evidence metadata and remove `templateOnly` from each submitted JSON file.

Owner submission JSON is a strict schema boundary: unknown fields are rejected. Put free-form evidence context into the referenced raw evidence file, not into the submission wrapper.

Recommended workflow:

1. Print the owner lane commands with `pnpm --silent check:0503-owner-evidence -- --next-owner-commands --owner <owner>`.
2. Copy only the relevant template files into a new repo-relative evidence directory.
3. Attach real command output, environment evidence paths, timestamps, and owner identity in that copied directory.
4. Run `pnpm --silent check:0503-owner-evidence -- --hash-evidence <repo-relative-evidence-file>` for every raw evidence file and copy `evidenceSha256`, `hashAlgorithm`, `evidenceModifiedAt`, and `evidenceSizeBytes` into the submission JSON.
5. Validate the copied directory with `pnpm check:0503-owner-evidence -- --owner-readiness --owner <owner> --evidence-dir <repo-relative-dir>`.
6. Require completeness with `pnpm check:0503-owner-evidence -- --evidence-dir <repo-relative-dir> --owner <owner> --require-complete`.
7. Rerun final strict completion with `pnpm --silent check:0503-strict:vd-watch`.
