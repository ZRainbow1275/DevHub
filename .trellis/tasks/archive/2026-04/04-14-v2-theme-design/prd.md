# Team 5: Theme-Design -- T9 Deep Theme System

## Project Context

DevHub is an Electron desktop app at `devhub/` (electron-vite + React 18 + TypeScript + Zustand + TailwindCSS). There are 5 themes: constructivism, cyberpunk, swiss, modern-light, warm-light. Currently they only differ in colors.

## Scope

Make each of the 5 themes truly distinct in visual design -- not just colors, but also:
- Border radius (square vs rounded vs pill)
- Border styles (thick solid vs thin glow vs dashed)
- Shadows (none vs neon glow vs soft vs warm)
- Fonts (already partially differentiated -- verify)
- Decorations (stripes vs grid lines vs paper texture vs none)
- Animations (hard cut vs smooth vs fade vs bouncy)
- Density (compact vs normal vs spacious)

---

## T9.1 Expand CSS Variable System

Add these NEW variable categories to EACH theme block in `devhub/src/renderer/styles/tokens/theme-tokens.css` (plus relevant tokens files).

```css
[data-theme="<theme>"] {
  /* Existing color vars remain */

  /* === Shape/Radius === */
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;
  --radius-xl: ...;
  --radius-card: ...;
  --radius-button: ...;
  --radius-input: ...;
  --radius-badge: ...;

  /* === Borders === */
  --border-width-default: ...;
  --border-style-default: ...;
  --border-card: ...;
  --border-input: ...;
  --border-button: ...;

  /* === Shadows === */
  --shadow-sm: ...;
  --shadow-md: ...;
  --shadow-lg: ...;
  --shadow-card: ...;
  --shadow-card-hover: ...;
  --shadow-button: ...;

  /* === Spacing/Density === */
  --density-factor: ...;  /* 0.85 compact - 1.15 spacious */
  --spacing-card-padding: ...;
  --spacing-section-gap: ...;

  /* === Animations === */
  --transition-default: ...;
  --transition-fast: ...;
  --animation-card-enter: ...;
  --animation-enabled: ...;  /* 1 or 0 */

  /* === Decorations === */
  --deco-pattern-opacity: ...;
  --deco-pattern-image: ...;  /* url() or none */
}
```

---

## T9.2 Per-Theme Values (AUTHORITATIVE)

### constructivism (default)

```css
--radius-sm: 0px;
--radius-md: 2px;
--radius-lg: 2px;
--radius-xl: 2px;
--radius-card: 2px;
--radius-button: 2px;
--radius-input: 2px;
--radius-badge: 0px;

--border-width-default: 2px;
--border-style-default: solid;
--border-card: 2px solid var(--surface-600);
--border-input: 2px solid var(--surface-600);
--border-button: 2px solid currentColor;

--shadow-sm: none;
--shadow-md: none;
--shadow-lg: none;
--shadow-card: none;
--shadow-card-hover: none;
--shadow-button: none;

--density-factor: 0.9;
--spacing-card-padding: 10px;
--spacing-section-gap: 12px;

--transition-default: none;
--transition-fast: none;
--animation-card-enter: none;
--animation-enabled: 0;

--deco-pattern-opacity: 0.06;
--deco-pattern-image: repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 14px);
```

### cyberpunk

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-card: 8px;
--radius-button: 20px;  /* pill */
--radius-input: 6px;
--radius-badge: 8px;

--border-width-default: 1px;
--border-style-default: solid;
--border-card: 1px solid rgba(0, 255, 255, 0.18);
--border-input: 1px solid rgba(0, 255, 255, 0.25);
--border-button: 1px solid rgba(255, 0, 200, 0.4);

--shadow-sm: 0 0 4px rgba(0, 255, 255, 0.1);
--shadow-md: 0 0 8px rgba(0, 255, 255, 0.15);
--shadow-lg: 0 0 16px rgba(0, 255, 255, 0.2);
--shadow-card: 0 0 12px rgba(0, 255, 255, 0.12), inset 0 0 12px rgba(0, 255, 255, 0.04);
--shadow-card-hover: 0 0 24px rgba(0, 255, 255, 0.25), inset 0 0 20px rgba(0, 255, 255, 0.08);
--shadow-button: 0 0 8px rgba(255, 0, 200, 0.3);

--density-factor: 1.0;
--spacing-card-padding: 14px;
--spacing-section-gap: 16px;

--transition-default: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
--transition-fast: all 0.15s ease-out;
--animation-card-enter: fadeInGlow 0.4s ease-out;
--animation-enabled: 1;

--deco-pattern-opacity: 0.035;
--deco-pattern-image: linear-gradient(rgba(0, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.15) 1px, transparent 1px);
/* grid lines 20px */
```

### swiss

```css
--radius-sm: 0px;
--radius-md: 0px;
--radius-lg: 0px;
--radius-xl: 0px;
--radius-card: 0px;
--radius-button: 0px;
--radius-input: 0px;
--radius-badge: 0px;

--border-width-default: 1px;
--border-style-default: solid;
--border-card: 1px solid #e8e8e8;
--border-input: 1px solid #d0d0d0;
--border-button: 1px solid currentColor;

--shadow-sm: none;
--shadow-md: none;
--shadow-lg: none;
--shadow-card: none;
--shadow-card-hover: none;
--shadow-button: none;

--density-factor: 1.15;  /* spacious */
--spacing-card-padding: 20px;
--spacing-section-gap: 28px;

--transition-default: none;
--transition-fast: none;
--animation-card-enter: none;
--animation-enabled: 0;

--deco-pattern-opacity: 0;
--deco-pattern-image: none;
```

### modern-light

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-card: 16px;
--radius-button: 24px;  /* pill */
--radius-input: 10px;
--radius-badge: 10px;

--border-width-default: 0px;
--border-style-default: none;
--border-card: none;
--border-input: 1px solid rgba(0, 0, 0, 0.08);
--border-button: none;

--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.04);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.04);
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.04);
--shadow-card-hover: 0 6px 20px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.06);
--shadow-button: 0 1px 3px rgba(0, 0, 0, 0.06);

--density-factor: 1.0;
--spacing-card-padding: 14px;
--spacing-section-gap: 18px;

--transition-default: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
--transition-fast: all 0.15s ease-out;
--animation-card-enter: fadeUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
--animation-enabled: 1;

--deco-pattern-opacity: 0;
--deco-pattern-image: radial-gradient(circle at 30% 10%, rgba(var(--accent-rgb, 50, 130, 255), 0.04), transparent 50%);
```

### warm-light

```css
--radius-sm: 3px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 10px;
--radius-card: 6px;
--radius-button: 6px;
--radius-input: 4px;
--radius-badge: 4px;

--border-width-default: 1px;
--border-style-default: dashed;
--border-card: 1px dashed var(--surface-600);
--border-input: 1px solid var(--surface-600);
--border-button: 1px solid var(--surface-700);

--shadow-sm: 0 1px 2px rgba(139, 115, 85, 0.06);
--shadow-md: 0 1px 3px rgba(139, 115, 85, 0.08);
--shadow-lg: 0 4px 8px rgba(139, 115, 85, 0.1);
--shadow-card: 0 1px 3px rgba(139, 115, 85, 0.08);
--shadow-card-hover: 0 2px 6px rgba(139, 115, 85, 0.12);
--shadow-button: 0 1px 2px rgba(139, 115, 85, 0.08);

--density-factor: 1.05;
--spacing-card-padding: 14px;
--spacing-section-gap: 16px;

--transition-default: all 0.35s ease-out;
--transition-fast: all 0.2s ease;
--animation-card-enter: fadeIn 0.4s ease-out;
--animation-enabled: 1;

--deco-pattern-opacity: 0.025;
--deco-pattern-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' type='fractalNoise'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.3'/%3E%3C/svg%3E");
/* paper texture */
```

---

## T9.3 Create Utility Classes

Add new utility classes in `devhub/src/renderer/styles/globals.css`:

```css
/* Radius utilities using theme variables */
.radius-sm { border-radius: var(--radius-sm); }
.radius-md { border-radius: var(--radius-md); }
.radius-lg { border-radius: var(--radius-lg); }
.radius-xl { border-radius: var(--radius-xl); }
.radius-card { border-radius: var(--radius-card); }
.radius-button { border-radius: var(--radius-button); }
.radius-input { border-radius: var(--radius-input); }
.radius-badge { border-radius: var(--radius-badge); }

/* Shadow utilities */
.shadow-card { box-shadow: var(--shadow-card); }
.shadow-card-hover:hover { box-shadow: var(--shadow-card-hover); }
.shadow-md-t { box-shadow: var(--shadow-md); }

/* Border utilities */
.border-card { border: var(--border-card); }
.border-input-t { border: var(--border-input); }

/* Transition utilities */
.transition-t { transition: var(--transition-default); }
.transition-t-fast { transition: var(--transition-fast); }
```

---

## T9.4 Systematic Replacement

Many components have `style={{ borderRadius: '2px' }}` inline. Replace systematically:

Search for the pattern `style={{ borderRadius: '2px' }}` -> replace with `className="... radius-sm"` (merge with existing className).
Similarly for `borderRadius: '1px'` -> `.radius-badge` or similar.
Similarly for `borderRadius: '4px'` -> `.radius-sm`.

DO NOT break existing className composition. Use template literals or classnames helper.

Files to scan (limit to these to avoid clobbering other teams' work):
- `devhub/src/renderer/components/ui/*.tsx` (safe)
- `devhub/src/renderer/styles/**/*.css` (safe)
- `devhub/src/renderer/styles/globals.css` (safe)
- `devhub/src/renderer/components/icons/index.tsx` (safe, icons)

DO NOT touch:
- `monitor/*.tsx` (Teams 1, 2, 3 own these)
- `project/*.tsx` (Team 4 owns)
- `layout/Sidebar.tsx`, `layout/StatusBar.tsx`, `layout/TitleBar.tsx` (Team 4 owns Sidebar)
- `settings/SettingsDialog.tsx` (Team 4 owns density)

Instead, update only shared `ui/` utilities and global CSS. The class-based approach means other teams' components automatically pick up new theme variables once they use `.radius-card`, `.shadow-card`, etc.

---

## T9.5 SettingsDialog Theme Preview Enhancement

The settings dialog already has theme selection. Enhance with:
- Mini preview card per theme (80x50px)
- Shows: mini color swatch, sample text in theme font, sample card shape
- Active theme has highlighted border
- Clicking the preview directly sets the theme

**NOTE**: Team 4 also modifies SettingsDialog (for density toggle). Coordinate via additive changes:
- Team 4: adds density dropdown to a new section
- Team 5: enhances existing theme picker with visual previews
- Neither should delete the other's additions when merging

---

## T9.6 Decorations Component Update

In `devhub/src/renderer/components/ui/DecorationSet.tsx` and `ThemeDecoration.tsx`:

- Use `var(--deco-pattern-image)` and `var(--deco-pattern-opacity)` from theme variables
- These auto-adapt to active theme
- No hardcoded patterns in components

---

## Acceptance Criteria

- [ ] 5 themes visually distinct in shape, border, shadow, density, animation, decoration (not just color)
- [ ] All new CSS variables defined in every theme block
- [ ] Global utility classes available and used by ui/ components
- [ ] Inline `style={{ borderRadius }}` in shared `ui/` components replaced with utility classes
- [ ] Theme preview cards in SettingsDialog
- [ ] Theme switch smooth, no missing variable errors in console
- [ ] `tsc --noEmit` passes
- [ ] No deletion of existing theme colors

---

## Critical Rules

- **NO deletion** of existing theme variables or components
- **NO emoji icons**
- **ONLY ADD** new variables per theme, never remove existing
- **DO NOT touch files owned by Teams 1-4** (see T9.4 restrictions)
- Run `cd devhub && npx tsc --noEmit` before completing

## Files In Scope

### CSS (primary)
- `devhub/src/renderer/styles/tokens/theme-tokens.css` -- MAIN variable additions
- `devhub/src/renderer/styles/tokens/colors.css` -- verify structure
- `devhub/src/renderer/styles/tokens/typography.css` -- verify
- `devhub/src/renderer/styles/tokens/animations.css` -- add theme-specific keyframes if needed
- `devhub/src/renderer/styles/globals.css` -- add utility classes
- `devhub/src/renderer/styles/components/*.css` -- if they exist, use variables

### Components
- `devhub/src/renderer/components/ui/DecorationSet.tsx` -- use theme vars
- `devhub/src/renderer/components/ui/ThemeDecoration.tsx` -- use theme vars
- `devhub/src/renderer/components/ui/Toast.tsx`, `LoadingSpinner.tsx`, etc. (systematic inline-style replacement)

### Hooks/Utils
- `devhub/src/renderer/hooks/useTheme.ts` -- verify no breakage
- `devhub/src/renderer/utils/theme-tokens.ts` -- JS accessor update if needed

## Out of Scope

- All backend files (main/, preload/)
- ProcessDetailPanel, PortFocusPanel, WindowView (Teams 1, 2)
- TopologyView, NeuralGraph, PortRelationshipGraph (Team 3)
- ProjectCard, ProjectList, ProjectDetailPanel, Sidebar, HeroStats (Team 4)
- Any file in `monitor/` subdirectory (Teams 1, 2, 3)
- `project/*.tsx` (Team 4)
- `layout/Sidebar.tsx` (Team 4)
