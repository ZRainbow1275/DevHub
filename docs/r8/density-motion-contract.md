# R8 Density and Motion Contract

Date: 2026-05-19

This document is the acceptance contract for `prompts/0503` theme density and motion items B.3.2-B.3.4 and B.4.3-B.4.4.

## Canonical Sources

- Density and motion CSS tokens: `src/renderer/styles/tokens/theme-tokens.css`
- Runtime application hook: `src/renderer/hooks/useTheme.ts`
- Runtime tests: `src/renderer/hooks/useTheme.test.tsx`
- Verifier: `scripts/verify-density-motion-contract.mjs`

Run:

```bash
pnpm check:density-motion-contract
node ./scripts/verify-density-motion-contract.mjs --print-markdown
```

## Acceptance Rules

- Compact, standard, and comfortable density levels must define explicit card, list-row, grid-gap, project-list, project-card, and card-width tokens.
- Density token sizes must increase strictly from compact to standard to comfortable.
- Motion levels must define explicit fast, normal, slow, theme-transition, default-transition, fast-transition, and card-enter animation tokens.
- `reduced` motion must force every duration to `0ms`, disable transitions, and disable card-enter animation.
- CSS must include a real `@media (prefers-reduced-motion: reduce)` fallback.
- Runtime `useTheme()` must resolve OS `prefers-reduced-motion: reduce` into effective `data-motion-level="reduced"`.

## Density Token Table

| Density | card min | row height | grid gap | project list row | project card min | project card width |
| --- | --- | --- | --- | --- | --- | --- |
| compact | 52px | 32px | 8px | 64px | 56px | 220px |
| standard | 72px | 40px | 12px | 120px | 80px | 240px |
| comfortable | 100px | 52px | 20px | 144px | 116px | 260px |

## Motion Token Table

| Motion | scale | fast | normal | slow | theme | transition | animation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reduced | 0 | 0ms | 0ms | 0ms | 0ms | none | none |
| balanced | 1 | 100ms | 200ms | 350ms | 250ms | all 0.25s cubic-bezier(0.2, 0, 0, 1) | card-enter-modern 200ms cubic-bezier(0.2, 0, 0, 1) |
| expressive | 1.35 | 140ms | 240ms | 520ms | 320ms | all 0.32s cubic-bezier(0.2, 0, 0, 1) | card-enter-modern 240ms cubic-bezier(0.2, 0, 0, 1) |

## Runtime Evidence

`src/renderer/hooks/useTheme.test.tsx` verifies:

- Density changes write `data-density="comfortable"` immediately and persist through `window.devhub.settings.update(...)`.
- Motion changes write `data-motion-level="expressive"` immediately and persist through `window.devhub.settings.update(...)`.
- OS `prefers-reduced-motion: reduce` overrides an expressive saved setting into effective `data-motion-level="reduced"`.
