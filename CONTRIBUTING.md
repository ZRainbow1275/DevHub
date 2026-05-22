# Contributing to DevHub

## Development Setup

```bash
pnpm install
pnpm dev
```

## Required Checks

Run focused checks for touched areas first, then run:

```bash
pnpm typecheck
pnpm lint
pnpm check:zod-sot
pnpm check:no-cloud-deps
pnpm check:no-ocr-deps
pnpm check:license
pnpm check:sbom
```

## Pull Request Checklist

- Keep changes narrow and additive
- Do not delete existing modules or user-facing surfaces without a tracked migration
- Do not introduce mock data in production paths
- Keep renderer and IPC contracts Zod-validated
- Use existing icon libraries instead of emoji
- Add regression tests for bug fixes
- Update docs for new user-facing behavior
- Record any legal, privacy, or security boundary changes

## Issue Quality

Good issues include current version, OS, exact command, expected behavior, actual behavior, logs, screenshots where relevant, and whether the issue reproduces after restart.
