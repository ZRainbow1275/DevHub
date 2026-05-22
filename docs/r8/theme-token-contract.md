# R8 Theme Token Contract

Date: 2026-05-19

This document is the acceptance contract for `prompts/0503` theme items B.2.1-B.2.8. It records the actual renderer CSS token values used by DevHub and the pairwise visible deltas between every built-in theme.

## Canonical Sources

- Color tokens: `src/renderer/styles/tokens/colors.css`
- Non-color design tokens: `src/renderer/styles/tokens/theme-tokens.css`
- Runtime palette state: `src/renderer/theme/theme-language.ts`
- Verifier: `scripts/verify-theme-token-contract.mjs`

Run:

```bash
pnpm check:theme-token-contract
node ./scripts/verify-theme-token-contract.mjs --print-markdown
```

## Acceptance Rules

- Every built-in palette must have a real `[data-theme="..."]` color block.
- Every built-in palette must have real radius, border, shadow, font, spacing, and motion tokens.
- Every pair of themes must differ in color.
- Every pair of themes must differ in all 7 visible axes from this set: color, radius, border, shadow, font, spacing, motion.
- `constructivism -> modern-light` is the strict regression sentinel and must differ in all 7 axes.

## Palette Token Table

| Palette | surface-900 | accent | radius | border | shadow | font | spacing | motion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| constructivism | #252220 | #d64545 | 2px | 2px | 3px 3px 0 rgba(0,0,0,0.35) | 'Oswald Variable', 'Bebas Neue', 'Anton', var(--font-display) | 4px | 150ms |
| modern-light | #f1f3f5 | #3b82f6 | 12px | 1px | 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06) | var(--font-sans) | 6px | 200ms |
| warm-light | #f5f0e8 | #b85c38 | 16px | 1px | 0 2px 8px rgba(139,90,43,0.08) | var(--font-serif) | 8px | 350ms |
| cyberpunk | #101020 | #00ffff | 8px | 1px | 0 0 8px rgba(0, 255, 255, 0.08), 0 0 2px rgba(0, 255, 255, 0.15), inset 0 1px 0 rgba(0, 255, 255, 0.05) | 'Orbitron Variable', 'Share Tech Mono', 'Exo 2 Variable', var(--font-sans) | 9px | 250ms |
| swiss | #fafafa | #1a1a1a | 0px | 1px | none | 'Helvetica Neue', 'Inter Variable', var(--font-sans) | 10px | 120ms |
| dark | #0b1120 | #3b82f6 | 10px | 1px | 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2) | 'Inter Variable', system-ui, sans-serif | 7px | 220ms |
| light | #f8fafc | #6366f1 | 14px | 1px | 0 2px 8px rgba(79,70,229,0.08), 0 1px 2px rgba(17,24,39,0.04) | system-ui, 'Inter Variable', sans-serif | 5px | 180ms |

## Pairwise Difference Table

| Pair | Changed axes | radius delta | border delta | spacing delta | motion delta |
| --- | --- | --- | --- | --- | --- |
| constructivism -> modern-light | color, radius, border, shadow, font, spacing, motion | 10px | 1px | 2px | 50ms |
| constructivism -> warm-light | color, radius, border, shadow, font, spacing, motion | 14px | 1px | 4px | 200ms |
| constructivism -> cyberpunk | color, radius, border, shadow, font, spacing, motion | 6px | 1px | 5px | 100ms |
| constructivism -> swiss | color, radius, border, shadow, font, spacing, motion | 2px | 1px | 6px | 30ms |
| constructivism -> dark | color, radius, border, shadow, font, spacing, motion | 8px | 1px | 3px | 70ms |
| constructivism -> light | color, radius, border, shadow, font, spacing, motion | 12px | 1px | 1px | 30ms |
| modern-light -> warm-light | color, radius, border, shadow, font, spacing, motion | 4px | 0px | 2px | 150ms |
| modern-light -> cyberpunk | color, radius, border, shadow, font, spacing, motion | 4px | 0px | 3px | 50ms |
| modern-light -> swiss | color, radius, border, shadow, font, spacing, motion | 12px | 0px | 4px | 80ms |
| modern-light -> dark | color, radius, border, shadow, font, spacing, motion | 2px | 0px | 1px | 20ms |
| modern-light -> light | color, radius, border, shadow, font, spacing, motion | 2px | 0px | 1px | 20ms |
| warm-light -> cyberpunk | color, radius, border, shadow, font, spacing, motion | 8px | 0px | 1px | 100ms |
| warm-light -> swiss | color, radius, border, shadow, font, spacing, motion | 16px | 0px | 2px | 230ms |
| warm-light -> dark | color, radius, border, shadow, font, spacing, motion | 6px | 0px | 1px | 130ms |
| warm-light -> light | color, radius, border, shadow, font, spacing, motion | 2px | 0px | 3px | 170ms |
| cyberpunk -> swiss | color, radius, border, shadow, font, spacing, motion | 8px | 0px | 1px | 130ms |
| cyberpunk -> dark | color, radius, border, shadow, font, spacing, motion | 2px | 0px | 2px | 30ms |
| cyberpunk -> light | color, radius, border, shadow, font, spacing, motion | 6px | 0px | 4px | 70ms |
| swiss -> dark | color, radius, border, shadow, font, spacing, motion | 10px | 0px | 3px | 100ms |
| swiss -> light | color, radius, border, shadow, font, spacing, motion | 14px | 0px | 5px | 60ms |
| dark -> light | color, radius, border, shadow, font, spacing, motion | 4px | 0px | 2px | 40ms |

## Runtime Persistence Evidence

`src/renderer/hooks/useTheme.test.tsx` verifies two runtime contracts:

- Theme selection mutates document `data-theme`, `data-palette`, and axis datasets before slow font preloading completes.
- Explicit theme choices call `window.devhub.settings.update(...)`, so restart restore uses the persisted appearance state rather than a transient UI-only state.
