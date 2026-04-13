# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

### Convention: Theme-Aware Utility Classes for Shape/Shadow/Motion

**What**: When applying border-radius, box-shadow, border, or transition to a component,
prefer the project's theme-aware utility classes over hardcoded `style={{ borderRadius: 'Npx' }}`
so the value automatically adapts to the active theme.

**Why**: The project ships 5+ themes (constructivism / cyberpunk / swiss / modern-light /
warm-light / dark / light). Each theme sets its own per-token values for `--radius-card`,
`--shadow-card`, `--transition-default`, etc. Hardcoding `borderRadius: '2px'` freezes a
component to constructivism visuals and prevents the theme system from taking effect.

**Utility classes** (defined in `src/renderer/styles/globals.css`):

| Use case | Class | CSS var |
|----------|-------|---------|
| Card shape | `radius-card` | `var(--radius-card)` |
| Button shape | `radius-button` | `var(--radius-button)` |
| Input shape | `radius-input` | `var(--radius-input)` |
| Badge shape | `radius-badge` | `var(--radius-badge)` |
| Small / medium / large / xl shape | `radius-sm` / `radius-md` / `radius-lg` / `radius-xl` | `var(--radius-*)` |
| Theme shadow tiers | `shadow-t-sm` / `shadow-t-md` / `shadow-t-lg` | `var(--shadow-*)` |
| Theme card shadow | `shadow-t-card` (+ `shadow-t-card-hover` on hover) | `var(--shadow-card[-hover])` |
| Theme borders | `border-t-card` / `border-t-input` / `border-t-button` | `var(--border-*)` |
| Theme transitions | `transition-t` / `transition-t-fast` | `var(--transition-*)` |
| Theme-aware enter animation | `card-enter-t` | `var(--animation-card-enter)` |
| Spacing (theme scalar) | `pad-t-card` / `gap-t-section` | `var(--spacing-*)` |

**Example**:
```tsx
// Good - adapts to active theme (square in swiss, rounded in cyberpunk, pill in modern-light)
<div className="bg-surface-800 border-2 border-surface-600 radius-card p-4">
  <button className="px-4 py-2 bg-accent text-white radius-button">Submit</button>
</div>

// Bad - locked to constructivism aesthetics, ignores theme system
<div style={{ borderRadius: '2px' }} className="bg-surface-800 border-2 p-4">
  <button style={{ borderRadius: '2px' }}>Submit</button>
</div>
```

**When it's OK to use explicit `borderRadius` inline style**:

1. Mini-preview surfaces that intentionally render "another theme" (e.g. the theme picker
   in `SettingsDialog.tsx` uses `sampleShape` from a `ThemeDescriptor` to preview each
   theme's shape without inheriting the currently active theme).
2. When the value comes from a CSS variable itself, e.g.
   `style={{ borderRadius: 'var(--radius-sm)' }}` — that already resolves per-theme.

**Related files**:
- `src/renderer/styles/tokens/theme-tokens.css` — source of per-theme token values
- `src/renderer/styles/globals.css` — utility class definitions (T9 section)
- `src/renderer/components/ui/ThemeDecoration.tsx` — reference consumer using `var(--deco-pattern-*)`

### Pattern: Theme Decoration via CSS Variables + React Extras

**Problem**: Each theme needs a unique ambient background (stripes, grid, paper noise, ...).
Doing this with a big `switch (theme)` in React forces every decoration change to touch TSX.

**Solution**: Expose the decoration as CSS variables (`--deco-pattern-image`,
`--deco-pattern-opacity`, `--deco-background-size`) in each `[data-theme="..."]` block. The
shared React component renders one `BasePatternLayer` that consumes those variables, and
only truly code-bound effects (e.g. animated scanline sweep, accent corner triangle) live
as per-theme "Extras" components keyed off `theme`.

**Example** (from `ThemeDecoration.tsx`):
```tsx
const BasePatternLayer: React.FC = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      opacity: 'var(--deco-pattern-opacity, 0)',
      backgroundImage: 'var(--deco-pattern-image, none)',
      backgroundSize: 'var(--deco-background-size, auto)',
    }}
    aria-hidden="true"
  />
)

const EXTRAS_MAP: Partial<Record<ThemeName, React.FC>> = {
  constructivism: SovietExtras,    // corner triangle
  cyberpunk: CyberpunkExtras,      // animated scanline
  // swiss/modern-light/warm-light use base pattern only
}
```

**Why**: Adding a new theme requires zero code changes to `ThemeDecoration.tsx` — you only
define the CSS variables. Extras are opt-in for motion / clipped shapes that CSS alone
cannot express cleanly.

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)
