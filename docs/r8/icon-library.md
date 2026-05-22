# R8.B Icon Library

Date: 2026-05-06

## Purpose

R8.B uses a token-based icon layer so renderer code can reference icons through stable strings instead of scattered inline SVG, ad-hoc imports, or emoji-like visual fallbacks. The implementation is intentionally explicit: every supported icon is individually imported and registered to preserve tree-shaking and make missing tokens fail into a visible fallback.

## Token Contract

Tokens use the shared `IconLibrary:name` format validated by `ICON_TOKEN_REGEX` in `src/shared/icon-library.ts`.

Examples:

- `lucide:Search`
- `tabler:Box`
- `radix:Cross1`
- `heroicons:Bell`
- `brand:OpenAI`

Invalid tokens and unknown icon names resolve to `lucide:HelpCircle`. The fallback is visible through `data-icon-available="false"`, `data-icon-requested-token`, and `data-icon-fallback-token`.

## Library Boundaries

The approved library boundaries are source-of-truth constants in `src/shared/icon-library.ts`.

| Library | Boundary |
|---|---|
| `lucide` | Product actions, toolbar icons, cards, statusbar, and monitor controls. |
| `tabler` | Settings, detailed forms, decoration controls, and secondary technical surfaces. |
| `radix` | Primitive UI internals such as cmdk, dialog chrome, chevrons, crosses, and dots. |
| `heroicons` | Marketing-scale hero icons, empty states, and large explanatory surfaces. |
| `brand` | Official AI tool and platform logos through simple-icons or vetted local SVG assets. |

## Renderer Components

- `src/renderer/components/icon/Icon.tsx` renders an accessible wrapper and resolves tokens through the renderer registry.
- `src/renderer/components/icon/IconResolver.ts` performs token parsing and fallback resolution.
- `src/renderer/components/icon/registry.tsx` maps each approved token to an explicitly imported component or vetted asset.
- `src/renderer/components/icon/BrandLogo.tsx` is a narrow wrapper for `brand:*` tokens.
- `src/renderer/components/icon/useIcon.ts` memoizes token resolution and exposes `useIconDefaults`.

## Theme Axis Defaults

`useIconDefaults` reads the existing document theme axes instead of introducing a parallel settings store:

- `data-density="compact"` maps default icons to `14px`; `standard` maps to `16px`; `comfortable` maps to `20px`.
- `data-radius-family="sharp"` maps default strokes to `2`; `soft` maps to `1.5`; `round` maps to `1.35`.
- `data-motion-level` maps icons to deterministic transition classes: `transition-none`, `transition-colors`, or `transition-all duration-200`.

Explicit `size` and `strokeWidth` props still win, so existing call sites keep their current dimensions unless they opt into theme-derived defaults by omitting those props.

The command palette is the first integrated UI slice: `src/renderer/components/command/R8CommandPalette.tsx` now renders `lucide:Search` and `lucide:Terminal` through the shared `Icon` component.

`src/renderer/components/icons/AIToolBrandLogo.tsx` keeps the existing AI sensing component API while routing the core tool identities through icon-library brand tokens:

- `codex` -> `brand:OpenAI`
- `claude-code` -> `brand:Claude`
- `gemini-cli` -> `brand:GoogleGemini`

Tool logos without a registered `brand:*` token keep their existing vetted local asset or simple-icons path until the registry adds a matching token.

## Accessibility Rules

Decorative icons must be hidden from assistive technology:

```tsx
<Icon token="lucide:Search" decorative />
```

Semantic icons must provide a label:

```tsx
<Icon token="heroicons:InformationCircle" decorative={false} label="Runtime information" />
```

The wrapper owns `role="img"` and `aria-label` for semantic icons. The child SVG or asset remains hidden from assistive technology so screen readers announce the intended label instead of library-specific SVG internals.

This follows the current guidance checked during implementation: decorative icons should use `aria-hidden`, icon-only/semantic affordances need an accessible name, and explicit named imports keep icon libraries tree-shakeable.

## No Emoji Policy

Emoji are not accepted as UI icons because they vary by operating system, are hard to theme, can be announced inconsistently by screen readers, and bypass the product's token/theme contract. The `check:no-emoji` script is wired before `eslint` in `package.json`, so `pnpm lint` fails before normal linting when emoji code points are introduced.

## Main Process And IPC

The main-process service exposes token metadata without loading renderer libraries:

- `src/main/services/IconRegistryService.ts`
- `src/main/ipc/iconHandlers.ts`
- `icon:list-libraries`
- `icon:resolve-token`

The preload bridge exposes:

- `window.devhub.r8.icon.listLibraries()`
- `window.devhub.r8.icon.resolveToken(token)`

All responses are parsed by Zod schemas in `src/shared/schemas/r8-runtime.ts`.

## Verification

Targeted verification passed for this slice:

```bash
pnpm -C devhub test --run src/main/services/IconRegistryService.test.ts src/renderer/components/icon/Icon.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx --maxWorkers=1
pnpm -C devhub test --run src/renderer/components/icons/AIToolBrandLogo.test.tsx src/renderer/components/icon/Icon.test.tsx --maxWorkers=1
pnpm -C devhub test --run src/renderer/components/icon/Icon.test.tsx --maxWorkers=1
pnpm -C devhub bench:icons
pnpm -C devhub typecheck
pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
git -C devhub diff --check
git diff --check
```

Results:

- Targeted icon tests: 3 files passed, 9 tests passed.
- Current targeted icon defaults tests: 3 files passed, 12 tests passed.
- Current AI brand-token tests: 2 files passed, 18 tests passed.
- Current icon component benchmark tests: 1 file passed, 8 tests passed; mixed token static render stays below the 1ms/icon budget.
- Icon bundle proof: `bench:icons` builds the renderer registry through Vite library mode with React externalized, rejects namespace imports from the approved icon libraries, and measured 56,454 raw bytes / 13,891 gzip bytes against the 200KB budget.
- TypeScript typecheck: passed.
- Preload contract tests: 1 file passed, 4 tests passed.
- Lint: passed, including `No emoji found in 596 files`.
- UI no-emoji acceptance: `pnpm -C devhub check:no-emoji` passed across the current DevHub scan set.
- Zod SoT verification: passed.
- Trellis context validation: passed.
- Diff whitespace checks: passed; Git printed existing LF-to-CRLF warnings only.

## Completion Boundary

- Remaining renderer `<svg>` inventory is graphing, visualization, sparkline, chart, or decorative theme art and is not treated as an icon-token migration gap.
- AI tools without a registered `brand:*` token retain existing vetted local assets or simple-icons paths until a matching official token is added.
- Spec-17 is considered verified for the current R8 scope after unit tests, Electron E2E, no-emoji guard, bundle proof, and render benchmark evidence.
